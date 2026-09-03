# BearFit Scheduling & Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build BearFit's package-aware scheduling system so staff can publish availability, members can request slots/custom times, staff can confirm/reject safely, confirmed sessions appear on the dashboard, and check-in/no-show deductions use the correct package exactly once.

**Architecture:** Add package catalog/cycle tables beside the existing member counters, then add recurring availability, concrete schedule slots, and bookings. All writes remain server-authorized through Postgres RPCs; the existing `members.sessions_*` fields remain a compatibility mirror while the new package cycle becomes the scheduling source of truth. Member and staff UIs read the same package eligibility and booking data so payment gates, capacity, renewal warnings, and attendance cannot disagree.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, Supabase Auth/Postgres/RLS/RPC, `@supabase/ssr`, Tailwind CSS, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-03-bearfit-scheduling-booking-design.md`

## Global Constraints

- Member self-booking requires the requested start to be at least **24 hours** away.
- Member self-cancellation is allowed until **4 hours** before start; later changes require staff/admin handling.
- Members may self-book only at their assigned/home branch.
- Members may choose a specific coach or `Any available coach`.
- Default duration is **60 minutes**, but staff may override per slot.
- Private capacity defaults to `1`; group capacity is staff-defined and may be greater than `1`.
- Pending requests do **not** consume slot capacity; only confirmed bookings count.
- Booking/confirmation does **not** deduct a session; attendance or an explicitly charged no-show does.
- Partial 24: activation payment, blocking installment gates at 19 and 13 sessions left, `Renewal Soon` at 2, `Last Session — Renew Now` at 1, hard block at 0.
- Pilates 5 = 5 sessions / 30 days / non-shareable; Pilates 10 = 10 / 45 / shareable; Pilates 20 = 20 / 60 / shareable; Pilates 1-on-1 is a distinct service category.
- Existing Payments → Check-in → Dashboard behavior must remain working throughout migration.
- No SMS/email/push, waitlist, Google Calendar sync, payment gateway, or true shared-credit relationship in this release.
- V1 booking-aware attendance uses the confirmed booking selected by staff; no automatic time-window rejection is added beyond requiring that booking to be `confirmed`. This avoids introducing an unapproved attendance cutoff while preserving exact booking linkage.

---

## Planned File Map

**Database migrations**
- Create `supabase/migrations/20260903090000_package_catalog_cycles.sql` — package catalog, package stages, member package cycles, stage payment links, compatibility bootstrap, eligibility helpers.
- Create `supabase/migrations/20260903091000_package_payment_integration.sql` — catalog-driven payment RPCs and compatibility mirroring.
- Create `supabase/migrations/20260903092000_scheduling_schema.sql` — recurring availability, concrete slots, bookings, RLS/indexes.
- Create `supabase/migrations/20260903093000_booking_operations.sql` — slot generation, member request/cancel, staff confirm/reject/assign/cancel RPCs.
- Create `supabase/migrations/20260903094000_booking_attendance.sql` — package-aware check-in, no-show charging, booking/session-log linkage.

**Shared application code**
- Modify `lib/database.types.ts` after type generation.
- Create `lib/scheduling.ts` — typed scheduling/package view models and server loaders.
- Modify `lib/member-account.ts` — include primary package eligibility, upcoming bookings, and package alerts.

**Member UI**
- Create `app/member/schedule/page.tsx` — authenticated member route and initial server payload.
- Create `app/member/schedule/MemberSchedulePageClient.tsx` — slots, booking requests, custom request, cancellation.
- Modify `components/bearfit/BearfitDashboardClient.tsx` — real Upcoming Sessions + package notices + Schedule navigation.
- Modify `app/member/dashboard/page.tsx` — pass scheduling/eligibility data.

**Staff UI**
- Create `app/staff/schedule/page.tsx` — staff/admin protected schedule workspace.
- Create `app/staff/schedule/StaffSchedulePageClient.tsx` — availability, one-off slots, request queue, confirmation/rejection/no-show actions.
- Modify `app/payments/PaymentsPageClient.tsx` — use catalog/package-stage payment flow.
- Modify `app/checkin/CheckInPageClient.tsx` — resolve booking/package before deduction.

**Tests**
- Create `tests/package-cycles.test.mjs`.
- Create `tests/scheduling-schema.test.mjs`.
- Create `tests/booking-rpcs.test.mjs`.
- Create `tests/booking-attendance.test.mjs`.
- Create `tests/member-schedule-ui.test.mjs`.
- Create `tests/staff-schedule-ui.test.mjs`.
- Modify `tests/payments-checkin-flow.test.mjs`.
- Modify `tests/member-dashboard-real-data.test.mjs`.

---

### Task 1: Package catalog, cycles, payment stages, and eligibility

**Files:**
- Create: `supabase/migrations/20260903090000_package_catalog_cycles.sql`
- Create: `tests/package-cycles.test.mjs`

**Interfaces:**
- Produces tables: `package_definitions`, `package_payment_stages`, `member_package_cycles`, `member_package_stage_payments`.
- Produces private helper: `private.package_eligibility(p_member_id uuid, p_service_category text) returns jsonb`.
- Produces public wrapper: `public.member_package_eligibility(p_service_category text) returns jsonb`.
- Produces staff queue: `public.staff_package_attention_queue() returns table (...)`.
- Later tasks depend on service categories `fitness`, `pilates_group`, and `pilates_1on1` exactly.

- [ ] **Step 1: Write the failing package-cycle structure tests**

Create `tests/package-cycles.test.mjs` with assertions for all required tables, seeded package codes, Partial 24 stage triggers, RLS, and eligibility warning text:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = new URL('../supabase/migrations/20260903090000_package_catalog_cycles.sql', import.meta.url)

test('package catalog seeds BearFit and Pilates products', () => {
  assert.equal(fs.existsSync(migration), true)
  const sql = fs.readFileSync(migration, 'utf8')
  for (const code of ['FULL24', 'FULL48', 'PARTIAL24', 'PILATES5', 'PILATES10', 'PILATES20', 'PILATES1ON1']) {
    assert.match(sql, new RegExp(code))
  }
  assert.match(sql, /PILATES5[\s\S]*5[\s\S]*30/i)
  assert.match(sql, /PILATES10[\s\S]*10[\s\S]*45/i)
  assert.match(sql, /PILATES20[\s\S]*20[\s\S]*60/i)
})

test('Partial 24 has activation, 19-left and 13-left payment stages', () => {
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /PARTIAL24[\s\S]*activation/i)
  assert.match(sql, /19/)
  assert.match(sql, /13/)
  assert.match(sql, /Renewal Soon/i)
  assert.match(sql, /Last Session/i)
})

test('package balance writes are protected by RLS and helper functions', () => {
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /alter table public\.member_package_cycles enable row level security/i)
  assert.match(sql, /private\.package_eligibility/i)
  assert.match(sql, /member_package_eligibility/i)
  assert.match(sql, /staff_package_attention_queue/i)
})
```

