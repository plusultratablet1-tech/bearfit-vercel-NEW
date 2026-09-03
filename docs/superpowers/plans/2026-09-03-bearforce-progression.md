# Bearforce Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build real Bearforce Points, 3+ sessions/week streaks with one grace week, 3-month seasons with spendable seasonal points, season prestige, and lifetime fitness tiers, then surface them on the member dashboard.

**Architecture:** Use an append-only earning ledger plus a separate redemption ledger. Award points server-side inside existing check-in/payment RPC paths, compute lifetime/season/streak/tier summaries in PostgreSQL, and load one member-safe summary RPC into the existing dashboard loader.

**Tech Stack:** PostgreSQL/Supabase RLS + PL/pgSQL, Next.js 16, React/TypeScript, Supabase JS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-03-bearforce-progression-design.md`

## Global Constraints
- Seasons are calendar quarters in Asia/Manila.
- Weekly streak goal is 3+ real check-ins Monday–Sunday with one isolated grace week.
- Lifetime points never reset or decrease from redemptions.
- Season earned drives prestige; season balance is spendable and expires by quarter scope.
- No-show charges never earn workout points.
- Payment amount never changes awarded point values.

---

### Task 1: Progression schema and calculations

**Files:**
- Create: `supabase/migrations/20260903120000_bearforce_progression.sql`
- Create: `tests/bearforce-progression.test.mjs`

**Interfaces:**
- Produces: `private.award_bearforce_points(...)`, `private.bearforce_summary_for_member(uuid,timestamptz)`, `public.member_bearforce_summary()`, `public.staff_redeem_bearforce_points(uuid,integer,text)`, `public.staff_reverse_bearforce_redemption(uuid)`.

- [ ] Write failing migration tests for ledger tables, source-key idempotency, exact point constants, quarter season key, 3-session goal/grace, tier/prestige thresholds, member summary, and redemption authorization.
- [ ] Run `node --test tests/bearforce-progression.test.mjs` and verify failure because migration does not exist.
- [ ] Implement the migration with RLS, indexes, helper functions, summary RPC, redemption RPCs, and session-log backfill excluding charged no-shows.
- [ ] Run `node --test tests/bearforce-progression.test.mjs` and verify pass.

### Task 2: Check-in and payment awarding integration

**Files:**
- Create: `supabase/migrations/20260903121000_bearforce_event_integration.sql`
- Modify: `tests/bearforce-progression.test.mjs`

**Interfaces:**
- Consumes: `private.award_bearforce_points` from Task 1.
- Produces: updated `public.staff_qr_checkin`, `public.staff_mark_package_payment_paid` behavior with idempotent earning.

- [ ] Add failing tests that check-in awards +100 only for a newly consumed session, no-show path has no award call, activation awards +200, on-time PARTIAL24 installment awards +150, and early renewal awards +250.
- [ ] Run focused test and verify failure.
- [ ] Replace the two RPC definitions in a new migration, preserving all existing package/check-in behavior while adding point awards.
- [ ] Run focused test and verify pass.

### Task 3: Typed dashboard loader

**Files:**
- Modify: `lib/database.types.ts`
- Modify: `lib/member-account.ts`
- Modify: `app/member/dashboard/page.tsx`
- Modify: `app/member/dashboard/MemberDashboardPageClient.tsx`
- Create: `tests/bearforce-dashboard.test.mjs`

**Interfaces:**
- Produces: `BearforceSummary` type and `bearforceSummary` dashboard prop.

- [ ] Write failing tests requiring `member_bearforce_summary`, real summary types/props, and dashboard pass-through.
- [ ] Run focused test and verify failure.
- [ ] Add database type entries, load the summary RPC server-side, and pass it through the dashboard page/client.
- [ ] Run focused test and verify pass.

### Task 4: Real progression cards

**Files:**
- Modify: `components/bearfit/BearfitDashboardClient.tsx`
- Modify: `tests/member-dashboard-real-data.test.mjs`
- Modify: `tests/bearforce-dashboard.test.mjs`

**Interfaces:**
- Consumes: `bearforceSummary`.
- Produces: four real cards for Workout Streak, Bearforce Points, Prestige/Season, Fitness Tier.

- [ ] Write failing assertions for the four progression cards, weekly x/3 copy, season balance, season earned/prestige, tier next-progress, and remove the old test that forbids real progression labels.
- [ ] Run focused dashboard tests and verify failure.
- [ ] Implement responsive cards using real summary values and retain operational package stats in the existing membership/progress areas.
- [ ] Run focused tests and verify pass.

### Task 5: Live rollback verification and release package

**Files:**
- Modify: `docs/BEARFIT_FOUNDATION_STATUS.md`
- Generated package: `/mnt/data/bearfit-bearforce-progression.zip`
- Generated fallback: `/mnt/data/bearfit-bearforce-progression-full.zip`

**Interfaces:**
- Validates all previous tasks against live Supabase while keeping production data unchanged.

- [ ] Run the full local regression suite with `node --test tests/*.test.mjs`.
- [ ] Apply the two migrations to Supabase.
- [ ] Run rollback SQL verifying check-in +100 once, no-show +0, payment bonuses, season balance/redemption, quarter isolation, and streak summary.
- [ ] Confirm `M0001` production session/package data remains unchanged by rollback verification.
- [ ] Update foundation status documentation and package changed/full source ZIPs for GitHub/Vercel.
