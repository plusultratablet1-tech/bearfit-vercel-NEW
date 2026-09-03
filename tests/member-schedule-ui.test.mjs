import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const page = new URL('../app/member/schedule/page.tsx', import.meta.url)
const client = new URL('../app/member/schedule/MemberSchedulePageClient.tsx', import.meta.url)

test('member schedule route is protected and server loaded', () => {
  assert.equal(fs.existsSync(page), true)
  const src = fs.readFileSync(page,'utf8')
  assert.match(src, /auth\.getUser/)
  assert.match(src, /redirect\(["']\/login["']\)|redirect\(["']\/welcome["']\)/)
  assert.match(src, /loadMemberScheduleData/)
})

test('member schedule supports slot, custom request and cancellation rules', () => {
  assert.equal(fs.existsSync(client), true)
  const src = fs.readFileSync(client,'utf8')
  assert.match(src, /member_request_slot/)
  assert.match(src, /member_request_custom_session/)
  assert.match(src, /member_cancel_booking/)
  assert.match(src, /Any available coach/i)
  assert.match(src, /24 hours/i)
  assert.match(src, /4 hours/i)
  assert.match(src, /Custom request/i)
  assert.doesNotMatch(src, /label[^\n]*Branch/i)
})

test('member schedule offers named home-branch coaches instead of raw coach ids', () => {
  const loader = fs.readFileSync(new URL('../lib/scheduling.ts', import.meta.url), 'utf8')
  const migration = fs.readFileSync(new URL('../supabase/migrations/20260903095000_member_coach_directory.sql', import.meta.url), 'utf8')
  assert.match(migration, /member_coach_directory/)
  assert.match(loader, /member_coach_directory/)
  const clientSource = fs.readFileSync(client, 'utf8')
  assert.match(clientSource, /initialData\.coaches/)
  assert.match(clientSource, /Any available coach/)
  assert.doesNotMatch(clientSource, /placeholder="Any available coach"/)
})
