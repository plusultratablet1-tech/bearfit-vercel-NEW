-- Fix package eligibility for depleted/expired cycles where the due-stage query is skipped.
-- Nullable scalar variables remain safe when no payment stage is evaluated.

create or replace function private.package_eligibility(p_member_id uuid,p_service_category text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_cycle record;
  v_due_stage_id uuid := null;
  v_due_stage_key text := null;
  v_due_stage_label text := null;
  v_warning_level text := 'none';
  v_warning_message text := null;
  v_blocking_reason text := null;
  v_can_request boolean := false;
  v_can_confirm boolean := false;
  v_can_check_in boolean := false;
  v_expired boolean := false;
begin
  if p_service_category not in ('fitness','pilates_group','pilates_1on1') then
    raise exception 'Invalid service category';
  end if;

  select c.id cycle_id,
         c.member_id,
         c.status,
         c.sessions_total,
         c.sessions_used,
         c.sessions_left,
         c.starts_at,
         c.expires_at,
         d.id package_id,
         d.code package_code,
         d.name package_name,
         d.service_category,
         d.shareable,
         d.billing_mode
    into v_cycle
  from public.member_package_cycles c
  join public.package_definitions d on d.id=c.package_id
  where c.member_id=p_member_id
    and d.service_category=p_service_category
    and c.status in ('active','depleted','expired')
  order by case when c.status='active' then 0 else 1 end,c.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'member_package_id',null,
      'package_code',null,
      'package_name',null,
      'service_category',p_service_category,
      'sessions_left',0,
      'sessions_total',0,
      'can_request_booking',false,
      'can_confirm_booking',false,
      'can_check_in',false,
      'blocking_reason','No active package',
      'warning_level','none',
      'warning_message',null,
      'payment_stage_due',null,
      'expires_at',null
    );
  end if;

  v_expired := v_cycle.status='expired'
    or (v_cycle.expires_at is not null and v_cycle.expires_at<=now());

  if v_expired then
    v_blocking_reason := 'Package expired';
  elsif v_cycle.status<>'active' or v_cycle.sessions_left<=0 then
    v_blocking_reason := 'No sessions remaining';
  else
    v_can_check_in := true;

    select s.id,s.stage_key,s.label
      into v_due_stage_id,v_due_stage_key,v_due_stage_label
    from public.package_payment_stages s
    left join public.member_package_stage_payments sp
      on sp.member_package_id=v_cycle.cycle_id and sp.stage_id=s.id
    where s.package_id=v_cycle.package_id
      and s.active
      and s.blocks_new_bookings_when_due
      and (
        s.trigger_type='activation'
        or (s.trigger_type='sessions_left' and v_cycle.sessions_left<=s.trigger_sessions_left)
      )
      and coalesce(sp.status,'due') not in ('paid','waived')
    order by s.stage_order desc
    limit 1;

    if found then
      v_blocking_reason := 'Payment Due';
    else
      v_can_request := true;
      v_can_confirm := true;
    end if;
  end if;

  if not v_expired and v_cycle.sessions_left=2 then
    v_warning_level := 'warning';
    v_warning_message := 'Renewal Soon';
  elsif not v_expired and v_cycle.sessions_left=1 then
    v_warning_level := 'critical';
    v_warning_message := 'Last Session — Renew Now';
  end if;

  return jsonb_build_object(
    'member_package_id',v_cycle.cycle_id,
    'package_id',v_cycle.package_id,
    'package_code',v_cycle.package_code,
    'package_name',v_cycle.package_name,
    'service_category',v_cycle.service_category,
    'sessions_left',v_cycle.sessions_left,
    'sessions_total',v_cycle.sessions_total,
    'sessions_used',v_cycle.sessions_used,
    'can_request_booking',v_can_request,
    'can_confirm_booking',v_can_confirm,
    'can_check_in',v_can_check_in,
    'blocking_reason',v_blocking_reason,
    'warning_level',v_warning_level,
    'warning_message',v_warning_message,
    'payment_stage_due',v_due_stage_key,
    'payment_stage_label',v_due_stage_label,
    'expires_at',v_cycle.expires_at,
    'shareable',v_cycle.shareable
  );
end;
$$;

revoke all on function private.package_eligibility(uuid,text) from public,anon;
grant execute on function private.package_eligibility(uuid,text) to authenticated,service_role;
