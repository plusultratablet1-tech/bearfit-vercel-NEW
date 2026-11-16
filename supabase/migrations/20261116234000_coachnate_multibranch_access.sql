-- BearFit Coach Nate: explicit, coach-scoped multi-branch permissions.
-- Other coach accounts keep their existing single-branch access.
-- No member, payment, attendance, session, or payroll records are modified.
--
-- CoachNate is an intentionally reserved named username. The existing
-- numbered coach aliases and protected auth.users signup trigger remain intact.
alter table public.coaches drop constraint if exists coaches_username_format_chk;
alter table public.coaches add constraint coaches_username_format_chk
  check (username is null or username ~ '^coach[1-9][0-9]{0,5}$' or username = 'coachnate');

create table if not exists public.coach_branch_access (
  coach_id uuid not null references public.coaches(id) on delete cascade,
  branch text not null check (branch in ('Malingap Branch','E. Rodriguez Branch','Primark Cainta')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key(coach_id,branch)
);
create index if not exists coach_branch_access_branch_idx on public.coach_branch_access(branch);
alter table public.coach_branch_access enable row level security;

-- Read-only visibility. No client INSERT/UPDATE/DELETE policies exist.
-- Only a verified server-side BearFit Admin provisioning action may assign branches.
grant select on public.coach_branch_access to authenticated;
grant select, insert, delete on public.coach_branch_access to service_role;
drop policy if exists coach_branch_access_read_admin_or_own on public.coach_branch_access;
create policy coach_branch_access_read_admin_or_own on public.coach_branch_access
for select to authenticated using (
  exists(select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.role='admin')
  or exists(select 1 from public.coaches c
    where c.id=coach_id and c.user_id=(select auth.uid()) and c.is_active and not c.is_demo)
);

-- Branch authorizations are never based on editable user_metadata.
-- Called by existing server-side, authenticated, coach-scoped RPCs.
create or replace function private.coach_branch_allowed(p_coach_id uuid,p_branch text)
returns boolean language sql stable security invoker set search_path=''
as $coach_branch_allowed$
  select exists (
    select 1 from public.coaches c
    where c.id=p_coach_id and c.is_active and not c.is_demo
      and (c.branch=p_branch or exists (
        select 1 from public.coach_branch_access a
        where a.coach_id=c.id and a.branch=p_branch
      ))
  );
$coach_branch_allowed$;


-- Preserve existing rules; only scope authorized branch checks for coach_activity_overview.
CREATE OR REPLACE FUNCTION public.coach_activity_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_coach public.coaches%rowtype;
  v_sessions jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_attention jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles
    where id=(select auth.uid()) and role='coach'
  ) then raise exception 'Active coach login required'; end if;
  select * into v_coach from public.coaches
    where user_id=(select auth.uid()) and is_active and not is_demo;
  if not found then raise exception 'Active coach account not linked'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'member_name',x.member_name,'member_code',x.member_code,
    'trained_at',x.trained_at,'session_label',x.session_label,
    'sessions_left_after',x.sessions_left_after,'source',x.source
  ) order by x.trained_at desc),'[]'::jsonb) into v_sessions
  from (
    select sl.id, m.full_name member_name,m.member_code,sl.trained_at,
      sl.session_label,sl.sessions_left_after,l.source
    from public.coach_historical_session_links l
    join public.session_logs sl on sl.id=l.session_log_id
    join public.members m on m.id=sl.member_id
    where l.coach_id=v_coach.id and private.coach_branch_allowed(v_coach.id,m.branch)
      and not coalesce(m.is_demo,false)
      and sl.trained_at>=now()-interval '120 days'
    order by sl.trained_at desc,sl.id desc limit 30
  ) x;

  -- A coach may see a limited payment summary ONLY for their own clients;
  -- never expose private proof, contact details, method or payment credentials.
  with linked_clients as (
    select distinct m.id,m.full_name,m.member_code,m.payment_status
    from public.members m
    where private.coach_branch_allowed(v_coach.id,m.branch) and not coalesce(m.is_demo,false)
      and (
        exists(select 1 from public.coach_historical_session_links l
          join public.session_logs sl on sl.id=l.session_log_id
          where l.coach_id=v_coach.id and sl.member_id=m.id)
        or exists(select 1 from public.bookings b
          where b.member_id=m.id and b.assigned_coach_user_id=v_coach.user_id
            and b.branch=m.branch
            and b.start_at between now()-interval '60 days' and now()+interval '40 days')
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'member_name',x.full_name,'member_code',x.member_code,
    'amount',x.amount,'package_name',x.package_name,'paid_at',x.paid_at
  ) order by x.paid_at desc),'[]'::jsonb) into v_payments
  from (
    select p.id,lc.full_name,lc.member_code,p.amount,
      coalesce(p.package_name,'Membership payment') as package_name,
      coalesce(p.paid_at,p.payment_date,p.created_at) paid_at
    from linked_clients lc join public.payments p on p.member_id=lc.id
    where lower(p.status)='paid'
      and coalesce(p.paid_at,p.payment_date,p.created_at)>=now()-interval '180 days'
    order by paid_at desc limit 20
  ) x;

  with linked_clients as (
    select distinct m.id,m.full_name,m.member_code,m.payment_status
    from public.members m
    where private.coach_branch_allowed(v_coach.id,m.branch) and not coalesce(m.is_demo,false)
      and (
        exists(select 1 from public.coach_historical_session_links l
          join public.session_logs sl on sl.id=l.session_log_id
          where l.coach_id=v_coach.id and sl.member_id=m.id)
        or exists(select 1 from public.bookings b
          where b.member_id=m.id and b.assigned_coach_user_id=v_coach.user_id
            and b.branch=m.branch
            and b.start_at between now()-interval '60 days' and now()+interval '40 days')
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'member_name',a.full_name,'member_code',a.member_code,
    'reason',a.reason,'payment_status',a.payment_status
  ) order by a.full_name),'[]'::jsonb) into v_attention
  from (
    select lc.full_name,lc.member_code,coalesce(lc.payment_status,'not recorded') payment_status,
      case when exists (
        select 1 from public.member_package_cycles cyc
        join public.member_package_stage_payments st on st.member_package_id=cyc.id
        where cyc.member_id=lc.id and cyc.status='active'
          and lower(st.status) not in ('paid','waived')
      ) then 'Package installment requires Admin review'
      when not exists (
        select 1 from public.payments p
        where p.member_id=lc.id and lower(p.status)='paid'
      ) then 'No verified payment record — confirm with Admin'
      else 'Payment status needs Admin review'
      end as reason
    from linked_clients lc
    where coalesce(lower(lc.payment_status),'not recorded') not in ('paid','verified')
      or exists (
        select 1 from public.member_package_cycles cyc
        join public.member_package_stage_payments st on st.member_package_id=cyc.id
        where cyc.member_id=lc.id and cyc.status='active'
          and lower(st.status) not in ('paid','waived')
      )
    order by lc.full_name limit 20
  ) a;

  return jsonb_build_object('sessions',v_sessions,'payments',v_payments,'payment_attention',v_attention);
