import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const migration="supabase/migrations/20260904104000_session_taxonomy_scheduling.sql"
const staff="app/staff/schedule/StaffSchedulePageClient.tsx"
const member="app/member/schedule/MemberSchedulePageClient.tsx"
const labels=["Strength Training","Weight Training","Boxing","Conditioning","Cardio","Group Fitness","Pilates Group","Pilates 1-on-1"]

test("scheduling RPCs derive categories and propagate session labels",()=>{
  assert.equal(fs.existsSync(migration),true)
  const sql=fs.readFileSync(migration,"utf8")
  assert.match(sql,/staff_create_availability_rule[\s\S]*p_session_label text/i)
  assert.match(sql,/staff_create_one_off_slot[\s\S]*p_session_label text/i)
  assert.match(sql,/member_request_custom_session[\s\S]*p_session_label text/i)
  assert.match(sql,/private\.session_label_category\(p_session_label\)/i)
  assert.match(sql,/schedule_slots[\s\S]*session_label[\s\S]*v_rule\.session_label/i)
  assert.match(sql,/bookings[\s\S]*session_label[\s\S]*v_slot\.session_label/i)
  assert.match(sql,/session_label=v_slot\.session_label|session_label\s*=\s*coalesce/i)
  assert.match(sql,/Session label does not match slot/i)
})

test("staff and member schedule UIs use the eight production workout names",()=>{
  const staffSrc=fs.readFileSync(staff,"utf8")
  const memberSrc=fs.readFileSync(member,"utf8")
  const helperSrc=fs.readFileSync("lib/session-taxonomy.ts","utf8")
  for(const label of labels) assert.match(helperSrc,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))
  assert.match(staffSrc,/SESSION_TAXONOMY/)
  assert.match(memberSrc,/SESSION_TAXONOMY/)
  assert.match(staffSrc,/p_session_label/)
  assert.match(memberSrc,/p_session_label/)
  assert.match(memberSrc,/displaySessionLabel\(slot\.session_label,slot\.session_type\)/)
  assert.match(memberSrc,/displaySessionLabel\(b\.session_label,b\.session_type\)/)
})
