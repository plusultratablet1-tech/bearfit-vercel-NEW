import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const sql=readFileSync("supabase/migrations/20261113193000_coach_available_confirmation_feedback.sql","utf8")
const ui=readFileSync("app/coach/CoachScheduleOverview.tsx","utf8")
const planner=readFileSync("app/coach/CoachSessionPlanner.tsx","utf8")

test("coach availability requires verified coach identity and ownership",()=>{
 assert.match(sql,/role='coach'/)
 assert.match(sql,/v_booking\.branch is distinct from v_coach\.branch/)
 assert.match(sql,/v_booking\.created_by=v_coach\.user_id/)
 assert.match(sql,/v_booking\.request_kind='custom'/)
 assert.match(sql,/v_booking\.assigned_coach_user_id=v_coach\.user_id/)
})
test("eligible coach-plotted sessions reuse existing payment and booking safety gates",()=>{
 assert.match(sql,/private\.package_eligibility\(v_booking\.member_id,v_booking\.session_type\)/)
 assert.match(sql,/can_confirm_booking/)
 assert.match(sql,/private\.confirm_booking_core\(v_booking\.id,v_booking\.slot_id,v_coach\.user_id,true\)/)
 assert.doesNotMatch(sql,/update\s+public\.members/i)
 assert.doesNotMatch(sql,/update\s+public\.payments/i)
 assert.doesNotMatch(sql,/insert\s+into\s+public\.session_logs/i)
})
test("member requests stay admin-confirmed and payment blockers stay visible",()=>{
 assert.match(sql,/pending Admin confirmation/)
 assert.match(sql,/blocking_reason/)
 assert.match(sql,/coach_plotted/)
 assert.match(ui,/rpc\("coach_schedule_accept"/)
 assert.match(ui,/Recheck confirmation/)
 assert.match(ui,/Booking confirmation blocked/)
 assert.match(ui,/actionNotice&&/)
 assert.match(planner,/Tap Available/)
})