end;
$function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_check_guest_pass.
CREATE OR REPLACE FUNCTION public.coach_check_guest_pass(p_token text, p_redeem boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.guest_invites%rowtype;v_user uuid;v_role text;v_branch text;v_host_name text;
begin
 v_user:=(select auth.uid());
 select role,branch into v_role,v_branch from public.profiles where id=v_user;
 if v_role not in ('coach','staff','admin') or v_role is null then raise exception 'Authorized gym login required'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{32}$' then raise exception 'Invalid guest pass'; end if;
 select * into v from public.guest_invites
 where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found then raise exception 'Guest pass not found'; end if;
 if v_role='coach' then
  select v.branch into v_branch from public.coaches c where c.user_id=v_user and c.is_active and not c.is_demo
    and private.coach_branch_allowed(c.id,v.branch);
  if v_branch is null then raise exception 'Linked active coach required'; end if;
  if not exists(select 1 from public.coach_shifts s join public.coaches c on s.coach_id=c.id
    where c.user_id=v_user and s.branch=v_branch and s.clock_out_at is null
      and s.clock_in_at>now()-interval '18 hours')
  then raise exception 'Verified clock-in is required to check guest passes'; end if;
 elsif v_role='staff' and v_branch<>v.branch
 then raise exception 'Wrong staff branch'; end if;
 if v_role<>'admin' and v_branch<>v.branch then raise exception 'Guest pass belongs to another branch'; end if;
 if v.status<>'active' or v.visit_day<>(now() at time zone 'Asia/Manila')::date
   or now()>v.expires_at
 then raise exception 'Guest pass is not active for today'; end if;
 if v.purpose='free_guest' and p_redeem and (
    v.host_confirmed_at is null or v.host_confirmed_at<now()-interval '10 minutes'
    or v.host_confirmed_at>now()
 ) then raise exception 'Hosting member must confirm arrival in their BearFit account within 10 minutes'; end if;
 if v.purpose='free_guest' then
   select m.full_name into v_host_name from public.members m where m.id=v.host_member_id;
 end if;
 if p_redeem then
   update public.guest_invites set status='redeemed',entered_at=now(),entered_by=v_user where id=v.id;
   insert into public.guest_invite_events(invite_id,action,actor_id) values(v.id,'entered',v_user);
 end if;
 return jsonb_build_object('status',case when p_redeem then 'redeemed' else 'active' end,
   'guest_name',v.guest_name,'branch',v.branch,'purpose',v.purpose,'visit_day',v.visit_day,
   'hosting_member_name',v_host_name,
   'host_arrival_confirmed',v.host_confirmed_at is not null and v.host_confirmed_at>=now()-interval '10 minutes',
   'permitted_service',case when v.purpose='visitor' then 'Visitor only — NO workout or personal training'
      when v.purpose='gym_day' then 'Gym facilities only — NO coaching'
      when v.purpose='free_guest' then 'Free gym-only benefit — NO coaching; hosting member must accompany guest'
      when v.purpose='training' then 'Paid guest training access — conduction separate'
      else 'Approved complimentary promotion' end);
end; $function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_client_cards.
CREATE OR REPLACE FUNCTION public.coach_client_cards()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_coach public.coaches%rowtype; v_cards jsonb;
begin
 if (select auth.uid()) is null or not exists (
   select 1 from public.profiles
   where id=(select auth.uid()) and role='coach'
 ) then raise exception 'Coach login required';end if;
 select * into v_coach from public.coaches
 where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Active coach not linked';end if;

 select coalesce(jsonb_agg(jsonb_build_object(
   'member_name',q.full_name,'member_code',q.member_code,
   'package_name',q.package_name,'membership_status',q.membership_status,
   'total_sessions',q.total_sessions,'sessions_used',q.sessions_used,
   'sessions_left',q.sessions_left,'last_sessions',q.last_sessions,
   'balance_verified',q.has_package_cycle,
   'assignment_source',q.assignment_source
 ) order by q.full_name,q.member_code),'[]'::jsonb) into v_cards
 from (
   select m.id,m.full_name,m.member_code,m.package_name,m.membership_status,
     coalesce(m.total_sessions,0) as total_sessions,
     coalesce(m.sessions_used,0) as sessions_used,
     coalesce(m.sessions_left,0) as sessions_left,
     exists(select 1 from public.member_package_cycles cyc
        where cyc.member_id=m.id and cyc.status='active') as has_package_cycle,
     case
       when lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(v_coach.display_name))
         then 'member_coach_assignment'
       when exists(
         select 1 from public.coach_historical_session_links l
         join public.session_logs sl on sl.id=l.session_log_id
         where l.coach_id=v_coach.id and sl.member_id=m.id)
         then 'coach_session_link'
       else 'assigned_booking'
     end as assignment_source,
     (select coalesce(jsonb_agg(h.session_date order by h.session_date desc),'[]'::jsonb)
      from (
        select dates.session_date from (
          select (sl.trained_at at time zone 'Asia/Manila')::date as session_date
          from public.coach_historical_session_links l
          join public.session_logs sl on sl.id=l.session_log_id
          where l.coach_id=v_coach.id and sl.member_id=m.id
          union
          select h.session_date from public.coach_owner_reported_session_dates h
          where h.coach_id=v_coach.id and h.member_id=m.id
        ) dates order by dates.session_date desc limit 6
      ) h) as last_sessions
   from public.members m
   where private.coach_branch_allowed(v_coach.id,m.branch) and not coalesce(m.is_demo,false)
     and (
       lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(v_coach.display_name))
       or exists(
         select 1 from public.coach_historical_session_links l
         join public.session_logs sl on sl.id=l.session_log_id
         where l.coach_id=v_coach.id and sl.member_id=m.id)
       or exists(
         select 1 from public.bookings b
         where b.member_id=m.id and b.branch=m.branch
           and b.assigned_coach_user_id=v_coach.user_id
           and b.start_at>now()-interval '45 days')
     )
   order by m.full_name,m.member_code
   limit 100
 ) q;
 return v_cards;
