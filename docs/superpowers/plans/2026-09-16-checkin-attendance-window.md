# Check-In Attendance Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden BearFit attendance so confirmed bookings can only be checked in from 2 hours before the scheduled start until 2 hours after the scheduled end, no-shows can only be processed after the session ends, and the staff check-in UI clearly shows the relevant booking/package and post-check-in balance state.

**Architecture:** Add one forward-only Supabase migration that replaces the existing attendance RPCs without changing table structure. Keep manual walk-in check-in unchanged, keep the existing shared `private.consume_package_session` idempotency path, and return post-consumption eligibility so the UI can show warnings even when a package becomes depleted. Update only the existing staff check-in client and add focused static regression tests matching the repository's current Node test style.

**Tech Stack:** Next.js 16, React 18, TypeScript, Supabase/PostgreSQL PL/pgSQL, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-03-bearfit-scheduling-booking-design.md`

## Global Constraints

- Booking check-in window is exactly 2 hours before `start_at` through 2 hours after `end_at`.
- Manual staff walk-in check-in remains available and is not subject to a booking attendance window.
- A booking/session can deduct at most one package credit through the existing shared consumption path.
- Bearforce `session_completed` points are awarded only when the package session was not already consumed.
- A confirmed booking can be marked no-show only after its scheduled `end_at`.
- Completed bookings must disappear from the check-in booking list after refresh.
- No changes to `main` until branch verification is complete.

---

### Task 1: Add failing attendance-window regression tests

**Files:**
- Create: `tests/checkin-attendance-window.test.mjs`

**Interfaces:**
- Consumes: `public.staff_qr_checkin`, `public.staff_mark_no_show`, `public.staff_checkin_context`, `app/checkin/CheckInPageClient.tsx`.
- Produces: regression expectations for the new migration and UI behavior.

- [ ] **Step 1: Write the failing test**

Create a Node test that expects a new migration file `supabase/migrations/20260916100000_checkin_attendance_window.sql` and asserts that it contains both `interval '2 hours'` bounds, no-show `end_at` guarding, `private.consume_package_session`, `already_consumed`, `private.award_bearforce_points`, post-check-in `eligibility`, and context filtering to confirmed bookings inside the attendance window. Also assert that the check-in UI reads result eligibility and visibly labels the attendance window/package details.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/checkin-attendance-window.test.mjs`

Expected: FAIL because the new migration does not exist and the UI does not yet contain the new attendance-window/status details.

### Task 2: Add server-side attendance and no-show guards

**Files:**
- Create: `supabase/migrations/20260916100000_checkin_attendance_window.sql`
- Test: `tests/checkin-attendance-window.test.mjs`

**Interfaces:**
- Consumes: existing `private.consume_package_session(uuid,uuid,uuid,uuid,text)`, `private.package_eligibility(uuid,text)`, and `private.award_bearforce_points(...)`.
- Produces: replacement `public.staff_qr_checkin(text,text,uuid,uuid,text)`, replacement `public.staff_mark_no_show(uuid,boolean,text)`, and replacement `public.staff_checkin_context(text)`.

- [ ] **Step 1: Implement the booking window in `staff_qr_checkin`**

For booking-based check-in, reject when `start_at`/`end_at` is missing, when `now() < start_at - interval '2 hours'`, or when `now() > end_at + interval '2 hours'`. Keep the manual path unchanged. Keep consumption through `private.consume_package_session` and Bearforce award only when `already_consumed` is false.

- [ ] **Step 2: Return post-consumption eligibility**

Add `eligibility: private.package_eligibility(v_member.id, v_session_type)` to the RPC response so the client can display `Payment Due`, `Renewal Soon`, `Last Session`, or zero-session blocking state immediately.

- [ ] **Step 3: Guard no-show timing**

Replace `staff_mark_no_show` so it rejects missing `end_at` and any request where `now() < end_at`; preserve charged/uncharged behavior and the shared one-session consumption path.

- [ ] **Step 4: Filter check-in context to relevant bookings**

Return only `confirmed` bookings where `now()` falls between `start_at - interval '2 hours'` and `end_at + interval '2 hours'`. Include package name/code and current package sessions in each booking JSON object for the UI.

- [ ] **Step 5: Run focused test**

Run: `node --test tests/checkin-attendance-window.test.mjs`

Expected: server-side assertions PASS; UI assertions may still fail until Task 3.

### Task 3: Clarify the staff check-in UI and post-check-in state

**Files:**
- Modify: `app/checkin/CheckInPageClient.tsx`
- Test: `tests/checkin-attendance-window.test.mjs`

**Interfaces:**
- Consumes: `ConfirmedBooking.package_name`, `package_code`, `sessions_left`, and RPC result `eligibility`.
- Produces: a clear booking summary, explicit attendance-window copy, and reliable post-check-in warning text.

- [ ] **Step 1: Extend client types**

Add optional package metadata to `ConfirmedBooking`. Add an RPC result eligibility shape with `warning_message` and `blocking_reason`.

- [ ] **Step 2: Use result eligibility after check-in**

Prefer `result.eligibility.warning_message || result.eligibility.blocking_reason` over looking up only the refreshed active-package list. This ensures the last credit / zero-credit state remains visible after a package becomes depleted.

- [ ] **Step 3: Show relevant booking details**

Keep the selector, but show package name/code in the option and render a small selected-booking summary with session, date/time, branch, package, sessions before check-in, and `Check-in window: 2 hours before start to 2 hours after end`.

- [ ] **Step 4: Preserve refresh behavior**

Keep the existing `staff_checkin_context` refresh and `chooseDefaults(next)` call so a completed booking disappears immediately.

- [ ] **Step 5: Run focused test**

Run: `node --test tests/checkin-attendance-window.test.mjs`

Expected: PASS.

### Task 4: Regression verification

**Files:**
- Verify all changed files only.

**Interfaces:**
- Consumes: repository test suite and TypeScript build configuration.
- Produces: evidence that scheduling/check-in/package/Bearforce behavior remains protected.

- [ ] **Step 1: Run attendance/check-in regression subset**

Run: `node --test tests/checkin-attendance-window.test.mjs tests/booking-attendance.test.mjs tests/checkin-session-labels.test.mjs tests/payments-checkin-flow.test.mjs tests/partial24-cycle-priority.test.mjs`

Expected: all PASS.

- [ ] **Step 2: Run the complete repository test suite**

Run: `npm test`

Expected: all PASS.

- [ ] **Step 3: Run typecheck/build where available**

Run: `npm run typecheck` and `npm run build`.

Expected: both PASS. If the sandbox cannot install dependencies, use the connected GitHub/Vercel checks for build verification and explicitly report the local limitation.

- [ ] **Step 4: Review branch diff**

Confirm only the plan, new regression test, new migration, and check-in client changed.

- [ ] **Step 5: Do not merge automatically**

Leave the verified feature branch/PR ready for preview deployment and user QA with JJ / M0001 before merging to `main`.
