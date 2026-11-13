import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
const dashboard = fs.readFileSync("components/bearfit/BearfitDashboardClient.tsx", "utf8")
const account = fs.readFileSync("lib/member-account-server.ts", "utf8")
const login = fs.readFileSync("lib/coach-login.ts", "utf8")
const payments = fs.readFileSync("app/member/payments/MemberPaymentsPageClient.tsx", "utf8")

test("member-facing address is derived without rewriting authentication IDs", () => {
  assert.ok(dashboard.includes("member.member_code.toLowerCase()"))
  assert.ok(dashboard.includes("@members.bearfit.ph"))
  assert.ok(login.includes("friendlyMemberHandle"))
  assert.ok(login.includes("memberAliasEmail(friendlyMemberHandle?.[1] ?? input)"))
  assert.ok(login.includes("members.bearfit.invalid"))
})
test("notice accompanies Welcome; membership is beside confirmed sessions", () => {
  assert.ok(dashboard.includes('lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,1fr)]'))
  assert.ok(dashboard.includes("headerNotice"))
  assert.ok(dashboard.includes("Bring a Friend / Guest Pass"))
  assert.ok(dashboard.includes("xl:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.5fr)]"))
  assert.ok(dashboard.indexOf("Membership ID") < dashboard.indexOf("Upcoming Sessions"))
  assert.ok(dashboard.indexOf("Upcoming Sessions") < dashboard.indexOf("Your Progression"))
})
test("activity filters and controls display genuine scoped session/payment records", () => {
  for (const x of ['role="tablist"',"setActivityTab(tab.id)","visibleActivityItems.map",
    "activityLimit === 3 ? 10 : 3",'"Show 10"','"Payment pending"',
    'href="/member/payments"','href="/member/schedule"']) assert.ok(dashboard.includes(x),x)
  assert.ok(payments.includes("payments.map((payment)"))
  assert.ok(account.includes('.eq("member_id", member.id)'))
  assert.ok(account.includes('.in("status", ["pending", "confirmed"])'))
  assert.ok(dashboard.includes("confirmedBookings[0]"))
})