end;$function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_final_booking_confirmation_status.
CREATE OR REPLACE FUNCTION public.coach_final_booking_confirmation_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid());
 v_branch text;
 v_coach_id uuid;
 v_results jsonb;
begin
 if v_uid is null or not exists(select 1 from public.profiles p
   where p.id=v_uid and p.role='coach')
 then raise exception 'Coach sign-in required'; end if;
 select c.id,c.branch into v_coach_id,v_branch from public.coaches c where c.user_id=v_uid
   and c.is_active and not coalesce(c.is_demo,false);
 if v_branch is null then raise exception 'Active coach not linked'; end if;
 select coalesce(jsonb_object_agg(b.id::text,exists(
   select 1 from public.booking_final_confirmations f
    where f.booking_id=b.id
      and f.member_id=b.member_id
      and f.final_schedule_revision=b.final_schedule_revision
      and f.start_at is not distinct from b.start_at
      and f.end_at is not distinct from b.end_at
      and f.coach_user_id is not distinct from b.assigned_coach_user_id
      and f.branch is not distinct from b.branch
      and f.session_type is not distinct from b.session_type
      and f.session_label is not distinct from b.session_label
      and f.slot_id is not distinct from b.slot_id
  )), '{}'::jsonb)
 into v_results
 from public.bookings b
 where b.assigned_coach_user_id=v_uid and private.coach_branch_allowed(v_coach_id,b.branch)
   and b.status='confirmed'
   and b.start_at between now()-interval '7 days' and now()+interval '90 days';
 return v_results;
end $function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_gps_attendance_status.
CREATE OR REPLACE FUNCTION public.coach_gps_attendance_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.coaches%rowtype;cfg public.coach_branch_gps_settings%rowtype;
begin
  if (select auth.uid()) is null or not exists(
     select 1 from public.profiles where id=(select auth.uid()) and role='coach')
  then raise exception 'Coach login required';end if;
  select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo;
  if not found then raise exception 'Active coach not found';end if;
  select * into cfg from public.coach_branch_gps_settings where private.coach_branch_allowed(c.id,branch) order by enabled desc,(branch=c.branch) desc limit 1;
  return jsonb_build_object('branch',coalesce(cfg.branch,c.branch),'configured',found,'enabled',coalesce(cfg.enabled,false),
    'radius_m',cfg.radius_m,'accuracy_limit_m',cfg.accuracy_limit_m);