- [ ] **Step 2: Run the new test and verify it fails**

Run: `node --test tests/package-cycles.test.mjs`

Expected: FAIL because `20260903090000_package_catalog_cycles.sql` does not exist.

- [ ] **Step 3: Create the package tables, checks, indexes, and seed data**

The migration must create these exact core shapes:

```sql
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
  unique(package_id, stage_key)
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
```

Seed the exact product data:

```sql
insert into public.package_definitions (code,name,service_category,included_sessions,validity_days,shareable,billing_mode)
values
  ('FULL24','Full 24','fitness',24,null,false,'full'),
  ('FULL48','Full 48','fitness',48,null,false,'full'),
  ('PARTIAL24','Partial 24','fitness',24,null,false,'installment'),
  ('PILATES5','Pilates 5','pilates_group',5,30,false,'full'),
  ('PILATES10','Pilates 10','pilates_group',10,45,true,'full'),
  ('PILATES20','Pilates 20','pilates_group',20,60,true,'full'),
  ('PILATES1ON1','Pilates 1-on-1','pilates_1on1',1,null,false,'single_session')
on conflict (code) do update set
  name = excluded.name,
  service_category = excluded.service_category,
  included_sessions = excluded.included_sessions,
  validity_days = excluded.validity_days,
  shareable = excluded.shareable,
  billing_mode = excluded.billing_mode;
```

Seed activation for all products plus Partial 24 blocking gates at 19 and 13.

- [ ] **Step 4: Add compatibility bootstrap and central eligibility logic**

Add a hidden `LEGACY_FITNESS` catalog row and bootstrap any existing member with `total_sessions > 0` and no package cycle into one active/depleted cycle preserving `sessions_used` and `sessions_left`. Do not mutate existing member counters during bootstrap.

`private.package_eligibility` must:

```sql
-- Pseudocode contract implemented in PL/pgSQL:
-- 1. choose newest active, unexpired cycle matching service_category
-- 2. return blocked if none exists, expired, or sessions_left = 0
-- 3. for PARTIAL24, detect due/unpaid blocking stages whose trigger threshold has been reached
-- 4. at 2 left return warning_level='warning', warning_message='Renewal Soon'
-- 5. at 1 left return warning_level='critical', warning_message='Last Session — Renew Now'
-- 6. return can_request_booking/can_confirm_booking/can_check_in booleans
```

Expose `member_package_eligibility` only to the current member; expose `staff_package_attention_queue` only to staff/admin and include `payment_due`, `renewal_soon`, `last_session`, and `expired` reasons.

- [ ] **Step 5: Add RLS/grants**

Members may read their own cycles/stage-payment rows and all active package definitions. Staff/admin may read all. Direct authenticated inserts/updates/deletes on package balances/stages are revoked; state changes happen through later RPCs/service-role migrations.

- [ ] **Step 6: Run package tests**

Run: `node --test tests/package-cycles.test.mjs`

Expected: PASS.

- [ ] **Step 7: Apply migration in Supabase and verify seeds**

Apply `20260903090000_package_catalog_cycles.sql`, then execute:

```sql
select code, included_sessions, validity_days, shareable, billing_mode
from public.package_definitions
where code in ('FULL24','FULL48','PARTIAL24','PILATES5','PILATES10','PILATES20','PILATES1ON1')
order by code;
```

