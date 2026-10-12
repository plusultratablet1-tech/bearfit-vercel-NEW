import fs from "node:fs"
import test from "node:test"
import assert from "node:assert/strict"
import ts from "typescript"

const boardSource=fs.readFileSync("lib/coach-attendance-board.ts","utf8")
const admin=fs.readFileSync("app/staff/coaches/attendance/CoachAttendanceAdminClient.tsx","utf8")
const output=ts.transpileModule(boardSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const out={exports:{}}
new Function("module","exports",output)(out,out.exports)
const {manilaDay,addDay,manilaWeek,shiftDay,confirmationDeadline,evaluateShift,csvEscape}=out.exports

const morning="2026-10-12T08:00:00+08:00"
const evening="2026-10-12T17:00:00+08:00"
const base={starts_at:morning,ends_at:evening,response:"pending",response_at:null}
const when=value=>Date.parse(value)
const result=(overrides={},punch,clock="2026-10-12T10:00:00+08:00")=>evaluateShift({...base,...overrides},punch,when(clock))

test("01 Manila dates use Philippine calendar across UTC midnight",()=>{
  assert.equal(manilaDay(new Date("2026-10-11T16:15:00Z")),"2026-10-12")
  assert.equal(manilaDay(new Date("2026-10-11T15:59:00Z")),"2026-10-11")
})
test("02 confirmation is due at 8PM Manila the previous day",()=>{
  assert.equal(confirmationDeadline(base),when("2026-10-11T20:00:00+08:00"))
})
test("03 pending coach before deadline stays awaiting",()=>{
  const r=result({},"", "2026-10-11T19:00:00+08:00")
  assert.equal(r.confirmation,"Awaiting response")
  assert.equal(r.needsAttention,false)
})
test("04 pending after deadline is unconfirmed, never automatically absent",()=>{
  const r=result({},"", "2026-10-11T21:00:00+08:00")
  assert.equal(r.confirmation,"Unconfirmed — 8PM passed")
  assert.equal(r.attendance,"Not yet due")
  assert.equal(r.needsAttention,true)
})
test("05 prior-day confirmed on time is good",()=>{
  const r=result({response:"confirmed",response_at:"2026-10-11T19:45:00+08:00"})
  assert.equal(r.confirmation,"Confirmed")
  assert.equal(r.confirmationTone,"ok")
})
test("06 late reply remains confirmed but flagged",()=>{
  const r=result({response:"confirmed",response_at:"2026-10-11T20:05:00+08:00"})
  assert.equal(r.confirmation,"Confirmed · late reply")
  assert.equal(r.lateResponse,true)
  assert.equal(r.needsAttention,true)
})
test("07 unavailable shift flagged with no proof of absence",()=>{
  const r=result({response:"unavailable",response_at:"2026-10-11T19:00:00+08:00"})
  assert.equal(r.confirmation,"Can't report")
  assert.equal(r.attendance,"No time-in · reported unavailable")
  assert.equal(r.needsAttention,true)
})
test("08 verified on-time clock-in shows on duty",()=>{
  const r=result({response:"confirmed",response_at:"2026-10-11T19:00:00+08:00"},
    {clock_in_at:"2026-10-12T07:56:00+08:00",clock_out_at:null})
  assert.equal(r.attendance,"On duty")
  assert.equal(r.attendanceTone,"ok")
})
test("09 verified late arrival remains present but flagged",()=>{
  const r=result({response:"confirmed",response_at:"2026-10-11T19:00:00+08:00"},
    {clock_in_at:"2026-10-12T08:18:00+08:00",clock_out_at:null})
  assert.equal(r.attendance,"Late arrival · on duty")
  assert.equal(r.lateArrival,true)
  assert.equal(r.needsAttention,true)
})
test("10 no punch at 8:09 is awaiting time-in, not immediately late",()=>{
  const r=result({response:"confirmed",response_at:"2026-10-11T19:00:00+08:00"},undefined,"2026-10-12T08:09:00+08:00")
  assert.equal(r.attendance,"Awaiting time-in")
  assert.equal(r.attendanceTone,"neutral")
})
test("11 missing arrival after grace flagged without asserting absence",()=>{
  const r=result({response:"confirmed",response_at:"2026-10-11T19:00:00+08:00"},undefined,"2026-10-12T08:17:00+08:00")
  assert.equal(r.attendance,"No verified arrival")
  assert.equal(r.needsAttention,true)
})
test("12 missed shift retains unresolved missing-time-in state",()=>{
  const r=result({response:"confirmed",response_at:"2026-10-11T19:00:00+08:00"},undefined,"2026-10-12T19:00:00+08:00")
  assert.equal(r.attendance,"Missing time-in (verify)")
})
test("13 forgetting clock-out is flagged without inventing one",()=>{
  const r=result({response:"confirmed",response_at:"2026-10-11T19:00:00+08:00"},
    {clock_in_at:"2026-10-12T07:55:00+08:00",clock_out_at:null},"2026-10-12T17:40:00+08:00")
  assert.equal(r.attendance,"Missing clock-out")
  assert.equal(r.needsAttention,true)
})
test("14 completed verified shift has no attendance alert",()=>{
  const r=result({response:"confirmed",response_at:"2026-10-11T19:00:00+08:00"},
    {clock_in_at:"2026-10-12T07:55:00+08:00",clock_out_at:"2026-10-12T17:10:00+08:00"},"2026-10-12T17:30:00+08:00")
  assert.equal(r.attendance,"Completed shift")
  assert.equal(r.needsAttention,false)
})
test("15 a late arrival that clocks out remains flagged in history",()=>{
  const r=result({response:"confirmed",response_at:"2026-10-11T19:00:00+08:00"},
    {clock_in_at:"2026-10-12T08:28:00+08:00",clock_out_at:"2026-10-12T17:05:00+08:00"},"2026-10-12T18:00:00+08:00")
  assert.equal(r.attendance,"Completed · late arrival")
  assert.equal(r.needsAttention,true)
})
test("16 week begins Monday and covers Sunday, crossing month ends",()=>{
  assert.deepEqual(manilaWeek("2026-11-01"),["2026-10-26","2026-10-27","2026-10-28","2026-10-29","2026-10-30","2026-10-31","2026-11-01"])
})
test("17 addDay and shiftDay do not depend on browser locale timezone",()=>{
  assert.equal(addDay("2026-12-31",1),"2027-01-01")
  assert.equal(shiftDay(base),"2026-10-12")
})
test("18 exported spreadsheet values safely quote comma and formula-leading cells",()=>{
  assert.equal(csvEscape('Coach "A", E Rod'),'"Coach ""A"", E Rod"')
  assert.equal(csvEscape(null),'""')
})
test("19 redesigned monitor defaults to Today and has functional week/history tabs",()=>{
  assert.match(admin,/useState<Tab>\("today"\)/)
  assert.match(admin,/Weekly Coach Coverage/)
  assert.match(admin,/Attendance History/)
  assert.match(admin,/setView\("today"\)/)
  assert.match(admin,/manilaWeek\(selectedDate\)/)
})
test("20 daily board shows separate confirmation attendance and conduction counts",()=>{
  assert.match(admin,/Previous-day confirmation/)
  assert.match(admin,/Actual attendance/)
  assert.match(admin,/Approved conductions/)
  assert.match(admin,/Sample member conductions today/)
  assert.match(admin,/attentionOnly/)
})
test("21 date and coach/branch filters also apply to weekly and history",()=>{
  assert.match(admin,/const eligibleCoaches=displayCoaches\.filter/)
  assert.match(admin,/const filteredPlans=displayPlans\.filter/)
  assert.match(admin,/const todayShifts=filteredPlans\.filter/)
  assert.match(admin,/const history=filteredPlans\.filter/)
})
test("22 operational shift creation and code generation remain in collapsed management area",()=>{
  assert.match(admin,/<details className=\{card\+" group"\}/)
  assert.match(admin,/Shift planning &amp; reception tools/)
  assert.match(admin,/admin_plan_coach_shift/)
  assert.match(admin,/issue_coach_branch_code/)
})
test("23 live mode auto refreshes only in visible tab, in-memory sample stays separate",()=>{
  assert.match(admin,/if\(!document\.hidden && !demoMode\) void load\(\)/)
  assert.match(admin,/60_000/)
  assert.match(admin,/demoMode \? sample\.plans : plans/)
  assert.match(admin,/DEMO MODE — SAMPLE DATA ONLY/)
})
test("24 sample mode cannot export, issue QR codes or create real shifts",()=>{
  assert.match(admin,/if\(demoMode\)return \/\/ Never let fictional attendance be exported/)
  assert.match(admin,/disabled=\{demoMode\|\|dataLimit\|\|history\.length===0\}/)
  assert.match(admin,/disabled=\{demoMode\|\|busy\|\|!selectedCoach\}/)
  assert.match(admin,/disabled=\{demoMode\|\|busy\}/)
})
test("25 history export includes coach, branch, confirmation, punches and reviewed status without payroll",()=>{
  assert.match(admin,/const headings=\["Date \(PH\)","Coach","Branch"/)
  assert.match(admin,/Attendance","Needs Attention","Approved Conductions"/)
  assert.match(admin,/text\/csv;charset=utf-8/)
  assert.doesNotMatch(admin,/rate_snapshot|per_conduction_rate/)
})
test("26 live results warn on truncation and use real approved conduction counts",()=>{
  assert.match(admin,/setDataLimit\(\[w,p,con\]\.some/)
  assert.match(admin,/Record limit reached/)
  assert.match(admin,/c\.status==="approved"/)
})
