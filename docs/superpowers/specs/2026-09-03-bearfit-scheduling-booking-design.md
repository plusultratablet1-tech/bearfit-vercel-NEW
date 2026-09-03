# BearFit Scheduling, Booking, and Package-Gating Design

Date: 2026-09-03
Status: Approved by user

## 1. Purpose

Build BearFit's real scheduling subsystem so the Member Dashboard can show real upcoming sessions and staff can manage availability, booking requests, confirmations, cancellations, attendance, and package eligibility.

The design must support both workflows from day one:

1. **Staff/Admin assignment:** staff can create or assign a session directly and confirm it immediately.
2. **Member self-booking:** members normally choose an available slot or send a custom schedule request. Member requests require staff/admin confirmation before becoming confirmed sessions.

The system must also respect BearFit's package rules instead of using one universal low-session threshold.

## 2. Agreed Business Rules

### 2.1 Booking methods

- Members can book an existing available slot.
- Members can submit a custom date/time request when no listed slot fits.
- Staff/admin can create one-off assignments directly.
- Member-created requests begin as `pending`.
- Staff/admin can `confirm` or `reject` pending requests.
- Staff-created assignments may begin as `confirmed`.

### 2.2 Notice periods

- Member self-booking is allowed only when the desired session starts **at least 24 hours in the future**.
- Inside the 24-hour window, the app blocks member self-booking and instructs the member to contact staff/admin.
- Staff/admin may still manually create or confirm a session inside the 24-hour window.
- Members may cancel/change a confirmed booking themselves until **4 hours before** session start.
- Inside the 4-hour window, the member must contact staff/admin. Staff/admin decides whether the change is allowed and whether a session should be charged.

### 2.3 Branch and coach rules

- For the current release, a member may self-book only at their assigned/home branch.
- Members may select a specific coach or choose **Any available coach**.
- Staff/admin assigns the final coach when confirming a request if the member selected Any available coach.

### 2.4 Duration and availability

- Default session duration is **60 minutes**.
- Staff/admin may override duration per slot.
- Staff/admin can create:
  - recurring availability, and
  - one-off availability slots.
- Recurring availability generates concrete bookable slots for a rolling future window.
- Individual generated slots can be edited or cancelled without deleting the recurring rule.

### 2.5 Private and group capacity

- A slot can be private or group.
- Private sessions normally use capacity `1`.
- Group sessions use a staff-defined capacity greater than `1`.
- **Pending requests do not consume capacity.**
- Only `confirmed` bookings count against capacity.
- Confirmation is transactional: if capacity is already full, confirmation fails cleanly.

### 2.6 Session deduction and no-shows

- Requesting a booking does not deduct a package session.
- Confirming a booking does not deduct a package session.
- A session is normally deducted only when the member actually checks in.
- Staff/admin may mark a confirmed booking `no_show` and choose whether to charge one session.
- A charged no-show uses the same package-session deduction path as attendance so balances cannot be changed twice.

### 2.7 Future booking balance protection

- Pending requests may exist even when a member is close to exhausting a package.
- Staff/admin cannot confirm more future sessions than the member has currently usable package credits for the matching service category.
- Already-confirmed sessions remain valid when a later installment becomes due.
- Package renewal creates/activates new usable credits before additional future bookings can be confirmed.

This rule prevents a member with one remaining credit from accumulating several confirmed sessions that cannot later be honored.

## 3. Package Model

The current `members.sessions_left` field is not sufficient as the long-term source of truth because a member can eventually hold different products at the same time, such as a fitness package and a Reformer Pilates package. Scheduling therefore needs package-specific balances.

### 3.1 Package definitions

Create a package catalog containing at least:

- package code and display name
- service category
- included sessions
- validity period, if any
- shareable flag
- billing mode: full, installment, or single-session
- active/inactive state

Initial package definitions include:

#### Core BearFit packages

- Full 24
- Full 48
- Partial 24

Exact prices for these packages remain managed by staff/payment configuration and are not hard-coded into scheduling logic.

#### Reformer Pilates group packages

From the supplied BearFit Pilates rate card:

- **Pilates 5** — 5 sessions, ₱4,450, 30-day validity, non-shareable
- **Pilates 10** — 10 sessions, ₱8,900, 45-day validity, shareable
- **Pilates 20** — 20 sessions, ₱16,400, 60-day validity, shareable
- Group-class reference rate: ₱890/session for 5 and 10; ₱820/session for 20

