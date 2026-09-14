# Package Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish BearFit package operations by surfacing staff package alerts, deep-linking them into the correct package payment flow, and aligning the live Supabase schema with the already-committed package pricing/admin migration.

**Architecture:** Keep the existing package catalog, cycles, staged-payment RPCs, and central eligibility rules as the source of truth. Extend `/staff/packages` to consume `staff_package_attention_queue()`, extend `/payments` to accept safe server-parsed prefill state and derive the actual due stage from package/stage-payment data, and apply the existing pricing/admin migration to the live Supabase project before release.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, Supabase Postgres/RPC/RLS, Node test runner, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-14-package-operations-design.md`

## Global Constraints

- Do not change package structural fields (included sessions, categories, billing modes, validity, stage trigger structure) from the UI.
- Pilates prices are fixed to ₱4,450 / ₱8,900 / ₱16,400 / ₱1,600; Full 24 / Full 48 / Partial 24 remain unset.
- Partial 24 activation credits 24 sessions exactly once; 19-left and 13-left installment payments credit 0 sessions.
- Unpaid due installments block new booking requests/confirmations, not already-confirmed attendance.
- 2 sessions left is Renewal Soon; 1 session left is Last Session — Renew Now; 0 sessions blocks booking/check-in.
- Legacy Fitness remains inactive and cannot be activated.
- Preserve Pilates Group and Pilates 1-on-1 as separate service categories.

---

### Task 1: Lock the Package Operations UI Contract with Tests

**Files:**
- Create: `tests/package-operations-ui.test.mjs`
- Read: `app/staff/packages/page.tsx`
- Read: `app/staff/packages/StaffPackagesPageClient.tsx`
- Read: `app/payments/page.tsx`
- Read: `app/payments/PaymentsPageClient.tsx`

**Interfaces:**
- Consumes: existing `staff_package_attention_queue()`, `staff_record_package_payment()`, `staff_mark_package_payment_paid()` RPC names.
- Produces: regression expectations for attention queue loading, deep-link query parameters, payment prefill props, trigger metadata, stage-payment status, and due-stage derivation.

- [ ] **Step 1: Write failing regression tests**

Create tests that assert:
- `app/staff/packages/page.tsx` calls `staff_package_attention_queue`.
- `StaffPackagesPageClient.tsx` renders `Member Package Attention`, `Payment Due`, `Renewal Soon`, `Last Session`, and links to `/payments?` with `memberId`, `packageCode`, and the appropriate cycle behavior.
- `app/payments/page.tsx` accepts `searchParams` and passes a `prefill` prop.
- `PaymentsPageClient.tsx` fetches `trigger_type`, `trigger_sessions_left`, `blocks_new_bookings_when_due`, and `member_package_stage_payments` status.
- Payment prefill code rejects invalid member/package/cycle combinations.
- Due-stage code ignores `paid` and `waived` stage payments and orders candidates by highest `stage_order`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/package-operations-ui.test.mjs`
Expected: FAIL because the attention queue and prefill interfaces do not yet exist.

- [ ] **Step 3: Commit the failing tests**

Commit message: `test: define package operations workflow`

---

### Task 2: Add Staff Package Attention Queue

**Files:**
- Modify: `app/staff/packages/page.tsx`
- Modify: `app/staff/packages/StaffPackagesPageClient.tsx`
- Test: `tests/package-operations-ui.test.mjs`

**Interfaces:**
- Consumes: `supabase.rpc("staff_package_attention_queue")` returning `member_id`, `member_code`, `member_name`, `member_package_id`, `package_code`, `package_name`, `service_category`, `sessions_left`, `reason`, `warning_level`, `expires_at`.
- Produces: `StaffPackageAttentionItem[]` and an `initialAttention` prop rendered above package cards.

- [ ] **Step 1: Load catalog and attention queue in parallel on the server page**

Use `Promise.all` for `staff_package_catalog()` and `staff_package_attention_queue()`; preserve both errors and pass them into the client.

- [ ] **Step 2: Add typed attention UI**

Render a section titled `Member Package Attention` with an explicit empty state. Each card must show member, package, service category, sessions left, and human-readable reason.

- [ ] **Step 3: Add payment handoff links**

For `payment_due`, link with:
`/payments?memberId=<id>&packageCode=<code>&memberPackageId=<cycle>`.

