-- Follow-up to 20261118111500: serialize coach completion against legacy QR/manual attendance.
-- Does not rewrite any member, payment, payroll, package, or historical session rows.
create or replace function public.coach_complete_checkedin_booking(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_uid uuid:=(select auth.uid());
  v_coach public.coaches%rowtype;
  v_booking public.bookings%rowtype;
  v_arrival public.member_training_arrivals%rowtype;
  v_result jsonb;
  v_log uuid;
  v_member_id uuid;
begin
  if v_uid is null or not exists(
    select 1 from public.profiles where id=v_uid and role='coach'
  ) then raise exception 'Coach login required'; end if;
  select * into v_coach from public.coaches where user_id=v_uid and is_active and not is_demo;
  if not found then raise exception 'Active coach account not linked'; end if;
  -- Lock the member before the booking: legacy QR and staff attendance also lock
  -- member first. This serializes competing attendance paths without deadlocks.
  select b.member_id into v_member_id from public.bookings b
    where b.id=p_booking_id and b.assigned_coach_user_id=v_uid
      and private.coach_branch_allowed(v_coach.id,b.branch);
  if not found then raise exception 'Not a booking assigned to this coach'; end if;
  perform 1 from public.members where id=v_member_id for update;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if v_booking.member_id is distinct from v_member_id then
    raise exception 'Booking membership changed during attendance review';
  end if;
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
  -- A standalone, non-booked legacy QR/manual attendance might have already
  -- consumed today's session. Never silently deduct again in the new flow.
  if exists (
    select 1 from public.session_logs sl
    where sl.member_id=v_booking.member_id and sl.booking_id is null
      and (sl.trained_at at time zone 'Asia/Manila')::date =
          (now() at time zone 'Asia/Manila')::date
  ) then
    raise exception 'An unlinked session is already recorded today. Admin must review before any further deduction';
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
