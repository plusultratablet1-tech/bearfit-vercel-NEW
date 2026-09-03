import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = new URL('../supabase/migrations/20260903130000_bearforce_rewards.sql', import.meta.url)

function sql() {
  assert.equal(fs.existsSync(migration), true, 'Expected Bearforce rewards migration to exist')
  return fs.readFileSync(migration, 'utf8')
}

test('rewards schema has catalog, requests, stock reservation and RLS boundaries', () => {
  const src = sql()
  assert.match(src, /create table if not exists public\.reward_catalog/i)
  assert.match(src, /create table if not exists public\.reward_requests/i)
  assert.match(src, /reserved_quantity/i)
  assert.match(src, /redeemed_quantity/i)
  assert.match(src, /stock_quantity/i)
  assert.match(src, /requires_active_membership/i)
  for (const status of ['pending', 'approved', 'rejected', 'cancelled', 'claimed']) assert.match(src, new RegExp(`'${status}'`, 'i'))
  assert.match(src, /enable row level security/i)
  assert.match(src, /revoke all on public\.reward_catalog from anon, authenticated/i)
  assert.match(src, /revoke all on public\.reward_requests from anon, authenticated/i)
})

test('member reward request reserves seasonal points and limited stock atomically', () => {
  const src = sql()
  assert.match(src, /member_request_reward/i)
  assert.match(src, /for update/i)
  assert.match(src, /private\.bearforce_summary_for_member/i)
  assert.match(src, /status\s*=\s*'pending'/i)
  assert.match(src, /sum\(points_cost\)/i)
  assert.match(src, /season_key/i)
  assert.match(src, /reserved_quantity\s*=\s*reserved_quantity\s*\+\s*1/i)
  assert.match(src, /stock_quantity is not null/i)
  assert.match(src, /Not enough seasonal Bearforce Points/i)
  assert.match(src, /Reward is out of stock/i)
  assert.match(src, /already have a pending request/i)
  assert.match(src, /active membership/i)
})

test('cancel and reject release reservations without spending points', () => {
  const src = sql()
  assert.match(src, /member_cancel_reward_request/i)
  assert.match(src, /staff_reject_reward_request/i)
  assert.match(src, /reserved_quantity\s*=\s*greatest\(reserved_quantity\s*-\s*1,\s*0\)/i)
  assert.match(src, /status\s*=\s*'cancelled'/i)
  assert.match(src, /status\s*=\s*'rejected'/i)
})

test('staff approval spends only current-season balance and consumes reserved stock', () => {
  const src = sql()
  assert.match(src, /staff_approve_reward_request/i)
  assert.match(src, /bearforce_redemptions/i)
  assert.match(src, /request season has ended|season has ended/i)
  assert.match(src, /reserved_quantity\s*=\s*greatest\(reserved_quantity\s*-\s*1,\s*0\)/i)
  assert.match(src, /redeemed_quantity\s*=\s*redeemed_quantity\s*\+\s*1/i)
  assert.match(src, /bearforce_redemption_id/i)
  assert.match(src, /status\s*=\s*'approved'/i)
})

test('staff reward workflow exposes catalog management, snapshots and claim transition', () => {
  const src = sql()
  for (const rpc of ['member_rewards_snapshot', 'staff_reward_snapshot', 'staff_create_reward', 'staff_update_reward', 'staff_mark_reward_claimed']) {
    assert.match(src, new RegExp(rpc, 'i'))
  }
  assert.match(src, /status\s*=\s*'claimed'/i)
  assert.match(src, /available_stock/i)
  assert.match(src, /reserved_points/i)
  assert.match(src, /available_points/i)
})