Expected: 7 rows with values matching the approved spec.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260903090000_package_catalog_cycles.sql tests/package-cycles.test.mjs
git commit -m "feat: add package cycles and eligibility"
```

---

### Task 2: Catalog-driven payment activation and Partial 24 installments

**Files:**
- Create: `supabase/migrations/20260903091000_package_payment_integration.sql`
- Modify: `app/payments/PaymentsPageClient.tsx`
- Modify: `tests/payments-checkin-flow.test.mjs`

**Interfaces:**
- Produces RPC: `staff_record_package_payment(p_member_id uuid, p_package_code text, p_stage_key text, p_amount numeric, p_payment_type text, p_status text, p_member_package_id uuid default null) returns jsonb`.
- Produces RPC: `staff_mark_package_payment_paid(p_payment_id uuid) returns jsonb`.
- Keeps legacy `staff_record_payment` and `staff_mark_payment_paid` available until production verification is complete.
- Payment activation creates/activates exactly one package cycle; installment payments never duplicate session credits.

- [ ] **Step 1: Extend failing payment tests**

Add assertions:

```js
const packagePaymentMigration = new URL('../supabase/migrations/20260903091000_package_payment_integration.sql', import.meta.url)

test('catalog payment flow creates package cycles and never credits installment sessions twice', () => {
  assert.equal(fs.existsSync(packagePaymentMigration), true)
  const sql = fs.readFileSync(packagePaymentMigration, 'utf8')
  assert.match(sql, /staff_record_package_payment/i)
  assert.match(sql, /staff_mark_package_payment_paid/i)
  assert.match(sql, /member_package_cycles/i)
  assert.match(sql, /member_package_stage_payments/i)
  assert.match(sql, /PARTIAL24/i)
  assert.match(sql, /credit_applied_at/i)
})