end;$function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_gps_time_punch.
CREATE OR REPLACE FUNCTION public.coach_gps_time_punch(p_work_shift_id uuid, p_action text, p_latitude double precision, p_longitude double precision, p_accuracy_m double precision, p_observed_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.coaches%rowtype;w public.coach_work_shifts%rowtype;
 cfg public.coach_branch_gps_settings%rowtype;
 s public.coach_shifts%rowtype;v_now timestamptz:=now();v_distance double precision;
begin
  if (select auth.uid()) is null or not exists(
    select 1 from public.profiles where id=(select auth.uid()) and role='coach')
  then raise exception 'Coach login required';end if;
  select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo for update;
  if not found then raise exception 'Active coach not found';end if;
  if p_action not in ('in','out') or p_action is null then raise exception 'Invalid attendance action';end if;
  select * into w from public.coach_work_shifts where id=p_work_shift_id and coach_id=c.id for update;
  if not found or not private.coach_branch_allowed(c.id,w.branch) then raise exception 'No assigned shift at this branch';end if;
  if w.response='unavailable' then raise exception 'Shift marked unavailable. Ask Admin to resolve';end if;
  select * into cfg from public.coach_branch_gps_settings where branch=w.branch and enabled;
  if not found then raise exception 'GPS clock-in is not enabled for this branch. Ask Admin to set the gym location';end if;
  if p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180
     or p_accuracy_m is null or p_accuracy_m<=0 or p_accuracy_m>cfg.accuracy_limit_m
  then raise exception 'Location accuracy is insufficient. Turn on precise location and try again';end if;
  if p_observed_at is null or abs(extract(epoch from (v_now-p_observed_at)))>60
  then raise exception 'Location fix expired. Try again';end if;

  v_distance:=2*6371000*asin(sqrt(least(1,
    power(sin(radians(p_latitude-cfg.latitude)/2),2)
    +cos(radians(cfg.latitude))*cos(radians(p_latitude))
    *power(sin(radians(p_longitude-cfg.longitude)/2),2)
  )));
  if v_distance>cfg.radius_m then
    raise exception 'Outside % geofence (%.0f m away). Clock in at your assigned gym',
      w.branch,v_distance;
  end if;
  if p_action='in' then
    if v_now<w.starts_at-interval '2 hours' or v_now>w.ends_at
    then raise exception 'Outside assigned shift clock-in window';end if;
    if exists(select 1 from public.coach_shifts where coach_id=c.id and clock_out_at is null)
    then raise exception 'Already clocked in. Clock out first';end if;
    insert into public.coach_shifts(coach_id,branch,clock_in_at,recorded_by,work_shift_id)
    values(c.id,w.branch,v_now,(select auth.uid()),w.id) returning * into s;
  else
    select * into s from public.coach_shifts where coach_id=c.id and work_shift_id=w.id for update;
    if not found or s.clock_out_at is not null then raise exception 'No open clock-in for this shift';end if;
    if v_now>s.clock_in_at+interval '24 hours' then raise exception 'Shift overdue. Ask Admin to correct';end if;
    update public.coach_shifts set clock_out_at=v_now where id=s.id returning * into s;
  end if;
  insert into public.coach_gps_attendance_audit(coach_id,work_shift_id,verified_by,branch,
    action,distance_m,accuracy_m,verified_at)
  values(c.id,w.id,(select auth.uid()),w.branch,p_action,v_distance,p_accuracy_m,v_now);
  return jsonb_build_object('action',p_action,'branch',w.branch,'clock_in_at',s.clock_in_at,
    'clock_out_at',s.clock_out_at,'verified',true,'method','gps',
    'distance_m',round(v_distance::numeric,0));
end;$function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_historical_activity.
CREATE OR REPLACE FUNCTION public.coach_historical_activity()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_coach public.coaches%rowtype; v_items jsonb;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='coach') then
  raise exception 'Coach login required';
 end if;
 select * into v_coach from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Active coach record not linked'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',s.id,'member_name',m.full_name,'member_code',m.member_code,
   'session_date',(s.trained_at at time zone 'Asia/Manila')::date,
   'source','Historical session entered by Admin',
   'session_label',s.session_label
  ) order by s.trained_at desc),'[]'::jsonb) into v_items
 from public.coach_historical_session_links l
 join public.session_logs s on s.id=l.session_log_id
 join public.members m on m.id=s.member_id
 where l.coach_id=v_coach.id and private.coach_branch_allowed(v_coach.id,m.branch)
   and s.trained_at>=now()-interval '120 days';
 return v_items;
end; $function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_member_qr_preview.
CREATE OR REPLACE FUNCTION public.coach_member_qr_preview(p_member_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_coach public.coaches%rowtype;v_member public.members%rowtype;v_booking public.bookings%rowtype;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='coach')
 then raise exception 'Coach login required'; end if;
 select * into v_coach from public.coaches where user_id=(select auth.uid()) and is_active;
 if not found then raise exception 'Active coach login not linked'; end if;
 select * into v_member from public.members where upper(member_code)=upper(btrim(p_member_code));
 if not found then raise exception 'No assigned active booking for this member'; end if;
 select * into v_booking from public.bookings b where b.member_id=v_member.id
  and b.assigned_coach_user_id=v_coach.user_id and private.coach_branch_allowed(v_coach.id,b.branch)
  and b.status='confirmed' and b.start_at is not null and b.end_at is not null
  and now() between b.start_at - interval '2 hours' and b.end_at + interval '2 hours'
  order by b.start_at limit 1;
 if not found then raise exception 'No assigned active booking for this member'; end if;
 return jsonb_build_object('member_name',v_member.full_name,'member_code',v_member.member_code,
  'booking_id',v_booking.id,'start_at',v_booking.start_at,'end_at',v_booking.end_at,
  'branch',v_booking.branch,'session_label',v_booking.session_label,
  'note','Preview only. Check-in requires authorized staff verification.');
