-- BearFit member month calendar and coach-scoped S&C / Cardio capacity.
-- Additive metadata only. Existing member, attendance, payroll and booking rows stay unchanged.
alter table public.coaches
  add column if not exists scheduling_specialization text not null default 'strength_conditioning'
  check (scheduling_specialization in ('strength_conditioning','cardio'));

create or replace function public.admin_set_coach_scheduling_specialization(
  p_coach_id uuid,p_specialization text
) returns void language plpgsql security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'
  ) then raise exception 'Admin access required'; end if;
  if p_specialization not in ('strength_conditioning','cardio') then raise exception 'Invalid specialization'; end if;
  update public.coaches set scheduling_specialization=p_specialization,updated_at=now()
    where id=p_coach_id and is_active and user_id is not null;
  if not found then raise exception 'Active linked coach not found'; end if;
end; $$;
revoke all on function public.admin_set_coach_scheduling_specialization(uuid,text) from public,anon;
grant execute on function public.admin_set_coach_scheduling_specialization(uuid,text) to authenticated;

-- Source-of-truth validation; a coach can be a cardio specialist or S&C, not both simultaneously.
create or replace function private.validate_coach_training_slot()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.session_label in ('Strength & Conditioning','Cardio') then
    if new.coach_user_id is null then raise exception 'Choose a coach for this training type'; end if;
    if new.capacity > case when new.session_label='Cardio' then 1 else 3 end then
      raise exception 'Capacity exceeds the coach limit'; end if;
    if not exists (
      select 1 from public.coaches c where c.user_id=new.coach_user_id
        and c.is_active and not coalesce(c.is_demo,false) and c.branch=new.branch
        and c.scheduling_specialization=case when new.session_label='Cardio' then 'cardio' else 'strength_conditioning' end
    ) then raise exception 'Coach specialization or branch does not match the session'; end if;
  end if;
  return new;
end; $$;

drop trigger if exists validate_coach_training_slot on public.schedule_slots;
create trigger validate_coach_training_slot before insert or update of coach_user_id,branch,session_label,capacity
  on public.schedule_slots for each row execute function private.validate_coach_training_slot();

drop trigger if exists validate_coach_training_rule on public.availability_rules;
create trigger validate_coach_training_rule before insert or update of coach_user_id,branch,session_label,capacity
  on public.availability_rules for each row execute function private.validate_coach_training_slot();

-- Return only the current member's home-branch availability and aggregate occupancy;
-- no other member's name, package or identity is included.
create or replace function public.member_calendar_slots(p_month date)
returns table(
  id uuid,coach_user_id uuid,coach_name text,branch text,session_type text,
  session_label text,start_at timestamptz,end_at timestamptz,
  capacity integer,booked integer,remaining integer
) language sql stable security definer set search_path=''
as $$
select s.id,s.coach_user_id,c.display_name,s.branch,s.session_type,s.session_label,
  s.start_at,s.end_at,
  least(s.capacity,case when s.session_label='Cardio' then 1 when s.session_label='Strength & Conditioning' then 3 else s.capacity end)::integer,
  coalesce(occupied.n,0)::integer,
  greatest(0,least(
    s.capacity-coalesce(same_slot.n,0),
    case when s.session_label='Cardio' then 1 when s.session_label='Strength & Conditioning' then 3 else 1 end
      -coalesce(occupied.n,0),
    case when coalesce(occupied.other_type,false) then 0 else 999 end
  ))::integer
from public.schedule_slots s
join public.members m on m.user_id=(select auth.uid()) and m.branch=s.branch
join public.coaches c on c.user_id=s.coach_user_id and c.is_active and not coalesce(c.is_demo,false)
  and c.branch=s.branch
left join lateral (
  select count(*)::integer as n from public.bookings b
    where b.slot_id=s.id and b.status='confirmed'
) same_slot on true
left join lateral (
  select count(*)::integer as n,
    coalesce(bool_or(b.session_label is distinct from s.session_label),false) as other_type
  from public.bookings b where b.assigned_coach_user_id=s.coach_user_id
    and b.status='confirmed' and b.start_at<s.end_at and b.end_at>s.start_at
) occupied on true
where (select auth.uid()) is not null
  and p_month is not null
  and s.status='open' and s.start_at>=now()
  and s.start_at >= date_trunc('month',p_month::timestamp) at time zone 'Asia/Manila'
  and s.start_at < (date_trunc('month',p_month::timestamp)+interval '1 month') at time zone 'Asia/Manila'
  and (s.session_label not in ('Strength & Conditioning','Cardio') or
    c.scheduling_specialization=case when s.session_label='Cardio' then 'cardio' else 'strength_conditioning' end)
