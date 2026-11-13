import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const sql=readFileSync("supabase/migrations/20261113100000_member_calendar_coach_capacity.sql","utf8")
const member=readFileSync("app/member/schedule/MemberSchedulePageClient.tsx","utf8")
const admin=readFileSync("app/staff/schedule/StaffSchedulePageClient.tsx","utf8")

test("member calendar uses the shared bookings and capacity-aware private RPC",()=>{
  assert.match(member,/member_calendar_slots/)
  assert.match(member,/member_request_slot/)
  assert.match(member,/member_request_custom_session/)
  assert.match(member,/member_cancel_booking/)
  assert.match(member,/Monthly view/)
  assert.match(member,/slot\.remaining<=0/)
  assert.match(member,/monthBookings/)
  assert.match(sql,/join public\.members m on m\.user_id=\(select auth\.uid\(\)\)/)
  assert.match(sql,/member_calendar_slots/)
  assert.doesNotMatch(sql,/select\s+b\.member_id\s*,/i)
})

test("per-coach S&C cap 3 and cardio cap 1 and explicit specialization",()=>{
  assert.match(sql,/scheduling_specialization/)
  assert.match(sql,/case when v_slot\.session_label='Strength & Conditioning' then 3 else 1 end/)
  assert.match(sql,/case when p_session_label='Strength & Conditioning' then 3 else 1 end/)
  assert.match(sql,/v_slot\.session_label='Cardio'/)
  assert.match(sql,/b\.assigned_coach_user_id=v_coach/)
  assert.match(sql,/pg_advisory_xact_lock/)
  assert.match(sql,/Coach has reached the limit for this hour/)
  assert.match(admin,/admin_set_coach_scheduling_specialization/)
  assert.match(admin,/Coach booking specializations/)
  assert.match(admin,/capacity:v==="Cardio"\?"1":v==="Strength & Conditioning"\?"3"/)
})

test("retain safety: package eligibility, branch, no session deductions",()=>{
  assert.match(sql,/private\.package_eligibility/)
  assert.match(sql,/v_member\.branch<>v_slot\.branch/)
  assert.match(sql,/Member already has a confirmed session/)
  assert.match(sql,/No sessions deducted/)
  assert.doesNotMatch(sql,/delete from public\.(members|bookings|session_logs)/i)
  assert.doesNotMatch(sql,/update public\.member_package_cycles/i)
})
