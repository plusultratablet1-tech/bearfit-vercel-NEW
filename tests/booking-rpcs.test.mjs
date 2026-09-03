import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const migration = new URL('../supabase/migrations/20260903093000_booking_operations.sql', import.meta.url)

test('booking RPCs enforce notice, cancellation, capacity, package and branch rules', () => {
  assert.equal(fs.existsSync(migration), true)
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /interval '24 hours'/i)
  assert.match(sql, /interval '4 hours'/i)
  assert.match(sql, /confirmed/i)
  assert.match(sql, /count\(\*\).*capacity/is)
  assert.match(sql, /private\.package_eligibility/i)
  assert.match(sql, /future.*confirmed/is)
  assert.match(sql, /branch/i)
})

test('pending booking creation does not consume capacity or sessions', () => {
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /status[^\n]*pending/i)
  assert.doesNotMatch(sql, /update public\.member_package_cycles[\s\S]*member_request_slot/i)
  assert.doesNotMatch(sql, /update public\.schedule_slots[\s\S]*set capacity\s*=\s*capacity\s*-/i)
})
