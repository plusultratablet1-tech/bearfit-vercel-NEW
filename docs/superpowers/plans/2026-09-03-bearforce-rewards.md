# Bearforce Rewards Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Bearforce Rewards Catalog, seasonal point reservations, staff-controlled approval/claim flow, and responsive member/staff Rewards pages.

**Architecture:** PostgreSQL remains the authority for reward stock, point reservations, seasonal spending, and request transitions. Members and staff use role-checked SECURITY DEFINER RPCs; Next.js pages render catalog/history and invoke those RPCs with the existing Supabase browser/server clients.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Supabase Postgres/Auth/RLS/RPC, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-03-bearforce-rewards-design.md`

## Global Constraints
- Current Bearforce lifetime and season-earned totals must never decrease on reward redemption.
- Pending reward requests reserve points and limited stock but do not spend Bearforce points.
- Bearforce points are spent only when staff/admin approves a pending request.
- Pending requests from an ended season cannot be approved.
- No fake rewards are seeded.
- Existing Payments, Scheduling, Check-in, Bearforce progression, PWA, and role-routing behavior must remain intact.
- All date/season calculations use Asia/Manila through the existing Bearforce season helpers.

---

### Task 1: Rewards schema and reservation engine

**Files:**
- Create: `supabase/migrations/20260903130000_bearforce_rewards.sql`
- Create: `tests/bearforce-rewards.test.mjs`

**Interfaces:**
- Consumes: `private.bearforce_season_key`, `private.bearforce_summary_for_member`, `public.bearforce_redemptions`, `private.is_staff_or_admin`.
- Produces: `reward_catalog`, `reward_requests`, `member_rewards_snapshot()`, `member_request_reward(uuid)`, `member_cancel_reward_request(uuid)`, `staff_reward_snapshot()`, `staff_create_reward(...)`, `staff_update_reward(...)`, `staff_approve_reward_request(uuid,text)`, `staff_reject_reward_request(uuid,text)`, `staff_mark_reward_claimed(uuid)`.

- [ ] **Step 1: Write failing schema/RPC tests**

Add assertions that the migration contains both tables, RLS, direct-write revokes, reservation fields, allowed statuses, and the member/staff RPC names. Add assertions that request logic checks current season balance minus pending reservations and locks the reward row.

- [ ] **Step 2: Run the rewards test and verify RED**

Run: `node --test tests/bearforce-rewards.test.mjs`
Expected: FAIL because the migration and RPC names do not exist.

- [ ] **Step 3: Implement the rewards migration**

Create the two tables, indexes, RLS policies, safe read grants, and role-checked RPCs. Implement atomic limited-stock reservation, seasonal point reservation, cancellation/rejection release, approval through `bearforce_redemptions`, and claimed transition.

- [ ] **Step 4: Run the rewards test and verify GREEN**

Run: `node --test tests/bearforce-rewards.test.mjs`
Expected: PASS.

### Task 2: Member Rewards page

**Files:**
- Create: `app/member/rewards/page.tsx`
- Create: `app/member/rewards/MemberRewardsPageClient.tsx`
- Modify: `components/bearfit/BearfitDashboardClient.tsx`
- Test: `tests/member-rewards-ui.test.mjs`

**Interfaces:**
- Consumes: `member_rewards_snapshot()`, `member_request_reward(uuid)`, `member_cancel_reward_request(uuid)`.
- Produces: responsive `/member/rewards` experience and member Rewards navigation.

- [ ] **Step 1: Write failing member UI tests**

Assert protected member route, snapshot RPC use, seasonal balance/reserved/available labels, reward cards with Redeem action, pending cancellation, history statuses, and Rewards links in desktop/mobile member navigation.

- [ ] **Step 2: Run the member rewards test and verify RED**

Run: `node --test tests/member-rewards-ui.test.mjs`
Expected: FAIL because the page and nav links do not exist.

- [ ] **Step 3: Implement the protected server page and responsive client**

Load the member snapshot server-side, render balance and catalog, invoke request/cancel RPCs client-side, reload after mutations, and disable redemption when unaffordable/out-of-stock/ineligible.

- [ ] **Step 4: Run the member rewards test and verify GREEN**

Run: `node --test tests/member-rewards-ui.test.mjs`
Expected: PASS.

### Task 3: Staff Rewards workspace

**Files:**
- Create: `app/staff/rewards/page.tsx`
- Create: `app/staff/rewards/StaffRewardsPageClient.tsx`
- Modify: `app/staff/schedule/StaffSchedulePageClient.tsx`
- Test: `tests/staff-rewards-ui.test.mjs`

**Interfaces:**
- Consumes: `staff_reward_snapshot()`, `staff_create_reward`, `staff_update_reward`, `staff_approve_reward_request`, `staff_reject_reward_request`, `staff_mark_reward_claimed`.
- Produces: staff/admin catalog management and request workflow.

- [ ] **Step 1: Write failing staff UI tests**

Assert role protection, create form fields, catalog active/stock controls, pending Approve/Reject actions, approved Mark Claimed action, request history, and staff Schedule header Rewards link.

- [ ] **Step 2: Run the staff rewards test and verify RED**

Run: `node --test tests/staff-rewards-ui.test.mjs`
Expected: FAIL because the staff rewards page does not exist.

- [ ] **Step 3: Implement the staff workspace**

Build role-protected server page and client controls using the staff RPCs. Reload snapshot after successful mutations and show returned database errors directly.

- [ ] **Step 4: Run the staff rewards test and verify GREEN**

Run: `node --test tests/staff-rewards-ui.test.mjs`
Expected: PASS.

### Task 4: Database types and release verification

**Files:**
- Modify: `lib/database.types.ts`
- Modify: `BEARFIT_FOUNDATION_STATUS.md` if present
- Test: `tests/bearforce-rewards.test.mjs`, `tests/member-rewards-ui.test.mjs`, `tests/staff-rewards-ui.test.mjs`, full `tests/*.test.mjs`

**Interfaces:**
- Consumes: all Tasks 1–3 interfaces.
- Produces: repository source that matches live Supabase and documents the rewards milestone.

- [ ] **Step 1: Update generated-style database types for reward tables/RPCs**

Add `reward_catalog`, `reward_requests`, and all new RPC signatures while preserving existing generated-style structures.

- [ ] **Step 2: Run focused tests**

Run: `node --test tests/bearforce-rewards.test.mjs tests/member-rewards-ui.test.mjs tests/staff-rewards-ui.test.mjs`
Expected: all PASS.

- [ ] **Step 3: Run full regression**

Run: `npm test`
Expected: 0 failures.

- [ ] **Step 4: Apply live migrations and run rollback verification**

Apply the rewards migration to project `zeqlsrebmdmkmaqllejx`. In rollback transactions verify limited/unlimited stock, point reservation, insufficient balance blocking, approval spend, reject/cancel release, claim transition, double-request prevention, active-membership rule, and prior-season approval blocking.

- [ ] **Step 5: Run Supabase security/performance advisors**

Confirm no missing RLS and fix any new unindexed foreign-key notices introduced by rewards. Keep known controlled-RPC/GraphQL warnings documented rather than disabling working app permissions blindly.

- [ ] **Step 6: Package changed-files and full-project ZIPs**

Create one small upload package and one full fallback archive for GitHub/Vercel deployment.
