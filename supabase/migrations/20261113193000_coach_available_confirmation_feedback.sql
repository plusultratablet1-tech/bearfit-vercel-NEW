-- Coach availability response now has a meaningful result.
-- Only a coach's own pending coach-plotted booking may be confirmed here,
-- and only through BearFit's existing package/payment/overlap confirmation gates.
-- Member-initiated requests remain Admin-confirmed. No credits or payments are altered.

create or replace function public.coach_schedule_accept(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_coach public.coaches%rowtype;
  v_booking public.bookings%rowtype;
  v_gate jsonb;
  v_block_reason text := null;
  v_status text;
  v_message text;
  v_coach_plotted boolean;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles
    where id=(select auth.uid()) and role='coach'
  ) then raise exception 'Coach login required'; end if;

  select * into v_coach from public.coaches
   where user_id=(select auth.uid()) and is_active and not is_demo;
  if not found then raise exception 'Active coach account not linked'; end if;

  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found or v_booking.branch is distinct from v_coach.branch
    or (v_booking.assigned_coach_user_id is distinct from v_coach.user_id
        and v_booking.requested_coach_user_id is distinct from v_coach.user_id)
  then raise exception 'Booking does not belong to your coach account'; end if;
  if v_booking.status not in ('pending','confirmed') then
    raise exception 'This booking is no longer available for a response'; end if;

  v_status := v_booking.status;
  v_coach_plotted := v_booking.status='pending'
    and v_booking.request_kind='custom'
    and v_booking.created_by=v_coach.user_id
    and v_booking.requested_coach_user_id=v_coach.user_id
    and v_booking.assigned_coach_user_id=v_coach.user_id;

  if v_coach_plotted then
    v_gate := private.package_eligibility(v_booking.member_id,v_booking.session_type);
    if coalesce((v_gate->>'can_confirm_booking')::boolean,false) then
      if coalesce(v_booking.start_at,v_booking.requested_start_at) <= now()+interval '5 minutes' then
        v_block_reason := 'Session is starting too soon or has already started';
      else
        -- Reuse the full existing booking confirmation checks. This creates a
        -- slot, verifies branch, capacity, specialization, member/coach overlap,
        -- package eligibility and future reserved credits; it does NOT deduct.
        perform private.confirm_booking_core(v_booking.id,v_booking.slot_id,v_coach.user_id,true);
        v_status := 'confirmed';
      end if;
    else
      v_block_reason := coalesce(nullif(v_gate->>'blocking_reason',''),'Package requires Admin review');
    end if;
  end if;

  -- Always record the coach's availability through the existing feedback system.
  -- Both operations run atomically and rollback together if confirmation fails.
  perform public.coach_schedule_respond(p_booking_id,'available',null);

  if v_status='confirmed' and v_coach_plotted then
    v_message := 'Session confirmed and added to the schedule. No package credits were deducted.';
  elsif v_status='confirmed' then
    v_message := 'Availability recorded. This booking is already confirmed.';
  elsif v_block_reason is not null then
    v_message := 'Availability recorded, but booking is still pending: ' ||
      v_block_reason || '. Ask BearFit Admin to review the package or payment.';
  else
    v_message := 'Availability recorded for Admin. The booking is still pending Admin confirmation.';
  end if;

  return jsonb_build_object(
    'booking_id',v_booking.id,'response','available','status',v_status,
    'coach_plotted',v_coach_plotted,'blocking_reason',v_block_reason,
    'message',v_message
  );
end; $$;

revoke all on function public.coach_schedule_accept(uuid) from public,anon;
grant execute on function public.coach_schedule_accept(uuid) to authenticated;

-- The calendar keeps working as before. Only pending request cards gain
-- coach-plotted and package-blocker indicators so existing availability
-- responses remain understandable after reloading the page.
create or replace function public.coach_schedule_overview()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_coach public.coaches%rowtype; v_bookings jsonb; v_requests jsonb;
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
  where b.assigned_coach_user_id=v_coach.user_id and b.branch=v_coach.branch
    and not coalesce(m.is_demo,false)
    and b.start_at between now()-interval '8 days' and now()+interval '90 days'
  order by b.start_at asc limit 180
 ) v;

 select coalesce(jsonb_agg(jsonb_build_object(
   'id',v.id,'start_at',v.start_at,'status',v.status,'member_name',v.member_name,
   'member_code',v.member_code,'session_label',v.session_label,
   'session_type',v.session_type,'coach_response',v.coach_response,
   'coach_reason',v.coach_reason,'coach_plotted',v.coach_plotted,
   'blocking_reason',v.blocking_reason
 ) order by v.start_at asc),'[]'::jsonb) into v_requests
 from (
  select b.id,coalesce(b.requested_start_at,b.start_at,b.created_at) start_at,
   b.status,m.full_name member_name,m.member_code,
   b.session_label,b.session_type,f.response coach_response,f.reason coach_reason,
   (b.request_kind='custom' and b.created_by=v_coach.user_id
      and b.requested_coach_user_id=v_coach.user_id
      and b.assigned_coach_user_id=v_coach.user_id) as coach_plotted,
   case when b.request_kind='custom' and b.created_by=v_coach.user_id
     and b.requested_coach_user_id=v_coach.user_id
     and b.assigned_coach_user_id=v_coach.user_id
    then nullif(private.package_eligibility(b.member_id,b.session_type)->>'blocking_reason','')
    else null end as blocking_reason
  from public.bookings b join public.members m on m.id=b.member_id
  left join public.coach_schedule_feedback f on f.booking_id=b.id and f.coach_id=v_coach.id
  where b.status='pending' and b.branch=v_coach.branch
    and not coalesce(m.is_demo,false) and b.created_at>=now()-interval '30 days'
    and (b.requested_coach_user_id=v_coach.user_id or b.assigned_coach_user_id=v_coach.user_id)
  order by start_at asc limit 30
 ) v;
 return jsonb_build_object('bookings',v_bookings,'requests',v_requests);
end; $$;

revoke all on function public.coach_schedule_overview() from public,anon;
grant execute on function public.coach_schedule_overview() to authenticated;
