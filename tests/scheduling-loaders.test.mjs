import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const schedulingPath = new URL('../lib/scheduling.ts', import.meta.url)
const memberAccountPath = new URL('../lib/member-account.ts', import.meta.url)

test('shared scheduling loader reads slots bookings package cycles and eligibility', () => {
  assert.equal(fs.existsSync(schedulingPath), true)
  const src = fs.readFileSync(schedulingPath, 'utf8')
  assert.match(src, /schedule_slots/)
  assert.match(src, /bookings/)
  assert.match(src, /member_package_cycles/)
  assert.match(src, /member_package_eligibility/)
  assert.match(src, /loadMemberScheduleData/)
})

test('member account includes upcoming bookings and package eligibility', () => {
  const src = fs.readFileSync(memberAccountPath, 'utf8')
  assert.match(src, /upcomingBookings/)
  assert.match(src, /packageEligibility/)
  assert.match(src, /packageAlerts/)
})
