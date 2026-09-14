# Package Operations Design

## Goal
Finish BearFit package operations without rebuilding the existing package foundation. Staff should be able to see members who need package action and move directly into the correct payment workflow, while preserving the existing catalog, package-cycle, booking, check-in, and payment-stage rules.

## Existing Foundation
The repository already has:
- `package_definitions`, `package_payment_stages`, `member_package_cycles`, and `member_package_stage_payments`.
- Full 24, Full 48, Partial 24, Pilates 5/10/20, Pilates 1-on-1, and Legacy Fitness definitions.
- Partial 24 payment stages at activation, 19 sessions left, and 13 sessions left.
- `private.package_eligibility()` / `member_package_eligibility()` for booking and check-in decisions.
- `staff_package_attention_queue()` for staff-facing package alerts.
- `staff_record_package_payment()` and `staff_mark_package_payment_paid()` for package-aware payments.
- `/staff/packages` and `/payments` staff interfaces.

## Live Database Drift
The live Supabase project has package-cycle migrations through the zero-session eligibility fix, but has not applied the repository migration `20260904101000_package_pricing_admin.sql`. The package UI already expects `package_definitions.standard_price`, `staff_package_catalog()`, and `admin_update_package_settings()`. Before the package operations UI is released, apply that existing migration to live Supabase and verify the seeded prices and RPCs.

Approved prices:
- Pilates 5: ₱4,450
- Pilates 10: ₱8,900
- Pilates 20: ₱16,400
- Pilates 1-on-1: ₱1,600
- Full 24, Full 48, Partial 24: price remains unset until explicitly decided.

## Staff Package Attention
Enhance `/staff/packages` with a `Member Package Attention` section populated by `staff_package_attention_queue()`.

Each item shows:
- member name and code
- package name and service category
- sessions remaining
- reason/status
- expiry when applicable

Reason presentation:
- `payment_due` → Payment Due, critical
- `last_session` → Last Session — Renew Now, critical
- `renewal_soon` → Renewal Soon, warning
- `expired` → Package Expired, critical

The section must render an explicit empty state when nobody needs action.

## Payment Handoff
Attention items link directly to `/payments` using query parameters.

For `payment_due`:
- prefill `memberId`
- prefill `packageCode`
- prefill `memberPackageId`
- do not guess the stage in the URL

The Payments page derives the actual due stage from package-stage definitions plus `member_package_stage_payments`, matching the package-eligibility rule: a stage is due if its trigger is reached and its status is not `paid` or `waived`; when multiple stages qualify, the highest `stage_order` wins.

For `renewal_soon`, `last_session`, and `expired`:
- prefill `memberId`
- prefill the member's current `packageCode`
- prefill `stageKey=activation`
- do not pass the existing cycle ID, so recording a paid activation creates a new package cycle instead of resetting the old cycle.

Staff can still change the prefilled package before recording payment.

## Package Rules That Must Not Change
- Activation payment credits the package's included sessions exactly once.
- Partial 24 19-left and 13-left installments add zero sessions; they only clear booking gates.
- An unpaid due installment blocks new booking requests/confirmations but does not invalidate already-confirmed sessions.
- 2 sessions left shows `Renewal Soon` and still permits use.
- 1 session left shows `Last Session — Renew Now` and still permits the final session.
- 0 sessions blocks new booking/check-in through central eligibility.
- Pilates Group and Pilates 1-on-1 remain separate service categories.
- Legacy Fitness remains inactive and cannot be enabled from package settings.

## Error Handling
- `/staff/packages` displays catalog or attention-queue RPC errors without crashing the page.
- `/payments` ignores malformed or unknown query prefill values and keeps the form usable.
- A deep-linked package cycle must match the selected member and package before it is used.
- If no due stage can be derived, the payment-stage selector remains available for staff choice rather than inventing a stage.

## Testing
Add regression coverage that verifies:
- `/staff/packages` loads `staff_package_attention_queue()`.
- attention cards expose the correct payment/renewal link shape.
- `/payments` server page passes query prefill to the client.
- Payments fetches trigger metadata and stage-payment status.
- due-stage selection ignores `paid` / `waived` stages and follows highest `stage_order`.
- renewal links do not reuse the existing cycle.
- existing package-cycle/payment/check-in tests continue to pass.
- Next.js production build succeeds in Vercel preview before merge.

## Out of Scope
- Creating arbitrary new package definitions from the UI.
- Editing included sessions, service categories, billing modes, validity, or payment-stage trigger structure.
- Setting Full 24 / Full 48 / Partial 24 prices without an explicit future decision.
- Changing Bearforce, rewards, session taxonomy, or unrelated scheduling behavior.
