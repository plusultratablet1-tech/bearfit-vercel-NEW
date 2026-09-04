# BearFit Steps 3–10 Production Design

## Goal
Complete BearFit Steps 3–10 as one coordinated production milestone: transparent Bearforce history, richer rewards/progression presentation, season/prestige and lifetime tier screens, configurable real package pricing with safe QA cleanup, and a production-facing session taxonomy that does not break package eligibility.

## Scope and Locked Decisions
This milestone includes:
- Step 3: Bearforce Points History.
- Step 4: Rewards page polish.
- Step 5: Bearforce progression presentation.
- Step 6: Season / Prestige screen.
- Step 7: Fitness Tier presentation.
- Step 8: Real BearFit package configuration.
- Step 9: Safe cleanup of test/legacy presentation while keeping JJ / M0001 as the permanent QA/demo member.
- Step 10: Production session names and image/content mapping.

Locked business decisions:
- Full24, Full48, and Partial24 prices remain unset until BearFit supplies real values. Admin can configure them later.
- Pilates prices are real and fixed initially: Pilates 5 = ₱4,450; Pilates 10 = ₱8,900; Pilates 20 = ₱16,400; Pilates 1-on-1 = ₱1,600.
- JJ / M0001 remains the permanent QA/demo member.
- Production session names are: Strength Training, Weight Training, Boxing, Conditioning, Cardio, Group Fitness, Pilates Group, Pilates 1-on-1.
- Existing Bearforce earning, season, streak, prestige, tier, and reward-spending rules remain unchanged.

## Architectural Principle
Do not replace authoritative accounting or eligibility logic with frontend calculations. Bearforce earnings/redemptions remain ledger-based in PostgreSQL. Package eligibility remains based on the existing internal service categories (`fitness`, `pilates_group`, `pilates_1on1`). Production-facing session names are stored separately from the internal service category so a label such as `Boxing` cannot accidentally bypass or break package rules.

The milestone adds only the minimum database/API fields required for transparent presentation and controlled administration. It does not introduce a general-purpose CMS or allow staff to edit structural package rules that affect accounting.

---

## Step 3 — Bearforce Points History

### Member Experience
Add a dedicated member progression route at `/member/bearforce`. The first section is an auditable points ledger showing the member exactly how points were earned and spent.

Earning rows come from `bearforce_point_events` and display:
- event label,
- positive point delta,
- local Asia/Manila date/time,
- source context when safely available.

Canonical member-facing event labels:
- `session_completed` → `Workout completed`
- `package_activation_paid` → `Package activation paid`
- `partial_installment_on_time` → `Installment paid on time`
- `early_renewal` → `Early renewal bonus`

Redemption rows come from completed `bearforce_redemptions` and display:
- reward label,
- negative point delta,
- local date/time,
- redemption status.

The combined history is reverse chronological. It is presentation-only; no member can edit ledger rows.

### Data/API
Add a member-only RPC, `public.member_bearforce_history(p_limit integer default 100)`, resolving the caller through `auth.uid()`. It returns a normalized array of earning and redemption events. The RPC never accepts arbitrary `member_id`.

No destructive migration or ledger rewrite is required.

---

## Step 4 — Rewards Page Polish

Keep the existing `/member/rewards` redemption engine and transitions unchanged. Improve presentation using the existing real catalog and request data.

### Member Reward Cards
Each active reward shows:
- title and description,
- optional image,
- category badge,
- point cost,
- available stock when limited,
- `Unlimited` when stock is null,
- active-membership requirement,
- affordability state,
- exact `X more points needed` copy when unaffordable,
- pending request state when that reward is already reserved.

### Balance Header
Show together:
- Season Earned,
- Season Spent,
- Reserved by Pending Requests,
- Available to Spend,
- season end date/countdown.

Do not relabel `season_earned` as spendable. Available-to-spend remains `season_balance - pending reservations`.

### History
Present Pending, Approved, Claimed, Rejected, and Cancelled requests with clear status badges and timestamps. Member cancellation remains limited to Pending requests.

### Images
Reward images remain controlled by the existing Admin reward image URL field. If absent, render a deterministic category fallback visual rather than a broken/empty image.

---

## Step 5 — Bearforce Progression Presentation

The home dashboard remains compact and retains four progression cards:
1. Workout Streak
2. Bearforce Points
3. Prestige / Season
4. Fitness Tier

