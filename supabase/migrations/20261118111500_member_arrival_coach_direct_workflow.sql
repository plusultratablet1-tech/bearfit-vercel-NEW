-- BearFit: member one-tap GPS arrival + coach-owned confirmed bookings and completion.
-- No existing member, booking, package, payment, or payroll records are rewritten.
-- Apply only after review. Production app remains on old workflow until this is deployed.
-- Critical: never treat arrival alone as conducted training or deduct sessions.
create table if not exists public.member_training_arrivals (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  final_schedule_revision integer not null,
  unique(booking_id,final_schedule_revision),
  member_id uuid not null references public.members(id) on delete restrict,
  checked_in_by uuid not null references auth.users(id),
  branch text not null,
  checked_in_at timestamptz not null default now(),
  observed_at timestamptz not null,
  distance_m double precision not null check (distance_m >= 0),
  accuracy_m double precision not null check (accuracy_m >= 0),
  method text not null default 'gps_geofence' check (method='gps_geofence')
);
create index if not exists member_training_arrivals_member_idx
  on public.member_training_arrivals(member_id,checked_in_at desc);
alter table public.member_training_arrivals enable row level security;
revoke all on public.member_training_arrivals from public,anon,authenticated;
grant select on public.member_training_arrivals to authenticated;
drop policy if exists "Member sees own verified arrivals" on public.member_training_arrivals;
create policy "Member sees own verified arrivals" on public.member_training_arrivals
for select to authenticated using (
 exists(select 1 from public.members m where m.id=member_id and m.user_id=(select auth.uid()))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
);

