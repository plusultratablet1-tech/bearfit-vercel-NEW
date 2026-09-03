import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = new URL('../supabase/migrations/20260903092000_scheduling_schema.sql', import.meta.url)

test('schedule schema supports recurring and concrete slots plus booking capacity', () => {
  assert.equal(fs.existsSync(migration), true)
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /create table public\.availability_rules/i)
  assert.match(sql, /create table public\.schedule_slots/i)
  assert.match(sql, /create table public\.bookings/i)
  assert.match(sql, /capacity integer/i)
  assert.match(sql, /unique.*availability_rule_id.*start_at/is)
})

test('members can only read open slots for their own branch while staff can manage all', () => {
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /schedule_slots_select_branch_or_staff/i)
  assert.match(sql, /private\.is_staff_or_admin/i)
  assert.match(sql, /enable row level security/i)
})

test('scheduling foreign keys flagged by advisors have covering indexes', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/20260903096000_scheduling_fk_indexes.sql', import.meta.url), 'utf8')
  for (const name of ['availability_rules_created_by_idx','bookings_created_by_idx','bookings_member_package_id_idx','bookings_requested_coach_user_id_idx','member_package_cycles_renewed_from_id_idx','member_package_stage_payments_stage_id_idx','schedule_slots_created_by_idx']) {
    assert.match(sql, new RegExp(name))
  }
})