Each card links to `/member/bearforce` for detail.

### Workout Streak Card
Show:
- current streak weeks,
- current weekly progress, e.g. `2 / 3 this week`,
- `Weekly goal complete` after reaching 3,
- a visible `Grace Week` state only when `grace_week_active=true`.

### Bearforce Card
Primary value: Lifetime Bearforce Points.
Secondary values: current Season Earned and Available to Spend.

### Prestige Card
Primary value: current prestige rank.
Secondary: current season key and points to next rank.

### Fitness Tier Card
Primary value: current lifetime tier.
Secondary: progress toward the next lifetime tier.

---

## Step 6 — Season / Prestige Screen

The `/member/bearforce` page contains a full season section.

### Current Season
Show:
- season key,
- season start/end in Asia/Manila,
- Season Earned,
- Season Spent,
- Spendable Balance,
- days/time until season ends,
- current prestige rank,
- progress bar to the next prestige threshold.

Prestige thresholds remain exactly:
- Rookie: 0–499
- Bronze: 500–1,499
- Silver: 1,500–2,999
- Gold: 3,000–4,999
- Prestige: 5,000+

### Previous Seasons
Add `public.member_bearforce_seasons()` returning historical season summaries derived from immutable earnings/redemptions rather than storing reset counters. Each row includes season key, earned, spent, resulting balance, and achieved prestige rank.

A season with no events does not need a synthetic history row.

### Season Boundaries
Seasons remain calendar quarters in Asia/Manila. No scheduled reset job is introduced.

---

## Step 7 — Lifetime Fitness Tier Presentation

Use the already-approved lifetime thresholds:
- Bear Cub: 0–999
- Grizzly: 1,000–4,999
- Kodiak: 5,000–9,999
- Titan Bear: 10,000–24,999
- Apex Bear: 25,000+

The member page renders a tier ladder with:
- current tier emphasized,
- completed tiers visibly achieved,
- next-tier threshold,
- progress bar,
- `X Lifetime Points to <next tier>` copy.

Use the label `BearFit Tier` or `Fitness Tier` with explicit helper text: `Based on Lifetime Bearforce Points.` It must not imply a medical or physiological fitness assessment.

Tier data continues to come from `private.bearforce_fitness_tier`; thresholds are not duplicated as editable client settings.

---

## Step 8 — Real Package Configuration

### Database
Add nullable `standard_price numeric(12,2)` to `public.package_definitions`, constrained to null or non-negative.

Populate known real prices:
- `PILATES5`: 4450.00
- `PILATES10`: 8900.00
- `PILATES20`: 16400.00
- `PILATES1ON1`: 1600.00

Leave these null:
- `FULL24`
- `FULL48`
- `PARTIAL24`

`LEGACY_FITNESS` stays inactive and its price remains null.

### Staff/Admin Package Settings
Add `/staff/packages`, staff/admin protected, with a package catalog view. To reduce accidental rule breakage, the v1 editor only allows Admin to change:
- standard price,
- active/inactive state for normal production package definitions.

Structural fields remain read-only in the UI:
- code,
- service category,
- included sessions,
- validity,
- shareable,
- billing mode,
- Partial24 stage thresholds.

Use controlled RPCs rather than direct authenticated table writes:
- `public.staff_package_catalog()` returns all definitions and stages.
- `public.admin_update_package_settings(p_package_id uuid, p_standard_price numeric, p_active boolean)` requires `role='admin'` rather than generic staff.

`LEGACY_FITNESS` cannot be activated through this RPC.

### Payments UI
When a package has a standard price, show it as guidance/default context. Actual recorded payment amount remains explicit and authoritative so real discounts/promotions or installment amounts are still possible.

No Full24/Full48/Partial24 fake prices are inserted.

---

## Step 9 — Safe QA / Legacy Cleanup

### Permanent QA Account
Add `is_demo boolean not null default false` to `public.members`. Mark JJ / M0001 as `is_demo=true` through a data migration that identifies the member by stable `member_code='M0001'`, not a generated UUID.

The UI may show a small `QA / Demo` badge to staff/admin for demo members. Normal member-facing copy should not expose internal QA terminology unless logged in as that demo account.

