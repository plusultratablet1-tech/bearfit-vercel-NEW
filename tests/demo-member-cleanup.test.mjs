import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const migration = "supabase/migrations/20260904102000_demo_member_cleanup.sql"

test("M0001 becomes permanent demo member without deleting history", () => {
  assert.equal(fs.existsSync(migration), true)
  const sql = fs.readFileSync(migration, "utf8")
  assert.match(sql, /is_demo boolean not null default false/i)
  assert.match(sql, /member_code\s*=\s*'M0001'/i)
  assert.match(sql, /QA Demo Package/i)
  for (const table of ["payments","bookings","session_logs","bearforce_point_events","bearforce_redemptions","reward_requests","member_package_cycles"]) {
    assert.doesNotMatch(sql, new RegExp(`delete\\s+from\\s+public\\.${table}`, "i"))
  }
  assert.doesNotMatch(sql, /LEGACY_FITNESS[^;]*active\s*=\s*true/i)
})

test("demo package presentation is explicit and staff rewards can badge demo members", () => {
  const account = fs.readFileSync("lib/member-account.ts", "utf8")
  const dashboard = fs.readFileSync("components/bearfit/BearfitDashboardClient.tsx", "utf8")
  const staffRewards = fs.readFileSync("app/staff/rewards/StaffRewardsPageClient.tsx", "utf8")
  assert.match(account, /displayPackageNameForMember/)
  assert.match(account, /QA Demo Package/)
  assert.match(dashboard, /displayPackageNameForMember/)
  assert.match(staffRewards, /member_is_demo/)
  assert.match(staffRewards, /QA \/ Demo/)
})
