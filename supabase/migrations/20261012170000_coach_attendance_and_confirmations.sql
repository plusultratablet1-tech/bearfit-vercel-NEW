-- BearFit coach shift confirmation and on-site proof-of-presence, Philippine time.
-- Does not grant coaches staff/admin permissions or touch member balances.
-- Member QR deductions and payable conduction creation remain disabled for coach role.

create table public.coach_work_shifts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete restrict,
  branch text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  response text not null default 'pending' check (response in ('pending','confirmed','unavailable')),
  response_at timestamptz,
  unavailable_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint coach_shift_duration check (
    ends_at>starts_at and ends_at<=starts_at+interval '18 hours'
  ),
  constraint coach_shift_response_fields check (
    (response='pending' and response_at is null and unavailable_reason is null)
    or (response='confirmed' and response_at is not null and unavailable_reason is null)
    or (response='unavailable' and response_at is not null and char_length(btrim(coalesce(unavailable_reason,''))) between 5 and 500)
  )
);
create index coach_work_shifts_time_idx on public.coach_work_shifts(starts_at,coach_id);
create index coach_work_shifts_coach_idx on public.coach_work_shifts(coach_id,starts_at);

alter table public.coach_shifts add column work_shift_id uuid unique references public.coach_work_shifts(id) on delete restrict;

-- 12-char unpredictable short-lived branch codes; only hashes are persisted.
create table public.coach_attendance_codes (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  code_hash text not null,
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint coach_attendance_code_ttl check (expires_at <= issued_at + interval '2 minutes')
);
create index coach_attendance_codes_lookup on public.coach_attendance_codes(branch,expires_at desc);