### JJ Package Presentation
Do not delete or rewrite JJ's historical package cycle or completed rewards test. The underlying `LEGACY_FITNESS` compatibility cycle remains the accounting source for its existing 5-session QA balance.

For the demo member only, presentation maps the inactive legacy cycle to the display label `QA Demo Package` instead of the old test wording. The compatibility `members.package_name` / `package_type` fields for M0001 may also be updated to `QA Demo Package` so old screens do not show `Test 5 Sessions`.

### Cleanup Policy
Do not mass-delete payments, bookings, session logs, Bearforce events, reward requests, or package cycles.

Before deleting any temporary rows, the implementation must first query and identify records that are clearly test-only. Deletion is permitted only when all are true:
- not required by a foreign-key-backed history chain,
- not a completed financial/reward/session record,
- not needed for JJ's permanent QA regression history,
- clearly temporary by source/status/timestamps or explicit test marker.

If certainty is not high, keep the record and hide/deactivate it instead.

`LEGACY_FITNESS` remains inactive for historical compatibility and is never offered as a production package.

---

## Step 10 — Production Session Taxonomy

### Core Rule
Keep `session_type` as the internal package service category for compatibility:
- `fitness`
- `pilates_group`
- `pilates_1on1`

Add a separate nullable `session_label` field to:
- `availability_rules`
- `schedule_slots`
- `bookings`
- `session_logs`

Canonical production labels and required service categories:
- Strength Training → `fitness`
- Weight Training → `fitness`
- Boxing → `fitness`
- Conditioning → `fitness`
- Cardio → `fitness`
- Group Fitness → `fitness`
- Pilates Group → `pilates_group`
- Pilates 1-on-1 → `pilates_1on1`

### Validation
Create one authoritative private mapping function, e.g. `private.session_label_category(p_session_label text) returns text`, and validate every new/updated slot/booking/check-in label server-side.

A supplied label must map to the same `session_type` service category. Example: `Boxing` cannot be paired with `pilates_group`.

### Scheduling
Staff recurring availability and one-off slot forms choose a production session label. The server derives/validates the internal service category from that label.

Member schedule cards show production labels, not `fitness`.

Custom member requests choose from the same eight labels. The request RPC derives the required internal category.

### Booking Propagation
When a booking is created from a slot, copy both:
- internal `session_type`,
- member-facing `session_label`.

Staff reassignment cannot move a booking to a slot with a different service category or a mismatched production label unless the booking is explicitly updated through the controlled scheduling flow.

### Check-In
For a confirmed booking, check-in inherits `session_label` from the booking and persists it on `session_logs`.

For manual/QR check-in without a booking, staff must choose one of the production labels. Server validation derives the service category and checks package eligibility before deduction.

### Existing Records
Do not fabricate specific workout labels for old records. Existing rows with null `session_label` render using safe fallback labels:
- `fitness` → `Fitness Session`
- `pilates_group` → `Pilates Group`
- `pilates_1on1` → `Pilates 1-on-1`

For historical `session_logs`, the fallback category is resolved from the linked booking when present; otherwise from the linked member package/package definition. If neither source can establish a category, render `Fitness Session` only when the existing activity source already classifies it as fitness; otherwise render `Training Session` rather than guessing a specific workout.

Where a historical session log note already contains an unambiguous known label, no automatic backfill is required in this milestone; preserving truth is more important than maximizing labels.

### Dashboard / Activity / Images
Upcoming session, booking history, check-in context, and activity log prefer `session_label` and fall back to the generic service label above.

Image mapping is deterministic by production label with a generic fitness/Pilates fallback. Image choice is presentation-only and never affects eligibility.

---

## Member Bearforce Page Composition

`/member/bearforce` is the single detailed progression destination, organized as:
1. summary header: Lifetime, Season Earned, Spendable;
2. weekly streak panel;
3. current Season / Prestige panel;
4. BearFit Tier ladder;
5. Bearforce transaction history;
6. previous season history.

On mobile, these stack vertically with touch-safe controls and existing PWA navigation conventions. Desktop uses the current dark BearFit visual language and orange accent.

---

## Navigation

Member desktop/sidebar and mobile navigation expose a Bearforce/Progress destination without removing Home, Schedule, Rewards, Payments, or Profile access. If mobile bottom-nav space is constrained, Bearforce may be reached from the Home progression cards and Rewards header rather than adding a sixth persistent icon.

