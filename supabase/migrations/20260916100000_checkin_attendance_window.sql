-- Harden booking attendance timing while preserving manual check-in and exactly-once package consumption.

drop function if exists public.staff_qr_checkin(text,text,uuid,uuid,text);

create or replace function public.staff_qr_checkin(
  p_member_code text,
  p_notes text default null,
  p_booking_id uuid default null,
  p_member_package_id uuid default null,
  p_session_label text default null
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_member public.members%rowtype;
  v_booking public.bookings%rowtype;
  v_cycle public.member_package_cycles%rowtype;
  v_definition public.package_definitions%rowtype;
  v_cycle_id uuid;
  v_session_type text;
  v_session_label text;
  v_elig jsonb;
  v_result jsonb;
  v_point_result jsonb := '{}'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;

  select * into v_member
  from public.members
  where upper(member_code)=upper(trim(p_member_code))
  for update;
  if not found then raise exception 'Member code not found'; end if;
  if lower(coalesce(v_member.membership_status,v_member.status,'inactive'))<>'active'
    or lower(coalesce(v_member.status,'inactive'))<>'active'
  then raise exception 'Membership is not active'; end if;

  if p_booking_id is not null then
    select * into v_booking
    from public.bookings
    where id=p_booking_id and member_id=v_member.id
    for update;
    if not found then raise exception 'Booking not found for member'; end if;

    if v_booking.status='completed' and exists(select 1 from public.session_logs where booking_id=v_booking.id) then
      return jsonb_build_object(
        'member_id',v_member.id,
        'member_code',v_member.member_code,
        'member_name',v_member.full_name,
        'status','completed',
        'already_checked_in',true,
        'session_type',v_booking.session_type,
        'session_label',v_booking.session_label,
        'sessions_left',(select sl.sessions_left_after from public.session_logs sl where sl.booking_id=v_booking.id limit 1),
        'eligibility',private.package_eligibility(v_member.id,v_booking.session_type)
      );
    end if;

    if v_booking.status<>'confirmed' then raise exception 'Booking must be confirmed before check-in'; end if;
    if v_booking.start_at is null or v_booking.end_at is null then raise exception 'Confirmed booking is missing its scheduled time'; end if;
    if now() < v_booking.start_at - interval '2 hours' then
      raise exception 'Booking check-in opens 2 hours before the scheduled start';
    end if;
    if now() > v_booking.end_at + interval '2 hours' then
      raise exception 'Booking check-in window has closed';
    end if;

    v_cycle_id:=v_booking.member_package_id;
    if v_cycle_id is null then raise exception 'Confirmed booking has no package cycle'; end if;
    v_session_type:=v_booking.session_type;
    v_session_label:=v_booking.session_label;
  else
    if nullif(trim(coalesce(p_session_label,'')),'') is null then
      raise exception 'Manual check-in requires a session label';
    end if;
    v_session_label:=trim(p_session_label);
    v_session_type:=private.session_label_category(p_session_label);
    v_elig:=private.package_eligibility(v_member.id,v_session_type);
    if not coalesce((v_elig->>'can_check_in')::boolean,false) then
      raise exception '%',coalesce(v_elig->>'blocking_reason','Package is not eligible for check-in');
    end if;

    if p_member_package_id is not null then
      select * into v_cycle
      from public.member_package_cycles
      where id=p_member_package_id and member_id=v_member.id;
      if not found then raise exception 'Package cycle not found'; end if;
      select * into v_definition from public.package_definitions where id=v_cycle.package_id;
      if not found then raise exception 'Package definition not found'; end if;
      if v_definition.service_category<>v_session_type then
        raise exception 'Selected package does not match workout type';
      end if;
      v_cycle_id:=p_member_package_id;
    else
      v_cycle_id:=(v_elig->>'member_package_id')::uuid;
      if v_cycle_id is null then raise exception 'No usable package'; end if;
    end if;
  end if;

  v_result:=private.consume_package_session(v_cycle_id,v_member.id,(select auth.uid()),p_booking_id,p_notes);

  if not coalesce((v_result->>'already_consumed')::boolean,false) then
    update public.session_logs
    set session_label=v_session_label
    where id=(v_result->>'session_log_id')::uuid;

    v_point_result:=private.award_bearforce_points(
      v_member.id,
      'session_completed',
      100,
      'session_log',
      (v_result->>'session_log_id')::uuid,
      now(),
      jsonb_build_object(
        'booking_id',p_booking_id,
        'member_package_id',v_cycle_id,
        'session_type',v_session_type,
        'session_label',v_session_label
      )
    );
  end if;

  if p_booking_id is not null then
    update public.bookings set status='completed' where id=p_booking_id and status='confirmed';
  end if;

  return v_result || jsonb_build_object(
    'member_id',v_member.id,
    'member_code',v_member.member_code,
    'member_name',v_member.full_name,
    'booking_id',p_booking_id,
    'session_type',v_session_type,
    'session_label',v_session_label,
    'status',case when p_booking_id is null then 'checked_in' else 'completed' end,
    'bearforce',v_point_result,
    'eligibility',private.package_eligibility(v_member.id,v_session_type)
  );
end; $$;
revoke all on function public.staff_qr_checkin(text,text,uuid,uuid,text) from public,anon;
grant execute on function public.staff_qr_checkin(text,text,uuid,uuid,text) to authenticated,service_role;

create or replace function public.staff_mark_no_show(
  p_booking_id uuid,
  p_charge_session boolean,
  p_notes text default null
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_booking public.bookings%rowtype;
  v_result jsonb:=jsonb_build_object();
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;

  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;

  if v_booking.status='no_show' then
    return jsonb_build_object('booking_id',v_booking.id,'status','no_show','charged',v_booking.no_show_charged,'already_processed',true);
  end if;
  if v_booking.status<>'confirmed' then raise exception 'Only confirmed bookings can be marked no-show'; end if;
  if v_booking.end_at is null then raise exception 'Confirmed booking is missing its scheduled end time'; end if;
  if now() < v_booking.end_at then
    raise exception 'No-show can only be marked after the scheduled session ends';
  end if;

  if p_charge_session then
    if v_booking.member_package_id is null then raise exception 'Booking has no package cycle'; end if;
    v_result:=private.consume_package_session(v_booking.member_package_id,v_booking.member_id,(select auth.uid()),v_booking.id,p_notes);
  end if;

  update public.bookings set status='no_show',no_show_charged=p_charge_session where id=v_booking.id;
  return jsonb_build_object(
    'booking_id',v_booking.id,
    'status','no_show',
    'charged',p_charge_session,
    'already_processed',false,
    'consumption',v_result
  );
end; $$;
revoke all on function public.staff_mark_no_show(uuid,boolean,text) from public,anon;
grant execute on function public.staff_mark_no_show(uuid,boolean,text) to authenticated,service_role;

create or replace function public.staff_checkin_context(p_member_code text)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_member public.members%rowtype;
  v_bookings jsonb;
  v_packages jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;

  select * into v_member from public.members where upper(member_code)=upper(trim(p_member_code));
  if not found then raise exception 'Member code not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,
    'start_at',b.start_at,
    'end_at',b.end_at,
    'session_type',b.session_type,
    'session_label',b.session_label,
    'branch',b.branch,
    'member_package_id',b.member_package_id,
    'package_name',d.name,
    'package_code',d.code,
    'sessions_left',c.sessions_left
  ) order by abs(extract(epoch from (b.start_at-now())))),'[]'::jsonb)
  into v_bookings
  from public.bookings b
  left join public.member_package_cycles c on c.id=b.member_package_id
  left join public.package_definitions d on d.id=c.package_id
  where b.member_id=v_member.id
    and b.status='confirmed'
    and b.start_at is not null
    and b.end_at is not null
    and now() >= b.start_at - interval '2 hours'
    and now() <= b.end_at + interval '2 hours';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,
    'package_name',d.name,
    'package_code',d.code,
    'service_category',d.service_category,
    'sessions_left',c.sessions_left,
    'sessions_total',c.sessions_total,
    'expires_at',c.expires_at,
    'eligibility',private.package_eligibility(v_member.id,d.service_category)
  ) order by c.created_at desc),'[]'::jsonb)
  into v_packages
  from public.member_package_cycles c
  join public.package_definitions d on d.id=c.package_id
  where c.member_id=v_member.id
    and c.status='active'
    and c.sessions_left>0
    and (c.expires_at is null or c.expires_at>now());

  return jsonb_build_object(
    'member',jsonb_build_object(
      'id',v_member.id,
      'member_code',v_member.member_code,
      'name',v_member.full_name,
      'branch',v_member.branch
    ),
    'confirmed_bookings',v_bookings,
    'packages',v_packages
  );
end; $$;
revoke all on function public.staff_checkin_context(text) from public,anon;
grant execute on function public.staff_checkin_context(text) to authenticated,service_role;
