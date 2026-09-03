import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const migration = new URL('../supabase/migrations/20260903094000_booking_attendance.sql', import.meta.url)

test('booking attendance has one shared idempotent package deduction path', () => {
  assert.equal(fs.existsSync(migration), true)
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /session_logs_one_booking_usage_uidx/i)
  assert.match(sql, /member_package_cycles[\s\S]*for update/i)
  assert.match(sql, /sessions_left\s*=\s*sessions_left\s*-\s*1/i)
  assert.match(sql, /sessions_used\s*=\s*sessions_used\s*\+\s*1/i)
  assert.match(sql, /status\s*=\s*'completed'/i)
  assert.match(sql, /no_show_charged/i)
  assert.match(sql, /sync_member_primary_balance/i)
})

test('check-in and no-show share package consumption and expose check-in context', () => {
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /private\.consume_package_session/i)
  assert.match(sql, /staff_qr_checkin/i)
  assert.match(sql, /staff_mark_no_show/i)
  assert.match(sql, /staff_checkin_context/i)
})
