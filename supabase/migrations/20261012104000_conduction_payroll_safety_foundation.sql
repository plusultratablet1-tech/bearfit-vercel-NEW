-- BearFit payroll safety foundation. Intentionally NOT connected to staff_qr_checkin.
-- No historical session consumption, balances, Bearforce events, or payroll payouts are changed.
-- No authenticated role can write these ledgers until separately reviewed RPCs are deployed.

create table if not exists public.coach_shifts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete restrict,
  branch text not null check (length(btrim(branch))>0),
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  correction_reason text,
  created_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at)
);
create unique index if not exists coach_shifts_one_open_per_coach
  on public.coach_shifts(coach_id) where clock_out_at is null;
create index if not exists coach_shifts_coach_time_idx
  on public.coach_shifts(coach_id,clock_in_at desc);

create table if not exists public.coach_payroll_cutoffs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open','for_review','approved','locked','paid')),
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  locked_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(coach_id,period_start),
  check (
    (extract(day from period_start)=1 and period_end=period_start+14)
    or
    (extract(day from period_start)=16 and period_end=
      (date_trunc('month',period_start::timestamp) + interval '1 month' - interval '1 day')::date)
  ),
  check (period_end>=period_start),
  check (status not in ('approved','locked','paid') or (approved_by is not null and approved_at is not null)),
  check (status not in ('locked','paid') or locked_at is not null),
  check (status<>'paid' or paid_at is not null)
);

create table if not exists public.coach_conductions (
  id uuid primary key default gen_random_uuid(),
  session_log_id uuid not null unique references public.session_logs(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  coach_id uuid not null references public.coaches(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete restrict,
  session_date date not null, -- Philippine local date; booking start for booked training
  branch text not null check(length(btrim(branch))>0),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  rate_history_id uuid references public.coach_rate_history(id) on delete restrict,
  rate_snapshot numeric(12,2) check(rate_snapshot>0),
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  payroll_cutoff_id uuid references public.coach_payroll_cutoffs(id) on delete restrict,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status='pending' and approved_by is null and approved_at is null and rate_snapshot is null and rate_history_id is null and payroll_cutoff_id is null)
    or
    (status='rejected' and approved_by is null and approved_at is null and rate_snapshot is null and rate_history_id is null and payroll_cutoff_id is null and length(btrim(coalesce(review_reason,'')))>0)
    or
    (status='approved' and approved_by is not null and approved_at is not null and rate_history_id is not null and rate_snapshot is not null)
  )
);
create index if not exists coach_conductions_cutoff_idx on public.coach_conductions(coach_id,session_date,status);

