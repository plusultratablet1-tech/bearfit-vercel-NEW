-- BearFit package catalog, package cycles, staged payments, and central eligibility.
-- Scheduling uses package-cycle balances as the source of truth while public.members
-- counters remain a compatibility mirror during migration.

create table public.package_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  service_category text not null check (service_category in ('fitness','pilates_group','pilates_1on1')),
  included_sessions integer not null check (included_sessions >= 0),
  validity_days integer check (validity_days is null or validity_days > 0),
  shareable boolean not null default false,
  billing_mode text not null check (billing_mode in ('full','installment','single_session')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.package_payment_stages (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.package_definitions(id) on delete cascade,
  stage_order integer not null,
  stage_key text not null,
  label text not null,
  trigger_type text not null check (trigger_type in ('activation','sessions_left')),
  trigger_sessions_left integer,
  blocks_new_bookings_when_due boolean not null default false,
  active boolean not null default true,
  unique(package_id, stage_key),
  check (
    (trigger_type = 'activation' and trigger_sessions_left is null)
    or (trigger_type = 'sessions_left' and trigger_sessions_left is not null and trigger_sessions_left >= 0)
  )
);

create table public.member_package_cycles (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  package_id uuid not null references public.package_definitions(id),
  status text not null check (status in ('pending','active','depleted','expired','cancelled')),
  sessions_total integer not null check (sessions_total >= 0),
  sessions_used integer not null default 0 check (sessions_used >= 0),
  sessions_left integer not null check (sessions_left >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  renewed_from_id uuid references public.member_package_cycles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sessions_used + sessions_left <= sessions_total)
);

create table public.member_package_stage_payments (
  id uuid primary key default gen_random_uuid(),
  member_package_id uuid not null references public.member_package_cycles(id) on delete cascade,
  stage_id uuid not null references public.package_payment_stages(id),
  payment_id uuid references public.payments(id) on delete set null,
  status text not null check (status in ('due','pending','paid','waived')),
  due_at timestamptz not null default now(),
  paid_at timestamptz,
  unique(member_package_id, stage_id)
);

create index package_definitions_service_active_idx
  on public.package_definitions(service_category, active);
create index package_payment_stages_package_order_idx
  on public.package_payment_stages(package_id, stage_order);
create index member_package_cycles_member_status_idx
  on public.member_package_cycles(member_id, status, created_at desc);
create index member_package_cycles_package_idx
  on public.member_package_cycles(package_id);
create index member_package_stage_payments_cycle_status_idx
  on public.member_package_stage_payments(member_package_id, status);
create index member_package_stage_payments_payment_idx
  on public.member_package_stage_payments(payment_id)
  where payment_id is not null;

create trigger package_definitions_set_updated_at
before update on public.package_definitions
for each row execute function public.set_updated_at();

create trigger member_package_cycles_set_updated_at
before update on public.member_package_cycles
for each row execute function public.set_updated_at();

-- Canonical package catalog. Scheduling does not hard-code prices.
insert into public.package_definitions
  (code,name,service_category,included_sessions,validity_days,shareable,billing_mode,active)
values
  ('FULL24','Full 24','fitness',24,null,false,'full',true),
  ('FULL48','Full 48','fitness',48,null,false,'full',true),
  ('PARTIAL24','Partial 24','fitness',24,null,false,'installment',true),
  ('PILATES5','Pilates 5','pilates_group',5,30,false,'full',true),
  ('PILATES10','Pilates 10','pilates_group',10,45,true,'full',true),
  ('PILATES20','Pilates 20','pilates_group',20,60,true,'full',true),
  ('PILATES1ON1','Pilates 1-on-1','pilates_1on1',1,null,false,'single_session',true),
  ('LEGACY_FITNESS','Legacy Fitness','fitness',0,null,false,'full',false)
on conflict (code) do update set
  name = excluded.name,
  service_category = excluded.service_category,
  included_sessions = excluded.included_sessions,
  validity_days = excluded.validity_days,
  shareable = excluded.shareable,
  billing_mode = excluded.billing_mode,
  active = excluded.active;

-- Activation payment is required before a normal package cycle becomes usable.
insert into public.package_payment_stages
  (package_id, stage_order, stage_key, label, trigger_type, trigger_sessions_left, blocks_new_bookings_when_due)
select id, 1, 'activation', 'Activation payment', 'activation', null, true
from public.package_definitions
where code in ('FULL24','FULL48','PARTIAL24','PILATES5','PILATES10','PILATES20','PILATES1ON1')
on conflict (package_id, stage_key) do update set
  stage_order = excluded.stage_order,
  label = excluded.label,
  trigger_type = excluded.trigger_type,
  trigger_sessions_left = excluded.trigger_sessions_left,
  blocks_new_bookings_when_due = excluded.blocks_new_bookings_when_due,
  active = true;

-- Partial 24 installment gates. These stages gate new booking confirmations but
-- do not add/deduct sessions themselves.
insert into public.package_payment_stages
  (package_id, stage_order, stage_key, label, trigger_type, trigger_sessions_left, blocks_new_bookings_when_due)
select id, 2, 'sessions_left_19', '19 sessions left installment', 'sessions_left', 19, true
from public.package_definitions where code = 'PARTIAL24'
on conflict (package_id, stage_key) do update set
  stage_order = excluded.stage_order,
  label = excluded.label,
  trigger_type = excluded.trigger_type,
  trigger_sessions_left = excluded.trigger_sessions_left,
  blocks_new_bookings_when_due = excluded.blocks_new_bookings_when_due,
  active = true;

insert into public.package_payment_stages
  (package_id, stage_order, stage_key, label, trigger_type, trigger_sessions_left, blocks_new_bookings_when_due)
select id, 3, 'sessions_left_13', '13 sessions left installment', 'sessions_left', 13, true
from public.package_definitions where code = 'PARTIAL24'
on conflict (package_id, stage_key) do update set
  stage_order = excluded.stage_order,
  label = excluded.label,
  trigger_type = excluded.trigger_type,
  trigger_sessions_left = excluded.trigger_sessions_left,
  blocks_new_bookings_when_due = excluded.blocks_new_bookings_when_due,
  active = true;

-- Compatibility bootstrap: preserve every existing paid/credited fitness balance
-- without changing public.members counters. This hidden cycle has no payment gate.
insert into public.member_package_cycles (
  member_id,
  package_id,
  status,
  sessions_total,
  sessions_used,
  sessions_left,
  starts_at
)
select
  m.id,
  pd.id,
  case when m.sessions_left > 0 then 'active' else 'depleted' end,
  m.total_sessions,
  least(m.sessions_used, m.total_sessions),
  m.sessions_left,
  coalesce(m.last_paid_at, m.join_date, now())
from public.members m
join public.package_definitions pd on pd.code = 'LEGACY_FITNESS'
where m.total_sessions > 0
  and not exists (
    select 1 from public.member_package_cycles c where c.member_id = m.id
  );

alter table public.package_definitions enable row level security;
alter table public.package_payment_stages enable row level security;
alter table public.member_package_cycles enable row level security;
alter table public.member_package_stage_payments enable row level security;

revoke all on table public.package_definitions from anon, authenticated;
revoke all on table public.package_payment_stages from anon, authenticated;
revoke all on table public.member_package_cycles from anon, authenticated;
revoke all on table public.member_package_stage_payments from anon, authenticated;

grant select on table public.package_definitions to authenticated;
grant select on table public.package_payment_stages to authenticated;
grant select on table public.member_package_cycles to authenticated;
grant select on table public.member_package_stage_payments to authenticated;

grant select, insert, update, delete on table public.package_definitions to service_role;
grant select, insert, update, delete on table public.package_payment_stages to service_role;
grant select, insert, update, delete on table public.member_package_cycles to service_role;
grant select, insert, update, delete on table public.member_package_stage_payments to service_role;

create policy "package_definitions_read_active_or_staff"
on public.package_definitions
for select to authenticated
using (active or (select private.is_staff_or_admin()));

create policy "package_payment_stages_read_active_or_staff"
on public.package_payment_stages
for select to authenticated
using (
  (active and exists (
    select 1 from public.package_definitions d
    where d.id = package_payment_stages.package_id and d.active
  ))
  or (select private.is_staff_or_admin())
);

create policy "member_package_cycles_read_own_or_staff"
on public.member_package_cycles
for select to authenticated
using (
  exists (
    select 1 from public.members m
    where m.id = member_package_cycles.member_id
      and m.user_id = (select auth.uid())
  )
  or (select private.is_staff_or_admin())
);

create policy "member_package_stage_payments_read_own_or_staff"
on public.member_package_stage_payments
for select to authenticated
using (
  exists (
    select 1
    from public.member_package_cycles c
    join public.members m on m.id = c.member_id
    where c.id = member_package_stage_payments.member_package_id
      and m.user_id = (select auth.uid())
  )
  or (select private.is_staff_or_admin())
);

-- Central package eligibility. Payment gates block NEW requests/confirmations, while
-- already-confirmed sessions may still be attended as long as the package is active,
-- unexpired, and has a remaining session.
create or replace function private.package_eligibility(
  p_member_id uuid,
  p_service_category text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cycle record;
  v_due_stage record;
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

  select
    c.id as cycle_id,
    c.member_id,
    c.status,
    c.sessions_total,
    c.sessions_used,
    c.sessions_left,
    c.starts_at,
    c.expires_at,
    d.id as package_id,
    d.code as package_code,
    d.name as package_name,
    d.service_category,
    d.shareable,
    d.billing_mode
  into v_cycle
  from public.member_package_cycles c
  join public.package_definitions d on d.id = c.package_id
  where c.member_id = p_member_id
    and d.service_category = p_service_category
    and c.status in ('active','depleted','expired')
  order by
    case when c.status = 'active' then 0 else 1 end,
    c.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'member_package_id', null,
      'package_code', null,
      'package_name', null,
      'service_category', p_service_category,
      'sessions_left', 0,
      'sessions_total', 0,
      'can_request_booking', false,
      'can_confirm_booking', false,
      'can_check_in', false,
      'blocking_reason', 'No active package',
      'warning_level', 'none',
      'warning_message', null,
      'payment_stage_due', null,
      'expires_at', null
    );
  end if;

  v_expired := v_cycle.status = 'expired'
    or (v_cycle.expires_at is not null and v_cycle.expires_at <= now());

  if v_expired then
    v_blocking_reason := 'Package expired';
  elsif v_cycle.status <> 'active' or v_cycle.sessions_left <= 0 then
    v_blocking_reason := 'No sessions remaining';
  else
    v_can_check_in := true;

    select
      s.id,
      s.stage_key,
      s.label,
      s.trigger_type,
      s.trigger_sessions_left,
      coalesce(sp.status, 'due') as payment_status
    into v_due_stage
    from public.package_payment_stages s
    left join public.member_package_stage_payments sp
      on sp.member_package_id = v_cycle.cycle_id
     and sp.stage_id = s.id
    where s.package_id = v_cycle.package_id
      and s.active
      and s.blocks_new_bookings_when_due
      and (
        s.trigger_type = 'activation'
        or (
          s.trigger_type = 'sessions_left'
          and v_cycle.sessions_left <= s.trigger_sessions_left
        )
      )
      and coalesce(sp.status, 'due') not in ('paid','waived')
    order by s.stage_order desc
    limit 1;

    if found then
      v_blocking_reason := 'Payment Due';
    else
      v_can_request := true;
      v_can_confirm := true;
    end if;
  end if;

  if not v_expired and v_cycle.sessions_left = 2 then
    v_warning_level := 'warning';
    v_warning_message := 'Renewal Soon';
  elsif not v_expired and v_cycle.sessions_left = 1 then
    v_warning_level := 'critical';
    v_warning_message := 'Last Session — Renew Now';
  end if;

  return jsonb_build_object(
    'member_package_id', v_cycle.cycle_id,
    'package_id', v_cycle.package_id,
    'package_code', v_cycle.package_code,
    'package_name', v_cycle.package_name,
    'service_category', v_cycle.service_category,
    'sessions_left', v_cycle.sessions_left,
    'sessions_total', v_cycle.sessions_total,
    'sessions_used', v_cycle.sessions_used,
    'can_request_booking', v_can_request,
    'can_confirm_booking', v_can_confirm,
    'can_check_in', v_can_check_in,
    'blocking_reason', v_blocking_reason,
    'warning_level', v_warning_level,
    'warning_message', v_warning_message,
    'payment_stage_due', case when v_due_stage.id is null then null else v_due_stage.stage_key end,
    'payment_stage_label', case when v_due_stage.id is null then null else v_due_stage.label end,
    'expires_at', v_cycle.expires_at,
    'shareable', v_cycle.shareable
  );
end;
$$;

revoke all on function private.package_eligibility(uuid, text) from public, anon;
grant execute on function private.package_eligibility(uuid, text) to authenticated, service_role;

create or replace function public.member_package_eligibility(
  p_service_category text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select id into v_member_id
  from public.members
  where user_id = (select auth.uid());

  if v_member_id is null then
    raise exception 'Member profile not found';
  end if;

  return private.package_eligibility(v_member_id, p_service_category);
end;
$$;

revoke all on function public.member_package_eligibility(text) from public, anon;
grant execute on function public.member_package_eligibility(text) to authenticated, service_role;

create or replace function public.staff_package_attention_queue()
returns table (
  member_id uuid,
  member_code text,
  member_name text,
  member_package_id uuid,
  package_code text,
  package_name text,
  service_category text,
  sessions_left integer,
  reason text,
  warning_level text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.member_code,
    m.full_name,
    c.id,
    d.code,
    d.name,
    d.service_category,
    c.sessions_left,
    case
      when c.expires_at is not null and c.expires_at <= now() then 'expired'
      when exists (
        select 1
        from public.package_payment_stages s
        left join public.member_package_stage_payments sp
          on sp.member_package_id = c.id and sp.stage_id = s.id
        where s.package_id = c.package_id
          and s.active
          and s.blocks_new_bookings_when_due
          and (
            s.trigger_type = 'activation'
            or (s.trigger_type = 'sessions_left' and c.sessions_left <= s.trigger_sessions_left)
          )
          and coalesce(sp.status, 'due') not in ('paid','waived')
      ) then 'payment_due'
      when c.sessions_left = 1 then 'last_session'
      when c.sessions_left = 2 then 'renewal_soon'
      else null
    end as reason,
    case
      when c.expires_at is not null and c.expires_at <= now() then 'critical'
      when exists (
        select 1
        from public.package_payment_stages s
        left join public.member_package_stage_payments sp
          on sp.member_package_id = c.id and sp.stage_id = s.id
        where s.package_id = c.package_id
          and s.active
          and s.blocks_new_bookings_when_due
          and (
            s.trigger_type = 'activation'
            or (s.trigger_type = 'sessions_left' and c.sessions_left <= s.trigger_sessions_left)
          )
          and coalesce(sp.status, 'due') not in ('paid','waived')
      ) then 'critical'
      when c.sessions_left = 1 then 'critical'
      when c.sessions_left = 2 then 'warning'
      else 'none'
    end as warning_level,
    c.expires_at
  from public.member_package_cycles c
  join public.members m on m.id = c.member_id
  join public.package_definitions d on d.id = c.package_id
  where c.status = 'active'
    and (
      (c.expires_at is not null and c.expires_at <= now())
      or c.sessions_left in (1,2)
      or exists (
        select 1
        from public.package_payment_stages s
        left join public.member_package_stage_payments sp
          on sp.member_package_id = c.id and sp.stage_id = s.id
        where s.package_id = c.package_id
          and s.active
          and s.blocks_new_bookings_when_due
          and (
            s.trigger_type = 'activation'
            or (s.trigger_type = 'sessions_left' and c.sessions_left <= s.trigger_sessions_left)
          )
          and coalesce(sp.status, 'due') not in ('paid','waived')
      )
    )
    and (select private.is_staff_or_admin())
  order by
    case
      when c.expires_at is not null and c.expires_at <= now() then 0
      when c.sessions_left = 1 then 1
      when c.sessions_left = 2 then 2
      else 3
    end,
    c.sessions_left asc,
    m.full_name asc;
$$;

revoke all on function public.staff_package_attention_queue() from public, anon;
grant execute on function public.staff_package_attention_queue() to authenticated, service_role;