#### Reformer Pilates 1-on-1

- **Pilates 1-on-1** — ₱1,600/session
- Modeled as a distinct service/package type so a group Pilates credit cannot be consumed accidentally by a 1-on-1 booking.

### 3.2 Member package cycles

Each purchase/renewal is represented as a package cycle rather than permanently adding sessions to one global counter.

A member package cycle stores:

- member
- package definition
- total sessions for that cycle
- used and remaining sessions
- start date
- expiry date when applicable
- status: pending, active, depleted, expired, cancelled
- renewal relationship to the prior cycle when applicable

This allows multiple package types to coexist safely and makes package validity enforceable.

### 3.3 Partial 24 payment checkpoints

Partial 24 is an installment package. The member receives the 24-session cycle at activation, while later installments act as booking gates rather than granting a second copy of the sessions.

Agreed checkpoints:

- **24 sessions / activation:** first payment is required to activate the cycle.
- **19 sessions remaining:** next installment becomes due.
- **13 sessions remaining:** next installment becomes due.
- **2 sessions remaining:** show `Renewal Soon` to the member and staff/admin.
- **1 session remaining:** show high-priority `Last Session — Renew Now`; the member may still use that final session.
- **0 sessions remaining:** block new bookings and check-ins until a renewal/new paid package is activated.

When a 19- or 13-session installment becomes due and remains unpaid:

- show `Payment Due` immediately,
- preserve already-confirmed bookings,
- block new member booking confirmations until the installment is paid.

The checkpoint itself does not deduct or add sessions.

## 4. Data Model

### 4.1 `package_definitions`

Canonical product catalog.

Key fields:

- `id`
- `code` unique
- `name`
- `service_category`
- `included_sessions`
- `validity_days` nullable
- `shareable`
- `billing_mode`
- `active`
- timestamps

### 4.2 `package_payment_stages`

Defines installment/activation gates per package without hard-coding them into UI code.

Key fields:

- `id`
- `package_id`
- `stage_order`
- `stage_key`
- `label`
- `trigger_type`: activation or sessions_left
- `trigger_sessions_left` nullable
- `blocks_new_bookings_when_due`
- `active`

Partial 24 starts with activation, 19-left, and 13-left payment stages.

### 4.3 `member_package_cycles`

Canonical balance for a member's purchased package cycle.

Key fields:

- `id`
- `member_id`
- `package_id`
- `status`
- `sessions_total`
- `sessions_used`
- `sessions_left`
- `starts_at`
- `expires_at` nullable
- `renewed_from_id` nullable
- timestamps

Session decrements must lock this row in the database transaction.

### 4.4 `member_package_stage_payments`

Connects a package cycle's required payment stage to an existing payment record.

Key fields:

- `id`
- `member_package_id`
- `stage_id`
- `payment_id` nullable
- `status`: due, pending, paid, waived
- `due_at`
- `paid_at` nullable

This separates **payment status** from **session credit**, which is required for Partial 24.

### 4.5 `availability_rules`

Stores recurring coach availability.

Key fields:

- `id`
- `coach_user_id`
- `branch`
- `session_type`
- `weekday`
- `local_start_time`
- `local_end_time`
- `slot_duration_minutes` default 60
- `capacity` default 1
- `valid_from`
- `valid_until` nullable
- `active`
- timestamps

Timezone is BearFit-local (`Asia/Manila`) for recurrence generation.

### 4.6 `schedule_slots`

Materialized bookable sessions.

Key fields:

- `id`
- `availability_rule_id` nullable
- `coach_user_id` nullable until assigned where allowed
- `branch`
- `session_type`
- `start_at`
- `end_at`
- `capacity`
- `status`: open, closed, cancelled, completed
- `created_by`
- timestamps

A uniqueness/overlap rule prevents accidental duplicate concrete slots from the same recurring rule.

### 4.7 `bookings`

Stores member booking requests and confirmed assignments.

Key fields:

- `id`
- `member_id`
- `slot_id` nullable for an unresolved custom request
- `request_kind`: slot, custom, staff_assignment
- `status`: pending, confirmed, rejected, cancelled, completed, no_show
- `requested_coach_user_id` nullable
- `assigned_coach_user_id` nullable
- `branch`
- `session_type`
- `requested_start_at`
- `start_at` nullable until confirmed
- `end_at` nullable until confirmed
- `member_package_id` nullable until/at confirmation
- `cancelled_at` nullable
- `cancel_reason` nullable
- `no_show_charged` default false
- `created_by`
- timestamps

