# BearFit foundation stabilization

Implemented on 2026-09-02:

- Added Supabase migrations for `members`, `profiles`, `payments`, and `session_logs`.
- Added RLS and role-aware staff/admin access.
- Added automatic member/profile creation after Supabase Auth signup.
- Added `staff_qr_checkin` RPC with server-side role enforcement.
- Added Next.js `proxy.ts` session refresh wiring.
- Fixed the welcome/onboarding redirect loop.
- Standardized login/signup on `/api/auth/signin` and `/api/auth/signup`.
- Added an `/auth/confirm` token callback for SSR email confirmation.
- Removed the public service-key `/api/init-db` route.
- Fixed stale `/dashboard` links and Next.js async route params.
- Removed unused duplicate Supabase/auth code.
- Added regression tests under `tests/`.

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Supabase email confirmation

If email confirmation is enabled, configure the Confirm signup email template to use:

`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

Set the Supabase Site URL to the production Vercel/custom domain.

## Remaining dependency task

The source currently pins Next.js 16.1.3. The execution environment used for this stabilization cannot reach npm, so the lockfile could not be safely regenerated for a framework upgrade. Upgrade Next.js and `eslint-config-next` together in a networked environment and regenerate `pnpm-lock.yaml` before relying on the security-version upgrade.

## Scheduling and package-cycle milestone — production verified 2026-09-03

The Schedule / Booking phase is implemented and production-verified against the BearFit Supabase project.

### Package and payment model

- Added canonical `package_definitions`, `package_payment_stages`, `member_package_cycles`, and `member_package_stage_payments` tables.
- Core catalog: Full 24, Full 48, Partial 24, Pilates 5, Pilates 10, Pilates 20, and Pilates 1-on-1.
- Pilates validity rules are enforced at the package-cycle level: 5 = 30 days, 10 = 45 days, 20 = 60 days.
- Pilates group and Pilates 1-on-1 are separate service categories; group credits cannot fund 1-on-1 attendance.
- Partial 24 activation creates one 24-session cycle; installment stages at 19 and 13 sessions clear booking gates and do not add duplicate sessions.
- Partial 24 renewal states: 2 left = `Renewal Soon`, 1 left = `Last Session — Renew Now`, 0 left = no new booking/check-in until renewal.
- Existing `members.sessions_*` counters remain a compatibility mirror for the primary fitness balance while package cycles are the scheduling source of truth.

### Scheduling and booking model

- Added `availability_rules`, `schedule_slots`, and `bookings` with RLS and covering foreign-key indexes.
- Staff/admin can create recurring availability, generate concrete slots, create one-off slots, assign members, confirm/reject member requests, reassign coaches, cancel bookings, and mark no-shows.
- Members can request open home-branch slots or send custom requests with a named home-branch coach or `Any available coach`.
- Member self-booking is blocked inside 24 hours and instructs the member to contact staff/admin.
- Member self-cancellation works until 4 hours before the confirmed start; inside 4 hours the operation returns staff-contact-required without cancelling.
- Pending requests do not consume capacity. Confirmation rechecks capacity, coach conflicts, branch, package eligibility, payment gates, and remaining usable credits transactionally.
- Booking confirmation never deducts a package session.

### Attendance integration

- Check-in resolves a confirmed booking/package before consuming a session.
- One successful booking check-in consumes exactly one package session, writes one `session_logs` row, and marks the booking `completed`.
- Repeating the same booking check-in cannot consume a second session.
- Staff no-show actions require an explicit `Charge 1 session` choice. Uncharged no-show consumes zero; charged no-show consumes exactly one; repeating it cannot double-charge.
- The Member Dashboard reads real upcoming confirmed bookings and real session/payment activity.

### Production verification evidence

Verified against production/live Supabase with reversible transactions where destructive test data was not needed:

- recurring slot generation is idempotent (second generation of the same window creates zero duplicates),
- >24-hour member request → staff confirmation → Member Dashboard Upcoming Session,
- live confirmed booking check-in completed the booking and moved the test member from 1 used / 4 left to 2 used / 3 left,
- inside-24-hour member booking is blocked,
- inside-4-hour member cancellation requires staff,
- uncharged no-show = 0 session delta,
- charged no-show = -1 session exactly once,
- Partial 24 19/13 payment gates block new bookings until paid while allowing already-confirmed attendance,
- 2/1/0 remaining-session warning/block rules behave as specified,
- Pilates 5/10/20 validity = 30/45/60 days,
- Pilates group credits cannot fund Pilates 1-on-1.

The combined local BearFit regression suite currently has 72 passing tests after the progression milestone. Vercel remains the final full Next.js compile/build verification for each uploaded release package.

### Active scheduling/package RPC surface

Member-facing:

- `member_package_eligibility`
- `member_coach_directory`
- `member_request_slot`
- `member_request_custom_session`
- `member_cancel_booking`

Staff/admin:

- `staff_package_attention_queue`
- `staff_record_package_payment`
- `staff_mark_package_payment_paid`
- `staff_create_availability_rule`
- `staff_generate_slots`
- `staff_create_one_off_slot`
- `staff_cancel_slot`
- `staff_confirm_booking`
- `staff_reject_booking`
- `staff_create_assignment`
- `staff_reassign_booking`
- `staff_cancel_booking`
- `staff_checkin_context`
- `staff_qr_checkin`
- `staff_mark_no_show`

### Security/advisor status

- RLS remains enabled on member, package, scheduling, booking, payment, and attendance tables.
- State-changing RPCs use fixed `search_path=''` and perform explicit authentication plus member ownership or staff/admin authorization checks.
- Supabase security advisor still reports expected visibility/executable warnings for RLS-protected authenticated tables and controlled `SECURITY DEFINER` RPCs because they are intentionally exposed through the authenticated API surface.
- Supabase Auth leaked-password protection is still disabled at the project level and should be enabled before a broader production launch.
- Performance advisor reports only unused-index informational notices on the low-data test project; the previously reported missing foreign-key indexes were added.

### Role status

Role separation is complete: `JJ / M0001` is a normal `member`, while the dedicated `BearFit Admin` login is `admin` with no member record attached. Member access to Payments, Check-in, and Staff Schedule has been verified blocked/redirected, while the Admin account can access those staff surfaces.

### Explicitly deferred after this milestone

- email/SMS/push notifications for booking or renewal alerts,
- waitlist automation,
- Google Calendar/external calendar synchronization,
- automatic payment gateway collection,
- true cross-member/shared-credit relationship enforcement for shareable Pilates packages,
- stricter automatic check-in time-window policy,
- Next.js/security dependency upgrade requiring lockfile regeneration in a networked development environment.

## Bearforce progression milestone — production verified 2026-09-03

The original dashboard progression concepts are now real data features instead of placeholders.

### Point earning

- Successful real check-in/completed training session: +100 Bearforce Points.
- Paid package activation: +200.
- On-time Partial 24 installment at the 19-left or 13-left checkpoint: +150.
- Early renewal while a prior same-service package still has at least one usable session: +250 bonus.
- Charged no-shows consume a package session but award zero Bearforce Points.
- Earning is append-only and source-key idempotent, so retrying the same check-in/payment cannot duplicate points.
- Historical legitimate session logs were backfilled at +100 each; historical payment bonuses were intentionally not guessed.

### Lifetime, season, spendable balance

- `Lifetime Bearforce Points` is the permanent total ever earned and never decreases from reward redemption.
- BearFit seasons are calendar quarters (3 months) in Asia/Manila.
- `Season Earned` is the current-quarter earned total used for Prestige rank.
- `Season Balance` is current-quarter earned minus completed redemptions and is the spendable amount.
- Unused seasonal balance expires naturally at the next quarter because each season is scoped separately; lifetime points remain.
- Staff/admin redemption and reversal RPCs are available; a fixed reward catalog is intentionally deferred until actual reward items/costs are defined.

### Workout streak

- Weekly goal is 3+ real completed/check-in sessions, Monday through Sunday in Asia/Manila.
- One isolated missed completed week is a grace week and does not increase the streak.
- The following successful week continues the streak; two missed completed weeks in a row reset it.
- The current in-progress week does not break a streak before the week is complete.

### Progression levels

Lifetime Fitness Tier:
- Bear Cub: 0–999
- Grizzly: 1,000–4,999
- Kodiak: 5,000–9,999
- Titan Bear: 10,000–24,999
- Apex Bear: 25,000+

Current-season Prestige:
- Rookie: 0–499
- Bronze: 500–1,499
- Silver: 1,500–2,999
- Gold: 3,000–4,999
- Prestige: 5,000+

### Dashboard integration

The Member Dashboard four-card progression area now shows real:
- Workout Streak with current `x / 3 this week` progress and grace state,
- Bearforce Points with Lifetime total and Available-to-spend season balance,
- Prestige / Season with quarter and season-earned total,
- Fitness Tier with progress toward the next lifetime tier.

### Live verification evidence

Production Supabase rollback verification confirmed:
- check-in awards exactly +100 once,
- repeated check-in does not duplicate points,
- charged no-show awards +0,
- activation awards +200,
- early renewal bonus awards +250,
- on-time Partial 24 19-left installment awards +150,
- reward redemption decreases season balance without changing lifetime points,
- reversing a redemption restores season balance,
- quarter boundary separates Q3/Q4 season totals,
- an isolated missed week activates grace and preserves the prior streak,
- completing the next qualifying week continues the streak.

The real M0001 package balance remained 2 used / 3 remaining after rollback verification. At the time of verification M0001 had 200 lifetime/2026-Q3 points from two existing legitimate completed session events, was Rookie prestige, and Bear Cub lifetime tier.

### Advisor status after progression DDL

- Both Bearforce tables have RLS enabled and member/staff read policies.
- The two Bearforce redemption staff-actor foreign keys now have covering indexes.
- Performance advisor reports only unused-index INFO notices on the low-data test project.
- Security advisor continues to report the existing authenticated GraphQL visibility and controlled `SECURITY DEFINER` RPC warnings by design, plus leaked-password protection disabled at the project level.

## Bearforce Rewards Catalog

- Member `/member/rewards` catalog uses the real current-season Bearforce spendable balance.
- Pending requests reserve points and limited stock but do not spend points.
- Staff/Admin `/staff/rewards` controls catalog creation/updates, approval, rejection, and claimed status.
- Approval spends seasonal Bearforce balance while Lifetime Points and Season Earned remain unchanged.
- Limited stock is reserved atomically; rejection/cancellation releases it; approval consumes it.
- No fake rewards are seeded. Staff creates real BearFit rewards and controls availability.
- Pending requests from an ended season cannot be approved.
