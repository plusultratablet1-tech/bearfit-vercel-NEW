import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { checkInDecision, conductionDecision, shiftDecision, cutoffFor, latestRateOn, payableAmount, payrollDecision, cutoffTransition, adjustmentDecision } from "../lib/coach-payroll-safety.mjs"

const goodScan = {
  staffAuthenticated:true,validMemberIdentity:true,qrVerified:true,branchAllowed:true,
  packageActive:true,sessionsLeft:5,confirmedBooking:true,withinBookingWindow:true,
  existingSessionLog:false,walkIn:false,
}
const goodConduction={
  sessionLogId:"log-a",memberId:"member-a",memberAttended:true,workoutCompleted:true,
  coachId:"coach-a",coachDisputed:false,coachChangedMidSession:false,isNoShow:false,isCancelled:false,
}
const goodPayroll={
  actorRole:"admin",everyConductionApproved:true,allRatesAssigned:true,hasDispute:false,cutoffStatus:"for_review",
}
const goodShift={
  authenticatedCoach:true,action:"in",openShift:false,branchVerified:true,
}
const rates=[{coachId:"a",effectiveFrom:"2026-10-01",amount:120},{coachId:"a",effectiveFrom:"2026-10-16",amount:150},{coachId:"b",effectiveFrom:"2026-10-01",amount:200}]
function scan(change={}) {return checkInDecision({...goodScan,...change})}
function cond(change={}) {return conductionDecision({...goodConduction,...change})}
function payroll(change={}) {return payrollDecision({...goodPayroll,...change})}

