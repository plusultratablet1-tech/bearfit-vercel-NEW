import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const migration="supabase/migrations/20260904105000_session_taxonomy_checkin.sql"
const checkin="app/checkin/CheckInPageClient.tsx"
const dashboard="components/bearfit/BearfitDashboardClient.tsx"

test("check-in RPC inherits booked labels and requires manual production labels",()=>{
  assert.equal(fs.existsSync(migration),true)
  const sql=fs.readFileSync(migration,"utf8")
  assert.match(sql,/staff_qr_checkin[\s\S]*p_session_label text/i)
  assert.match(sql,/v_booking\.session_label/i)
  assert.match(sql,/Manual check-in requires a session label/i)
  assert.match(sql,/private\.session_label_category\(p_session_label\)/i)
  assert.doesNotMatch(sql,/select c\.\*,d\.\*/i)
  assert.match(sql,/update public\.session_logs[\s\S]*session_label/i)
  assert.match(sql,/staff_checkin_context[\s\S]*session_label/i)
  assert.match(sql,/award_bearforce_points[\s\S]*session_completed[\s\S]*100/i)
  assert.doesNotMatch(sql,/staff_mark_no_show[\s\S]*award_bearforce_points/i)
})

test("check-in UI sends manual label and booked check-ins show inherited label",()=>{
  const src=fs.readFileSync(checkin,"utf8")
  assert.match(src,/SESSION_TAXONOMY/)
  assert.match(src,/p_session_label/)
  assert.match(src,/displaySessionLabel\(booking\.session_label, booking\.session_type\)/)
  assert.match(src,/Manual workout type/i)
})

test("dashboard uses production label for upcoming and completed session presentation",()=>{
  const src=fs.readFileSync(dashboard,"utf8")
  assert.match(src,/displaySessionLabel/)
  assert.match(src,/nextBooking\.session_label/)
  assert.match(src,/log\.session_label/)
  assert.match(src,/sessionVisualForType\(nextBooking\.session_label, nextBooking\.session_type\)/)
})