Staff navigation adds Packages alongside Schedule, Payments, Check-in, and Rewards.

---

## Security

- Member Bearforce history/season RPCs resolve identity from `auth.uid()`.
- Package price changes require Admin role and controlled RPCs.
- Members cannot directly write package definitions, progression ledger, season history, rewards accounting, or session taxonomy fields.
- Session label/category matching is validated server-side in scheduling/check-in RPCs.
- Existing RLS ownership and staff/admin checks remain in force.
- New tables/columns follow the current RLS pattern; no anonymous access is introduced.

Existing Supabase lint warnings for intentionally exposed authenticated `SELECT` objects and controlled `SECURITY DEFINER` RPCs are not silently represented as zero-warning status. Leaked-password protection remains a separate launch-hardening item.

---

## Error Handling

Member-facing pages must render useful empty states for:
- no Bearforce history,
- no previous seasons,
- no rewards,
- no package price configured,
- no upcoming session label on legacy data.

RPC errors are surfaced as user-readable messages while preserving the database as source of truth. No client action should optimistically deduct sessions, points, stock, or package balances before the server succeeds.

---

## Testing and Verification

### Bearforce / Rewards
- History includes positive earning and negative completed-redemption rows in correct order.
- Member can only retrieve own history.
- Season history separates Q3/Q4 correctly and leaves Lifetime unchanged.
- Prestige thresholds and lifetime tier threshold edges remain correct.
- Rewards still reserve pending points and spend only on approval.
- Rewards UI correctly calculates `X more points needed` using available-to-request balance.

### Packages
- Nullable standard prices accept known Pilates values and null Full24/Full48/Partial24 values.
- Admin can update price/active state.
- Member/staff cannot use the package settings mutation if not Admin.
- `LEGACY_FITNESS` cannot be activated through Admin settings.
- Existing Partial24 19/13 session gates remain unchanged.
- Payment RPC behavior and session credits regress cleanly.

### QA Cleanup
- M0001 remains 2 used / 3 left unless intentionally changed by a later manual QA action.
- Existing 200 Lifetime / 200 Season Earned / 100 Season Spendable state after the completed Trial Perk remains intact at the start of this milestone.
- Historical claimed reward remains linked and visible.
- Cleanup does not delete completed historical accounting rows.

### Session Taxonomy
- Every canonical label maps to exactly one allowed internal category.
- Invalid label/category combinations fail server-side.
- Fitness package can fund Strength, Weight Training, Boxing, Conditioning, Cardio, and Group Fitness.
- Pilates Group packages can fund only Pilates Group.
- Pilates 1-on-1 package can fund only Pilates 1-on-1.
- Booking-created check-ins propagate the exact label to session logs.
- Manual check-in requires a label and deducts exactly one eligible session.
- Charged no-show still awards zero Bearforce workout points.
- Legacy null labels render safe generic fallbacks.

### UI / Regression
- Dashboard progression cards link correctly and remain responsive.
- `/member/bearforce`, `/member/rewards`, `/staff/packages`, staff schedule, member schedule, check-in, payments, and dashboard render at desktop/tablet/mobile sizes.
- PWA service worker continues not to cache private member/payment/reward/progression API data.
- Existing auth role routing remains unchanged.

### Live Verification Safety
Use transaction rollback tests or the permanent QA/demo account only. Do not mutate real production members for verification. Re-query M0001 and Bearforce totals after live rollback tests to prove data integrity.

---

## Rollout Order

1. Add database fields/RPCs for history, season summaries, package pricing/admin settings, demo marker, and session labels.
2. Verify migrations and live rollback tests before UI deployment.
3. Build `/member/bearforce` and polish `/member/rewards`.
4. Build `/staff/packages` and wire package price context into Payments.
5. Update scheduling/check-in/session history to use production labels while retaining internal categories.
6. Apply conservative QA/legacy presentation cleanup.
7. Run full regression suite and Supabase advisors.
8. Package a changed-files release plus full-project backup for GitHub/Vercel.

## Out of Scope for Steps 3–10

- Public member leaderboard.
- Automatic reward-request expiry worker.
- App push notifications.
- Editable Bearforce thresholds or point rules.
- Editable session taxonomy from Admin.
- Full24/Full48/Partial24 fabricated prices.
- Deleting historical financial/session/reward ledgers merely to make the database look clean.