create table if not exists public.coach_payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  cutoff_id uuid not null references public.coach_payroll_cutoffs(id) on delete restrict,
  conduction_id uuid references public.coach_conductions(id) on delete restrict,
  amount numeric(12,2) not null check(amount<>0),
  reason text not null check(length(btrim(reason))>=10),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_payroll_audit (
  id uuid primary key default gen_random_uuid(),
  entity text not null check(entity in ('conduction','cutoff','shift','adjustment')),
  entity_id uuid not null,
  operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

-- Basic referential and payroll checks even for privileged writes.
create or replace function private.guard_coach_conduction()
returns trigger language plpgsql set search_path='' as $$
declare
  v_log public.session_logs%rowtype;
  v_booking public.bookings%rowtype;
  v_rate public.coach_rate_history%rowtype;
  v_cutoff public.coach_payroll_cutoffs%rowtype;
  v_date date;
begin
  if tg_op='UPDATE' and old.payroll_cutoff_id is not null then
    raise exception 'Conductions already attached to payroll are immutable; use adjustments';
  end if;
  if tg_op='UPDATE' and old.status='approved' then
    -- An approved attendance can be attached to its first cutoff exactly once.
    -- Its coach, member, rate, session and approval evidence cannot change.
    if new.payroll_cutoff_id is null or
       (to_jsonb(new)-'payroll_cutoff_id'-'updated_at') <>
       (to_jsonb(old)-'payroll_cutoff_id'-'updated_at') then
      raise exception 'Approved conduction may only be assigned once to an eligible payroll cutoff';
    end if;
  end if;
  select * into v_log from public.session_logs where id=new.session_log_id;
  if not found then raise exception 'Attendance session log not found'; end if;
  if v_log.member_id<>new.member_id or v_log.booking_id is distinct from new.booking_id then
    raise exception 'Conduction must match source attendance member and booking';
  end if;

  if new.booking_id is not null then
    select * into v_booking from public.bookings where id=new.booking_id;
    if not found or v_booking.member_id<>new.member_id then
      raise exception 'Booking is not owned by the attending member';
    end if;
    if v_booking.status<>'completed' then
      raise exception 'No-show, cancelled, pending and uncompleted bookings are not payable';
    end if;
    if v_booking.start_at is null or new.branch<>v_booking.branch then
      raise exception 'Conduction must match the completed booking branch and date';
    end if;
    v_date:=(v_booking.start_at at time zone 'Asia/Manila')::date;
  else
    v_date:=(v_log.trained_at at time zone 'Asia/Manila')::date;
  end if;
  if new.session_date<>v_date then
    raise exception 'Conduction period must follow the source session Asia/Manila date';
  end if;
  if new.status='approved' then
    select * into v_rate from public.coach_rate_history where id=new.rate_history_id;
    if not found or v_rate.coach_id<>new.coach_id or v_rate.effective_from>new.session_date
      or v_rate.per_conduction_rate<>new.rate_snapshot then
      raise exception 'Approved conduction requires the matching effective coach rate snapshot';
    end if;
    if exists (
      select 1 from public.coach_rate_history later
      where later.coach_id=new.coach_id
        and later.effective_from<=new.session_date
        and later.effective_from>v_rate.effective_from
    ) then
      raise exception 'An approved conduction must use the latest rate effective on session date';
    end if;
  end if;
  if new.payroll_cutoff_id is not null then
    if new.status<>'approved' then raise exception 'Only approved conductions may be assigned to payroll'; end if;
    select * into v_cutoff from public.coach_payroll_cutoffs where id=new.payroll_cutoff_id;
    if not found or v_cutoff.coach_id<>new.coach_id or new.session_date not between v_cutoff.period_start and v_cutoff.period_end then
      raise exception 'Payroll cutoff must match coach and actual session date';
    end if;
    if v_cutoff.status in ('locked','paid') then
      raise exception 'Locked or paid cutoff cannot receive new conductions';
    end if;
  end if;
  return new;
end; $$;
create trigger guard_coach_conduction_before_write
  before insert or update on public.coach_conductions
  for each row execute function private.guard_coach_conduction();

-- Cutoffs cannot be edited once locked/paid, and status cannot leap forward.
create or replace function private.guard_coach_payroll_cutoff()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if old.status='paid' then
      raise exception 'Paid payroll cannot be modified in place';
    end if;
    if old.status='locked' and
       (new.status<>'paid' or new.paid_at is null
        or (to_jsonb(new)-'status'-'paid_at')<>(to_jsonb(old)-'status'-'paid_at')) then
      raise exception 'Locked payroll may only transition once to paid';
    end if;
    if new.coach_id<>old.coach_id or new.period_start<>old.period_start or new.period_end<>old.period_end then
      raise exception 'Payroll cutoff identity and dates cannot be changed';
    end if;
    if not (
      (old.status='open' and new.status in ('open','for_review'))
      or (old.status='for_review' and new.status in ('for_review','approved','open'))
      or (old.status='approved' and new.status in ('approved','locked','for_review'))
      or (old.status='locked' and new.status='paid')
    ) then
      raise exception 'Invalid payroll approval transition';
    end if;
  end if;
  return new;
end; $$;
create trigger guard_coach_payroll_cutoff_before_write
  before update on public.coach_payroll_cutoffs
  for each row execute function private.guard_coach_payroll_cutoff();

create or replace function private.guard_coach_payroll_adjustment()
returns trigger language plpgsql set search_path='' as $$
declare v_cutoff public.coach_payroll_cutoffs%rowtype;
begin
  select * into v_cutoff from public.coach_payroll_cutoffs where id=new.cutoff_id;
  if not found then raise exception 'Payroll cutoff not found'; end if;
  if v_cutoff.status in ('locked','paid') then
    raise exception 'Use a later open cutoff for post-payment corrections';
  end if;
  if new.conduction_id is not null and not exists(
    select 1 from public.coach_conductions c where c.id=new.conduction_id and c.coach_id=v_cutoff.coach_id
  ) then
    raise exception 'Correction references a conduction belonging to another coach';
  end if;
  return new;
end; $$;
create trigger guard_coach_payroll_adjustment_before_write
  before insert on public.coach_payroll_adjustments
  for each row execute function private.guard_coach_payroll_adjustment();

-- Audit all future operational inserts and updates, retaining before-and-after images.
create or replace function private.audit_coach_payroll_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  v_id:=case when tg_op='DELETE' then old.id else new.id end;
  insert into public.coach_payroll_audit(entity,entity_id,operation,old_data,new_data,changed_by)
  values (
    case tg_table_name
      when 'coach_conductions' then 'conduction'
      when 'coach_payroll_cutoffs' then 'cutoff'
      when 'coach_shifts' then 'shift'
      else 'adjustment' end,
    v_id,tg_op,
    case when tg_op='INSERT' then null else to_jsonb(old) end,
    case when tg_op='DELETE' then null else to_jsonb(new) end,
    (select auth.uid())
  );
  return coalesce(new,old);
end; $$;
create trigger audit_coach_conductions after insert or update or delete on public.coach_conductions
  for each row execute function private.audit_coach_payroll_change();
create trigger audit_coach_shifts after insert or update or delete on public.coach_shifts
  for each row execute function private.audit_coach_payroll_change();
create trigger audit_coach_cutoffs after insert or update or delete on public.coach_payroll_cutoffs
  for each row execute function private.audit_coach_payroll_change();
create trigger audit_coach_adjustments after insert or update or delete on public.coach_payroll_adjustments
  for each row execute function private.audit_coach_payroll_change();

-- Payroll adjustments and the audit trail are append-only, even for privileged updates.
create or replace function private.prevent_payroll_history_mutation()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Immutable coach payroll history; record a new corrective entry instead'; end; $$;
create trigger prevent_coach_payroll_adjustment_mutation
  before update or delete on public.coach_payroll_adjustments for each row
  execute function private.prevent_payroll_history_mutation();
create trigger prevent_coach_payroll_audit_mutation
  before update or delete on public.coach_payroll_audit for each row
  execute function private.prevent_payroll_history_mutation();

-- Any previously recorded payable source or historical rate must not be deleted.
-- Corrections are new audited events/adjustments rather than destructive rewrites.
create trigger prevent_coach_conduction_deletion
  before delete on public.coach_conductions for each row
  execute function private.prevent_payroll_history_mutation();
create trigger prevent_coach_cutoff_deletion
  before delete on public.coach_payroll_cutoffs for each row
  execute function private.prevent_payroll_history_mutation();
create trigger prevent_coach_shift_deletion
  before delete on public.coach_shifts for each row
  execute function private.prevent_payroll_history_mutation();
create trigger prevent_coach_rate_history_mutation
  before update or delete on public.coach_rate_history for each row
  execute function private.prevent_payroll_history_mutation();

alter table public.coach_shifts enable row level security;
alter table public.coach_conductions enable row level security;
alter table public.coach_payroll_cutoffs enable row level security;
alter table public.coach_payroll_adjustments enable row level security;
alter table public.coach_payroll_audit enable row level security;

-- Read-only admin access during Phase 2: no INSERT/UPDATE/DELETE or write RPCs.
create policy coach_shifts_admin_read on public.coach_shifts for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy coach_conductions_admin_read on public.coach_conductions for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy coach_cutoffs_admin_read on public.coach_payroll_cutoffs for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy coach_adjustments_admin_read on public.coach_payroll_adjustments for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy coach_audit_admin_read on public.coach_payroll_audit for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));

revoke all on table public.coach_shifts, public.coach_conductions,
  public.coach_payroll_cutoffs, public.coach_payroll_adjustments, public.coach_payroll_audit
  from public,anon,authenticated;
grant select on table public.coach_shifts, public.coach_conductions,
  public.coach_payroll_cutoffs, public.coach_payroll_adjustments, public.coach_payroll_audit
  to authenticated;