test("01 duplicate scan is idempotent",()=>assert.equal(scan({existingSessionLog:true}),"already_checked_in"))
test("02 simultaneous retries resolve to one existing source",()=>assert.equal(scan({existingSessionLog:true,sessionsLeft:0}),"already_checked_in"))
test("03 invalid or shared QR identity is denied",()=>assert.equal(scan({qrVerified:false}),"blocked_identity"))
test("04 exhausted member package is denied",()=>assert.equal(scan({sessionsLeft:0}),"blocked_package"))
test("05 expired or inactive package is denied",()=>assert.equal(scan({packageActive:false}),"blocked_package"))
test("06 wrong-branch check-in is denied",()=>assert.equal(scan({branchAllowed:false}),"blocked_branch"))
test("07 unauthenticated scanner cannot confirm check-in",()=>assert.equal(scan({staffAuthenticated:false}),"blocked_unauthenticated"))
test("08 walk-in missing coach is blocked",()=>assert.equal(scan({walkIn:true,uniqueWalkInId:"walkin-a",sessionType:"fitness"}),"blocked_incomplete_walkin"))
test("09 separate valid walk-in IDs are accepted",()=>{
  assert.equal(scan({walkIn:true,uniqueWalkInId:"walkin-a",coachId:"coach-a",sessionType:"fitness"}),"eligible_to_confirm")
  assert.equal(scan({walkIn:true,uniqueWalkInId:"walkin-b",coachId:"coach-a",sessionType:"fitness"}),"eligible_to_confirm")
})
test("10 invalid member identity is denied",()=>assert.equal(scan({validMemberIdentity:false}),"blocked_identity"))
test("11 verified group attendances each qualify individually",()=>{
  assert.deepEqual(["m1","m2","m3","m4"].map((memberId)=>cond({memberId})),Array(4).fill("eligible_for_admin_approval"))
})
test("12 no-show booking is never a payable conduction",()=>assert.equal(cond({isNoShow:true}),"not_payable"))
test("13 member's roster coach cannot replace actual missing coach",()=>assert.equal(cond({coachId:null}),"pending_coach_verification"))
test("14 unspecified coach attribution waits for review",()=>assert.equal(cond({coachId:""}),"pending_coach_verification"))
test("15 conflicting coach claims do not approve",()=>assert.equal(cond({coachDisputed:true}),"pending_coach_verification"))
test("16 early checkout before completed workout is pending",()=>assert.equal(cond({workoutCompleted:false}),"pending_completion_verification"))
test("17 handover between coaches is pending resolution",()=>assert.equal(cond({coachChangedMidSession:true}),"pending_coach_verification"))
test("18 source attendance log is mandatory",()=>assert.equal(cond({sessionLogId:null}),"blocked_missing_source"))
test("19 forgotten clock-in cannot be fabricated by clock-out",()=>assert.equal(shiftDecision({...goodShift,action:"out",openShift:false}),"blocked_missing_clock_in"))
test("20 forgotten clock-out remains open, new clock-in blocked",()=>assert.equal(shiftDecision({...goodShift,openShift:true}),"blocked_already_clocked_in"))
test("21 duplicate clock-in blocked",()=>assert.equal(shiftDecision({...goodShift,openShift:true}),"blocked_already_clocked_in"))
test("22 branch mismatch requires review",()=>assert.equal(shiftDecision({...goodShift,branchVerified:false}),"pending_branch_verification"))
test("23 device clock before server clock-in cannot establish clock-out",()=>assert.equal(shiftDecision({...goodShift,action:"out",openShift:true,clockInTime:"2026-10-12T03:00:00Z",serverTime:"2026-10-12T02:00:00Z"}),"blocked_invalid_time"))
test("24 shift without bookings does not earn automatic conductions",()=>{
  assert.equal(shiftDecision(goodShift),"clock_in_allowed")
  assert.equal(payableAmount([],"a",rates),0)
})
test("25 missing rate blocks payroll",()=>assert.equal(payroll({allRatesAssigned:false}),"blocked_missing_rate"))
test("26 mid-cutoff coach rate change respects the session date",()=>{
  assert.equal(latestRateOn(rates,"a","2026-10-15").amount,120)
  assert.equal(latestRateOn(rates,"a","2026-10-16").amount,150)
  assert.equal(payableAmount([{coachId:"a",status:"approved",sessionDate:"2026-10-15"},{coachId:"a",status:"approved",sessionDate:"2026-10-16"}],"a",rates),270)
})
test("27 October 31 belongs to second cutoff",()=>assert.deepEqual(cutoffFor("2026-10-31T15:59:59Z"),{from:"2026-10-16",through:"2026-10-31"}))
test("28 postpaid rate or conduction mutation cannot reopen paid cutoff",()=>{
  assert.equal(payroll({cutoffStatus:"paid"}),"blocked_locked")
  assert.equal(adjustmentDecision({cutoffStatus:"paid",actorRole:"admin",auditReason:"Correct paid cutoff",amount:100,coachMatches:true}),"next_open_cutoff_required")
})
test("29 duplicate paid-status transition is idempotent",()=>assert.equal(cutoffTransition("paid","paid"),"already_paid"))
test("30 coach reassignment after payout requires later adjustment",()=>assert.equal(adjustmentDecision({cutoffStatus:"locked",actorRole:"admin",auditReason:"Reassign paid training",amount:-150,coachMatches:true}),"next_open_cutoff_required"))
test("31 February cutoff handles leap year",()=>assert.deepEqual(cutoffFor("2028-02-29T13:00:00Z"),{from:"2028-02-16",through:"2028-02-29"}))
test("32 February cutoff handles ordinary year",()=>assert.deepEqual(cutoffFor("2027-02-28T13:00:00Z"),{from:"2027-02-16",through:"2027-02-28"}))
test("33 midnight Philippine time belongs to local-date cutoff",()=>assert.equal(cutoffFor("2026-10-15T16:05:00Z").from,"2026-10-16"))
test("34 payroll rejects a mixed-coach ledger",()=>assert.throws(()=>payableAmount([{coachId:"b",status:"approved",sessionDate:"2026-10-10"}],"a",rates),/Mixed coaches/))
test("35 unapproved conduction cannot enter payroll calculation",()=>assert.throws(()=>payableAmount([{coachId:"a",status:"pending",sessionDate:"2026-10-10"}],"a",rates),/Unapproved/))
test("36 non-admin cannot approve payroll",()=>assert.equal(payroll({actorRole:"staff"}),"blocked_role"))
test("37 outstanding coach dispute blocks payroll",()=>assert.equal(payroll({hasDispute:true}),"blocked_dispute"))
test("38 valid cutoff statuses must proceed in order",()=>{
  assert.equal(cutoffTransition("open","paid"),"blocked")
  assert.equal(cutoffTransition("open","for_review"),"allowed")
  assert.equal(cutoffTransition("approved","locked"),"allowed")
  assert.equal(cutoffTransition("locked","paid"),"allowed")
})
test("39 adjustment must include an auditable reason",()=>assert.equal(adjustmentDecision({cutoffStatus:"open",actorRole:"admin",auditReason:"",amount:100,coachMatches:true}),"blocked_authorization_or_reason"))
test("40 adjustment cannot target a different coach",()=>assert.equal(adjustmentDecision({cutoffStatus:"open",actorRole:"admin",auditReason:"Correction for coach",amount:100,coachMatches:false}),"blocked_wrong_coach"))
test("41 cancellation is never a payable conduction",()=>assert.equal(cond({isCancelled:true}),"not_payable"))
test("42 member without attendance waits for verification",()=>assert.equal(cond({memberAttended:false}),"pending_attendance_verification"))
test("43 missing rate throws rather than calculating zero",()=>assert.throws(()=>payableAmount([{coachId:"missing",status:"approved",sessionDate:"2026-10-10"}],"missing",rates),/Missing effective rate/))
test("44 valid same-coach individual rate produces correct centavo calculation",()=>{
  assert.equal(payableAmount(Array.from({length:3},()=>({coachId:"b",status:"approved",sessionDate:"2026-10-10"})),"b",rates),600)
})