-- One touch at the gym. GPS is checked against existing Admin-managed branch settings;
-- only distance and reported accuracy are retained, never exact handset coordinates.
create or replace function public.member_training_checkin(
  p_booking_id uuid, p_latitude double precision, p_longitude double precision,
  p_accuracy_m double precision, p_observed_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_uid uuid:=(select auth.uid());
  v_booking public.bookings%rowtype;
  v_member public.members%rowtype;
  v_cfg public.coach_branch_gps_settings%rowtype;
  v_arrival public.member_training_arrivals%rowtype;
  v_sin double precision;
  v_a double precision;
  v_distance double precision;
begin
  if v_uid is null then raise exception 'Sign in to check in'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Scheduled session not found'; end if;
  select * into v_member from public.members
    where id=v_booking.member_id and user_id=v_uid and not is_demo;
  if not found then raise exception 'Only the assigned member may check in'; end if;
  if v_booking.status not in ('confirmed','completed') then
    raise exception 'Only confirmed sessions support member check-in';
  end if;
  if v_booking.start_at is null or v_booking.end_at is null then
    raise exception 'Session time is not assigned';
  end if;
  if v_member.branch is distinct from v_booking.branch then
    raise exception 'Member and booking branches do not match';
  end if;
  select * into v_arrival from public.member_training_arrivals where booking_id=p_booking_id and final_schedule_revision=v_booking.final_schedule_revision;
  if found then return jsonb_build_object(
    'status','already_checked_in','booking_id',p_booking_id,
    'checked_in_at',v_arrival.checked_in_at
  ); end if;
  if v_booking.status<>'confirmed' then raise exception 'Session already closed'; end if;
  if now()<v_booking.start_at-interval '90 minutes' or
     now()>v_booking.end_at+interval '30 minutes' then
    raise exception 'Check-in is available from 90 minutes before to 30 minutes after the scheduled session';
  end if;
  if p_observed_at is null or abs(extract(epoch from (now()-p_observed_at)))>90 then
    raise exception 'Location is outdated. Tap check-in again at the gym';
  end if;
  if p_latitude is null or p_longitude is null or
     p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or
     p_accuracy_m is null or p_accuracy_m not between 0.1 and 100000 then
    raise exception 'A valid device location is required';
  end if;
  select * into v_cfg from public.coach_branch_gps_settings
    where branch=v_booking.branch and enabled;
  if not found or v_cfg.latitude is null or v_cfg.longitude is null then
    raise exception 'Branch location verification is unavailable. Ask Admin for attendance assistance';
  end if;
  if p_accuracy_m>v_cfg.accuracy_limit_m then
    raise exception 'Location accuracy is too low. Move closer to the gym entrance and try again';
  end if;
  v_sin:=sin(radians(p_latitude-v_cfg.latitude)/2);
  v_a:=v_sin*v_sin+cos(radians(v_cfg.latitude))*cos(radians(p_latitude))*
       power(sin(radians(p_longitude-v_cfg.longitude)/2),2);
  v_distance:=6371000*2*asin(sqrt(greatest(0,least(1,v_a))));
  if v_distance>v_cfg.radius_m then
    raise exception 'Please check in when you are physically at your BearFit branch';
  end if;
  insert into public.member_training_arrivals
    (booking_id,final_schedule_revision,member_id,checked_in_by,branch,observed_at,distance_m,accuracy_m)
  values(p_booking_id,v_booking.final_schedule_revision,v_member.id,v_uid,v_booking.branch,p_observed_at,v_distance,p_accuracy_m)
  returning * into v_arrival;
  return jsonb_build_object('status','checked_in','booking_id',p_booking_id,
    'checked_in_at',v_arrival.checked_in_at,'session_deducted',false);
end $fn$;
revoke all on function public.member_training_checkin(uuid,double precision,double precision,double precision,timestamptz) from public,anon;
grant execute on function public.member_training_checkin(uuid,double precision,double precision,double precision,timestamptz) to authenticated;

-- Coach retains the existing conflict checks. All weekly bookings are confirmed in
-- the SAME transaction: a failure rolls the entire batch back, including pending rows.
-- A coach cannot accept stricter cancellation terms on the member's behalf.
create or replace function public.coach_book_sessions_direct(
  p_member_code text, p_session_label text, p_start_at timestamptz,
  p_duration_minutes integer default 60, p_occurrences integer default 1
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_uid uuid:=(select auth.uid());
  v_coach public.coaches%rowtype;
  v_pending jsonb;
  v_id text;
  v_ids jsonb:='[]'::jsonb;
begin
  if v_uid is null or not exists(
    select 1 from public.profiles where id=v_uid and role='coach'
  ) then raise exception 'Coach login required'; end if;
  select * into v_coach from public.coaches where user_id=v_uid and is_active and not is_demo;
  if not found then raise exception 'Active coach account not linked'; end if;
  v_pending:=public.coach_plot_sessions(p_member_code,p_session_label,
    p_start_at,p_duration_minutes,p_occurrences);
  for v_id in select jsonb_array_elements_text(v_pending->'booking_ids') loop
    if not exists(select 1 from public.bookings b where b.id=v_id::uuid
        and b.created_by=v_uid and b.assigned_coach_user_id=v_uid
        and private.coach_branch_allowed(v_coach.id,b.branch) and b.status='pending')
    then raise exception 'Coach-created booking failed ownership verification'; end if;
    perform private.confirm_booking_core(v_id::uuid,null,v_uid,true);
    v_ids:=v_ids||to_jsonb(v_id::uuid);
  end loop;
  return jsonb_build_object('status','confirmed','booking_ids',v_ids,
    'count',jsonb_array_length(v_ids),
    'message','Coach bookings confirmed and visible to Member and Admin; no package sessions deducted');
end $fn$;
revoke all on function public.coach_book_sessions_direct(text,text,timestamptz,integer,integer) from public,anon;
grant execute on function public.coach_book_sessions_direct(text,text,timestamptz,integer,integer) to authenticated;

-- Coaches may see only whether their assigned bookings have a verified gym arrival.
create or replace function public.coach_training_arrival_status()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_uid uuid:=(select auth.uid()); v_coach public.coaches%rowtype;
begin
  if v_uid is null or not exists(select 1 from public.profiles
    where id=v_uid and role='coach') then raise exception 'Coach login required'; end if;
  select * into v_coach from public.coaches where user_id=v_uid and is_active and not is_demo;
  if not found then raise exception 'Active coach account not linked'; end if;
  return coalesce((
    select jsonb_object_agg(a.booking_id::text,to_char(a.checked_in_at
      at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI')) from public.member_training_arrivals a
    join public.bookings b on b.id=a.booking_id
    where b.assigned_coach_user_id=v_uid and private.coach_branch_allowed(v_coach.id,b.branch)
      and a.final_schedule_revision=b.final_schedule_revision and a.checked_in_at>=now()-interval '45 days'
  ),'{}'::jsonb);
end $fn$;
revoke all on function public.coach_training_arrival_status() from public,anon;
grant execute on function public.coach_training_arrival_status() to authenticated;

-- Member has already independently checked in using their own account and verified GPS.
-- Coach has one completion action. No check-in => NO coach-driven deduction.
-- Admin keeps all no-show/dispute powers and must separately approve coach payroll.
create or replace function public.coach_complete_checkedin_booking(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_uid uuid:=(select auth.uid());
  v_coach public.coaches%rowtype;
  v_booking public.bookings%rowtype;
  v_arrival public.member_training_arrivals%rowtype;
  v_result jsonb;
  v_log uuid;
begin
  if v_uid is null or not exists(
    select 1 from public.profiles where id=v_uid and role='coach'
  ) then raise exception 'Coach login required'; end if;
  select * into v_coach from public.coaches where user_id=v_uid and is_active and not is_demo;
  if not found then raise exception 'Active coach account not linked'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found or v_booking.assigned_coach_user_id is distinct from v_uid or
    not private.coach_branch_allowed(v_coach.id,v_booking.branch) then
    raise exception 'Not a booking assigned to this coach'; end if;
  if v_booking.status='completed' and exists(
    select 1 from public.session_logs where booking_id=p_booking_id
  ) then return jsonb_build_object('status','already_completed',
    'booking_id',p_booking_id,'session_deducted',false);
  end if;
  if v_booking.status<>'confirmed' then raise exception 'Only confirmed sessions can be completed'; end if;
  if v_booking.start_at is null or v_booking.end_at is null
    or now()<v_booking.start_at+interval '20 minutes'
    or now()>v_booking.end_at+interval '3 hours' then
    raise exception 'Complete Session is available during/shortly after the training time';
  end if;
  select * into v_arrival from public.member_training_arrivals
    where booking_id=p_booking_id and final_schedule_revision=v_booking.final_schedule_revision
      and member_id=v_booking.member_id and branch=v_booking.branch
      and checked_in_at between v_booking.start_at-interval '90 minutes'
                            and v_booking.end_at+interval '30 minutes';
  if not found then
    raise exception 'No independently verified member check-in. Ask Admin to review attendance; no session was deducted';
  end if;
  if v_booking.member_package_id is null then
    raise exception 'No eligible package linked to this booking. Admin review required';
  end if;
  v_result:=private.consume_package_session(v_booking.member_package_id,
    v_booking.member_id,v_uid,v_booking.id,'Coach completed training with verified member GPS arrival');
  v_log:=(v_result->>'session_log_id')::uuid;
  if coalesce((v_result->>'already_consumed')::boolean,false) then
    raise exception 'Session was previously deducted; Admin must review';
  end if;
  update public.session_logs set session_label=v_booking.session_label where id=v_log;
  update public.bookings set status='completed' where id=v_booking.id and status='confirmed';
  insert into public.coach_conductions
    (session_log_id,member_id,coach_id,booking_id,session_date,branch,status)
  values(v_log,v_booking.member_id,v_coach.id,v_booking.id,
    (v_booking.start_at at time zone 'Asia/Manila')::date,v_booking.branch,'pending')
  on conflict (session_log_id) do nothing;
  perform private.award_bearforce_points(v_booking.member_id,'session_completed',100,
    'session_log',v_log,now(),
    jsonb_build_object('method','member_gps_coach_completion','booking_id',v_booking.id));
  return jsonb_build_object('status','completed','booking_id',p_booking_id,
    'session_log_id',v_log,'sessions_left',v_result->'sessions_left',
    'session_deducted',true,'coach_conduction','pending_admin_review');
end $fn$;
revoke all on function public.coach_complete_checkedin_booking(uuid) from public,anon;
grant execute on function public.coach_complete_checkedin_booking(uuid) to authenticated;