test('payments UI selects a package catalog code instead of inventing session count', () => {
  assert.match(paymentsClient, /package_definitions/)
  assert.match(paymentsClient, /staff_record_package_payment/)
  assert.doesNotMatch(paymentsClient, /Sessions purchased.*input/i)
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/payments-checkin-flow.test.mjs`

Expected: FAIL on the new migration/RPC assertions.

- [ ] **Step 3: Add package references to payments and implement activation semantics**

Migration adds:

```sql
alter table public.payments
  add column if not exists package_definition_id uuid references public.package_definitions(id),
  add column if not exists member_package_id uuid references public.member_package_cycles(id),
  add column if not exists package_stage_id uuid references public.package_payment_stages(id);
```

`staff_record_package_payment` rules:
- Verify staff/admin.
- Resolve `p_package_code` and stage.
- For activation without `p_member_package_id`, create one `pending` cycle with package-defined session total and expiry calculated from `validity_days` only when payment becomes paid.
- Create/link `member_package_stage_payments`.
- Create payment as pending/paid.
- If paid, delegate to `staff_mark_package_payment_paid`.

`staff_mark_package_payment_paid` rules:
- Lock payment and linked cycle/stage rows.
- Idempotently mark payment/stage paid.
- For activation stage only: activate the cycle once, set `starts_at`, `expires_at`, and initial session balance.
- For Partial 24 19/13 installment: mark gate paid **without adding sessions**.
- Maintain `payments.credit_applied_at` as the idempotency marker for activation credit only.
- Call `private.sync_member_primary_balance(member_id)` after activation to mirror the newest active `fitness` cycle into `members.package_name`, `total_sessions`, `sessions_used`, and `sessions_left`.

- [ ] **Step 4: Update the Payments UI to use the catalog**

Replace free-form session count entry with:
- package select from `package_definitions where active=true`,
- existing member package-cycle selector when recording a later Partial 24 stage,
- stage selector from `package_payment_stages`,
- amount, method, and pending/paid status.

The UI must call:

```ts
await supabase.rpc("staff_record_package_payment", {
  p_member_id: form.memberId,
  p_package_code: form.packageCode,
  p_stage_key: form.stageKey,
  p_amount: amount,
  p_payment_type: form.paymentType || null,
  p_status: form.status,
  p_member_package_id: form.memberPackageId || null,
})
```

Pending still creates **no usable sessions**. Paid activation creates the package-defined amount exactly once.

- [ ] **Step 5: Run payment tests**

Run: `node --test tests/payments-checkin-flow.test.mjs`

Expected: PASS.

- [ ] **Step 6: Database transaction verification**

Inside a rollback-only transaction, verify:
1. paid FULL24 activation creates 24 usable sessions,
2. marking same payment paid again adds 0,
3. Partial 24 19-left installment changes stage to paid but adds 0 sessions.

Expected deltas: `+24`, then `+0`, then installment `+0`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260903091000_package_payment_integration.sql app/payments/PaymentsPageClient.tsx tests/payments-checkin-flow.test.mjs
git commit -m "feat: connect payments to package cycles"
```

---

### Task 3: Scheduling schema, RLS, and recurring slot generation

**Files:**
- Create: `supabase/migrations/20260903092000_scheduling_schema.sql`
- Create: `tests/scheduling-schema.test.mjs`

**Interfaces:**
- Produces tables: `availability_rules`, `schedule_slots`, `bookings`.
- Produces RPCs: `staff_create_availability_rule(...)`, `staff_generate_slots(p_rule_id uuid, p_through date)`, `staff_create_one_off_slot(...)`, `staff_cancel_slot(p_slot_id uuid)`.
- `schedule_slots.session_type` must equal one of the package service categories so eligibility matching is deterministic.

- [ ] **Step 1: Write failing scheduling-schema tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = new URL('../supabase/migrations/20260903092000_scheduling_schema.sql', import.meta.url)

test('schedule schema supports recurring and concrete slots plus booking capacity', () => {
  assert.equal(fs.existsSync(migration), true)
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /create table public\.availability_rules/i)
  assert.match(sql, /create table public\.schedule_slots/i)
  assert.match(sql, /create table public\.bookings/i)
  assert.match(sql, /capacity integer/i)
  assert.match(sql, /unique.*availability_rule_id.*start_at/is)
})

test('members can only read open slots for their own branch while staff can manage all', () => {
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /schedule_slots_select_branch_or_staff/i)
  assert.match(sql, /private\.is_staff_or_admin/i)
  assert.match(sql, /enable row level security/i)
})
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/scheduling-schema.test.mjs`

Expected: FAIL because migration does not exist.

- [ ] **Step 3: Create scheduling tables and indexes**

Use these core columns:

```sql
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  branch text not null,
  session_type text not null check (session_type in ('fitness','pilates_group','pilates_1on1')),
  weekday integer not null check (weekday between 0 and 6),
  local_start_time time not null,
  local_end_time time not null,
  slot_duration_minutes integer not null default 60 check (slot_duration_minutes > 0),
  capacity integer not null default 1 check (capacity > 0),
  valid_from date not null,
  valid_until date,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  availability_rule_id uuid references public.availability_rules(id) on delete set null,
  coach_user_id uuid references auth.users(id) on delete set null,
  branch text not null,
  session_type text not null check (session_type in ('fitness','pilates_group','pilates_1on1')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  capacity integer not null default 1 check (capacity > 0),
  status text not null default 'open' check (status in ('open','closed','cancelled','completed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create unique index schedule_slots_rule_start_uidx
on public.schedule_slots(availability_rule_id, start_at)
where availability_rule_id is not null;
```

Create `bookings` with this concrete shape:

```sql
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  slot_id uuid references public.schedule_slots(id) on delete set null,
  request_kind text not null check (request_kind in ('slot','custom','staff_assignment')),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled','completed','no_show')),
  requested_coach_user_id uuid references auth.users(id) on delete set null,
  assigned_coach_user_id uuid references auth.users(id) on delete set null,
  branch text not null,
  session_type text not null check (session_type in ('fitness','pilates_group','pilates_1on1')),
  requested_start_at timestamptz not null,
  requested_duration_minutes integer not null default 60 check (requested_duration_minutes > 0),
  start_at timestamptz,
  end_at timestamptz,
  member_package_id uuid references public.member_package_cycles(id) on delete set null,
  cancelled_at timestamptz,
  cancel_reason text,
  no_show_charged boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or start_at is not null),
  check (end_at is null or end_at > start_at)
);

create index bookings_member_status_start_idx on public.bookings(member_id,status,start_at);
create index bookings_slot_status_idx on public.bookings(slot_id,status);
create index bookings_coach_status_start_idx on public.bookings(assigned_coach_user_id,status,start_at);
```

- [ ] **Step 4: Implement recurrence generation in Asia/Manila**

`staff_generate_slots` must:
- require staff/admin,
- lock/read one active rule,
- generate dates from `greatest(valid_from, current_date)` through `least(p_through, valid_until)` when `valid_until` exists,
- combine each local date/time using `AT TIME ZONE 'Asia/Manila'`,
- split the availability window into `slot_duration_minutes`,
- `insert ... on conflict do nothing` on `(availability_rule_id,start_at)`.

A second run for the same rule/date window must create **zero duplicates**.

- [ ] **Step 5: Add RLS/grants**

- Members can select `schedule_slots` only when `status='open'` and `slot.branch` matches their `members.branch`.
- Members can select only their own `bookings`.
- Staff/admin can select all scheduling rows.
- Direct authenticated insert/update/delete is revoked; RPCs perform state changes.

- [ ] **Step 6: Run scheduling-schema tests**

Run: `node --test tests/scheduling-schema.test.mjs`

Expected: PASS.

- [ ] **Step 7: Apply migration and recurrence smoke test**

Create one test recurring rule, generate 14 days, call generator twice, and verify the slot count is unchanged on the second call.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260903092000_scheduling_schema.sql tests/scheduling-schema.test.mjs
git commit -m "feat: add scheduling schema and slot generation"
```

---

### Task 4: Member booking requests, custom requests, capacity-safe confirmation, and cancellation

**Files:**
- Create: `supabase/migrations/20260903093000_booking_operations.sql`
- Create: `tests/booking-rpcs.test.mjs`

**Interfaces:**
- Produces RPCs:
  - `member_request_slot(p_slot_id uuid) returns jsonb`
  - `member_request_custom_session(p_session_type text, p_requested_start_at timestamptz, p_requested_coach_user_id uuid default null, p_duration_minutes integer default 60) returns jsonb`
  - `member_cancel_booking(p_booking_id uuid, p_reason text default null) returns jsonb`
  - `staff_confirm_booking(p_booking_id uuid, p_slot_id uuid default null, p_assigned_coach_user_id uuid default null) returns jsonb`
  - `staff_reject_booking(p_booking_id uuid, p_reason text default null) returns jsonb`
  - `staff_create_assignment(p_member_id uuid, p_slot_id uuid, p_member_package_id uuid default null) returns jsonb`
  - `staff_reassign_booking(p_booking_id uuid, p_slot_id uuid default null, p_assigned_coach_user_id uuid default null) returns jsonb`
  - `staff_cancel_booking(p_booking_id uuid, p_reason text) returns jsonb`

- [ ] **Step 1: Write failing booking-rule tests**

Tests inspect the migration for the exact guards:

```js
assert.match(sql, /interval '24 hours'/i)
assert.match(sql, /interval '4 hours'/i)
assert.match(sql, /confirmed/i)
assert.match(sql, /count\(\*\).*capacity/is)
assert.match(sql, /private\.package_eligibility/i)
assert.match(sql, /future.*confirmed/is)
assert.match(sql, /branch/i)
```

Also assert that pending booking creation never updates `schedule_slots.capacity` or any package session counter.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/booking-rpcs.test.mjs`

Expected: FAIL because booking RPC migration does not exist.

- [ ] **Step 3: Implement member request rules**

`member_request_slot` must perform all of these inside the function:

```sql
-- authenticated member only
-- lock/read slot
-- reject unless slot.status='open'
-- reject if slot.start_at < now() + interval '24 hours'
-- derive member from auth.uid(); reject if member.branch <> slot.branch
-- call private.package_eligibility(member.id, slot.session_type)
-- reject only when can_request_booking=false
-- insert booking status='pending', request_kind='slot'
-- DO NOT increment capacity and DO NOT deduct sessions
```

`member_request_custom_session` derives branch from the member record; it never accepts a caller-provided branch. It applies the same 24-hour and package-request eligibility rules and stores `slot_id=null`.

- [ ] **Step 4: Implement member cancellation cutoff**

`member_cancel_booking` allows the owner to cancel `pending` freely and `confirmed` only when `coalesce(start_at,requested_start_at) >= now() + interval '4 hours'`. Inside the cutoff return JSON `{ "staff_contact_required": true }` without changing status.

- [ ] **Step 5: Implement transactional staff confirmation**

`staff_confirm_booking` must lock booking and target slot, then re-check:
1. staff/admin,
2. booking still pending,
3. slot open,
4. confirmed count `< slot.capacity`,
5. assigned coach does not overlap another confirmed booking using `tstzrange(start_at,end_at,'[)')`,
6. member branch rule for member-originated request,
7. active unexpired matching package eligibility,
8. no unpaid blocking stage,
9. `confirmed future bookings for that package < sessions_left`.

For a custom request with no supplied slot, create a one-off slot from `requested_start_at`, requested/default coach, requested duration, member branch, and capacity 1, then confirm against it.

Only after every check passes should it set `status='confirmed'`, concrete `start_at/end_at`, `assigned_coach_user_id`, and `member_package_id`.

- [ ] **Step 6: Implement staff assignment/reject/cancel**

Staff direct assignment bypasses the 24-hour member notice rule but still enforces package balance/payment gates and capacity. `staff_reassign_booking` re-runs the same capacity, coach-overlap, and package checks before moving a confirmed booking to another slot/coach. Staff rejection/cancellation records reason and timestamp. Session charging is intentionally excluded from cancellation and handled only by Task 5's explicit `staff_mark_no_show(..., p_charge_session)` path so a cancellation can never accidentally deduct a package credit.

- [ ] **Step 7: Run booking tests**

Run: `node --test tests/booking-rpcs.test.mjs`

Expected: PASS.

- [ ] **Step 8: Apply migration and concurrency verification**

Create one capacity-1 slot and two pending requests in a rollback test. Confirm request A, then confirm B. Expected: A succeeds; B fails `Slot is full`; exactly one booking is confirmed.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260903093000_booking_operations.sql tests/booking-rpcs.test.mjs
git commit -m "feat: add booking request and confirmation rules"
```

---

### Task 5: Package-aware attendance and charged no-shows

**Files:**
- Create: `supabase/migrations/20260903094000_booking_attendance.sql`
- Create: `tests/booking-attendance.test.mjs`
- Modify: `tests/payments-checkin-flow.test.mjs`

**Interfaces:**
- Adds `session_logs.booking_id` and `session_logs.member_package_id`.
- Produces private helper: `private.consume_package_session(p_member_package_id uuid, p_member_id uuid, p_staff_user_id uuid, p_booking_id uuid, p_notes text) returns jsonb`.
- Replaces check-in RPC with compatible defaults: `staff_qr_checkin(p_member_code text, p_notes text default null, p_booking_id uuid default null, p_member_package_id uuid default null) returns jsonb`.
- Produces `staff_mark_no_show(p_booking_id uuid, p_charge_session boolean, p_notes text default null) returns jsonb`.
- Produces `staff_checkin_context(p_member_code text) returns jsonb` for the staff UI.

- [ ] **Step 1: Write failing attendance tests**

Assert migration contains:
- unique attendance linkage for a booking,
- row locking (`for update`) on `member_package_cycles`,
- decrement of `sessions_left` and increment of `sessions_used`,
- booking completion,
- no-show idempotency,
- compatibility mirror update.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/booking-attendance.test.mjs tests/payments-checkin-flow.test.mjs`

Expected: FAIL on new package-aware attendance assertions.

- [ ] **Step 3: Extend session log schema and create one shared deduction path**

Add:

```sql
alter table public.session_logs
  add column if not exists booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists member_package_id uuid references public.member_package_cycles(id) on delete set null;

create unique index if not exists session_logs_one_booking_usage_uidx
on public.session_logs(booking_id)
where booking_id is not null;
```

`private.consume_package_session` locks the cycle, rejects expired/depleted/zero balance, decrements exactly once, updates Partial 24 stage due-state after the new balance, updates compatibility `members` counters for fitness cycles, and creates the linked session log.

- [ ] **Step 4: Replace `staff_qr_checkin` without breaking manual check-in**

Rules:
- If `p_booking_id` is supplied, require a confirmed booking for this member and consume its `member_package_id`; mark booking `completed`.
- If no booking is supplied and `p_member_package_id` is supplied, allow staff manual attendance using that active cycle.
- If neither is supplied, auto-select only when exactly one usable active cycle exists; otherwise return `Package selection required`.
- Repeated booking check-in must not deduct twice because the booking-linked log is unique and booking is no longer confirmed.

- [ ] **Step 5: Implement no-show**

`staff_mark_no_show` locks the confirmed booking. With `p_charge_session=false`, only mark `no_show`. With `true`, call the same `private.consume_package_session` helper, then set `no_show_charged=true`. Repeating the operation returns the existing state and never deducts again.

- [ ] **Step 6: Implement `staff_checkin_context`**

Return member identity plus:
- confirmed bookings ordered nearest start,
- active usable package cycles with package names/service categories/session balances,
- current eligibility warning.

The UI uses this to make package selection explicit when needed.

- [ ] **Step 7: Run attendance tests**

Run: `node --test tests/booking-attendance.test.mjs tests/payments-checkin-flow.test.mjs`

Expected: PASS.

- [ ] **Step 8: Rollback-only database verification**

Verify one confirmed booking check-in yields package `sessions_left -1`, `sessions_used +1`, one session log, booking `completed`; second attempt yields no further change. Verify charged no-show has the same `-1/+1` delta exactly once.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260903094000_booking_attendance.sql tests/booking-attendance.test.mjs tests/payments-checkin-flow.test.mjs
git commit -m "feat: make check-in booking and package aware"
```

---

### Task 6: Regenerate Supabase types and shared scheduling loaders

**Files:**
- Modify: `lib/database.types.ts`
- Create: `lib/scheduling.ts`
- Modify: `lib/member-account.ts`
- Create: `tests/scheduling-loaders.test.mjs`

**Interfaces:**
- Produces types `PackageDefinitionRow`, `MemberPackageCycleRow`, `ScheduleSlotRow`, `BookingRow` from generated `Database`.
- Produces `loadMemberScheduleData(userId: string)`.
- Extends `MemberAccountData` with `packageEligibility`, `upcomingBookings`, and `packageAlerts`.

- [ ] **Step 1: Write failing loader tests**

Assert `lib/scheduling.ts` exists and queries `schedule_slots`, `bookings`, `member_package_cycles`, and `member_package_eligibility`; assert `lib/member-account.ts` includes `upcomingBookings` and `packageEligibility`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/scheduling-loaders.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Generate fresh Supabase TypeScript types**

Use the Supabase type generator after all five migrations are applied and replace `lib/database.types.ts` with the generated schema. Do not hand-maintain new table/function signatures.

- [ ] **Step 4: Create focused scheduling loader**

`loadMemberScheduleData(userId)` must:
- resolve the member record,
- fetch open future slots for `member.branch`,
- fetch the member's pending/confirmed future bookings,
- fetch active package cycles joined to package definitions,
- call `member_package_eligibility` for each distinct service category present,
- return a single typed object suitable for initial SSR payload.

- [ ] **Step 5: Extend member account loader**

Add only dashboard-needed scheduling data: next 3 confirmed bookings and normalized package warning(s). Preserve existing profile/payment/session-log reads.

- [ ] **Step 6: Run loader tests and typecheck**

Run:

```bash
node --test tests/scheduling-loaders.test.mjs
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/database.types.ts lib/scheduling.ts lib/member-account.ts tests/scheduling-loaders.test.mjs
git commit -m "feat: add typed scheduling data loaders"
```

---

### Task 7: Member schedule experience

**Files:**
- Create: `app/member/schedule/page.tsx`
- Create: `app/member/schedule/MemberSchedulePageClient.tsx`
- Create: `tests/member-schedule-ui.test.mjs`

**Interfaces:**
- Uses `loadMemberScheduleData` from Task 6.
- Calls `member_request_slot`, `member_request_custom_session`, and `member_cancel_booking` from Task 4.

- [ ] **Step 1: Write failing route/UI tests**

Tests require:
- server route with `auth.getUser()` and redirect to `/login`/`/welcome` when unauthenticated,
- client calls all three member booking RPCs,
- UI includes `Any available coach`, `24 hours`, `4 hours`, `Request`, and `Custom request`,
- no branch selector is exposed to members.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/member-schedule-ui.test.mjs`

Expected: FAIL because route/client do not exist.

- [ ] **Step 3: Build protected server page**

`app/member/schedule/page.tsx` authenticates, loads scheduling data, and passes only member-safe rows to the client. The server never accepts a branch from query parameters.

- [ ] **Step 4: Build slot browser and request actions**

The client shows:
- home branch banner,
- slots grouped by local date (`Asia/Manila` display),
- coach name or `Any available coach`,
- type, duration, capacity remaining,
- package warning/eligibility badge,
- Request button disabled inside 24h with `Contact staff/admin for sessions less than 24 hours away`.

On success, refresh/re-fetch route data.

- [ ] **Step 5: Build custom request and cancellation UI**

Custom request captures session type, desired date/time, specific coach or Any, and duration default 60. Cancellation button is available for pending and eligible confirmed bookings; inside the 4-hour cutoff, surface the RPC's `staff_contact_required` message instead of pretending it cancelled.

- [ ] **Step 6: Run member schedule tests and typecheck**

Run:

```bash
node --test tests/member-schedule-ui.test.mjs
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/member/schedule tests/member-schedule-ui.test.mjs
git commit -m "feat: add member schedule booking flow"
```

---

### Task 8: Staff schedule workspace

**Files:**
- Create: `app/staff/schedule/page.tsx`
- Create: `app/staff/schedule/StaffSchedulePageClient.tsx`
- Create: `tests/staff-schedule-ui.test.mjs`

**Interfaces:**
- Staff route follows the same server role guard as `/payments` and `/checkin`.
- Calls availability/slot RPCs from Task 3 and booking-management RPCs from Tasks 4–5.
- Reads `staff_package_attention_queue()` for Payment Due/Renewal Soon/Last Session alerts.

- [ ] **Step 1: Write failing staff-route tests**

Require role guard, availability rule RPCs, booking confirm/reject, no-show charge choice, capacity display, and attention queue.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/staff-schedule-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Create protected server route**

Mirror `/payments/page.tsx`: unauthenticated → `/login`; non-staff/admin → `/member/dashboard`; staff/admin receives the client workspace.

- [ ] **Step 4: Build availability controls**

Provide two forms:
1. recurring rule — coach, branch, service category, weekday, start/end local time, duration default 60, capacity, valid-from/until;
2. one-off slot — coach or unassigned, branch, service category, concrete start/end, capacity.

After a recurring rule is saved, call `staff_generate_slots` for a rolling 8-week window.

- [ ] **Step 5: Build pending request queue and confirmation workflow**

Each pending row shows member, branch, requested time/type/coach, package eligibility, session balance, payment gate, and target slot capacity. Confirmation calls `staff_confirm_booking`; any database conflict/full/payment error is shown verbatim as a controlled error banner, not ignored.

- [ ] **Step 6: Build confirmed-session actions**

Allow staff to cancel, reassign coach, reject pending, and mark no-show with an explicit checkbox/toggle `Charge 1 session`. Never default the charge toggle to true.

- [ ] **Step 7: Add package attention queue**

Display categorized rows for `Payment Due`, `Renewal Soon`, `Last Session`, and `Expired`. This is the v1 staff notification surface; do not add push/email delivery.

- [ ] **Step 8: Run staff UI tests and typecheck**

Run:

```bash
node --test tests/staff-schedule-ui.test.mjs
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/staff/schedule tests/staff-schedule-ui.test.mjs
git commit -m "feat: add staff scheduling workspace"
```

---

### Task 9: Check-in UI package/booking resolution

**Files:**
- Modify: `app/checkin/CheckInPageClient.tsx`
- Modify: `tests/payments-checkin-flow.test.mjs`

**Interfaces:**
- Uses `staff_checkin_context(member_code)` before deduction.
- Calls compatible `staff_qr_checkin` with `p_booking_id` and/or `p_member_package_id`.

- [ ] **Step 1: Add failing check-in UI assertions**

Require `staff_checkin_context`, booking/package selection, `p_booking_id`, and `p_member_package_id` in the client source.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/payments-checkin-flow.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Split lookup from commit**

After scan/manual code, first call `staff_checkin_context`. If there is one confirmed booking and its package is resolved, preselect it. If multiple bookings/packages exist, show a small selector. The final Check In button calls:

```ts
await supabase.rpc("staff_qr_checkin", {
  p_member_code: memberCode,
  p_notes: notes.trim() || null,
  p_booking_id: selectedBookingId || null,
  p_member_package_id: selectedPackageId || null,
})
```

Keep QR camera and manual code fallback unchanged.

- [ ] **Step 4: Show package warning after check-in**

Render returned warning such as `Payment Due`, `Renewal Soon`, or `Last Session — Renew Now` so staff is immediately aware after the balance changes.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
node --test tests/payments-checkin-flow.test.mjs
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/checkin/CheckInPageClient.tsx tests/payments-checkin-flow.test.mjs
git commit -m "feat: resolve booking packages at check-in"
```

---

### Task 10: Real Upcoming Sessions and package alerts on the Member Dashboard

**Files:**
- Modify: `app/member/dashboard/page.tsx`
- Modify: `components/bearfit/BearfitDashboardClient.tsx`
- Modify: `tests/member-dashboard-real-data.test.mjs`

**Interfaces:**
- Consumes `upcomingBookings`, `packageEligibility`, and `packageAlerts` from `loadMemberAccountData`.
- Links Schedule nav to `/member/schedule`.

- [ ] **Step 1: Write failing dashboard assertions**

Require:
- `/member/schedule` link,
- real `upcomingBookings` prop,
- rendered coach/branch/start/status data,
- no `Scheduling is not connected` placeholder,
- package warning copy for `Payment Due`, `Renewal Soon`, and `Last Session`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/member-dashboard-real-data.test.mjs`

Expected: FAIL on new scheduling assertions.

- [ ] **Step 3: Pass scheduling data from the server page**

Add the new props from `account` in `app/member/dashboard/page.tsx` without adding separate duplicate Supabase calls.

- [ ] **Step 4: Replace dummy/empty Upcoming Sessions block with real cards**

For each confirmed future booking show:
- session type,
- coach (`Any available coach` only if still unassigned),
- home branch,
- date/time,
- status,
- countdown derived client-side from `start_at`,
- `Manage` link to `/member/schedule`.

Keep the current dark/orange BearFit visual language and move closer to the user's dummy dashboard target without reintroducing fake metrics.

- [ ] **Step 5: Add package warning banner**

Above Upcoming Sessions, render the highest-priority eligibility alert:
- blocking Payment Due,
- Renewal Soon at 2,
- Last Session at 1,
- blocked/no sessions at 0.

The banner text comes from the centralized RPC result; do not duplicate threshold logic in React.

- [ ] **Step 6: Activate Schedule navigation**

Replace the disabled `Schedule · Soon` sidebar item with a normal `Link href="/member/schedule"`.

- [ ] **Step 7: Run dashboard tests and typecheck**

Run:

```bash
node --test tests/member-dashboard-real-data.test.mjs
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/member/dashboard/page.tsx components/bearfit/BearfitDashboardClient.tsx tests/member-dashboard-real-data.test.mjs
git commit -m "feat: show real upcoming sessions on dashboard"
```

---

### Task 11: Full regression, Supabase advisors, production deployment verification

**Files:**
- Modify only if failures reveal a defect in files from Tasks 1–10.
- Update: `docs/BEARFIT_FOUNDATION_STATUS.md` with scheduling milestone once verified.

**Interfaces:**
- No new interfaces. This task verifies the release as a whole.

- [ ] **Step 1: Run the complete regression suite**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all tests pass, TypeScript succeeds, lint has no errors, Next production build completes.

- [ ] **Step 2: Run Supabase security and performance advisors**

Review every new warning. Expected intentional warnings may include authenticated exposure of RLS-protected tables and authenticated execution of staff/member `SECURITY DEFINER` RPCs; verify each such function performs explicit `auth.uid()`/role/ownership checks and fixed `search_path=''`. Fix any missing-RLS, mutable-search-path, or unsafe grant notice before deployment.

- [ ] **Step 3: Production verification sequence**

After Vercel deploy, perform this exact order:

1. Staff creates recurring coach availability and generates slots.
2. Confirm generated slots appear once; regenerate same window and verify no duplicates.
3. Member opens `/member/schedule` and sees only their home branch.
4. Member requests a slot more than 24 hours away; status is Pending and capacity remains unchanged.
5. Staff confirms it; capacity count increments and Member Dashboard shows the upcoming session.
6. Member tries a request inside 24 hours; app blocks and tells them to contact staff/admin.
7. Member cancels a confirmed session more than 4 hours away; cancellation succeeds.
8. Test a confirmed booking inside 4 hours; member gets staff-contact-required instead of self-cancel.
9. Staff checks the member into a confirmed booking; correct package decreases exactly one and dashboard activity updates.
10. Repeat the same check-in; balance does not decrease again.
11. Mark another confirmed booking no-show with Charge disabled; balance unchanged.
12. Mark a test no-show with Charge enabled; exactly one package session is consumed.
13. Move a reversible Partial 24 test cycle to 19/13 due state; new confirmation is blocked until stage payment is paid.
14. Verify 2 sessions = Renewal Soon, 1 = Last Session, 0 = booking/check-in blocked.
15. Verify Pilates 5/10/20 expiry values and that `pilates_group` cannot fund `pilates_1on1`.

- [ ] **Step 4: Return the temporary admin test account to the intended role**

Once a dedicated staff/admin account exists, change the ordinary member test account back to `member` and verify `/payments`, `/checkin`, and `/staff/schedule` redirect it to `/member/dashboard`.

- [ ] **Step 5: Update foundation status doc**

Record that scheduling/package cycles are production-verified, list the active RPCs/tables, and keep deferred features (push notifications, waitlist, calendar sync, shared-credit relationships) explicitly deferred.

- [ ] **Step 6: Final commit**

```bash
git add docs/BEARFIT_FOUNDATION_STATUS.md
git commit -m "docs: mark scheduling flow verified"
```

---

## Plan Self-Review

**Spec coverage:** All approved requirements map to Tasks 1–11: package catalog/cycles and Partial 24 gates (1–2), recurring/one-off capacity scheduling (3), member/staff booking and cutoffs (4), check-in/no-show deduction (5/9), typed loaders (6), member schedule (7), staff schedule/attention queue (8), dashboard integration (10), and production verification (11).

**Placeholder scan:** No `TBD`, `TODO`, “implement later”, or unspecified error-handling steps remain. Deferred scope is explicitly listed in the approved spec rather than hidden as placeholders.

**Type consistency:** Service categories are consistently `fitness`, `pilates_group`, `pilates_1on1`; booking statuses and RPC names are defined before UI consumers; package-cycle IDs flow from payment → eligibility → booking → attendance → session logs.

**Resolved ambiguity:** The approved spec mentioned an “allowed attendance window” without defining a duration. V1 does not add an unapproved clock cutoff: staff explicitly selects a confirmed booking (or manual package) at check-in, and the database requires the booking to still be `confirmed`. A stricter check-in time window can be added later as a separate policy decision.
