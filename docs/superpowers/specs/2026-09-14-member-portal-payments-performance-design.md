# Member Portal Payments & Performance Design

## Goal
Make the BearFit member portal feel like one consistent app while adding a real view-only member Payments experience and reducing avoidable server-to-Supabase latency.

## Approved scope
- Rewards uses the existing `MemberAppShell` with Rewards active.
- Member navigation uses a real `/member/payments` route instead of `#payments` on the dashboard.
- `/member/payments` is view-only: no online checkout, proof upload, or member-side payment mutation.
- Payments shows current package state, sessions remaining, payment/renewal attention, Partial 24 stage guidance, known amount due, and recent payment history.
- If a payment is due and no member payment channel is configured, instruct the member to contact BearFit staff/admin directly; do not invent contact details.
- Improve member loading by parallelizing independent Supabase calls and adding route loading states.
- Do not change package deduction, booking, reward redemption, or staff/admin payment business rules.

## Navigation architecture
Continue the incremental `MemberAppShell` approach rather than moving the entire member portal into a Next.js shared layout in this pass. Schedule already uses the shell. Rewards and Payments will use it next. Dashboard remains unchanged structurally to reduce regression risk.

`MemberAppShell` navigation:
- Home -> `/member/dashboard`
- Schedule -> `/member/schedule`
- Rewards -> `/member/rewards`
- Payments -> `/member/payments`
- Profile -> `/member/profile`

The active page is highlighted on desktop and mobile.

## Rewards UX
Wrap the existing rewards content in `MemberAppShell activePath="/member/rewards"`. Remove rewards-only duplicate header navigation and duplicate bottom navigation. Keep reward snapshot, redeem, cancel, reserved points, catalog, and history behavior unchanged.

## Member Payments data model
Create a focused member payments loader instead of reusing the heavier dashboard account loader.

`MemberPackageEligibilityView` includes the existing RPC fields needed by the page:
- `member_package_id`
- `package_code`
- `package_name`
- `service_category`
- `sessions_left`
- `sessions_total`
- `sessions_used`
- `blocking_reason`
- `warning_level`
- `warning_message`
- `payment_stage_due`
- `payment_stage_label`
- `expires_at`

`loadMemberPaymentsData(userId)`:
1. Load profile and member in parallel.
2. If the member exists, load recent member payments plus fitness, Pilates Group, and Pilates 1-on-1 eligibility in parallel.
3. Keep only package eligibility records backed by a real `member_package_id` for the package cards.
4. Use recent payment rows to display known pending amounts and payment history.

No new SQL migration is required because `member_package_eligibility` already returns the exact due stage and label.

## Payments UX
The page uses `MemberAppShell activePath="/member/payments"`.

Top summary:
- payment health (`Payment Due`, `Renewal Soon`, `Last Session — Renew Now`, or `Up to date`)
- total/member-level payment status
- latest paid date/amount when available

Package cards:
- package name and category
- sessions remaining / total
- expiry when present
- current warning/blocking state
- exact payment stage due when present
- known amount due when a matching pending payment exists
- for Partial 24 when no stage is currently due, show the next milestone: at 19 sessions left, then at 13 sessions left, then installments up to date

History:
- recent payment rows with package, stage, amount, status, date, and payment type
- empty state when no payments exist

When a payment is due, show: `Contact BearFit staff/admin to settle this payment.` No fake phone number, Messenger URL, or checkout action.

## Performance
Dashboard currently parallelizes its main session/payment/booking/Bearforce queries but then performs coach lookup and three package-eligibility calls in later rounds. Change it so coach directory and all three known package-eligibility RPCs are part of the same concurrent batch as the other independent post-member queries.

Rewards currently does auth, then profile lookup, then rewards snapshot. After auth, profile and rewards snapshot can run concurrently.

Add member route loading skeletons for Dashboard, Schedule, Rewards, and Payments so navigation produces immediate feedback while server data is resolving.

## Error handling
- Authentication behavior remains unchanged: unauthenticated members are redirected to login/welcome according to the existing route convention.
- Staff/admin visiting member Rewards remain redirected to staff Rewards.
- Staff/admin visiting member Payments are redirected to `/payments`.
- Partial data failures render the page with an explanatory warning rather than exposing raw database errors.

## Acceptance criteria
1. Rewards keeps the BearFit desktop sidebar and mobile bottom nav, with Rewards active.
2. Payments nav opens `/member/payments` from desktop and mobile.
3. Member Payments is view-only and displays real package/payment data.
4. Partial 24 due stage uses the authoritative eligibility RPC output.
5. No billing, booking, check-in, or reward mutation rules change.
6. Dashboard eligibility RPCs no longer execute in a sequential loop.
7. Rewards profile and snapshot fetch in parallel after auth.
8. Dashboard, Schedule, Rewards, and Payments have route loading feedback.
9. Feature branch Vercel preview must succeed before merge.
10. Production Vercel status must succeed after merge.