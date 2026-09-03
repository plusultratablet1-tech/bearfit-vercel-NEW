# Bearforce Progression Design

## Goal
Turn the four placeholder-style progression ideas from the original BearFit dashboard into a real, auditable system driven by actual check-ins and package payments: Bearforce Points, Workout Streak, Season/Prestige, and Fitness Tier.

## Core Principles
- Real activity only. Points are awarded from persisted BearFit events, never client-side counters.
- Idempotent. Repeating a check-in/payment RPC must never duplicate points.
- Lifetime achievement never decreases when rewards are redeemed.
- Seasonal spendability is separate from seasonal ranking so redeeming a reward does not lower prestige.
- Member-visible calculations use Asia/Manila for weekly goals and calendar-quarter seasons.

## Bearforce Point Rules
Earning events:
- Successful staff check-in/completed training session: +100 points.
- Package activation payment that becomes paid: +200 points.
- PARTIAL24 installment paid on time: +150 points. A 19-left stage is on time when paid at 19 or more sessions left; a 13-left stage is on time when paid at 13 or more sessions left. Paying after the threshold gives no bonus and never subtracts points.
- Early renewal: +250 bonus when a new activation is paid while a previous package cycle in the same service category is still active with at least 1 session remaining.
- Payment amount does not multiply points.
- Charged no-shows consume a session but do not earn workout points.

All earning events are stored in an immutable `bearforce_point_events` ledger with unique source/event keys.

## Lifetime and Seasonal Values
Three values are exposed:
- `lifetime_points`: sum of all earned Bearforce Points across all time. Never reset and never reduced by redemptions.
- `season_earned`: points earned in the current 3-month season. Used for Season/Prestige rank and not reduced by redemptions.
- `season_balance`: current-season earned points minus completed current-season redemptions. This is the spendable amount.

Seasons are calendar quarters in Asia/Manila:
- Q1: Jan 1–Mar 31
- Q2: Apr 1–Jun 30
- Q3: Jul 1–Sep 30
- Q4: Oct 1–Dec 31

Unused `season_balance` expires automatically at the quarter boundary because the new season only counts new-season earning and redemption rows. Lifetime points remain unchanged.

## Workout Streak
Weekly goal: 3+ real completed/check-in sessions during Monday–Sunday, Asia/Manila.
- 3+ sessions: successful streak week.
- 0–2 sessions: missed week.
- One isolated missed completed week is a grace week: streak count stays unchanged and grace is marked used.
- If the next completed week also misses the goal, streak resets.
- A successful week after a grace week continues and increments the streak.
- The in-progress current week does not break a streak before Sunday ends; if it reaches 3 sessions it counts immediately.
- Charged no-shows do not count toward the weekly goal.

Dashboard exposes `current_week_sessions`, `weekly_goal=3`, `weekly_goal_met`, `streak_weeks`, and `grace_week_active`.

## Fitness Tier (Lifetime)
Fitness Tier is based only on `lifetime_points`:
- Bear Cub: 0–999
- Grizzly: 1,000–4,999
- Kodiak: 5,000–9,999
- Titan Bear: 10,000–24,999
- Apex Bear: 25,000+

The summary also returns the next tier and points required to reach it.

## Season Prestige (Current Season)
Prestige is based on `season_earned`, not spendable balance:
- Rookie: 0–499
- Bronze: 500–1,499
- Silver: 1,500–2,999
- Gold: 3,000–4,999
- Prestige: 5,000+

Redeeming points does not lower this rank.

## Redemption Model
Actual reward catalog items are intentionally out of scope until BearFit defines rewards/prices. The data layer supports staff/admin recording a redemption with a label and point cost.
- `bearforce_redemptions` stores member, season key, reward label, points spent, status, staff actor, timestamps.
- `staff_redeem_bearforce_points` validates available season balance and inserts a completed redemption.
- `staff_reverse_bearforce_redemption` reverses mistakes without deleting history.
- Members can read only their own earning/redemption history; staff/admin can inspect all.

## Integration
- Check-in awards session points only after a new successful session log is created and only when `already_consumed=false`.
- No-show charging never calls the point-award path.
- Package payment confirmation awards activation/installment/renewal points after payment state is safely persisted.
- Existing legitimate session logs are backfilled at +100, excluding logs tied to charged no-show bookings.
- Historical payment bonuses are not guessed/backfilled because timeliness cannot be reconstructed reliably for every legacy payment.

## Dashboard
Replace the current four operational stat cards with the real progression cards from the original design concept:
1. Workout Streak — streak weeks plus current `x / 3 this week` progress.
2. Bearforce Points — lifetime total plus spendable current-season balance.
3. Prestige / Season — current prestige rank plus quarter label and season-earned points.
4. Fitness Tier — lifetime tier plus progress to next tier.

Operational package/session/payment numbers remain visible elsewhere in the existing membership card, package progress, and activity sections.

## Security and Error Handling
- All earning writes occur in `SECURITY DEFINER` private/public RPCs with existing staff/admin authorization for check-in/payment flows.
- Member summary RPC resolves the caller from `auth.uid()` and never accepts an arbitrary member ID.
- Redemptions are staff/admin-only and cannot make balance negative.
- RLS is enabled on both progression tables.

## Testing
- Static source regression tests cover schema, idempotent source keys, point values, streak goal/grace rules, tier/rank thresholds, dashboard wiring, and no-show exclusion.
- Live Supabase rollback tests verify session award idempotency, no-show exclusion, payment award rules, redemption balance behavior, season separation, and member summary output without changing production member balances.