create table public.coach_work_shift_events (
  id uuid primary key default gen_random_uuid(),
  work_shift_id uuid not null references public.coach_work_shifts(id) on delete restrict,
  action text not null check (action in ('planned','confirmed','unavailable')),
  actor_id uuid not null references auth.users(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

-- Only admin/staff read schedule and attendance; coaches use restricted RPCs only.
alter table public.coach_work_shifts enable row level security;
alter table public.coach_attendance_codes enable row level security;
alter table public.coach_work_shift_events enable row level security;

create policy coach_work_shifts_admin_read on public.coach_work_shifts for select to authenticated
 using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','staff')));
create policy coach_work_shift_events_admin_read on public.coach_work_shift_events for select to authenticated
 using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','staff')));

revoke all on table public.coach_work_shifts,public.coach_attendance_codes,public.coach_work_shift_events
 from public,anon,authenticated;
grant select on table public.coach_work_shifts,public.coach_work_shift_events to authenticated;
-- Existing coach_shifts RLS grants admin SELECT only; coaches never receive table-level writes.

create or replace function public.admin_plan_coach_shift(
 p_coach_id uuid,p_starts_at timestamptz,p_ends_at timestamptz
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_coach public.coaches%rowtype; v_id uuid;
begin
 if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
 then raise exception 'Admin access required'; end if;
 select * into v_coach from public.coaches where id=p_coach_id and is_active for update;
 if not found then raise exception 'Active coach not found'; end if;
 if p_starts_at is null or p_ends_at is null
    or p_starts_at<now() + interval '5 minutes'
    or p_starts_at>now()+interval '90 days'
    or p_ends_at<=p_starts_at
    or p_ends_at>p_starts_at+interval '18 hours'
 then raise exception 'Shift must be in the next 90 days and at most 18 hours'; end if;
 -- Serialize concurrent requests for the same coach; no overlapping shifts.
 perform pg_advisory_xact_lock(hashtextextended(v_coach.id::text,3));
 if exists(select 1 from public.coach_work_shifts s
     where s.coach_id=p_coach_id and tstzrange(s.starts_at,s.ends_at,'[)') &&
      tstzrange(p_starts_at,p_ends_at,'[)'))
 then raise exception 'This coach already has an overlapping shift'; end if;
 insert into public.coach_work_shifts(coach_id,branch,starts_at,ends_at,created_by)
 values(p_coach_id,v_coach.branch,p_starts_at,p_ends_at,(select auth.uid()))
 returning id into v_id;
 insert into public.coach_work_shift_events(work_shift_id,action,actor_id)
 values(v_id,'planned',(select auth.uid()));
 return v_id;
end; $$;

create or replace function public.coach_respond_to_shift(
 p_work_shift_id uuid,p_response text,p_reason text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_shift public.coach_work_shifts%rowtype; v_coach public.coaches%rowtype;
 v_deadline timestamptz; v_late boolean;
begin
 if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='coach')
 then raise exception 'Coach login required'; end if;
 select * into v_coach from public.coaches where user_id=(select auth.uid()) and is_active;
 if not found then raise exception 'Active coach account not linked'; end if;
 select * into v_shift from public.coach_work_shifts where id=p_work_shift_id and coach_id=v_coach.id for update;
 if not found then raise exception 'This shift does not belong to your account'; end if;
 if v_shift.starts_at<=now() then raise exception 'Shift has already started. Ask Admin to record an exception'; end if;
 if p_response not in ('confirmed','unavailable') or p_response is null
 then raise exception 'Choose confirmed or unavailable'; end if;
 if p_response='unavailable' and char_length(btrim(coalesce(p_reason,''))) not between 5 and 500
 then raise exception 'Please give a reason (5-500 characters)'; end if;
 -- 8 PM Manila the evening before the scheduled shift's Manila date.
 v_deadline:=(((v_shift.starts_at at time zone 'Asia/Manila')::date - 1)
               + time '20:00') at time zone 'Asia/Manila';
 v_late:=now()>v_deadline;
 if v_shift.response<>'pending' and v_shift.response=p_response
 then return jsonb_build_object('response',v_shift.response,'already_recorded',true,'late',coalesce(v_shift.response_at>v_deadline,false)); end if;
 update public.coach_work_shifts set response=p_response,response_at=now(),
   unavailable_reason=case when p_response='unavailable' then btrim(p_reason) else null end
 where id=v_shift.id;
 insert into public.coach_work_shift_events(work_shift_id,action,actor_id,details)
 values(v_shift.id,p_response,(select auth.uid()),
   jsonb_build_object('late',v_late,'reason',case when p_response='unavailable' then btrim(p_reason) else null end));
 return jsonb_build_object('response',p_response,'late',v_late,'deadline',v_deadline,'already_recorded',false);
end; $$;

-- An authorized on-site Admin/Staff shows the rotating code at reception.
create or replace function public.issue_coach_branch_code(p_branch text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_role text;v_branch text;v_code text;v_exp timestamptz;
begin
 select role,branch into v_role,v_branch from public.profiles where id=(select auth.uid());
 if v_role not in ('admin','staff') or v_role is null then raise exception 'Staff/Admin required'; end if;
 if p_branch not in ('Malingap Branch','E. Rodriguez Branch') or p_branch is null
 then raise exception 'Unknown branch'; end if;
 if v_role='staff' and v_branch<>p_branch then raise exception 'Wrong staff branch'; end if;
 v_code:=upper(encode(extensions.gen_random_bytes(6),'hex'));
 v_exp:=now()+interval '2 minutes';
 insert into public.coach_attendance_codes(branch,code_hash,issued_by,expires_at)
 values(p_branch,encode(extensions.digest(v_code,'sha256'),'hex'),(select auth.uid()),v_exp);
 return jsonb_build_object('code',v_code,'expires_at',v_exp,'branch',p_branch);
end; $$;

-- A coach must have their own linked account, a planned shift, and a valid
-- time-limited code from the correct branch. No device-clock input is accepted.
create or replace function public.coach_verified_time_punch(
 p_work_shift_id uuid,p_code text,p_action text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_coach public.coaches%rowtype; v_work public.coach_work_shifts%rowtype;
 v_shift public.coach_shifts%rowtype; v_hash text; v_time timestamptz := now();
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='coach')
 then raise exception 'Coach login required'; end if;
 select * into v_coach from public.coaches where user_id=(select auth.uid()) and is_active for update;
 if not found then raise exception 'Active coach link not found'; end if;
 if p_action not in ('in','out') or p_action is null then raise exception 'Invalid time punch'; end if;
 select * into v_work from public.coach_work_shifts where id=p_work_shift_id and coach_id=v_coach.id for update;
 if not found then raise exception 'No assigned work shift'; end if;
 if v_work.response='unavailable' then raise exception 'Shift marked unavailable. Ask Admin to resolve'; end if;
 if p_code is null or p_code !~ '^[0-9A-Fa-f]{12}$' then raise exception 'Enter the 12-character branch code'; end if;
 v_hash:=encode(extensions.digest(upper(p_code),'sha256'),'hex');
 if not exists(select 1 from public.coach_attendance_codes t
               where t.branch=v_work.branch and t.code_hash=v_hash and t.expires_at>v_time
                 and t.issued_at<=v_time)
 then raise exception 'Branch code expired or incorrect'; end if;
 if p_action='in' then
   if v_time<v_work.starts_at-interval '2 hours' or v_time>v_work.ends_at
   then raise exception 'Outside assigned shift clock-in window'; end if;
   if exists(select 1 from public.coach_shifts s where s.coach_id=v_coach.id and s.clock_out_at is null)
   then raise exception 'Already clocked in. Clock out of the open shift first'; end if;
   insert into public.coach_shifts(coach_id,branch,clock_in_at,recorded_by,work_shift_id)
    values(v_coach.id,v_work.branch,v_time,(select auth.uid()),v_work.id)
    returning * into v_shift;
 else
   select * into v_shift from public.coach_shifts
    where work_shift_id=v_work.id and coach_id=v_coach.id for update;
   if not found or v_shift.clock_out_at is not null then raise exception 'No open verified time-in for this shift'; end if;
   if v_time>v_shift.clock_in_at+interval '24 hours' then raise exception 'Shift is overdue; ask Admin to resolve'; end if;
   update public.coach_shifts set clock_out_at=v_time where id=v_shift.id returning * into v_shift;
 end if;
 return jsonb_build_object('action',p_action,'coach_id',v_coach.id,'branch',v_work.branch,
   'clock_in_at',v_shift.clock_in_at,'clock_out_at',v_shift.clock_out_at,'verified',true);
end; $$;

-- Coach sees only their own shifts/bookings/conductions; never rates or other coach data.
create or replace function public.coach_operational_dashboard()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_coach public.coaches%rowtype; v_shifts jsonb;v_bookings jsonb;v_conductions jsonb;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='coach')
 then raise exception 'Coach login required'; end if;
 select * into v_coach from public.coaches where user_id=(select auth.uid()) and is_active;
 if not found then raise exception 'Active coach login not linked'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
    'id',w.id,'starts_at',w.starts_at,'ends_at',w.ends_at,'branch',w.branch,
    'response',w.response,'response_at',w.response_at,'reason',w.unavailable_reason,
    'clock_in_at',s.clock_in_at,'clock_out_at',s.clock_out_at
  ) order by w.starts_at),'[]'::jsonb) into v_shifts
 from public.coach_work_shifts w
 left join public.coach_shifts s on s.work_shift_id=w.id
 where w.coach_id=v_coach.id
   and w.ends_at>now()-interval '8 days'
   and w.starts_at<now()+interval '35 days';

 select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'start_at',b.start_at,'end_at',b.end_at,
    'branch',b.branch,'session_type',b.session_type,'session_label',b.session_label,
    'member_name',m.full_name,'member_code',m.member_code,'status',b.status
 ) order by b.start_at),'[]'::jsonb) into v_bookings
 from public.bookings b join public.members m on m.id=b.member_id
 where b.assigned_coach_user_id=v_coach.user_id
  and b.branch=v_coach.branch and b.status in ('confirmed','completed','no_show')
  and b.start_at>now()-interval '8 days' and b.start_at<now()+interval '35 days';

 select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'session_date',c.session_date,'status',c.status,'member_name',m.full_name
  ) order by c.session_date desc),'[]'::jsonb) into v_conductions
 from public.coach_conductions c join public.members m on m.id=c.member_id
 where c.coach_id=v_coach.id and c.session_date >= (now() at time zone 'Asia/Manila')::date-31;
 return jsonb_build_object('coach_id',v_coach.id,'name',v_coach.display_name,'username',v_coach.username,
   'branch',v_coach.branch,'shifts',v_shifts,'bookings',v_bookings,'conductions',v_conductions);