end; $function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_operational_dashboard.
CREATE OR REPLACE FUNCTION public.coach_operational_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 where w.coach_id=v_coach.id and private.coach_branch_allowed(v_coach.id,w.branch)
   and w.ends_at>now()-interval '8 days'
   and w.starts_at<now()+interval '35 days';

 select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'start_at',b.start_at,'end_at',b.end_at,
    'branch',b.branch,'session_type',b.session_type,'session_label',b.session_label,
    'member_name',m.full_name,'member_code',m.member_code,'status',b.status
 ) order by b.start_at),'[]'::jsonb) into v_bookings
 from public.bookings b join public.members m on m.id=b.member_id
 where b.assigned_coach_user_id=v_coach.user_id
  and private.coach_branch_allowed(v_coach.id,b.branch) and b.status in ('confirmed','completed','no_show')
  and b.start_at>now()-interval '8 days' and b.start_at<now()+interval '35 days';

 select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'session_date',c.session_date,'status',c.status,'member_name',m.full_name
  ) order by c.session_date desc),'[]'::jsonb) into v_conductions
 from public.coach_conductions c join public.members m on m.id=c.member_id
 where c.coach_id=v_coach.id and private.coach_branch_allowed(v_coach.id,c.branch) and c.session_date >= (now() at time zone 'Asia/Manila')::date-31;
 return jsonb_build_object('coach_id',v_coach.id,'name',v_coach.display_name,'username',v_coach.username,
   'branch',v_coach.branch,'shifts',v_shifts,'bookings',v_bookings,'conductions',v_conductions);
end; $function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_payment_tracking_overview.
CREATE OR REPLACE FUNCTION public.coach_payment_tracking_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_coach public.coaches%rowtype; v_clients jsonb;v_receipts jsonb;v_reports jsonb;v_dues jsonb;
begin
 if (select auth.uid()) is null or not exists(
   select 1 from public.profiles where id=(select auth.uid()) and role='coach'
 ) then raise exception 'Coach login required';end if;
 select * into v_coach from public.coaches
 where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Active coach not linked';end if;
 -- Admin-set coach_name, assigned booking or verified coach-linked session
 -- proves the member is within this coach's scope. Branch never crosses.
 with linked as (
  select m.id,m.member_code,m.full_name,m.package_name,m.payment_status,m.sessions_left
  from public.members m where private.coach_branch_allowed(v_coach.id,m.branch) and not coalesce(m.is_demo,false)
  and (lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(v_coach.display_name))
   or exists(select 1 from public.coach_historical_session_links l
      join public.session_logs s on s.id=l.session_log_id
      where l.coach_id=v_coach.id and s.member_id=m.id)
   or exists(select 1 from public.bookings b
      where b.member_id=m.id and b.assigned_coach_user_id=v_coach.user_id
      and b.branch=m.branch and b.start_at>now()-interval '90 days'))
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'member_code',z.member_code,'member_name',z.full_name,'package_name',z.package_name,
   'payment_status',coalesce(z.payment_status,'not recorded'),'sessions_left',z.sessions_left,
   'verified_total',z.verified_total,'open_payable',z.open_payable,
   'payable_count',z.payable_count,'unverified_reports',z.unverified_reports,
   'has_verified_payment',z.has_verified_payment
 ) order by z.full_name),'[]'::jsonb) into v_clients
 from (select l.*,
   (select coalesce(sum(p.amount),0) from public.payments p
      where p.member_id=l.id and lower(p.status)='paid') as verified_total,
   (select coalesce(sum(a.amount_due),0) from public.coach_client_payables a
      where a.member_id=l.id and a.status='open') as open_payable,
   (select count(*) from public.coach_client_payables a
      where a.member_id=l.id and a.status='open') as payable_count,
   (select count(*) from public.coach_payment_reports r
      where r.member_id=l.id and r.coach_id=v_coach.id and r.status='pending') as unverified_reports,
   exists(select 1 from public.payments p
      where p.member_id=l.id and lower(p.status)='paid') as has_verified_payment
 from linked l order by l.full_name limit 100) z;

 with linked as (
  select m.id,m.full_name,m.member_code
  from public.members m where private.coach_branch_allowed(v_coach.id,m.branch) and not coalesce(m.is_demo,false)
  and (lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(v_coach.display_name))
   or exists(select 1 from public.coach_historical_session_links l
      join public.session_logs s on s.id=l.session_log_id
      where l.coach_id=v_coach.id and s.member_id=m.id)
   or exists(select 1 from public.bookings b where b.member_id=m.id
      and b.assigned_coach_user_id=v_coach.user_id and b.branch=m.branch
      and b.start_at>now()-interval '90 days'))
 )
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',v.id,'member_name',v.full_name,'member_code',v.member_code,
 'amount',v.amount,'payment_type',v.payment_type,
 'package_name',v.package_name,'stage',v.stage,'recorded_at',v.recorded_at,
 'status',v.status,'actual_sender_recorded',false
 ) order by v.recorded_at desc),'[]'::jsonb) into v_receipts
 from (select p.id,l.full_name,l.member_code,p.amount,p.payment_type,p.package_name,
 p.stage,p.status,coalesce(p.paid_at,p.payment_date,p.created_at) recorded_at
 from linked l join public.payments p on p.member_id=l.id
 where p.status in ('paid','pending')
 order by recorded_at desc limit 60) v;

 select coalesce(jsonb_agg(jsonb_build_object(
 'id',r.id,'member_name',m.full_name,'member_code',m.member_code,
 'sender',r.reported_sender,'channel',r.channel,'amount',r.amount,
 'transfer_reference',r.transfer_reference,'status',r.status,'created_at',r.created_at
 ) order by r.created_at desc),'[]'::jsonb) into v_reports
 from (select * from public.coach_payment_reports
 where coach_id=v_coach.id order by created_at desc limit 60) r
 join public.members m on m.id=r.member_id;

 with linked as (
  select m.id,m.full_name,m.member_code
  from public.members m where private.coach_branch_allowed(v_coach.id,m.branch) and not coalesce(m.is_demo,false)
  and (lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(v_coach.display_name))
   or exists(select 1 from public.coach_historical_session_links l
      join public.session_logs s on s.id=l.session_log_id
      where l.coach_id=v_coach.id and s.member_id=m.id)
   or exists(select 1 from public.bookings b where b.member_id=m.id
      and b.assigned_coach_user_id=v_coach.user_id and b.branch=m.branch
      and b.start_at>now()-interval '90 days'))
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',a.id,'member_name',l.full_name,'member_code',l.member_code,
   'label',a.label,'amount_due',a.amount_due,'due_at',a.due_at,'status',a.status
 ) order by a.due_at asc nulls last),'[]'::jsonb) into v_dues
 from linked l join public.coach_client_payables a on a.member_id=l.id
 where a.status='open';
 return jsonb_build_object('clients',v_clients,'receipts',v_receipts,
 'reported_transfers',v_reports,'payables',v_dues);
