import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const schemaUrl = new URL('../supabase/migrations/20260903120000_bearforce_progression.sql', import.meta.url)
const integrationUrl = new URL('../supabase/migrations/20260903121000_bearforce_event_integration.sql', import.meta.url)
const indexUrl = new URL('../supabase/migrations/20260903122000_bearforce_fk_indexes.sql', import.meta.url)

function read(url) {
  assert.equal(fs.existsSync(url), true, `Expected ${url.pathname} to exist`)
  return fs.readFileSync(url, 'utf8')
}

test('Bearforce progression schema provides append-only earnings and seasonal redemptions', () => {
  const sql = read(schemaUrl)
  assert.match(sql, /create table if not exists public\.bearforce_point_events/i)
  assert.match(sql, /create table if not exists public\.bearforce_redemptions/i)
  assert.match(sql, /unique[\s\S]{0,220}member_id[\s\S]{0,220}event_type[\s\S]{0,220}source_type[\s\S]{0,220}source_id/i)
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /member_bearforce_summary/i)
  assert.match(sql, /staff_redeem_bearforce_points/i)
  assert.match(sql, /staff_reverse_bearforce_redemption/i)
  const indexSql = read(indexUrl)
  assert.match(indexSql, /bearforce_redemptions_created_by_idx/i)
  assert.match(indexSql, /bearforce_redemptions_reversed_by_idx/i)
})

test('Bearforce seasons are calendar quarters and weekly goal is three sessions in Asia Manila', () => {
  const sql = read(schemaUrl)
  assert.match(sql, /Asia\/Manila/)
  assert.match(sql, /extract\(quarter from/i)
  assert.match(sql, /weekly_goal['"\s,:=]+3/i)
  assert.match(sql, /grace_week_active/i)
  assert.match(sql, /date_trunc\('week'/i)
})

test('Bearforce lifetime tiers and seasonal prestige thresholds are explicit', () => {
  const sql = read(schemaUrl)
  for (const value of ['Bear Cub', 'Grizzly', 'Kodiak', 'Titan Bear', 'Apex Bear']) assert.match(sql, new RegExp(value))
  for (const value of ['Rookie', 'Bronze', 'Silver', 'Gold', 'Prestige']) assert.match(sql, new RegExp(value))
  for (const threshold of ['1000', '5000', '10000', '25000']) assert.match(sql, new RegExp(threshold))
})

test('existing real sessions are backfilled but charged no-shows are excluded', () => {
  const sql = read(schemaUrl)
  assert.match(sql, /insert into public\.bearforce_point_events/i)
  assert.match(sql, /session_logs/i)
  assert.match(sql, /no_show/i)
  assert.match(sql, /100/)
})

test('event integration awards exact point values and keeps no-shows out of workout awards', () => {
  const sql = read(integrationUrl)
  assert.match(sql, /staff_qr_checkin/i)
  assert.match(sql, /award_bearforce_points[\s\S]{0,500}100/i)
  assert.match(sql, /staff_mark_package_payment_paid/i)
  assert.match(sql, /200/)
  assert.match(sql, /150/)
  assert.match(sql, /250/)
  assert.match(sql, /PARTIAL24/i)
  assert.match(sql, /trigger_sessions_left/i)
  assert.doesNotMatch(sql, /staff_mark_no_show[\s\S]{0,1200}award_bearforce_points/i)
})
