-- Wire real Bearforce earning into existing check-in and package payment flows.

-- Check-in: only a newly consumed real check-in earns +100. Charged no-shows use
-- private.consume_package_session directly and therefore do not call this award path.
create or replace function public.staff_qr_checkin(
  p_member_code text,
  p_notes text default null,
  p_booking_id uuid default null,
  p_member_package_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_member public.members%rowtype;
  v_booking public.bookings%rowtype;
  v_cycle_id uuid;
  v_usable_count integer;
  v_result jsonb;
  v_point_result jsonb := '{}'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  select * into v_member from public.members where upper(member_code)=upper(trim(p_member_code)) for update;
  if not found then raise exception 'Member code not found'; end if;
  if lower(coalesce(v_member.membership_status,v_member.status,'inactive'))<>'active' or lower(coalesce(v_member.status,'inactive'))<>'active' then raise exception 'Membership is not active'; end if;

  if p_booking_id is not null then
    select * into v_booking from public.bookings where id=p_booking_id and member_id=v_member.id for update;
    if not found then raise exception 'Booking not found for member'; end if;
    if v_booking.status='completed' and exists(select 1 from public.session_logs where booking_id=v_booking.id) then
      return jsonb_build_object('member_id',v_member.id,'member_code',v_member.member_code,'status','completed','already_checked_in',true);
    end if;
    if v_booking.status<>'confirmed' then raise exception 'Booking must be confirmed before check-in'; end if;
    v_cycle_id:=v_booking.member_package_id;
    if v_cycle_id is null then raise exception 'Confirmed booking has no package cycle'; end if;
  elsif p_member_package_id is not null then
    v_cycle_id:=p_member_package_id;
  else
    select count(*),min(c.id) into v_usable_count,v_cycle_id
    from public.member_package_cycles c
    where c.member_id=v_member.id and c.status='active' and c.sessions_left>0 and (c.expires_at is null or c.expires_at>now());
    if v_usable_count=0 then raise exception 'No usable package'; end if;
    if v_usable_count>1 then raise exception 'Package selection required'; end if;
  end if;

  v_result:=private.consume_package_session(v_cycle_id,v_member.id,(select auth.uid()),p_booking_id,p_notes);

  if not coalesce((v_result->>'already_consumed')::boolean,false) then
    v_point_result:=private.award_bearforce_points(
      v_member.id,
      'session_completed',
      100,
      'session_log',
      (v_result->>'session_log_id')::uuid,
      now(),
      jsonb_build_object('booking_id',p_booking_id,'member_package_id',v_cycle_id)
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
    'status',case when p_booking_id is null then 'checked_in' else 'completed' end,
    'bearforce',v_point_result
  );
end; $$;
revoke all on function public.staff_qr_checkin(text,text,uuid,uuid) from public,anon;
grant execute on function public.staff_qr_checkin(text,text,uuid,uuid) to authenticated,service_role;

-- Payment: activation +200; on-time PARTIAL24 installment +150; early renewal +250.
create or replace function public.staff_mark_package_payment_paid(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_cycle public.member_package_cycles%rowtype;
  v_stage public.package_payment_stages%rowtype;
  v_definition public.package_definitions%rowtype;
  v_now timestamptz := now();
  v_activation_credit_applied boolean := false;
  v_early_renewal boolean := false;
  v_installment_on_time boolean := false;
  v_activation_points jsonb := '{}'::jsonb;
  v_installment_points jsonb := '{}'::jsonb;
  v_renewal_points jsonb := '{}'::jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not (select private.is_staff_or_admin()) then
    raise exception 'Staff access required';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then raise exception 'Payment not found'; end if;
  if v_payment.member_package_id is null or v_payment.package_stage_id is null or v_payment.package_definition_id is null then
    raise exception 'Payment is not linked to a package cycle';
  end if;

  select * into v_cycle from public.member_package_cycles where id = v_payment.member_package_id for update;
  if not found then raise exception 'Package cycle not found'; end if;
  select * into v_stage from public.package_payment_stages where id = v_payment.package_stage_id;
  if not found then raise exception 'Package stage not found'; end if;
  select * into v_definition from public.package_definitions where id = v_payment.package_definition_id;
  if not found then raise exception 'Package definition not found'; end if;

  if v_stage.stage_key='activation' then
    select exists(
      select 1
      from public.member_package_cycles previous_cycle
      join public.package_definitions previous_definition on previous_definition.id=previous_cycle.package_id
      where previous_cycle.member_id=v_payment.member_id
        and previous_cycle.id<>v_cycle.id
        and previous_definition.service_category=v_definition.service_category
        and previous_cycle.status='active'
        and previous_cycle.sessions_left>0
        and (previous_cycle.expires_at is null or previous_cycle.expires_at>v_now)
    ) into v_early_renewal;
  elsif v_definition.code='PARTIAL24'
    and v_stage.trigger_type='sessions_left'
    and v_stage.trigger_sessions_left is not null
    and v_cycle.sessions_left>=v_stage.trigger_sessions_left then
    v_installment_on_time:=true;
  end if;

  update public.payments
  set status = 'paid',
      paid_at = coalesce(paid_at, v_now),
      payment_date = coalesce(payment_date, v_now)
  where id = v_payment.id;

  update public.member_package_stage_payments
  set status = 'paid',
      payment_id = v_payment.id,
      paid_at = coalesce(paid_at, v_now)
  where member_package_id = v_cycle.id
    and stage_id = v_stage.id;

  if v_stage.stage_key = 'activation' and v_payment.credit_applied_at is null then
    update public.member_package_cycles
    set status = 'active',
        sessions_total = v_definition.included_sessions,
        sessions_used = 0,
        sessions_left = v_definition.included_sessions,
        starts_at = coalesce(starts_at, v_now),
        expires_at = case
          when v_definition.validity_days is null then null
          else coalesce(starts_at, v_now) + make_interval(days => v_definition.validity_days)
        end
    where id = v_cycle.id;

    update public.payments
    set credit_applied_at = v_now,
        sessions_purchased = v_definition.included_sessions
    where id = v_payment.id;

    update public.members
    set payment_status = 'paid',
        last_paid_at = v_now,
        last_paid_amount = v_payment.amount,
        total_paid = total_paid + coalesce(v_payment.amount, 0)
    where id = v_payment.member_id;

    perform private.sync_member_primary_balance(v_payment.member_id);
    v_activation_credit_applied := true;

    v_activation_points:=private.award_bearforce_points(
      v_payment.member_id,'package_activation_paid',200,'payment',v_payment.id,v_now,
      jsonb_build_object('package_code',v_definition.code,'stage_key',v_stage.stage_key)
    );

    if v_early_renewal then
      v_renewal_points:=private.award_bearforce_points(
        v_payment.member_id,'early_renewal',250,'payment',v_payment.id,v_now,
        jsonb_build_object('package_code',v_definition.code,'service_category',v_definition.service_category)
      );
    end if;
  elsif v_stage.stage_key <> 'activation' then
    -- PARTIAL24 installment stages only clear the gate; they add zero sessions.
    update public.members
    set payment_status = 'paid',
        last_paid_at = v_now,
        last_paid_amount = v_payment.amount,
        total_paid = case when v_payment.credit_applied_at is null then total_paid + coalesce(v_payment.amount, 0) else total_paid end
    where id = v_payment.member_id;

    update public.payments
    set credit_applied_at = coalesce(credit_applied_at, v_now),
        sessions_purchased = 0
    where id = v_payment.id;

    if v_installment_on_time then
      v_installment_points:=private.award_bearforce_points(
        v_payment.member_id,'partial_installment_on_time',150,'payment',v_payment.id,v_now,
        jsonb_build_object(
          'package_code','PARTIAL24',
          'stage_key',v_stage.stage_key,
          'trigger_sessions_left',v_stage.trigger_sessions_left,
          'sessions_left_when_paid',v_cycle.sessions_left
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'member_package_id', v_cycle.id,
    'package_code', v_definition.code,
    'stage_key', v_stage.stage_key,
    'status', 'paid',
    'activation_credit_applied', v_activation_credit_applied,
    'sessions_credited', case when v_activation_credit_applied then v_definition.included_sessions else 0 end,
    'bearforce',jsonb_build_object(
      'activation',v_activation_points,
      'installment',v_installment_points,
      'early_renewal',v_renewal_points
    )
  );
end;
$$;

revoke all on function public.staff_mark_package_payment_paid(uuid) from public, anon;
grant execute on function public.staff_mark_package_payment_paid(uuid) to authenticated, service_role;
