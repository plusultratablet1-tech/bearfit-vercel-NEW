import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = new URL('../app/member/rewards/page.tsx', import.meta.url)
const client = new URL('../app/member/rewards/MemberRewardsPageClient.tsx', import.meta.url)
const dashboard = new URL('../components/bearfit/BearfitDashboardClient.tsx', import.meta.url)

test('member Rewards route is protected and loads the server snapshot', () => {
  assert.equal(fs.existsSync(page), true)
  const src = fs.readFileSync(page, 'utf8')
  assert.match(src, /auth\.getUser/)
  assert.match(src, /member_rewards_snapshot/)
  assert.match(src, /redirect\(["']\/login["']\)|redirect\(["']\/welcome["']/)
})

test('member Rewards UI separates earned spent reserved and available points', () => {
  assert.equal(fs.existsSync(client), true)
  const src = fs.readFileSync(client, 'utf8')
  assert.match(src, /Season Earned/i)
  assert.match(src, /Season Spent/i)
  assert.match(src, /Reserved/i)
  assert.match(src, /Available to Spend/i)
  assert.match(src, /season_key/)
})

test('member can request affordable rewards and cancel only pending requests', () => {
  const src = fs.readFileSync(client, 'utf8')
  assert.match(src, /member_request_reward/)
  assert.match(src, /member_cancel_reward_request/)
  assert.match(src, /Redeem/i)
  assert.match(src, /Cancel request/i)
  assert.match(src, /Out of stock/i)
  assert.match(src, /more points needed/i)
  assert.match(src, /Active membership required/i)
  for (const status of ['Pending','Approved','Claimed','Rejected','Cancelled']) assert.match(src, new RegExp(status, 'i'))
})

test('dashboard desktop and mobile member navigation exposes Rewards', () => {
  const src = fs.readFileSync(dashboard, 'utf8')
  assert.match(src, /href:\s*["']\/member\/rewards["']/)
  assert.match(src, /MobileNavItem href=["']\/member\/rewards["']/)
  assert.match(src, /label=["']Rewards["']/)
})

test("member Rewards production view shows earned spent reserved available and exact deficits", () => {
  const source = fs.readFileSync("app/member/rewards/MemberRewardsPageClient.tsx", "utf8")
  assert.match(source, /Season Earned/)
  assert.match(source, /Season Spent/)
  assert.match(source, /Reserved/)
  assert.match(source, /Available to Spend/)
  assert.match(source, /more points needed/)
  assert.match(source, /Unlimited/)
  assert.match(source, /Season ends/)
  assert.match(source, /pendingRewardIds/)
})
