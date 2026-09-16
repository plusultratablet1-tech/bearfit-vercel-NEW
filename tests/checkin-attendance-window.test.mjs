import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migrationPath = new URL('../supabase/migrations/20260916100000_checkin_attendance_window.sql', import.meta.url)
const checkinClientPath = new URL('../app/checkin/CheckInPageClient.tsx', import.meta.url)

test('booking check-in is restricted to the approved two-hour attendance window', () => {
  assert.equal(fs.existsSync(migrationPath), true)
  const sql = fs.readFileSync(migrationPath, 'utf8')
  assert.match(sql, /start_at\s*-\s*interval\s*'2 hours'/i)
  assert.match(sql, /end_at\s*\+\s*interval\s*'2 hours'/i)
  assert.match(sql, /check-in opens 2 hours before/i)
  assert.match(sql, /check-in window has closed/i)
})

test('manual check-in keeps the shared exactly-once consumption and Bearforce path', () => {
  assert.equal(fs.existsSync(migrationPath), true)
  const sql = fs.readFileSync(migrationPath, 'utf8')
  assert.match(sql, /private\.consume_package_session/i)
  assert.match(sql, /already_consumed/i)
  assert.match(sql, /private\.award_bearforce_points/i)
  assert.match(sql, /p_booking_id is not null[\s\S]*else[\s\S]*p_session_label/i)
})

test('no-show is blocked until the scheduled session has ended', () => {
  assert.equal(fs.existsSync(migrationPath), true)
  const sql = fs.readFileSync(migrationPath, 'utf8')
  assert.match(sql, /staff_mark_no_show/i)
  assert.match(sql, /now\(\)\s*<\s*v_booking\.end_at/i)
  assert.match(sql, /No-show can only be marked after the scheduled session ends/i)
})

test('check-in context exposes only relevant confirmed bookings with package details', () => {
  assert.equal(fs.existsSync(migrationPath), true)
  const sql = fs.readFileSync(migrationPath, 'utf8')
  assert.match(sql, /staff_checkin_context/i)
  assert.match(sql, /b\.status\s*=\s*'confirmed'/i)
  assert.match(sql, /now\(\)\s*>=\s*b\.start_at\s*-\s*interval\s*'2 hours'/i)
  assert.match(sql, /now\(\)\s*<=\s*b\.end_at\s*\+\s*interval\s*'2 hours'/i)
  assert.match(sql, /'package_name',d\.name/i)
  assert.match(sql, /'package_code',d\.code/i)
  assert.match(sql, /'sessions_left',c\.sessions_left/i)
})

test('check-in response includes post-consumption eligibility for package warnings', () => {
  assert.equal(fs.existsSync(migrationPath), true)
  const sql = fs.readFileSync(migrationPath, 'utf8')
  assert.match(sql, /'eligibility'\s*,\s*private\.package_eligibility\(v_member\.id\s*,\s*v_session_type\)/i)
})

test('staff check-in UI shows the attendance window, booking package details, and result eligibility', () => {
  const source = fs.readFileSync(checkinClientPath, 'utf8')
  assert.match(source, /package_name\?: string \| null/i)
  assert.match(source, /sessions_left\?: number \| null/i)
  assert.match(source, /result\?\.eligibility\?\.warning_message/i)
  assert.match(source, /Check-in window: 2 hours before start to 2 hours after end/i)
  assert.match(source, /booking\.package_name/i)
})
