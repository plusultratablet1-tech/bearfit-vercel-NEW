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

test('member Rewards UI separates spendable, reserved and available points', () => {
  assert.equal(fs.existsSync(client), true)
  const src = fs.readFileSync(client, 'utf8')
  assert.match(src, /Season Balance/i)
  assert.match(src, /Reserved/i)
  assert.match(src, /Available to Redeem/i)
  assert.match(src, /season_key/)
})

test('member can request affordable rewards and cancel only pending requests', () => {
  const src = fs.readFileSync(client, 'utf8')
  assert.match(src, /member_request_reward/)
  assert.match(src, /member_cancel_reward_request/)
  assert.match(src, /Redeem/i)
  assert.match(src, /Cancel request/i)
  assert.match(src, /Out of stock/i)
  assert.match(src, /Not enough points/i)
  assert.match(src, /Active membership required/i)
  for (const status of ['Pending','Approved','Claimed','Rejected','Cancelled']) assert.match(src, new RegExp(status, 'i'))
})

test('dashboard desktop and mobile member navigation exposes Rewards', () => {
  const src = fs.readFileSync(dashboard, 'utf8')
  assert.match(src, /href:\s*["']\/member\/rewards["']/)
  assert.match(src, /MobileNavItem href=["']\/member\/rewards["']/)
  assert.match(src, /label=["']Rewards["']/)
})
