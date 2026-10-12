import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import ts from "typescript"
import { createRequire } from "node:module"

const dataFile = fs.readFileSync("lib/coach-attendance-demo.ts","utf8")
const admin = fs.readFileSync("app/staff/coaches/attendance/CoachAttendanceAdminClient.tsx","utf8")
const board = fs.readFileSync("lib/coach-attendance-board.ts","utf8")

// Compile the presentation-only fixture for runtime tests without starting Next.js
// or issuing a database request.
const compiled = ts.transpileModule(dataFile,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText
const testingModule = {exports:{}}
new Function("module","exports",compiled)(testingModule,testingModule.exports)
const {buildCoachAttendanceDemo} = testingModule.exports

const today = new Date("2026-10-12T08:32:00Z") // 4:32 PM PH

test("demo generates four real-looking but non-UUID identities",()=>{
  const d=buildCoachAttendanceDemo(today)
  assert.equal(d.coaches.length,4)
  assert.deepEqual(d.coaches.map(c=>[c.username,c.display_name]),[
    ["coach1","Amiel"],["coach2","Joaquin"],["coach3","Andrei"],["coach4","Hunejin"],
  ])
  assert.ok(d.coaches.every(c=>c.id.startsWith("demo-")))
  assert.ok(d.coaches.every(c=>c.user_id===null))
})

test("sample shifts use relative Philippine local days and date offsets",()=>{
  const d=buildCoachAttendanceDemo(today)
  assert.equal(d.plans.length,6)
  assert.equal(d.plans[0].starts_at,"2026-10-12T08:00:00+08:00")
  assert.equal(d.plans[4].starts_at,"2026-10-11T08:00:00+08:00")
  assert.equal(d.plans[5].starts_at,"2026-10-13T08:00:00+08:00")
  assert.ok(d.plans.every(p=>p.id.startsWith("demo-")))
})

test("demo responses cover confirmed, no reply and cannot report with reason",()=>{
  const d=buildCoachAttendanceDemo(today)
  const states = new Set(d.plans.map(s=>s.response))
  assert.deepEqual([...states].sort(),["confirmed","pending","unavailable"])
  assert.match(d.plans[3].unavailable_reason,/unable to report/i)
  assert.equal(d.plans[2].response_at,null)
})

test("late clock-in is represented without fabricating a missing time punch",()=>{
  const d=buildCoachAttendanceDemo(today)
  const late=d.punches.find(p=>p.work_shift_id==="demo-shift-2")
  assert.ok(late)
  assert.equal(late.clock_in_at,"2026-10-12T09:18:00+08:00")
  assert.equal(d.punches.find(p=>p.work_shift_id==="demo-shift-3"),undefined)
  assert.equal(d.punches.find(p=>p.work_shift_id==="demo-shift-4"),undefined)
})

test("demo sample conduction totals are explicitly disconnected from payroll",()=>{
  const d=buildCoachAttendanceDemo(today)
  assert.deepEqual(Object.values(d.sampleConductions),[6,3,0,0])
  assert.match(dataFile,/neither member balances nor payroll are calculated/)
  assert.doesNotMatch(dataFile,/\bsupabase\b\.|\bfetch\(/)
})

test("dates move with Manila calendar and month/year boundaries",()=>{
  const d=buildCoachAttendanceDemo(new Date("2027-01-01T01:00:00Z"))
  assert.equal(d.plans[0].starts_at,"2027-01-01T08:00:00+08:00")
  assert.equal(d.plans[4].starts_at,"2026-12-31T08:00:00+08:00")
  assert.equal(d.plans[5].starts_at,"2027-01-02T08:00:00+08:00")
})

test("sample view is the default and has a clear demo warning",()=>{
  assert.match(admin,/const \[demoMode,setDemoMode\]=useState\(true\)/)
  assert.match(admin,/DEMO MODE — SAMPLE DATA ONLY/)
  assert.match(admin,/All entries are fictional examples/)
})

test("live mode can be selected and never mixes sample rows with live rows",()=>{
  assert.match(admin,/demoMode \? sample\.coaches : coaches/)
  assert.match(admin,/demoMode \? sample\.plans : plans/)
  assert.match(admin,/demoMode \? sample\.punches : punches/)
  assert.match(admin,/aria-pressed=\{!demoMode\}/)
})

test("demo disallows creating work shifts or branch attendance codes",()=>{
  assert.match(admin,/if \(demoMode\) \{ setError\("Switch to Live Data before creating a real shift/)
  assert.match(admin,/if \(demoMode\) \{ setError\("Switch to Live Data before issuing an actual attendance code/)
  assert.match(admin,/disabled=\{demoMode\|\|busy\|\|!selectedCoach\}/)
  assert.match(admin,/disabled=\{demoMode\|\|busy\}/)
})

test("sample mode hides real-issued attendance codes and real database errors",()=>{
  assert.match(admin,/issued&&!demoMode/)
  assert.match(admin,/error&&!demoMode/)
  assert.match(admin,/notice&&!demoMode/)
})

test("sample mode visually distinguishes fictional metrics and conductions",()=>{
  assert.match(admin,/Sample coaches/)
  assert.match(admin,/Sample time-ins/)
  assert.match(admin,/Sample alerts/)
  assert.match(admin,/Sample member conductions today/)
  assert.match(admin,/not payable/)
})

test("a late check-in becomes an alert while maintaining verified attendance status",()=>{
  assert.match(board,/Date\.parse\(punch\.clock_in_at\) > start \+ 15 \* 60_000/)
  assert.match(board,/Late arrival/)
  assert.match(admin,/clock_in_at\?fmt\(p.clock_in_at\)/)
})
