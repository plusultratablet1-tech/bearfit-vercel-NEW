import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const sql = readFileSync("supabase/migrations/20261118111500_member_arrival_coach_direct_workflow.sql", "utf8")
const member = readFileSync("components/bearfit/MemberTrainingCheckIn.tsx", "utf8")
const dashboard = readFileSync("components/bearfit/BearfitDashboardClient.tsx", "utf8")
const server = readFileSync("lib/member-account-server.ts", "utf8")
const coachPlanner = readFileSync("app/coach/CoachSessionPlanner.tsx", "utf8")
const coachSchedule = readFileSync("app/coach/CoachScheduleOverview.tsx", "utf8")

test("member check-in is authenticated, member-owned, GPS-verified, and never deducts", () => {
  assert.match(sql, /member_training_checkin/)
  assert.match(sql, /user_id=v_uid and not is_demo/)
  assert.match(sql, /v_booking\.status<>'confirmed'/)
  assert.match(sql, /v_booking\.start_at-interval '90 minutes'/)
  assert.match(sql, /v_cfg\.accuracy_limit_m/)
  assert.match(sql, /v_distance>v_cfg\.radius_m/)
  assert.match(sql, /'session_deducted',false/)
  const checkin = sql.split("-- Coach retains")[0]
  assert.doesNotMatch(checkin, /consume_package_session/)
  assert.doesNotMatch(checkin, /latitude double precision not null/)
})

test("arrival proofs are keyed to schedule version so rescheduling invalidates old evidence", () => {
  assert.match(sql, /unique\(booking_id,final_schedule_revision\)/)
  assert.match(sql, /a\.final_schedule_revision=b\.final_schedule_revision/)
  assert.match(sql, /final_schedule_revision=v_booking\.final_schedule_revision/)
  assert.match(member, /scheduleRevision/)
})

test("coaches can confirm only their own plotted sessions with package/capacity checks", () => {
  assert.match(sql, /public\.coach_plot_sessions/)
  assert.match(sql, /b\.created_by=v_uid and b\.assigned_coach_user_id=v_uid/)
  assert.match(sql, /private\.coach_branch_allowed/)
  assert.match(sql, /private\.confirm_booking_core\(v_id::uuid,null,v_uid,true\)/)
  assert.match(coachPlanner, /coach_book_sessions_direct/)
  assert.doesNotMatch(coachPlanner, /db\.rpc\("staff_confirm_booking"/)
})

test("only verified arrivals support coach one-tap completion; only one debit per booking", () => {
  assert.match(sql, /v_booking\.assigned_coach_user_id is distinct from v_uid/)
  assert.match(sql, /where booking_id=p_booking_id and final_schedule_revision=v_booking\.final_schedule_revision/)
  assert.match(sql, /private\.consume_package_session\(v_booking\.member_package_id/)
  assert.match(sql, /if coalesce\(\(v_result->>'already_consumed'\)::boolean,false\) then/)
  assert.match(sql, /insert into public\.coach_conductions/)
  assert.match(sql, /'pending_admin_review'/)
  assert.match(coachSchedule, /coach_complete_checkedin_booking/)
  assert.match(coachSchedule, /clientArrivals\[b\.id\]/)
})

test("member has a single meaningful check-in action and current sessions remain visible", () => {
  assert.match(dashboard, /MemberTrainingCheckIn bookings=\{upcomingBookings\}/)
  assert.match(member, /I'm Here — Check In/)
  assert.match(member, /navigator\.geolocation\.getCurrentPosition/)
  assert.match(member, /db\.rpc\("member_training_checkin"/)
  assert.match(member, /Check-in is temporarily unavailable/)
  assert.match(server, /Date\.now\(\) - 3 \* 60 \* 60 \* 1000/)
})

test("member-only RLS and explicit function grants are present", () => {
  assert.match(sql, /enable row level security/)
  assert.match(sql, /m\.user_id=\(select auth\.uid\(\)\)/)
  assert.match(sql, /revoke all on public\.member_training_arrivals from public,anon,authenticated/)
  assert.match(sql, /grant select on public\.member_training_arrivals to authenticated/)
  assert.match(sql, /grant execute on function public\.member_training_checkin/)
  assert.match(sql, /grant execute on function public\.coach_complete_checkedin_booking/)
})