### 4.8 Existing `session_logs`

Add optional `booking_id` and `member_package_id` references.

- A checked-in booking can create at most one attendance log.
- A charged no-show can create at most one charge/usage event.
- Existing manual check-in remains possible for staff, but the staff must select the applicable service/package when no confirmed booking identifies it automatically.

## 5. Server-Side Operations

All state-changing scheduling operations must be database transactions/RPCs with staff/member authorization enforced server-side. Browser-side checks are only UX helpers.

### Member operations

- `member_request_slot(slot_id)`
  - verifies authenticated member
  - same branch
  - start is at least 24 hours away
  - slot is open
  - package is eligible
  - creates pending booking

- `member_request_custom_session(...)`
  - same 24-hour and branch rules
  - coach may be specific or Any available coach
  - creates pending booking without consuming capacity

- `member_cancel_booking(booking_id)`
  - allowed directly only when at least 4 hours remain
  - later cancellations return a staff-contact-required result rather than silently cancelling

### Staff/admin operations

- create/edit recurring availability
- create/edit/cancel one-off slots
- confirm/reject booking requests
- create direct confirmed assignment
- reassign coach
- staff cancellation/late-change handling
- mark no-show with explicit `charge_session` choice

### Confirmation transaction

Before changing a booking to `confirmed`, the database re-checks:

1. staff/admin authorization
2. slot is still open
3. confirmed count is below capacity
4. assigned coach does not conflict with another confirmed slot
5. member branch matches the slot for member-originated bookings
6. a matching package cycle is active, unexpired, and has usable credit
7. there is no overdue blocking installment
8. confirmed future bookings do not exceed remaining usable package credits

Only then is the booking confirmed.

## 6. Check-In Integration

Check-in becomes booking-aware without breaking the working staff tool.

### Confirmed booking check-in

When a member checks in for a confirmed booking:

1. identify the confirmed booking within the allowed attendance window
2. resolve its `member_package_id`
3. lock the package cycle
4. verify it still has a usable session
5. deduct exactly one session
6. increment used sessions
7. create one `session_logs` record linked to booking/package
8. mark booking `completed`
9. evaluate payment/renewal alerts after the new balance

The operation is idempotent: repeating the same check-in cannot deduct twice.

### Charged no-show

Staff marking `no_show` with `charge_session=true` runs the same one-session ledger operation and marks the booking as charged. Repeating the action cannot charge twice.

## 7. Eligibility and Alert Engine

Package eligibility is computed centrally so the Member Dashboard, booking UI, staff screens, and check-in all show the same state.

Return a normalized eligibility result such as:

- `can_request_booking`
- `can_confirm_booking`
- `can_check_in`
- `blocking_reason`
- `warning_level`
- `warning_message`
- `sessions_left`
- `payment_stage_due`
- `expires_at`

### Partial 24 examples

- 20 left, all required stages paid → eligible
- 19 left, 19-left stage unpaid → `Payment Due`, no new confirmation
- 2 left → eligible + `Renewal Soon`
- 1 left → eligible + `Last Session — Renew Now`
- 0 left → blocked until renewal

### Staff/admin renewal view

Staff/admin gets a derived queue of members needing attention:

- payment due
- 2 sessions left: renewal soon
- 1 session left: last session/high priority
- expired package

The first release does **not** need a full push-notification service. These are persisted/derived application alerts visible in staff/member UI. Email, SMS, and push delivery can be added later without changing package eligibility rules.

## 8. Member Experience

### `/member/schedule`

Member sees:

- home branch only
- available slots grouped by date
- coach or Any available coach choice
- session type
- duration
- remaining capacity for group classes
- package eligibility/warnings
- Request button
- custom request option when no slot fits

If the desired time is inside 24 hours, self-booking is disabled and the UI says to contact staff/admin.

### Member Dashboard

The existing dummy design remains the visual target. The Upcoming Sessions area becomes real:

- confirmed next session
- session type
- coach
- branch
- date/time
- countdown
- booking status
- cancellation/change action when outside the 4-hour cutoff

