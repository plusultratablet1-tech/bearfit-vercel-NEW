import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = new URL('../app/staff/rewards/page.tsx', import.meta.url)
const client = new URL('../app/staff/rewards/StaffRewardsPageClient.tsx', import.meta.url)
const scheduleClient = new URL('../app/staff/schedule/StaffSchedulePageClient.tsx', import.meta.url)

test('staff Rewards route is protected for staff/admin and loads its snapshot', () => {
  assert.equal(fs.existsSync(page), true)
  const src = fs.readFileSync(page,'utf8')
  assert.match(src,/role !== ["']staff["'] && role !== ["']admin["']/)
  assert.match(src,/staff_reward_snapshot/)
})

test('staff can create and manage real reward catalog fields', () => {
  assert.equal(fs.existsSync(client), true)
  const src = fs.readFileSync(client,'utf8')
  assert.match(src,/staff_create_reward/)
  assert.match(src,/staff_update_reward/)
  for (const label of ['Title','Description','Category','Points cost','Stock','Image URL','Active membership','Active']) assert.match(src,new RegExp(label,'i'))
  assert.match(src,/Unlimited stock/i)
})

test('staff request queue supports approve reject and claimed transitions', () => {
  const src=fs.readFileSync(client,'utf8')
  assert.match(src,/staff_approve_reward_request/)
  assert.match(src,/staff_reject_reward_request/)
  assert.match(src,/staff_mark_reward_claimed/)
  assert.match(src,/Approve/i)
  assert.match(src,/Reject/i)
  assert.match(src,/Mark claimed/i)
  assert.match(src,/Pending requests/i)
  assert.match(src,/Request history/i)
})

test('staff schedule header links to Rewards workspace', () => {
  const src=fs.readFileSync(scheduleClient,'utf8')
  assert.match(src,/href=["']\/staff\/rewards["']/)
  assert.match(src,/>Rewards</)
})