order by s.start_at,c.display_name,s.id
limit 500;
$$;
revoke all on function public.member_calendar_slots(date) from public,anon;
grant execute on function public.member_calendar_slots(date) to authenticated;

-- Existing confirmation's package checks, slot occupancy and admin flow are retained.
create or replace function private.confirm_booking_core(
  p_booking_id uuid,p_slot_id uuid default null,p_assigned_coach_user_id uuid default null,p_require_pending boolean default true
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_booking public.bookings%rowtype;
  v_member public.members%rowtype;
  v_slot public.schedule_slots%rowtype;
  v_slot_id uuid;
  v_coach uuid;
  v_elig jsonb;
  v_member_package uuid;
  v_sessions_left integer;
  v_confirmed_count integer;
  v_future_confirmed integer;
  v_duration integer;
begin
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if p_require_pending and v_booking.status<>'pending' then raise exception 'Booking is no longer pending'; end if;
  select * into v_member from public.members where id=v_booking.member_id;

  v_slot_id:=coalesce(p_slot_id,v_booking.slot_id);
  if v_slot_id is null then
    v_coach:=coalesce(p_assigned_coach_user_id,v_booking.requested_coach_user_id);
    if v_coach is null then raise exception 'Assign a coach before confirming a custom request'; end if;
    v_duration:=v_booking.requested_duration_minutes;
    insert into public.schedule_slots(coach_user_id,branch,session_type,session_label,start_at,end_at,capacity,status,created_by)
    values(v_coach,v_booking.branch,v_booking.session_type,v_booking.session_label,v_booking.requested_start_at,v_booking.requested_start_at+make_interval(mins=>v_duration),1,'open',(select auth.uid()))
    returning id into v_slot_id;
  end if;

  select * into v_slot from public.schedule_slots where id=v_slot_id for update;
  if not found or v_slot.status<>'open' then raise exception 'Slot is not open'; end if;
  if v_booking.request_kind in ('slot','custom') and v_member.branch<>v_slot.branch then raise exception 'Member branch does not match slot branch'; end if;
  if v_booking.session_type<>v_slot.session_type then raise exception 'Booking/package service does not match slot'; end if;
  if v_booking.session_label is not null and v_slot.session_label is not null and v_booking.session_label<>v_slot.session_label then
    raise exception 'Session label does not match slot';
  end if;

  select count(*) into v_confirmed_count from public.bookings where slot_id=v_slot.id and status='confirmed' and id<>v_booking.id;
  if v_confirmed_count >= v_slot.capacity then raise exception 'Slot capacity is full'; end if;

  v_coach:=coalesce(p_assigned_coach_user_id,v_slot.coach_user_id,v_booking.requested_coach_user_id);
  if v_coach is null then raise exception 'Coach assignment required'; end if;
  -- Serialize confirmations for this coach. Separate slots still share a coach-wide limit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bearfit-confirm-coach:' || v_coach::text,0));
  if v_slot.session_label in ('Strength & Conditioning','Cardio') then
    if not exists (
      select 1 from public.coaches c
      where c.user_id=v_coach and c.is_active and not coalesce(c.is_demo,false)
        and c.branch=v_slot.branch
        and c.scheduling_specialization=case when v_slot.session_label='Cardio' then 'cardio' else 'strength_conditioning' end
    ) then raise exception 'Choose an active % coach at this branch', v_slot.session_label; end if;
  end if;
  -- A member cannot confirm overlapping appointments with different coaches.
  if exists(
    select 1 from public.bookings b where b.member_id=v_member.id and b.status='confirmed' and b.id<>v_booking.id
      and pg_catalog.tstzrange(b.start_at,b.end_at,'[)') && pg_catalog.tstzrange(v_slot.start_at,v_slot.end_at,'[)')
  ) then raise exception 'Member already has a confirmed session during this time'; end if;

  if exists(
    select 1 from public.bookings b where b.assigned_coach_user_id=v_coach
      and b.status='confirmed' and b.id<>v_booking.id
      and pg_catalog.tstzrange(b.start_at,b.end_at,'[)') && pg_catalog.tstzrange(v_slot.start_at,v_slot.end_at,'[)')
      and (v_slot.session_label is distinct from 'Strength & Conditioning' or b.session_label is distinct from 'Strength & Conditioning')
  ) then raise exception 'Coach has another type of overlapping session'; end if;

  if (
    select count(*) from public.bookings b where b.assigned_coach_user_id=v_coach
      and b.status='confirmed' and b.id<>v_booking.id
      and pg_catalog.tstzrange(b.start_at,b.end_at,'[)') && pg_catalog.tstzrange(v_slot.start_at,v_slot.end_at,'[)')
  ) >= case when v_slot.session_label='Strength & Conditioning' then 3 else 1 end
  then raise exception 'Coach has reached the limit for this hour'; end if;

  v_elig:=private.package_eligibility(v_member.id,v_slot.session_type);
  if not coalesce((v_elig->>'can_confirm_booking')::boolean,false) then raise exception '%',coalesce(v_elig->>'blocking_reason','Package cannot confirm booking'); end if;
  v_member_package:=(v_elig->>'member_package_id')::uuid;
  v_sessions_left:=coalesce((v_elig->>'sessions_left')::integer,0);

  select count(*) into v_future_confirmed from public.bookings
  where member_id=v_member.id and member_package_id=v_member_package and status='confirmed'
    and coalesce(start_at,requested_start_at)>=now() and id<>v_booking.id;
  if v_future_confirmed >= v_sessions_left then raise exception 'Not enough remaining package sessions for another confirmed future booking'; end if;

  update public.bookings set
    status='confirmed',slot_id=v_slot.id,assigned_coach_user_id=v_coach,start_at=v_slot.start_at,end_at=v_slot.end_at,
    member_package_id=v_member_package,session_label=coalesce(v_booking.session_label,v_slot.session_label)
  where id=v_booking.id;
  return jsonb_build_object('booking_id',v_booking.id,'status','confirmed','slot_id',v_slot.id,'member_package_id',v_member_package,'session_label',coalesce(v_booking.session_label,v_slot.session_label));
end; $$;

-- Existing coach planner retains assignment and package safeguards, with 3-way S&C overlap.
create or replace function public.coach_plot_sessions(
  p_member_code text,
  p_session_label text,
  p_start_at timestamptz,
  p_duration_minutes integer default 60,
  p_occurrences integer default 1
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_coach public.coaches%rowtype;
  v_member public.members%rowtype;
  v_type text;
  v_start timestamptz;
  v_end timestamptz;
  v_booking_id uuid;
  v_ids jsonb := '[]'::jsonb;
  v_i integer;
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.profiles where id=(select auth.uid()) and role='coach'
  ) then raise exception 'Coach login required'; end if;
  select * into v_coach from public.coaches
    where user_id=(select auth.uid()) and is_active and not is_demo;
  if not found then raise exception 'Active coach account not linked'; end if;

  if p_member_code is null or length(btrim(p_member_code)) not between 2 and 20 then
    raise exception 'Choose an assigned client';
  end if;
  if p_start_at is null then raise exception 'Choose a valid start date and time'; end if;
  if p_duration_minutes is null or p_duration_minutes not in (30,45,60,90,120) then
    raise exception 'Choose a supported session duration';
  end if;
  if p_occurrences is null or p_occurrences not between 1 and 8 then
    raise exception 'Weekly repetition must be between 1 and 8 sessions';
  end if;
  if p_start_at <= now() + interval '5 minutes'
    or p_start_at + (p_occurrences - 1) * interval '7 days' > now() + interval '90 days' then
    raise exception 'Choose a future time at least 5 minutes away, within the next 90 days';
  end if;
  -- The current taxonomy includes Strength & Conditioning, while the older
  -- private helper does not. Keep the workaround scoped to this new RPC.
  v_type := case when btrim(coalesce(p_session_label,'')) = 'Strength & Conditioning'
    then 'fitness' else private.session_label_category(p_session_label) end;

  if p_session_label in ('Strength & Conditioning','Cardio')
    and v_coach.scheduling_specialization <>
      case when p_session_label='Cardio' then 'cardio' else 'strength_conditioning' end
  then raise exception 'This coach is not assigned to the requested training type'; end if;

  select * into v_member from public.members
    where upper(member_code)=upper(btrim(p_member_code))
      and branch=v_coach.branch and not coalesce(is_demo,false);
  if not found then raise exception 'Client is unavailable at your branch'; end if;
  if not (
    lower(btrim(coalesce(v_member.coach_name,'')))=lower(btrim(v_coach.display_name))
    or exists (
      select 1 from public.coach_historical_session_links h
      join public.session_logs l on l.id=h.session_log_id
      where h.coach_id=v_coach.id and l.member_id=v_member.id
    )
    or exists (
      select 1 from public.bookings b
      where b.member_id=v_member.id and b.branch=v_coach.branch
        and b.assigned_coach_user_id=v_coach.user_id
        and b.start_at>now()-interval '45 days'
    )
  ) then raise exception 'This client is not assigned to your coach account'; end if;

  -- Serialize concurrent plotting requests for this coach and member.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'bearfit-coach-plot-coach:' || v_coach.user_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'bearfit-coach-plot-member:' || v_member.id::text,0));

  for v_i in 0..p_occurrences-1 loop
    v_start := p_start_at + v_i * interval '7 days';
    v_end := v_start + pg_catalog.make_interval(mins=>p_duration_minutes);
    if exists (
      select 1 from public.bookings b
      where b.member_id=v_member.id and b.status in ('pending','confirmed')
        and pg_catalog.tstzrange(
          coalesce(b.start_at,b.requested_start_at),
          coalesce(b.end_at,coalesce(b.start_at,b.requested_start_at)
            + pg_catalog.make_interval(mins=>b.requested_duration_minutes)), '[)'
        ) && pg_catalog.tstzrange(v_start,v_end,'[)')
    ) then raise exception 'Client already has a session at this time'; end if;

    if exists (
      select 1 from public.bookings b
      where b.status in ('pending','confirmed') and b.branch=v_coach.branch
        and (b.assigned_coach_user_id=v_coach.user_id or b.requested_coach_user_id=v_coach.user_id)
        and pg_catalog.tstzrange(
          coalesce(b.start_at,b.requested_start_at),
          coalesce(b.end_at,coalesce(b.start_at,b.requested_start_at)
            + pg_catalog.make_interval(mins=>b.requested_duration_minutes)), '[)'
        ) && pg_catalog.tstzrange(v_start,v_end,'[)')
        and (p_session_label is distinct from 'Strength & Conditioning' or b.session_label is distinct from 'Strength & Conditioning')
    ) then raise exception 'Coach has a conflicting training type at this hour'; end if;

    if (
      select count(*) from public.bookings b
      where b.status in ('pending','confirmed') and b.branch=v_coach.branch
        and (b.assigned_coach_user_id=v_coach.user_id or b.requested_coach_user_id=v_coach.user_id)
        and pg_catalog.tstzrange(
          coalesce(b.start_at,b.requested_start_at),
          coalesce(b.end_at,coalesce(b.start_at,b.requested_start_at)
            + pg_catalog.make_interval(mins=>b.requested_duration_minutes)), '[)'
        ) && pg_catalog.tstzrange(v_start,v_end,'[)')
    ) >= case when p_session_label='Strength & Conditioning' then 3 else 1 end
    then raise exception 'Coach has reached the limit for this hour'; end if;

    insert into public.bookings(
      member_id,request_kind,status,requested_coach_user_id,assigned_coach_user_id,
      branch,session_type,session_label,requested_start_at,requested_duration_minutes,
      start_at,end_at,created_by
    ) values (
      v_member.id,'custom','pending',v_coach.user_id,v_coach.user_id,
      v_coach.branch,v_type,btrim(p_session_label),v_start,p_duration_minutes,
      v_start,v_end,(select auth.uid())
    ) returning id into v_booking_id;
    v_ids := v_ids || pg_catalog.to_jsonb(v_booking_id);
  end loop;

  return jsonb_build_object('booking_ids',v_ids,'count',p_occurrences,
    'status','pending','message','Sessions plotted for Admin confirmation. No sessions deducted.');
end; $$;

-- Member's custom-session coach selector now lists linked active coaches, not staff/admin accounts.
create or replace function public.member_coach_directory()
returns table(id uuid,full_name text,branch text)
language sql stable security definer set search_path=''
as $$
  select c.user_id,c.display_name,c.branch from public.coaches c
  join public.members m on m.user_id=(select auth.uid()) and m.branch=c.branch
  where c.is_active and not coalesce(c.is_demo,false) and c.user_id is not null
  order by c.display_name;
$$;
revoke all on function public.member_coach_directory() from public,anon;
grant execute on function public.member_coach_directory() to authenticated;
