# Member Portal Payments & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Rewards and Payments feel like first-class BearFit member app screens while reducing avoidable member-page loading latency.

**Architecture:** Reuse the existing `MemberAppShell` for Rewards and the new view-only Payments route. Add a focused payments server loader using existing `member_package_eligibility` RPC data, and parallelize independent dashboard/rewards Supabase requests. Keep existing member business rules unchanged.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, Supabase SSR/client, Tailwind CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-14-member-portal-payments-performance-design.md`

## Global Constraints

- Do not add online checkout, proof upload, or member-side payment mutation.
- Do not alter package deduction, booking, check-in, reward redemption, or staff/admin payment rules.
- Use `/member/payments` as the member Payments destination.
- Use the authoritative `member_package_eligibility` RPC for Partial 24 payment-stage state.
- Do not invent BearFit contact details.
- Preserve the client/server Supabase boundary: server-only helpers must not leak into client-imported modules.
- Work on `ux/member-rewards-payments-performance`, not `main`.

---

### Task 1: Add regression tests for member app navigation, Rewards shell, Payments route, and parallel loading

**Files:**
- Create: `tests/member-portal-payments-ux.test.mjs`

**Interfaces:**
- Consumes: source files under `components/bearfit`, `app/member`, and `lib`.
- Produces: static regression assertions that fail before the feature exists and protect the approved UX/performance structure.

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const shell = fs.readFileSync("components/bearfit/MemberAppShell.tsx", "utf8")
const rewards = fs.readFileSync("app/member/rewards/MemberRewardsPageClient.tsx", "utf8")
const accountLoader = fs.readFileSync("lib/member-account-server.ts", "utf8")

test("member shell routes Payments to the dedicated member page", () => {
  assert.match(shell, /href:\s*["']\/member\/payments["']/)
})

test("rewards uses the shared member app shell", () => {
  assert.match(rewards, /MemberAppShell/)
  assert.match(rewards, /activePath=["']\/member\/rewards["']/)
})

test("member payments route and focused loader exist", () => {
  assert.equal(fs.existsSync("app/member/payments/page.tsx"), true)
  assert.equal(fs.existsSync("app/member/payments/MemberPaymentsPageClient.tsx"), true)
  assert.equal(fs.existsSync("lib/member-payments-server.ts"), true)
})

test("dashboard package eligibility is requested concurrently", () => {
  assert.match(accountLoader, /member_package_eligibility/)
  assert.match(accountLoader, /Promise\.all/)
  assert.doesNotMatch(accountLoader, /for\s*\([^)]*serviceCategory[^)]*\)\s*\{[\s\S]*?await\s+supabase\.rpc\(["']member_package_eligibility["']/)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/member-portal-payments-ux.test.mjs`
Expected: failures because `/member/payments`, the focused loader, and Rewards shell integration do not yet exist and the shell still points Payments to the dashboard anchor.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/member-portal-payments-ux.test.mjs
git commit -m "test: cover member payments and rewards UX"
```

---

### Task 2: Move Rewards into the shared member shell and fix member Payments navigation

**Files:**
- Modify: `components/bearfit/MemberAppShell.tsx`
- Modify: `app/member/rewards/MemberRewardsPageClient.tsx`
- Modify: `app/member/rewards/page.tsx`

**Interfaces:**
- Consumes: `MemberAppShell({ activePath, children })`.
- Produces: Rewards rendered in the shared shell; Payments nav points to `/member/payments`.

- [ ] **Step 1: Change `MemberAppShell` Payments item**

Use:

```ts
{ label: "Payments", icon: CreditCard, href: "/member/payments", activePath: "/member/payments" }
```

- [ ] **Step 2: Wrap Rewards content**

Import:

```ts
import MemberAppShell from "@/components/bearfit/MemberAppShell"
```

Replace the standalone page wrapper and duplicate bottom navigation with:

```tsx
<MemberAppShell activePath="/member/rewards">
  <div className="mx-auto max-w-7xl px-4 py-5 pb-28 md:px-6 lg:px-8 lg:py-8 lg:pb-8">
    {/* existing rewards content */}
  </div>
</MemberAppShell>
```

Remove Rewards-only Dashboard/Schedule header navigation and its local `MobileLink` helper. Do not change redeem/cancel RPC behavior.

- [ ] **Step 3: Parallelize Rewards role and snapshot loading**

After `getUser()` succeeds, use:

```ts
const [profileResult, snapshotResult] = await Promise.all([
  supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  supabase.rpc("member_rewards_snapshot"),
])
```

Redirect staff/admin based on `profileResult.data?.role`, then pass `snapshotResult` to the client.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/member-portal-payments-ux.test.mjs`
Expected: Rewards and shell assertions pass; Payments route assertions still fail.

