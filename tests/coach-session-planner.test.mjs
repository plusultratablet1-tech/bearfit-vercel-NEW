import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const planner=readFileSync("app/coach/CoachSessionPlanner.tsx","utf8")
const migration=readFileSync("supabase/migrations/20261112210000_coach_daily_weekly_planner.sql","utf8")
const home=readFileSync("app/coach/CoachHomeClient.tsx","utf8")

test("planner added without removing existing schedule operations",()=>{
  assert.match(home,/CoachSessionPlanner onCreated=\{refresh\}/)
  assert.match(home,/<CoachScheduleOverview/)
  assert.match(home,/<CoachActivityPanel/)
})
test("daily and recurring sessions use coach-scoped RPC",()=>{
  assert.match(planner,/rpc\("coach_client_cards"\)/)
  assert.match(planner,/rpc\("coach_plot_sessions"/)
  assert.match(planner,/p_occurrences:repeat\?Number\(weeks\):1/)
  assert.match(planner,/new Date\(start\+":00\+08:00"\)/)
})
test("server verifies coach assignment, branch, authentication and conflict",()=>{
  assert.match(migration,/role='coach'/)
  assert.match(migration,/v_coach\.branch/)
  assert.match(migration,/coach_historical_session_links/)
  assert.match(migration,/tstzrange/)
  assert.match(migration,/status in \('pending','confirmed'\)/)
})
test("new bookings are pending and do not change credits or payroll",()=>{
  assert.match(migration,/v_member\.id,'custom','pending'/)
  assert.doesNotMatch(migration,/update public\.members/i)
  assert.doesNotMatch(migration,/insert into public\.session_logs/i)
  assert.doesNotMatch(migration,/insert into public\.coach_conductions/i)
})
