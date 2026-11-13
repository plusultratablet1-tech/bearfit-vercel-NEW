import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const dashboard = fs.readFileSync("components/bearfit/BearfitDashboardClient.tsx", "utf8")
const account = fs.readFileSync("lib/member-account-server.ts", "utf8")
const login = fs.readFileSync("lib/coach-login.ts", "utf8")
const payments = fs.readFileSync("app/member/payments/MemberPaymentsPageClient.tsx", "utf8")

test("friendly member address is derived for every account without changing the Supabase user ID", () => {
  assert.match(dashboard, /member\.member_code\.toLowerCase\(\)\}\\?@members\.bearfit\.ph|member\.member_code\.toLowerCase\(\)\}.*@members\.bearfit\.ph/)
  assert.match(login, /members\\?\.bearfit\\?\.ph/)
  assert.match(login, /memberAliasEmail\(friendlyMemberHandle\?\.\[1\] \?\? input\)/)
  assert.match(login, /members\.bearfit\.invalid/)
})

test("welcome header shows notice next to greeting and membership next to upcoming sessions", () => {
  assert.match(dashboard, /lg:grid-cols-\[minmax\(0,1\.45fr\)_minmax\(280px,1fr\)\]/)
  assert.match(dashboard, /headerNotice/)
  assert.match(dashboard, /Bring a Friend \/ Guest Pass/)
  assert.match(dashboard, /xl:grid-cols-\[minmax\(260px,0\.78fr\)_minmax\(0,1\.5fr\)\]/)
  assert.ok(dashboard.indexOf("Membership ID") < dashboard.indexOf("Upcoming Sessions"))
  assert.ok(dashboard.indexOf("Upcoming Sessions") < dashboard.indexOf("Your Progression"))
})

test("activity, sessions, payments are interactive, member-only, and show 3 / 10", () => {
  assert.match(dashboard, /role="tablist"/)
  assert.match(dashboard, /setActivityTab\(tab\.id\)/)
  assert.match(dashboard, /visibleActivityItems\.map/)
  assert.match(dashboard, /setActivityLimit\(activityLimit === 3 \? 10 : 3\)/)
  assert.match(dashboard, /"Show 10"/)
  assert.match(dashboard, /item\.status === "pending" \? "Payment pending"/)
  assert.match(dashboard, /href="\/member\/payments"/)
  assert.match(dashboard, /href="\/member\/schedule"/)
  assert.match(payments, /payments\.map\(\(payment\)/)
  assert.match(account, /\.eq\("member_id", member\.id\)/)
  assert.match(account, /\.in\("status", \["pending", "confirmed"\]\)/)
  assert.match(dashboard, /confirmedBookings\[0\]/)
})
