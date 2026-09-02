import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migrationPath = new URL('../supabase/migrations/20260902180000_payments_checkin_flow.sql', import.meta.url)
const paymentsPage = fs.readFileSync(new URL('../app/payments/page.tsx', import.meta.url), 'utf8')
const paymentsClient = fs.readFileSync(new URL('../app/payments/PaymentsPageClient.tsx', import.meta.url), 'utf8')
const checkinPage = fs.readFileSync(new URL('../app/checkin/page.tsx', import.meta.url), 'utf8')
const checkinClient = fs.readFileSync(new URL('../app/checkin/CheckInPageClient.tsx', import.meta.url), 'utf8')

test('payment migration records purchased sessions and applies credits only through staff RPCs', () => {
  assert.equal(fs.existsSync(migrationPath), true)
  const sql = fs.readFileSync(migrationPath, 'utf8')
  assert.match(sql, /sessions_purchased\s+integer/i)
  assert.match(sql, /credit_applied_at\s+timestamptz/i)
  assert.match(sql, /staff_record_payment/i)
  assert.match(sql, /staff_mark_payment_paid/i)
  assert.match(sql, /sessions_left\s*=\s*sessions_left\s*\+\s*v_payment\.sessions_purchased/i)
  assert.match(sql, /credit_applied_at\s+is\s+null/i)
})

test('payments UI uses staff payment RPCs rather than directly crediting members', () => {
  assert.match(paymentsClient, /staff_record_payment/)
  assert.match(paymentsClient, /staff_mark_payment_paid/)
  assert.doesNotMatch(paymentsClient, /\.from\(["']members["']\)\s*\.update/)
  assert.match(paymentsClient, /Sessions purchased/i)
})

test('payments and check-in routes are server protected for staff or admin', () => {
  assert.doesNotMatch(paymentsPage, /["']use client["']/)
  assert.doesNotMatch(checkinPage, /["']use client["']/)
  assert.match(paymentsPage, /role !== ["']staff["'] && role !== ["']admin["']/)
  assert.match(checkinPage, /role !== ["']staff["'] && role !== ["']admin["']/)
})

test('check-in UI supports staff/admin and a manual member code fallback', () => {
  assert.match(checkinClient, /staff_qr_checkin/)
  assert.match(checkinClient, /Manual member code/i)
  assert.match(checkinClient, /admin/i)
})