end;$function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_plot_sessions.
CREATE OR REPLACE FUNCTION public.coach_plot_sessions(p_member_code text, p_session_label text, p_start_at timestamp with time zone, p_duration_minutes integer DEFAULT 60, p_occurrences integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_type := (case when btrim(coalesce(p_session_label,'')) = 'Strength & Conditioning'
    then 'fitness' else private.session_label_category(p_session_label) end);

  if p_session_label in ('Strength & Conditioning','Cardio')
    and v_coach.scheduling_specialization <>
      (case when p_session_label='Cardio' then 'cardio' else 'strength_conditioning' end)
  then raise exception 'This coach is not assigned to the requested training type'; end if;

  select * into v_member from public.members
    where upper(member_code)=upper(btrim(p_member_code))
      and private.coach_branch_allowed(v_coach.id,branch) and not coalesce(is_demo,false);
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
      where b.member_id=v_member.id and b.branch=v_member.branch
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

    -- One coach cannot conduct simultaneous sessions at two physical branches.
    if exists (
      select 1 from public.bookings b
      where b.status in ('pending','confirmed')
        and b.branch is distinct from v_member.branch
        and (b.assigned_coach_user_id=v_coach.user_id or b.requested_coach_user_id=v_coach.user_id)
        and pg_catalog.tstzrange(
          coalesce(b.start_at,b.requested_start_at),
          coalesce(b.end_at,coalesce(b.start_at,b.requested_start_at)
            + pg_catalog.make_interval(mins=>b.requested_duration_minutes)), '[)'
        ) && pg_catalog.tstzrange(v_start,v_end,'[)')
    ) then raise exception 'A coach cannot have overlapping sessions at different branches'; end if;

    if exists (
      select 1 from public.bookings b
      where b.status in ('pending','confirmed') and b.branch=v_member.branch
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
      where b.status in ('pending','confirmed') and b.branch=v_member.branch
        and (b.assigned_coach_user_id=v_coach.user_id or b.requested_coach_user_id=v_coach.user_id)
        and pg_catalog.tstzrange(
          coalesce(b.start_at,b.requested_start_at),
          coalesce(b.end_at,coalesce(b.start_at,b.requested_start_at)
            + pg_catalog.make_interval(mins=>b.requested_duration_minutes)), '[)'
        ) && pg_catalog.tstzrange(v_start,v_end,'[)')
    ) >= (case when p_session_label='Strength & Conditioning' then 3 else 1 end)
    then raise exception 'Coach has reached the limit for this hour'; end if;

    insert into public.bookings(
      member_id,request_kind,status,requested_coach_user_id,assigned_coach_user_id,
      branch,session_type,session_label,requested_start_at,requested_duration_minutes,
      start_at,end_at,created_by
    ) values (
      v_member.id,'custom','pending',v_coach.user_id,v_coach.user_id,
      v_member.branch,v_type,btrim(p_session_label),v_start,p_duration_minutes,
      v_start,v_end,(select auth.uid())
    ) returning id into v_booking_id;
    v_ids := v_ids || pg_catalog.to_jsonb(v_booking_id);
  end loop;

  return jsonb_build_object('booking_ids',v_ids,'count',p_occurrences,
    'status','pending','message','Sessions plotted for Admin confirmation. No sessions deducted.');
end; $function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_record_session_event.
CREATE OR REPLACE FUNCTION public.coach_record_session_event(p_booking_id uuid, p_event_type text, p_member_code text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_coach public.coaches%rowtype; v_booking public.bookings%rowtype;
        v_member_code text; v_id uuid;
begin
 if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='coach')
 then raise exception 'Coach login required'; end if;
 select * into v_coach from public.coaches
  where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Active coach account not linked'; end if;
 if p_event_type not in ('confirmed','qr_confirmed','in_session','cancel_requested')
 then raise exception 'Invalid coach action'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found or v_booking.assigned_coach_user_id is distinct from v_coach.user_id
    or not private.coach_branch_allowed(v_coach.id,v_booking.branch) then
    raise exception 'This is not your assigned session'; end if;
 if v_booking.status<>'confirmed' then
    raise exception 'Only active confirmed bookings may be tagged'; end if;
 if p_event_type='cancel_requested' then
   if v_booking.start_at<=now() then raise exception 'Ask Admin to review a past or in-progress booking'; end if;
   if char_length(btrim(coalesce(p_reason,''))) not between 5 and 300
   then raise exception 'Provide a cancellation reason (5-300 characters)'; end if;
 end if;
 if p_event_type in ('qr_confirmed','in_session') then
  select member_code into v_member_code from public.members where id=v_booking.member_id;
  if upper(btrim(coalesce(p_member_code,'')))<>upper(coalesce(v_member_code,''))
  then raise exception 'Member QR does not match the assigned client'; end if;
  if v_booking.start_at is null or v_booking.end_at is null or
     now()<v_booking.start_at-interval '2 hours' or now()>v_booking.end_at+interval '2 hours'
  then raise exception 'QR confirmation is outside this session window'; end if;
 end if;
 insert into public.coach_session_events(coach_id,booking_id,event_type,reason,actor_id)
 values(v_coach.id,p_booking_id,p_event_type,
        case when p_event_type='cancel_requested' then btrim(p_reason) else null end,(select auth.uid()))
 on conflict (coach_id,booking_id,event_type) do nothing
 returning id into v_id;
 if v_id is null then
  select id into v_id from public.coach_session_events
   where coach_id=v_coach.id and booking_id=p_booking_id and event_type=p_event_type;
 end if;
 return jsonb_build_object('event_id',v_id,'event_type',p_event_type);
end; $function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_report_client_transfer.
CREATE OR REPLACE FUNCTION public.coach_report_client_transfer(p_member_code text, p_sender text, p_amount numeric, p_channel text, p_transfer_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.coaches%rowtype;m public.members%rowtype;v_id uuid;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles
 where id=(select auth.uid()) and role='coach') then raise exception 'Coach required';end if;
 select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Coach account inactive';end if;
 select * into m from public.members where upper(member_code)=upper(btrim(p_member_code));
 if not found or not private.coach_branch_allowed(c.id,m.branch) or m.is_demo
 or not (lower(btrim(coalesce(m.coach_name,'')))=lower(btrim(c.display_name))
  or exists(select 1 from public.coach_historical_session_links l
   join public.session_logs s on s.id=l.session_log_id
   where l.coach_id=c.id and s.member_id=m.id)
  or exists(select 1 from public.bookings b
   where b.member_id=m.id and b.assigned_coach_user_id=c.user_id
   and b.branch=m.branch and b.start_at>now()-interval '90 days'))
 then raise exception 'Member not assigned to coach';end if;
 if p_amount is null or p_amount<=0 or p_amount>10000000
 then raise exception 'Invalid amount';end if;
 if char_length(btrim(coalesce(p_sender,''))) not between 2 and 120
 then raise exception 'Enter sender name (2-120 characters)';end if;
 if p_channel not in ('GCash','Maya','Bank transfer','Cash','Other')
 then raise exception 'Unsupported payment channel';end if;
 if char_length(coalesce(p_transfer_reference,''))>120 or char_length(coalesce(p_notes,''))>500
 then raise exception 'Reference or note too long';end if;
 if nullif(btrim(coalesce(p_transfer_reference,'')),'') is not null and exists (
  select 1 from public.coach_payment_reports r where r.member_id=m.id and r.coach_id=c.id
   and r.channel=p_channel and r.amount=p_amount
   and lower(r.transfer_reference)=lower(btrim(p_transfer_reference))
 ) then raise exception 'A report with this transfer reference already exists';end if;
 insert into public.coach_payment_reports(
  member_id,coach_id,recorded_by,reported_sender,amount,channel,transfer_reference,notes)
 values(m.id,c.id,(select auth.uid()),btrim(p_sender),p_amount,p_channel,
  nullif(btrim(coalesce(p_transfer_reference,'')),''),nullif(btrim(coalesce(p_notes,'')),''))
 returning id into v_id;
 return jsonb_build_object('id',v_id,'status','pending',
 'message','Sent to Admin for verification; no official payment was recorded.');
end;$function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_schedule_overview.
CREATE OR REPLACE FUNCTION public.coach_schedule_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_coach public.coaches%rowtype; v_bookings jsonb;v_requests jsonb;
begin
 if (select auth.uid()) is null or not exists(
   select 1 from public.profiles where id=(select auth.uid()) and role='coach'
 ) then raise exception 'Coach account required'; end if;
 select * into v_coach from public.coaches
  where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Active coach record not linked';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',v.id,'start_at',v.start_at,'end_at',v.end_at,'status',v.status,
   'member_name',v.member_name,'member_code',v.member_code,'session_label',v.session_label,
   'session_type',v.session_type,'branch',v.branch,
   'coach_response',v.coach_response,'coach_reason',v.coach_reason
 ) order by v.start_at asc),'[]'::jsonb) into v_bookings
 from (
  select b.id,b.start_at,b.end_at,b.status,m.full_name member_name,m.member_code,
   b.session_label,b.session_type,b.branch,
   f.response coach_response,f.reason coach_reason
  from public.bookings b join public.members m on m.id=b.member_id
  left join public.coach_schedule_feedback f on f.booking_id=b.id and f.coach_id=v_coach.id
  where b.assigned_coach_user_id=v_coach.user_id and private.coach_branch_allowed(v_coach.id,b.branch)
    and not coalesce(m.is_demo,false)
    and b.start_at between now()-interval '8 days' and now()+interval '90 days'
  order by b.start_at asc limit 180
 ) v;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',v.id,'start_at',v.start_at,'status',v.status,'member_name',v.member_name,
   'member_code',v.member_code,'session_label',v.session_label,
   'session_type',v.session_type,'coach_response',v.coach_response,
   'coach_reason',v.coach_reason
 ) order by v.start_at asc),'[]'::jsonb) into v_requests
 from (
  select b.id,coalesce(b.requested_start_at,b.start_at,b.created_at) start_at,
   b.status,m.full_name member_name,m.member_code,
   b.session_label,b.session_type,f.response coach_response,f.reason coach_reason
  from public.bookings b join public.members m on m.id=b.member_id
  left join public.coach_schedule_feedback f on f.booking_id=b.id and f.coach_id=v_coach.id
  where b.status='pending' and private.coach_branch_allowed(v_coach.id,b.branch)
    and not coalesce(m.is_demo,false) and b.created_at>=now()-interval '30 days'
    and (b.requested_coach_user_id=v_coach.user_id or b.assigned_coach_user_id=v_coach.user_id)
  order by start_at asc limit 30
 ) v;
 return jsonb_build_object('bookings',v_bookings,'requests',v_requests);
