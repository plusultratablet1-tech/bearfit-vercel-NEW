import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const shell = fs.readFileSync("components/bearfit/MemberAppShell.tsx", "utf8")
const dashboardClient = fs.readFileSync("components/bearfit/BearfitDashboardClient.tsx", "utf8")
const rewardsClient = fs.readFileSync("app/member/rewards/MemberRewardsPageClient.tsx", "utf8")
const rewardsPage = fs.readFileSync("app/member/rewards/page.tsx", "utf8")
const accountLoader = fs.readFileSync("lib/member-account-server.ts", "utf8")

test("member shell routes Payments to the dedicated member page", () => {
  assert.match(shell, /href:\s*["']\/member\/payments["']/)
  assert.doesNotMatch(shell, /\/member\/dashboard#payments/)
})

test("dashboard routes Payments to the dedicated member page", () => {
  assert.match(dashboardClient, /label:\s*["']Payments["'][\s\S]*?href:\s*["']\/member\/payments["']/)
  assert.match(dashboardClient, /MobileNavItem href=["']\/member\/payments["'] label=["']Payments["']/)
  assert.doesNotMatch(dashboardClient, /href=["']#payments["']/)
})

test("rewards uses the shared member app shell without its own mobile navigation", () => {
  assert.match(rewardsClient, /MemberAppShell/)
  assert.match(rewardsClient, /activePath=["']\/member\/rewards["']/)
  assert.doesNotMatch(rewardsClient, /function\s+MobileLink/)
})

test("rewards profile and snapshot requests are parallel after auth", () => {
  assert.match(rewardsPage, /Promise\.all\s*\(\s*\[/)
  assert.match(rewardsPage, /member_rewards_snapshot/)
})

test("member payments route and focused loader exist", () => {
  assert.equal(fs.existsSync("app/member/payments/page.tsx"), true)
  assert.equal(fs.existsSync("app/member/payments/MemberPaymentsPageClient.tsx"), true)
  assert.equal(fs.existsSync("lib/member-payments-server.ts"), true)
})

test("member payments is view-only and uses authoritative package stage state", () => {
  const page = fs.readFileSync("app/member/payments/MemberPaymentsPageClient.tsx", "utf8")
  const loader = fs.readFileSync("lib/member-payments-server.ts", "utf8")
  assert.match(page, /Payments & Package/)
  assert.match(page, /payment_stage_due/)
  assert.match(page, /Contact BearFit staff\/admin to settle this payment/)
  assert.doesNotMatch(page, /supabase\.rpc\(/)
  assert.match(loader, /member_package_eligibility/)
  assert.match(loader, /Promise\.all/)
})

test("dashboard package eligibility is requested concurrently", () => {
  assert.match(accountLoader, /member_package_eligibility/)
  assert.match(accountLoader, /Promise\.all/)
  assert.doesNotMatch(
    accountLoader,
    /for\s*\([^)]*serviceCategory[^)]*\)\s*\{[\s\S]*?await\s+supabase\.rpc\(["']member_package_eligibility["']/,
  )
})

test("member routes provide immediate loading feedback", () => {
  for (const path of [
    "app/member/dashboard/loading.tsx",
    "app/member/schedule/loading.tsx",
    "app/member/rewards/loading.tsx",
    "app/member/payments/loading.tsx",
  ]) {
    assert.equal(fs.existsSync(path), true, `${path} should exist`)
  }
})