The dashboard also surfaces package-specific notices such as Payment Due, Renewal Soon, Last Session, and expiry warnings.

## 9. Staff/Admin Experience

Staff/admin receives a schedule workspace with:

- calendar/list views
- recurring availability management
- one-off slots
- pending booking request queue
- approve/reject actions
- capacity view
- coach assignment
- member/package eligibility before confirmation
- late cancellation/no-show handling
- renewal/payment attention queue

Staff-created direct assignments can bypass the member 24-hour notice rule but cannot silently bypass package balance or payment gates.

## 10. Security and RLS

- Members can read only their own bookings and eligible slots for their branch.
- Members can create/cancel only their own booking requests through controlled functions.
- Staff/admin can read/manage bookings and slots according to staff authorization.
- Package balances cannot be updated directly from the browser.
- Payment-stage status is changed only by payment workflow or staff/admin-controlled operations.
- Capacity checks, package checks, check-in deductions, and no-show charges occur inside database transactions.
- `SECURITY DEFINER` RPCs must explicitly validate `auth.uid()` and staff/admin role and use a fixed `search_path`.
- RLS remains enabled on every new public table.

## 11. Migration / Compatibility Strategy

1. Add package catalog and package-cycle tables without deleting existing member counters.
2. Seed package definitions.
3. Create an initial package cycle for the existing test member based on their current package/balance.
4. Link new payments to package cycle/stage where applicable.
5. Add scheduling tables and RPCs.
6. Make new scheduling/check-in logic read package-cycle balances.
7. Keep `members.total_sessions`, `sessions_used`, and `sessions_left` as a compatibility mirror for the member's primary fitness package during transition.
8. Update Member Dashboard data loader to prefer package-cycle data.
9. Remove dependence on the global member balance only after the new flow is verified in production.

This avoids breaking the currently working Payments → Check-in → Dashboard flow during migration.

## 12. Testing Requirements

### Database tests

- pending request does not consume capacity
- confirmation consumes one capacity position
- final capacity position cannot be double-confirmed concurrently
- member self-book inside 24 hours is rejected
- member cancellation at >=4 hours succeeds
- member cancellation inside 4 hours requires staff handling
- wrong-branch self-book is rejected
- check-in deducts exactly one package session
- repeated check-in cannot double-deduct
- no-show without charge leaves balance unchanged
- charged no-show deducts once
- expired package cannot be used
- Partial 24 at 19/13 with unpaid stage blocks new confirmations
- Partial 24 at 2/1 still allows the remaining sessions and emits renewal warnings
- zero sessions blocks confirmation and check-in
- confirmed future bookings cannot exceed usable credits
- recurring slot generation does not duplicate slots

### Application regression tests

- existing auth continues to work
- existing payment pending/paid semantics remain correct
- member dashboard still loads real data
- staff payments page still works
- staff check-in page still works
- `/member/schedule` is member-protected
- staff schedule routes are staff/admin-protected

### Production verification

After Vercel deploy:

1. create recurring coach availability
2. verify generated slots
3. submit a member request >24h away
4. approve it as staff/admin
5. verify it appears on Member Dashboard
6. check in and verify package/session/activity update
7. test 4-hour cancellation behavior
8. test a Partial 24 payment checkpoint in a reversible test cycle

## 13. Explicitly Deferred Scope

To keep this phase focused, the following are not required for the first scheduling release:

- automatic SMS/email/push notifications
- in-app chat implementation
- online payment gateway integration
- Google Calendar synchronization
- waitlists
- timed holds for pending requests
- advanced coach payroll/commission calculations
- true multi-member consumption of a shareable Pilates package

The package catalog stores `shareable` now so the later sharing feature does not require redefining the product catalog. Actual sharing relationships and authorization will be a separate phase.

## 14. Success Criteria

The scheduling phase is complete when:

- staff can publish recurring and one-off availability,
- members can request a listed slot or custom time under the agreed rules,
- staff can approve/reject and assign coaches,
- capacity cannot be overbooked,
- confirmed upcoming sessions appear on the real Member Dashboard,
- cancellation/no-show rules are enforced,
- attendance deducts from the correct package exactly once,
- Partial 24 payment gates and 2/1-session renewal warnings behave correctly,
- Pilates packages retain their own validity and service type,
- the existing working payment/check-in flow remains functional throughout migration.