end;$function$
;

-- Preserve existing rules; only scope authorized branch checks for coach_schedule_respond.
CREATE OR REPLACE FUNCTION public.coach_schedule_respond(p_booking_id uuid, p_response text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.coaches%rowtype;b public.bookings%rowtype;f public.coach_schedule_feedback%rowtype;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles
 where id=(select auth.uid()) and role='coach') then raise exception 'Coach account required';end if;
 select * into c from public.coaches where user_id=(select auth.uid()) and is_active and not is_demo;
 if not found then raise exception 'Coach not active';end if;
 if p_response not in ('available','conflict','cancel_requested') or p_response is null then raise exception 'Invalid coach response';end if;
 select * into b from public.bookings where id=p_booking_id for update;
 if not found or not private.coach_branch_allowed(c.id,b.branch)
 or (b.assigned_coach_user_id is distinct from c.user_id
     and b.requested_coach_user_id is distinct from c.user_id)
 then raise exception 'Booking is not assigned or requested for this coach';end if;
 if b.status not in ('pending','confirmed') then raise exception 'Booking is no longer actionable';end if;
 if p_response='cancel_requested' and b.status<>'confirmed' then raise exception 'Only confirmed bookings can be cancellation requests';end if;
 if coalesce(b.start_at,b.requested_start_at)<=now() and p_response='cancel_requested' then
 raise exception 'Past or ongoing session cancellation needs Admin review';end if;
 if p_response in ('conflict','cancel_requested') and length(btrim(coalesce(p_reason,''))) not between 5 and 300
 then raise exception 'Please provide a reason (5-300 characters)';end if;
 insert into public.coach_schedule_feedback(booking_id,coach_id,actor_id,response,reason,updated_at)
 values(p_booking_id,c.id,(select auth.uid()),p_response,
    case when p_response='available' then null else btrim(p_reason) end,now())
 on conflict(coach_id,booking_id) do update
  set response=excluded.response,reason=excluded.reason,actor_id=excluded.actor_id,updated_at=now()
 returning * into f;
 return jsonb_build_object('response',f.response,'booking_id',f.booking_id,
 'message','Saved for Admin review. Official booking status unchanged.');
end;$function$
;

-- Four-argument overload is used only for explicitly selected branch.
-- The original three-argument RPC is preserved unchanged.
CREATE OR REPLACE FUNCTION public.admin_plan_coach_shift(p_coach_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_branch text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_coach public.coaches%rowtype; v_id uuid;
begin
 if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
 then raise exception 'Admin access required'; end if;
 select * into v_coach from public.coaches where id=p_coach_id and is_active for update;
 if not found then raise exception 'Active coach not found'; end if;
 if p_branch is null or not private.coach_branch_allowed(v_coach.id,p_branch)
 then raise exception 'Coach is not authorized at the selected branch'; end if;
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
 values(p_coach_id,p_branch,p_starts_at,p_ends_at,(select auth.uid()))
 returning id into v_id;
 insert into public.coach_work_shift_events(work_shift_id,action,actor_id)
 values(v_id,'planned',(select auth.uid()));
 return v_id;
end; $function$
;
revoke all on function public.admin_plan_coach_shift(uuid,timestamptz,timestamptz,text) from public;
grant execute on function public.admin_plan_coach_shift(uuid,timestamptz,timestamptz,text) to authenticated;
