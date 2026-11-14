import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const sql=readFileSync("supabase/migrations/20261114230000_booking_final_confirmation_and_change_audit.sql","utf8")
const member=readFileSync("app/member/schedule/MemberSchedulePageClient.tsx","utf8")
const staff=readFileSync("app/staff/schedule/StaffSchedulePageClient.tsx","utf8")
const doc=readFileSync("docs/BEARFIT_OPERATIONS_POLICY_V1.md","utf8")

test("Final schedule acknowledgment can only be recorded by owning member after Admin confirmed",()=>{
 assert.match(sql,/m\.user_id=v_uid/)
 assert.match(sql,/v_b\.status<>'confirmed'/)
 assert.match(sql,/v_b\.start_at<=now\(\)/)
 assert.match(sql,/and not coalesce\(m\.is_demo,false\)/)
 assert.match(sql,/unique\(booking_id,final_schedule_revision\)/)
 assert.match(member,/Confirm Final Schedule & Terms/)
})
test("Any changed coach/time/service invalidates previous final client confirmation",()=>{
 assert.match(sql,/final_schedule_revision:=old\.final_schedule_revision\+1/)
 for(const part of ["start_at","end_at","assigned_coach_user_id","slot_id","branch","session_type","session_label"])assert.match(sql,new RegExp("old\\."+part+" is distinct from new\\."+part))
 assert.match(sql,/f\.final_schedule_revision=v_b\.final_schedule_revision/)
 assert.match(member,/a\.final_schedule_revision===/)
})
test("Admin cannot charge a no-show absent current client final acknowledgment",()=>{
 assert.match(sql,/require_final_client_confirmation_for_no_show_charge/)
 assert.match(sql,/before update of status on public\.booking_no_show_cases/)
 assert.match(sql,/Client has not acknowledged the final assigned schedule/)
 assert.match(sql,/new\.status<>'charged'/)
 assert.match(staff,/no-show penalty not chargeable yet/)
})
test("Cancelled and rescheduled bookings generate private member-visible audit events",()=>{
 assert.match(sql,/create table if not exists public\.booking_operational_events/)
 assert.match(sql,/Member[s]? see own booking change notices/)
 assert.match(sql,/old\.status is distinct from new\.status/)
 assert.match(sql,/schedule_changed/)
 assert.match(sql,/audit_direct_booking_assignment/)
 assert.match(member,/Booking changes & cancellation notices/)
})
test("Staff cancellation requires a categorized explanation and cannot deduct sessions",()=>{
 assert.match(sql,/length\(btrim\(coalesce\(p_reason,''\)\)\) not between 8 and 600/)
 assert.match(sql,/member_session_deducted',false/)
 assert.match(staff,/Coach unavailable \/ absent/)
 assert.match(staff,/Member emergency \(Admin exception\)/)
 assert.match(staff,/cancellationReason=category\+": \"\+note\.trim\(\)/)
})
test("Legacy booking cancellation rights are preserved after cutoff",()=>{
 assert.match(sql,/if v_agreed or now\(\)<=v_cutoff then/)
 assert.match(sql,/original legacy cancellation rights retained/)
 assert.doesNotMatch(sql,/delete from public\.session_logs/i)
})
test("Policy manual documents member, coach, Admin authority and pending finance decisions",()=>{
 for(const word of ["Member","Coach","Admin","10:00 PM","48 hours","Owner approval still required","no member session"])assert.ok(doc.includes(word))
 assert.doesNotMatch(sql,/update public\.coach_payroll_cutoffs/)
 assert.doesNotMatch(sql,/update public\.coach_conductions/)
 assert.doesNotMatch(sql,/update public\.payments/)
 assert.doesNotMatch(sql,/update public\.member_package_cycles/)
})
