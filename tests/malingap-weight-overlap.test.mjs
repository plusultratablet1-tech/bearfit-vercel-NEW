import {readFileSync} from "node:fs"
import {test} from "node:test"
import assert from "node:assert/strict"

const sql=readFileSync("supabase/migrations/20261117093000_malingap_weights_three_overlap.sql","utf8")
const helper=readFileSync("lib/malingap-weight-capacity.ts","utf8")
const planner=readFileSync("app/coach/CoachSessionPlanner.tsx","utf8")
const admin=readFileSync("app/staff/schedule/StaffSchedulePageClient.tsx","utf8")

test("weights sharing applies only to Malingap Branch",()=>{
  assert.match(sql,/p_branch='Malingap Branch'/)
  for(const label of ["Strength Training","Weight Training","Strength & Conditioning"]) {
    assert.ok(sql.includes("'"+label+"'"))
  }
  assert.match(sql,/when p_label='Strength & Conditioning' then 3/)
  assert.match(sql,/else 1/)
  assert.match(helper,/branch === "Malingap Branch"/)
})
test("coach plotting accepts compatible overlapping weight types, still caps at 3",()=>{
  assert.match(sql,/not private\.coach_parallel_compatible\(v_member\.branch,p_session_label,b\.session_label\)/)
  assert.match(sql,/>= private\.coach_parallel_capacity\(v_member\.branch,p_session_label\)/)
  assert.match(sql,/b\.status in \('pending','confirmed'\)/)
  assert.match(sql,/Client already has a session at this time/)
  assert.match(sql,/A coach cannot have overlapping sessions at different branches/)
  assert.match(sql,/v_member\.id,'custom','pending'/)
})
test("Admin confirmation enforces coach-wide limit and retains package eligibility",()=>{
  assert.match(sql,/private\.coach_parallel_compatible\(v_slot\.branch,v_slot\.session_label,b\.session_label\)/)
  assert.match(sql,/b\.branch is distinct from v_slot\.branch/)
  assert.match(sql,/>= private\.coach_parallel_capacity\(v_slot\.branch,v_slot\.session_label\)/)
  assert.match(sql,/v_confirmed_count >= v_slot\.capacity/)
  assert.match(sql,/private\.package_eligibility\(v_member\.id,v_slot\.session_type\)/)
  assert.match(sql,/v_future_confirmed >= v_sessions_left/)
})
test("member calendar capacity and other-type rules recognize equivalent weight labels",()=>{
  assert.match(sql,/private\.coach_parallel_capacity\(s\.branch,s\.session_label\)/)
  assert.match(sql,/private\.coach_parallel_compatible\(s\.branch,s\.session_label,b\.session_label\)/)
  assert.match(sql,/s\.branch='Malingap Branch'/)
})
test("existing bookings, credits, payroll and user accounts are never rewritten",()=>{
  assert.match(sql,/Malingap weights sharing 3 clients per coach/)
  assert.doesNotMatch(sql,/\bupdate\s+public\.(members|payments|coach_conductions|profiles)\b/i)
  assert.doesNotMatch(sql,/\bdelete\s+from\s+public\.(members|payments|coach_conductions|profiles)\b/i)
  assert.doesNotMatch(sql,/\binsert\s+into\s+public\.(members|payments|coach_conductions|profiles)\b/i)
  assert.match(sql,/v_changed is not null/)
})
test("coach and Admin interface explain applicable capacity without changing booking workflow",()=>{
  assert.match(planner,/malingapWeightTraining/)
  assert.match(planner,/up to 3 different assigned clients/)
  assert.match(planner,/p_occurrences:repeat\?Number\(weeks\):1/)
  assert.match(admin,/coachSuggestedCapacity/)
  assert.match(admin,/malingapWeightTraining/)
  assert.match(admin,/staff_create_one_off_slot/)
  assert.match(admin,/staff_create_availability_rule/)
})
