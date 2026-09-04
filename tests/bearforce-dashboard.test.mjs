import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const account = fs.readFileSync(new URL('../lib/member-account.ts', import.meta.url), 'utf8')
const page = fs.readFileSync(new URL('../app/member/dashboard/page.tsx', import.meta.url), 'utf8')
const client = fs.readFileSync(new URL('../app/member/dashboard/MemberDashboardPageClient.tsx', import.meta.url), 'utf8')
const dashboard = fs.readFileSync(new URL('../components/bearfit/BearfitDashboardClient.tsx', import.meta.url), 'utf8')
const types = fs.readFileSync(new URL('../lib/database.types.ts', import.meta.url), 'utf8')

test('member account loader fetches the real Bearforce summary RPC', () => {
  assert.match(types, /member_bearforce_summary/)
  assert.match(account, /BearforceSummary/)
  assert.match(account, /member_bearforce_summary/)
  assert.match(account, /bearforceSummary/)
  assert.match(page, /bearforceSummary=/)
  assert.match(client, /bearforceSummary/)
})

test('dashboard renders all four real progression concepts from summary values', () => {
  assert.match(dashboard, /Workout Streak/)
  assert.match(dashboard, /Bearforce Points/)
  assert.match(dashboard, /Prestige \/ Season/)
  assert.match(dashboard, /Fitness Tier/)
  assert.match(dashboard, /current_week_sessions/)
  assert.match(dashboard, /weekly_goal/)
  assert.match(dashboard, /season_balance/)
  assert.match(dashboard, /season_earned/)
  assert.match(dashboard, /lifetime_points/)
  assert.match(dashboard, /fitness_tier/)
  assert.match(dashboard, /prestige/)
})

test('dashboard explains spendable season balance separately from lifetime achievement', () => {
  assert.match(dashboard, /Available to spend/i)
  assert.match(dashboard, /Lifetime/i)
  assert.match(dashboard, /this week/i)
})

test("dashboard progression cards link to the Bearforce detail page", () => {
  const dashboard = fs.readFileSync("components/bearfit/BearfitDashboardClient.tsx", "utf8")
  assert.match(dashboard, /href="\/member\/bearforce"/)
})