end; $$;

-- Coach QR lookup is deliberately READ-ONLY: cannot deduct packages.
-- Restrict member details to currently valid confirmed bookings assigned to the linked coach.
create or replace function public.coach_member_qr_preview(p_member_code text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_coach public.coaches%rowtype;v_member public.members%rowtype;v_booking public.bookings%rowtype;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='coach')
 then raise exception 'Coach login required'; end if;
 select * into v_coach from public.coaches where user_id=(select auth.uid()) and is_active;
 if not found then raise exception 'Active coach login not linked'; end if;
 select * into v_member from public.members where upper(member_code)=upper(btrim(p_member_code));
 if not found then raise exception 'No assigned active booking for this member'; end if;
 select * into v_booking from public.bookings b where b.member_id=v_member.id
  and b.assigned_coach_user_id=v_coach.user_id and b.branch=v_coach.branch
  and b.status='confirmed' and b.start_at is not null and b.end_at is not null
  and now() between b.start_at - interval '2 hours' and b.end_at + interval '2 hours'
  order by b.start_at limit 1;
 if not found then raise exception 'No assigned active booking for this member'; end if;
 return jsonb_build_object('member_name',v_member.full_name,'member_code',v_member.member_code,
  'booking_id',v_booking.id,'start_at',v_booking.start_at,'end_at',v_booking.end_at,
  'branch',v_booking.branch,'session_label',v_booking.session_label,
  'note','Preview only. Check-in requires authorized staff verification.');
end; $$;

revoke all on function public.admin_plan_coach_shift(uuid,timestamptz,timestamptz) from public,anon;
revoke all on function public.coach_respond_to_shift(uuid,text,text) from public,anon;
revoke all on function public.issue_coach_branch_code(text) from public,anon;
revoke all on function public.coach_verified_time_punch(uuid,text,text) from public,anon;
revoke all on function public.coach_operational_dashboard() from public,anon;
revoke all on function public.coach_member_qr_preview(text) from public,anon;
grant execute on function public.admin_plan_coach_shift(uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.coach_respond_to_shift(uuid,text,text) to authenticated;
grant execute on function public.issue_coach_branch_code(text) to authenticated;
grant execute on function public.coach_verified_time_punch(uuid,text,text) to authenticated;
grant execute on function public.coach_operational_dashboard() to authenticated;
grant execute on function public.coach_member_qr_preview(text) to authenticated;