- [ ] **Step 5: Commit**

```bash
git add components/bearfit/MemberAppShell.tsx app/member/rewards
git commit -m "feat: keep member rewards inside app shell"
```

---

### Task 3: Build the focused view-only member Payments data loader

**Files:**
- Create: `lib/member-payments-server.ts`
- Modify: `lib/member-account.ts`

**Interfaces:**
- Produces: `MemberPackageEligibilityView`, `MemberPaymentsData`, and `loadMemberPaymentsData(userId: string): Promise<MemberPaymentsData>`.
- Consumes: existing Supabase `members`, `profiles`, `payments`, and `member_package_eligibility`.

- [ ] **Step 1: Add client-safe types to `lib/member-account.ts`**

```ts
export type MemberPackageEligibilityView = {
  member_package_id?: string | null
  package_code?: string | null
  package_name?: string | null
  service_category: string
  sessions_left: number
  sessions_total: number
  sessions_used?: number
  blocking_reason?: string | null
  warning_level?: string | null
  warning_message?: string | null
  payment_stage_due?: string | null
  payment_stage_label?: string | null
  expires_at?: string | null
}

export type MemberPaymentsData = {
  member: MemberRow | null
  profile: ProfileRow | null
  payments: PaymentRow[]
  packages: MemberPackageEligibilityView[]
  loadError: string | null
}
```

- [ ] **Step 2: Create the server-only loader**

Implementation shape:

```ts
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/database.types"
import type { MemberPackageEligibilityView, MemberPaymentsData, MemberRow, PaymentRow, ProfileRow } from "@/lib/member-account"

const SERVICE_CATEGORIES = ["fitness", "pilates_group", "pilates_1on1"] as const

function asEligibility(value: Json | null): MemberPackageEligibilityView | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null
  return value as unknown as MemberPackageEligibilityView
}

export async function loadMemberPaymentsData(userId: string): Promise<MemberPaymentsData> {
  const supabase = await createClient()
  const [profileResult, memberResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("members").select("*").eq("user_id", userId).maybeSingle(),
  ])

  const profile = (profileResult.data ?? null) as ProfileRow | null
  const member = (memberResult.data ?? null) as MemberRow | null
  if (!member || profileResult.error || memberResult.error) {
    return { member, profile, payments: [], packages: [], loadError: profileResult.error || memberResult.error ? "We couldn't load your payment details right now." : null }
  }

  const [paymentsResult, ...eligibilityResults] = await Promise.all([
    supabase.from("payments").select("*").eq("member_id", member.id).order("created_at", { ascending: false }).limit(20),
    ...SERVICE_CATEGORIES.map((serviceCategory) => supabase.rpc("member_package_eligibility", { p_service_category: serviceCategory })),
  ])

  const packages = eligibilityResults
    .map((result) => asEligibility(result.data as Json | null))
    .filter((item): item is MemberPackageEligibilityView => Boolean(item?.member_package_id))

  return {
    member,
    profile,
    payments: (paymentsResult.data ?? []) as PaymentRow[],
    packages,
    loadError: paymentsResult.error || eligibilityResults.some((result) => result.error) ? "Some package or payment details couldn't be loaded." : null,
  }
}
```

- [ ] **Step 3: Run the focused test**

Run: `node --test tests/member-portal-payments-ux.test.mjs`
Expected: focused loader existence assertion passes; page/client assertions still fail.

- [ ] **Step 4: Commit**

```bash
git add lib/member-account.ts lib/member-payments-server.ts
git commit -m "feat: load member payment data"
```

---

### Task 4: Create the view-only Member Payments page

**Files:**
- Create: `app/member/payments/page.tsx`
- Create: `app/member/payments/MemberPaymentsPageClient.tsx`

**Interfaces:**
- Consumes: `loadMemberPaymentsData()` and `MemberAppShell`.
- Produces: authenticated member view-only Payments UX at `/member/payments`.

- [ ] **Step 1: Create the server route**

```tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { loadMemberPaymentsData } from "@/lib/member-payments-server"
import MemberPaymentsPageClient from "./MemberPaymentsPageClient"

export default async function MemberPaymentsPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect("/login")

  const data = await loadMemberPaymentsData(user.id)
  if (data.profile?.role === "staff" || data.profile?.role === "admin") redirect("/payments")
  if (!data.member) redirect("/welcome")

  return <MemberPaymentsPageClient data={data} />
}
```

- [ ] **Step 2: Build display helpers in the client component**

Implement:

```ts
function nextPartial24Milestone(pkg: MemberPackageEligibilityView) {
  if (pkg.package_code !== "PARTIAL24" || pkg.payment_stage_due) return null
  if (pkg.sessions_left > 19) return "Next installment at 19 sessions left"
  if (pkg.sessions_left > 13) return "Next installment at 13 sessions left"
  return "Installments up to date"
}
```

Match a known pending amount with:

```ts
const pendingPayment = payments.find((payment) =>
  payment.status === "pending" &&
  payment.member_package_id === pkg.member_package_id &&
  payment.stage === pkg.payment_stage_due
)
```

- [ ] **Step 3: Render the approved Payments UX**

Use `MemberAppShell activePath="/member/payments"` and include:
- page heading `Payments & Package`
- overall status card
- real package cards
- Partial 24 due stage / next milestone
- amount due only when known from a matching pending payment
- `Contact BearFit staff/admin to settle this payment.` when due
- recent payment history
- empty states for no package/no payments

No mutation buttons or Supabase client should be added to this page.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/member-portal-payments-ux.test.mjs`
Expected: all navigation/Rewards/Payments existence assertions pass; dashboard performance assertion remains to be completed.

- [ ] **Step 5: Commit**

```bash
git add app/member/payments
git commit -m "feat: add member payments center"
```

---

### Task 5: Reduce avoidable dashboard round trips

**Files:**
- Modify: `lib/member-account-server.ts`

**Interfaces:**
- Preserves: `loadMemberAccountData(userId)` return shape.
- Changes only request scheduling: independent RPCs/queries run concurrently.

- [ ] **Step 1: Replace post-member sequential eligibility and coach rounds with one concurrent batch**

After member/profile resolution, run these together:
- session logs
- payments
- confirmed upcoming bookings
- Bearforce summary
- coach directory
- fitness eligibility
- Pilates Group eligibility
- Pilates 1-on-1 eligibility

Use one `Promise.all([...])` and map the three eligibility results back to their service categories.

- [ ] **Step 2: Preserve package alert derivation**

For each parsed eligibility result, preserve the existing rules:

```ts
const hasPackage = Boolean(item.member_package_id)
if (item.warning_message || (hasPackage && item.blocking_reason)) {
  packageAlerts.push({
    serviceCategory,
    warningLevel: item.warning_level as string | null,
    message: item.warning_message as string | null,
    blockingReason: item.blocking_reason as string | null,
  })
}
```

Filter the already-fetched coach directory to the coach IDs referenced by upcoming bookings; do not make another coach RPC.

- [ ] **Step 3: Run the focused test**

Run: `node --test tests/member-portal-payments-ux.test.mjs`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/member-account-server.ts
git commit -m "perf: parallelize member dashboard loading"
```

---

### Task 6: Add immediate route loading feedback

**Files:**
- Create: `components/bearfit/MemberRouteLoading.tsx`
- Create: `app/member/dashboard/loading.tsx`
- Create: `app/member/schedule/loading.tsx`
- Create: `app/member/rewards/loading.tsx`
- Create: `app/member/payments/loading.tsx`

**Interfaces:**
- Produces: a shared visual skeleton for server-rendered member routes.

- [ ] **Step 1: Create a generic member loading skeleton**

Render a dark BearFit-styled page with pulse placeholders for heading, summary cards, and content. Include `aria-label="Loading member page"` and avoid any Supabase access.

- [ ] **Step 2: Re-export the shared skeleton from each route loading file**

Each file should be:

```tsx
import MemberRouteLoading from "@/components/bearfit/MemberRouteLoading"

export default MemberRouteLoading
```

- [ ] **Step 3: Extend the regression test**

Assert all four loading files exist.

- [ ] **Step 4: Run tests**

Run: `node --test tests/member-portal-payments-ux.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/bearfit/MemberRouteLoading.tsx app/member/*/loading.tsx tests/member-portal-payments-ux.test.mjs
git commit -m "ux: add member route loading feedback"
```

---

### Task 7: Verify preview, review diff, merge, and verify production

**Files:**
- No new production files unless verification finds an issue.

**Interfaces:**
- Produces: reviewed PR and green production deployment.

- [ ] **Step 1: Run repository checks where available**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

If the local environment cannot access the repository, explicitly report that limitation and do not claim these commands passed.

- [ ] **Step 2: Confirm Vercel preview status for feature head**

Expected: `Vercel = success`.

- [ ] **Step 3: Review changed files and PR diff**

Confirm no staff/admin payment mutation logic or database migration changed.

- [ ] **Step 4: Open PR to `main` and squash merge after green preview**

- [ ] **Step 5: Confirm production Vercel status for the merge commit**

Expected: `Vercel = success`.

- [ ] **Step 6: Report verification limits accurately**

If protected browser UI/runtime telemetry cannot be accessed, state that clearly and rely only on verified build/status evidence.