For renewal/last-session/expired, link with:
`/payments?memberId=<id>&packageCode=<code>&stageKey=activation`.
Do not include the existing cycle ID for renewal activation.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/package-operations-ui.test.mjs tests/package-admin-settings.test.mjs tests/package-cycles.test.mjs`
Expected: package attention assertions PASS; payment-prefill assertions may still FAIL until Task 3.

- [ ] **Step 5: Commit**

Commit message: `feat: add staff package attention queue`

---

### Task 3: Add Safe Payment Prefill and Due-Stage Derivation

**Files:**
- Modify: `app/payments/page.tsx`
- Modify: `app/payments/PaymentsPageClient.tsx`
- Test: `tests/package-operations-ui.test.mjs`

**Interfaces:**
- Consumes server `searchParams` keys: `memberId`, `packageCode`, `memberPackageId`, `stageKey`.
- Produces `PaymentPrefill = { memberId?: string; packageCode?: string; memberPackageId?: string; stageKey?: string }` passed to the client.
- Fetches stage metadata including `trigger_type`, `trigger_sessions_left`, `blocks_new_bookings_when_due` and stage-payment rows `{ member_package_id, stage_id, status }`.

- [ ] **Step 1: Parse search params on the server page**

Only copy string values. Pass them as `prefill`; do not query the database in the server page solely to trust query input.

- [ ] **Step 2: Extend client types and fetches**

Extend `PackageStage` with trigger metadata and fetch `member_package_stage_payments`.

- [ ] **Step 3: Validate and apply prefill after data loads**

Apply only when:
- member exists,
- package exists and is active,
- supplied cycle (if any) belongs to that member and package.
Unknown values are ignored without breaking the form.

- [ ] **Step 4: Derive the correct due stage for existing cycles**

For a supplied existing cycle, select active blocking stages whose trigger is reached and whose stage payment is not `paid` or `waived`; sort by `stage_order` descending and use the first. If no stage is due, keep a valid supplied `stageKey` or the normal selector.

- [ ] **Step 5: Preserve renewal semantics**

When the URL requests `stageKey=activation` without `memberPackageId`, prefill activation but keep cycle blank so a new cycle is created.

- [ ] **Step 6: Run tests**

Run: `pnpm test -- tests/package-operations-ui.test.mjs tests/package-admin-settings.test.mjs tests/package-cycles.test.mjs tests/package-eligibility-edge.test.mjs tests/payments-checkin-flow.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: prefill package payments from staff alerts`

---

### Task 4: Align Live Supabase Package Pricing/Admin Schema

**Files:**
- Existing migration source: `supabase/migrations/20260904101000_package_pricing_admin.sql`
- No new schema design required.

**Interfaces:**
- Produces live `package_definitions.standard_price`, `staff_package_catalog()`, and `admin_update_package_settings()`.

- [ ] **Step 1: Apply the existing migration to the live Supabase project**

Use the exact SQL from `20260904101000_package_pricing_admin.sql` with migration name `package_pricing_admin`.

- [ ] **Step 2: Verify live schema and seed values**

Query `package_definitions` and confirm:
- Pilates 5 = 4450
- Pilates 10 = 8900
- Pilates 20 = 16400
- Pilates 1-on-1 = 1600
- FULL24, FULL48, PARTIAL24 = null
- LEGACY_FITNESS remains inactive

Verify the RPCs exist.

- [ ] **Step 3: Run Supabase advisors**

Run both security and performance advisors. Do not introduce unrelated schema changes in this feature; report pre-existing findings separately.

---

### Task 5: Full Verification and Release

**Files:**
- All files changed above.

**Interfaces:**
- Produces a Vercel-verified PR ready for merge.

- [ ] **Step 1: Run full repository tests**

Run: `pnpm test`
Expected: all tests PASS.

- [ ] **Step 2: Run typecheck and lint**

Run: `pnpm run typecheck`
Run: `pnpm run lint`
Expected: PASS, or document pre-existing non-blocking lint findings separately.

- [ ] **Step 3: Open pull request**

PR title: `Finish package operations workflow`

- [ ] **Step 4: Verify Vercel preview**

Wait for Vercel commit status to report `success`.

- [ ] **Step 5: Review diff for scope creep**

Confirm only package-operations UI/tests/docs changed and no unrelated behavior was modified.

- [ ] **Step 6: Merge to `main`**

Merge only after Vercel preview succeeds.

- [ ] **Step 7: Verify main deployment**

Confirm the merged commit's Vercel status is `success` before declaring release complete.
