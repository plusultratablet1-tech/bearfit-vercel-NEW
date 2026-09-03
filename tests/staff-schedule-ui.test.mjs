import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const page = new URL('../app/staff/schedule/page.tsx', import.meta.url)
const client = new URL('../app/staff/schedule/StaffSchedulePageClient.tsx', import.meta.url)

test('staff schedule route is protected for staff/admin', () => {
  assert.equal(fs.existsSync(page),true)
  const src=fs.readFileSync(page,'utf8')
  assert.match(src,/role !== ["']staff["'] && role !== ["']admin["']/)
})

test('staff schedule manages availability bookings no-shows and package attention', () => {
  assert.equal(fs.existsSync(client),true)
  const src=fs.readFileSync(client,'utf8')
  assert.match(src,/staff_create_availability_rule/)
  assert.match(src,/staff_generate_slots/)
  assert.match(src,/staff_create_one_off_slot/)
  assert.match(src,/staff_confirm_booking/)
  assert.match(src,/p_assigned_coach_user_id/)
  assert.match(src,/staff_create_assignment/)
  assert.match(src,/staff_reassign_booking/)
  assert.match(src,/Assign member/i)
  assert.match(src,/staff_reject_booking/)
  assert.match(src,/staff_mark_no_show/)
  assert.match(src,/Charge 1 session/i)
  assert.match(src,/capacity/i)
  assert.match(src,/staff_package_attention_queue/)
  assert.match(src,/Payment Due|Renewal Soon|Last Session/i)
})