const sql=fs.readFileSync(new URL("../supabase/migrations/20261012104000_conduction_payroll_safety_foundation.sql",import.meta.url),"utf8")
const legacy=fs.readFileSync(new URL("../supabase/migrations/20260903094000_booking_attendance.sql",import.meta.url),"utf8")
const windowRules=fs.readFileSync(new URL("../supabase/migrations/20260916100000_checkin_attendance_window.sql",import.meta.url),"utf8")

test("45 DB enforces one conduction per source session log",()=>assert.match(sql,/session_log_id uuid not null unique references public\.session_logs/))
test("46 DB enforces only one open shift per coach",()=>assert.match(sql,/unique index[^;]*coach_shifts_one_open_per_coach[\s\S]*where clock_out_at is null/))
test("47 DB restricts payroll cutoffs to 1-15 or 16-last day",()=>{
  assert.match(sql,/extract\(day from period_start\)=1/)
  assert.match(sql,/extract\(day from period_start\)=16/)
})
test("48 DB disallows wages without approver and rate snapshot",()=>assert.match(sql,/status='approved' and approved_by is not null and approved_at is not null and rate_history_id is not null and rate_snapshot is not null/))
test("49 DB refuses no-show booking as payable conduction",()=>assert.match(sql,/v_booking.status<>'completed'/))
test("50 DB prevents misattributing another member's source attendance",()=>assert.match(sql,/v_log.member_id<>new.member_id/))
test("51 DB requires a real coach's latest effective rate",()=>assert.match(sql,/later.effective_from>v_rate.effective_from/))
test("52 DB prevents payroll assignment to another coach or cutoff",()=>assert.match(sql,/v_cutoff.coach_id<>new.coach_id or new.session_date not between v_cutoff.period_start and v_cutoff.period_end/))
test("53 DB prevents paid cutoff edits and keeps correction history",()=>{
  assert.match(sql,/Paid payroll cannot be modified in place/)
  assert.match(sql,/prevent_coach_payroll_adjustment_mutation/)
  assert.match(sql,/prevent_coach_payroll_audit_mutation/)
})
test("54 DB blocks new write actions for client roles, including staff",()=>{
  assert.match(sql,/revoke all on table public.coach_shifts, public.coach_conductions/)
  assert.match(sql,/to authenticated;/)
  assert.doesNotMatch(sql,/grant (insert|update|delete) on table public\.coach_/i)
})
test("55 schema introduces no triggers on live session deductions",()=>{
  assert.doesNotMatch(sql,/create trigger[\s\S]*on public\.(session_logs|member_package_cycles|bookings)/i)
  assert.doesNotMatch(sql,/create or replace function public\.staff_qr_checkin/)
})
test("56 historical check-in already protects booked sessions against duplicates",()=>assert.match(legacy,/unique index if not exists session_logs_one_booking_usage_uidx/))
test("57 live check-in timing and Bearforce awards remain untouched",()=>{
  assert.match(windowRules,/Booking check-in opens 2 hours/)
  assert.match(windowRules,/private\.award_bearforce_points/)
})
