-- BearFit 2026-11-17: Malingap weights sharing 3 clients per coach
-- Preserve all live booking, session, payment, and payroll data; functions only.
-- Abort if another change updated the booking functions after review.
do $malingap_weights_guard$
declare v_changed text;
begin
  select string_agg(source_fn,', ') into v_changed
  from (values
    ('private'::text,'confirm_booking_core'::text,'31cf7ae7a118e53bc49ef4e956da2521'::text),
    ('public'::text,'coach_plot_sessions'::text,'d478264ee358a0113b074ba1526e70ed'::text),
    ('public'::text,'member_calendar_slots'::text,'9952e45b505587af62b281eab775012f'::text)
  ) expected(schema_name,source_fn,definition_md5)
  where not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname=expected.schema_name and p.proname=expected.source_fn
      and md5(pg_get_functiondef(p.oid))=expected.definition_md5
  );
  if v_changed is not null then
    raise exception 'Malingap scheduling update canceled: functions changed (%)',v_changed;
  end if;
end;
$malingap_weights_guard$;

-- Business rule: At Malingap weights / strength sessions share a coach
-- for up to 3 distinct clients. Boxing remains solo until the separate buddy
-- service and policy are implemented. All other branches retain prior rules.
create or replace function private.coach_parallel_capacity(p_branch text,p_label text)
returns integer language sql immutable set search_path=''
as $weight_capacity$
  select case
    when p_branch='Malingap Branch'
      and p_label in ('Strength Training','Weight Training','Strength & Conditioning') then 3
    when p_label='Strength & Conditioning' then 3
    else 1
  end;
$weight_capacity$;

create or replace function private.coach_parallel_compatible(p_branch text,p_new_label text,p_existing_label text)
returns boolean language sql immutable set search_path=''
as $weight_compatible$
  select case
    when p_branch='Malingap Branch'
      and p_new_label in ('Strength Training','Weight Training','Strength & Conditioning')
      and p_existing_label in ('Strength Training','Weight Training','Strength & Conditioning') then true
    when p_new_label='Strength & Conditioning' and p_existing_label='Strength & Conditioning' then true
    else false
  end;
$weight_compatible$;

-- These are internal-only helpers, not directly exposed to public/anon Auth.
revoke all on function private.coach_parallel_capacity(text,text) from public, anon;
revoke all on function private.coach_parallel_compatible(text,text,text) from public, anon;
grant execute on function private.coach_parallel_capacity(text,text) to authenticated,service_role;
grant execute on function private.coach_parallel_compatible(text,text,text) to authenticated,service_role;

-- Coach plotting checks both pending and confirmed overlaps.
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
        and not private.coach_parallel_compatible(v_member.branch,p_session_label,b.session_label)
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
    ) >= private.coach_parallel_capacity(v_member.branch,p_session_label)
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

-- Admin confirmation validates confirmed bookings by the same capacity rule.
-- Membership eligibility, audit, credit deductions and payroll rules are untouched.
CREATE OR REPLACE FUNCTION private.confirm_booking_core(p_booking_id uuid, p_slot_id uuid DEFAULT NULL::uuid, p_assigned_coach_user_id uuid DEFAULT NULL::uuid, p_require_pending boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        and c.scheduling_specialization=(case when v_slot.session_label='Cardio' then 'cardio' else 'strength_conditioning' end)
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
      and (b.branch is distinct from v_slot.branch
        or not private.coach_parallel_compatible(v_slot.branch,v_slot.session_label,b.session_label))
  ) then raise exception 'Coach has another type of overlapping session'; end if;

  if (
    select count(*) from public.bookings b where b.assigned_coach_user_id=v_coach
      and b.status='confirmed' and b.id<>v_booking.id
      and pg_catalog.tstzrange(b.start_at,b.end_at,'[)') && pg_catalog.tstzrange(v_slot.start_at,v_slot.end_at,'[)')
  ) >= private.coach_parallel_capacity(v_slot.branch,v_slot.session_label)
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
end; $function$
;

-- Member calendar shows remaining group capacity using the same labels.
CREATE OR REPLACE FUNCTION public.member_calendar_slots(p_month date)
 RETURNS TABLE(id uuid, coach_user_id uuid, coach_name text, branch text, session_type text, session_label text, start_at timestamp with time zone, end_at timestamp with time zone, capacity integer, booked integer, remaining integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select s.id,s.coach_user_id,c.display_name,s.branch,s.session_type,s.session_label,
  s.start_at,s.end_at,
  least(s.capacity,case when s.branch='Malingap Branch' and s.session_label in ('Strength Training','Weight Training','Strength & Conditioning')
    then 3 when s.session_label='Cardio' then 1 when s.session_label='Strength & Conditioning' then 3 else s.capacity end)::integer,
  coalesce(occupied.n,0)::integer,
  greatest(0,least(
    s.capacity-coalesce(same_slot.n,0),
    private.coach_parallel_capacity(s.branch,s.session_label)
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
    coalesce(bool_or(b.branch is distinct from s.branch
      or not private.coach_parallel_compatible(s.branch,s.session_label,b.session_label)),false) as other_type
  from public.bookings b where b.assigned_coach_user_id=s.coach_user_id
    and b.status='confirmed' and b.start_at<s.end_at and b.end_at>s.start_at
) occupied on true
where (select auth.uid()) is not null
  and p_month is not null
  and s.status='open' and s.start_at>=now()
  and s.start_at >= date_trunc('month',p_month::timestamp) at time zone 'Asia/Manila'
  and s.start_at < (date_trunc('month',p_month::timestamp)+interval '1 month') at time zone 'Asia/Manila'
  and (s.session_label not in ('Strength & Conditioning','Cardio') or
    c.scheduling_specialization=(case when s.session_label='Cardio' then 'cardio' else 'strength_conditioning' end))
order by s.start_at,c.display_name,s.id
limit 500;
$function$
;
