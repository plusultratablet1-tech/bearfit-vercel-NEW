-- BearFit catalog-driven payments.
-- Activation payments create/activate a package cycle exactly once.
-- Partial 24 installment payments clear booking gates but never duplicate sessions.

alter table public.payments
  add column if not exists package_definition_id uuid references public.package_definitions(id),
  add column if not exists member_package_id uuid references public.member_package_cycles(id),
  add column if not exists package_stage_id uuid references public.package_payment_stages(id);

create index if not exists payments_package_definition_idx on public.payments(package_definition_id);
create index if not exists payments_member_package_idx on public.payments(member_package_id);
create index if not exists payments_package_stage_idx on public.payments(package_stage_id);

create or replace function private.sync_member_primary_balance(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle record;
begin
  select c.*, d.name as package_name
    into v_cycle
  from public.member_package_cycles c
  join public.package_definitions d on d.id = c.package_id
  where c.member_id = p_member_id
    and d.service_category = 'fitness'
    and c.status in ('active','depleted')
  order by case when c.status = 'active' then 0 else 1 end, c.created_at desc
  limit 1;

  if found then
    update public.members
    set package_name = v_cycle.package_name,
        package_type = v_cycle.package_name,
        total_sessions = v_cycle.sessions_total,
        sessions_used = v_cycle.sessions_used,
        sessions_left = v_cycle.sessions_left
    where id = p_member_id;
  end if;
end;
$$;

revoke all on function private.sync_member_primary_balance(uuid) from public, anon;
grant execute on function private.sync_member_primary_balance(uuid) to authenticated, service_role;

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
  elsif v_stage.stage_key <> 'activation' then
    -- PARTIAL24 installment stages (19/13) only clear the gate.
    -- They intentionally add zero sessions.
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
  end if;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'member_package_id', v_cycle.id,
    'package_code', v_definition.code,
    'stage_key', v_stage.stage_key,
    'status', 'paid',
    'activation_credit_applied', v_activation_credit_applied,
    'sessions_credited', case when v_activation_credit_applied then v_definition.included_sessions else 0 end
  );
end;
$$;

revoke all on function public.staff_mark_package_payment_paid(uuid) from public, anon;
grant execute on function public.staff_mark_package_payment_paid(uuid) to authenticated, service_role;

create or replace function public.staff_record_package_payment(
  p_member_id uuid,
  p_package_code text,
  p_stage_key text,
  p_amount numeric,
  p_payment_type text,
  p_status text,
  p_member_package_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_definition public.package_definitions%rowtype;
  v_stage public.package_payment_stages%rowtype;
  v_cycle public.member_package_cycles%rowtype;
  v_payment_id uuid;
  v_status text := lower(trim(coalesce(p_status, 'pending')));
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (select private.is_staff_or_admin()) then raise exception 'Staff access required'; end if;
  if v_status not in ('pending','paid') then raise exception 'Payment status must be pending or paid'; end if;
  if coalesce(p_amount, 0) < 0 then raise exception 'Amount cannot be negative'; end if;
  if not exists (select 1 from public.members where id = p_member_id) then raise exception 'Member not found'; end if;

  select * into v_definition
  from public.package_definitions
  where code = upper(trim(p_package_code)) and active;
  if not found then raise exception 'Package not found or inactive'; end if;

  select * into v_stage
  from public.package_payment_stages
  where package_id = v_definition.id
    and stage_key = trim(p_stage_key)
    and active;
  if not found then raise exception 'Package payment stage not found'; end if;

  if v_stage.stage_key = 'activation' then
    if p_member_package_id is not null then
      select * into v_cycle
      from public.member_package_cycles
      where id = p_member_package_id and member_id = p_member_id and package_id = v_definition.id
      for update;
      if not found then raise exception 'Package cycle does not match member/package'; end if;
    else
      insert into public.member_package_cycles (
        member_id, package_id, status, sessions_total, sessions_used, sessions_left
      ) values (
        p_member_id, v_definition.id, 'pending', v_definition.included_sessions, 0, 0
      ) returning * into v_cycle;
    end if;
  else
    if p_member_package_id is null then raise exception 'Existing package cycle required for installment payment'; end if;
    select * into v_cycle
    from public.member_package_cycles
    where id = p_member_package_id and member_id = p_member_id and package_id = v_definition.id
    for update;
    if not found then raise exception 'Package cycle does not match member/package'; end if;
    if v_definition.code <> 'PARTIAL24' then raise exception 'Installment stage is only valid for PARTIAL24'; end if;
  end if;

  insert into public.member_package_stage_payments (
    member_package_id, stage_id, status
  ) values (
    v_cycle.id, v_stage.id, case when v_status = 'paid' then 'pending' else 'pending' end
  )
  on conflict (member_package_id, stage_id) do update
    set status = case when public.member_package_stage_payments.status = 'paid' then 'paid' else 'pending' end;

  insert into public.payments (
    member_id, package_name, stage, amount, status, payment_type,
    sessions_purchased, created_by, package_definition_id, member_package_id, package_stage_id
  ) values (
    p_member_id, v_definition.name, v_stage.stage_key, coalesce(p_amount,0), v_status,
    nullif(trim(coalesce(p_payment_type,'')), ''), 0, (select auth.uid()),
    v_definition.id, v_cycle.id, v_stage.id
  ) returning id into v_payment_id;

  update public.member_package_stage_payments
  set payment_id = v_payment_id
  where member_package_id = v_cycle.id and stage_id = v_stage.id;

  if v_status = 'paid' then
    return public.staff_mark_package_payment_paid(v_payment_id);
  end if;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'member_package_id', v_cycle.id,
    'package_code', v_definition.code,
    'stage_key', v_stage.stage_key,
    'status', 'pending',
    'sessions_credited', 0
  );
end;
$$;

revoke all on function public.staff_record_package_payment(uuid,text,text,numeric,text,text,uuid) from public, anon;
grant execute on function public.staff_record_package_payment(uuid,text,text,numeric,text,text,uuid) to authenticated, service_role;
