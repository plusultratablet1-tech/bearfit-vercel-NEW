import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import ts from "typescript"
const read=path=>fs.readFileSync(path,"utf8")
function load(path,deps={}){
 const output=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const exports={}
 new Function("require","exports",output)((name)=>{if(!(name in deps))throw Error("Unexpected dependency: "+name);return deps[name]},exports)
 return exports
}
const branches=load("lib/branches.ts")
const adminHome=load("lib/admin-home.ts",{"@/lib/branches":branches})
const m=load("lib/daily-reconciliation.ts",{"@/lib/branches":branches,"@/lib/admin-home":adminHome})
const server=read("app/staff/reconciliation/page.tsx")
const client=read("app/staff/reconciliation/ReconciliationClient.tsx")
const nav=read("components/bearfit/StaffPersistentShell.tsx")
const home=read("app/staff/home/AdminHomeClient.tsx")
const a="Malingap Branch",b="E. Rodriguez Branch",c="Primark Cainta"
const date="2026-10-14"
const base=()=>({date,members:[],coaches:[],paid:[],flagged:[],missingPaidDate:[],attendance:[],bookings:[],plans:[],clockins:[],conductions:[],guests:[],failed:[]})
const member=(id,branch,is_demo=false)=>({id,member_code:"M"+id,full_name:"Member",branch,is_demo})
const coach=(id,branch,is_demo=false)=>({id,display_name:"Coach",branch,is_demo})
const payment=(id,member_id,amount,status="paid")=>({id,member_id,amount,status,paid_at:"2026-10-14T02:00:00Z",created_at:"2026-10-14T02:00:00Z",payment_type:"cash"})
test("01 valid Philippines-local day has exact UTC start and end",()=>{
 assert.deepEqual(m.dayWindow(date),{from:"2026-10-13T16:00:00.000Z",to:"2026-10-14T16:00:00.000Z"})
})
test("02 date picker rejects malformed, impossible and future dates",()=>{
 const now=new Date("2026-10-14T06:00:00Z")
 assert.equal(m.selectedDay("2026-10-14",now),date)
 for(const bad of ["2026-02-30","2026-10-15","../secret","2024-12-31","2026-6-3"]){
  assert.equal(m.selectedDay(bad,now),date)
 }
})
test("03 includes exactly the three approved branches",()=>{
 assert.deepEqual(branches.BRANCH_IDS,[a,b,c])
 assert.equal(m.ALL_BRANCHES,"ALL")
})
test("04 live paid amount joins to correct member branch, not guessed from payment",()=>{
 const d=base()
 d.members=[member("1",a),member("2",b),member("3",c)]
 d.paid=[payment("p1","1",100),payment("p2","2",220),payment("p3","3",330)]
 assert.equal(m.reconciliationStats(d,a).recordedPaid,100)
 assert.equal(m.reconciliationStats(d,c).recordedPaid,330)
 assert.equal(m.reconciliationStats(d,m.ALL_BRANCHES).recordedPaid,650)
})
test("05 demo members never inflate totals or guest host reconciliation",()=>{
 const d=base()
 d.members=[member("real",c),member("fake",c,true)]
 d.paid=[payment("1","real",200),payment("2","fake",9900)]
 d.attendance=[{id:"v1",member_id:"real",booking_id:null,trained_at:"",session_label:"Pilates"},{id:"v2",member_id:"fake",booking_id:null,trained_at:"",session_label:"Pilates"}]
 d.guests=[{id:"g",branch:c,host_member_id:"fake",status:"entered",purpose:"visitor",visit_day:date,entered_at:"x",amount_verified:100,payment_reference:null}]
 const stats=m.reconciliationStats(d,c)
 assert.equal(stats.recordedPaid,200)
 assert.equal(stats.memberVisits,1)
 assert.equal(stats.guestEntries,0)
})
test("06 inactive demo coaches are excluded from shifts and conductions",()=>{
 const d=base()
 d.members=[member("real",c)]
 d.coaches=[coach("realCoach",c),coach("fake",c,true)]
 d.conductions=[{id:"c1",member_id:"real",coach_id:"fake",branch:c,status:"approved",session_date:date,rate_snapshot:100},{id:"c2",member_id:"real",coach_id:"realCoach",branch:c,status:"approved",session_date:date,rate_snapshot:100}]
 d.clockins=[{id:"w1",coach_id:"fake",branch:c,clock_in_at:"",clock_out_at:null},{id:"w2",coach_id:"realCoach",branch:c,clock_in_at:"",clock_out_at:null}]
 const result=m.reconciliationStats(d,c)
 assert.equal(result.conductionsApproved,1)
 assert.equal(result.coachClockins,1)
})
test("07 recorded PAID is not mistakenly treated as bank reconciliation",()=>{
 assert.match(client,/Recorded transactions only; not bank or cash verified/)
 assert.match(client,/does not verify bank settlements/)
 assert.match(client,/not a signed daily closing report/)
})
test("08 imported legacy pending member labels are never counted as transactions",()=>{
 const d=base()
 d.members=[{...member("1",b),payment_status:"pending"}]
 assert.equal(m.reconciliationStats(d,b).flaggedCount,0)
})
test("09 flagged transactions do not inflate recorded PAID collections",()=>{
 const d=base()
 d.members=[member("1",a)]
 d.flagged=[payment("p","1",999,"pending")]
 assert.equal(m.reconciliationStats(d,a).recordedPaid,0)
 assert.equal(m.reconciliationStats(d,a).flaggedCount,1)
})
test("10 orphan and demo-linked payments remain unmatched rather than attributed",()=>{
 const d=base()
 d.members=[member("fake",c,true)]
 d.paid=[payment("o","missing",999),payment("f","fake",100)]
 assert.equal(m.reconciliationStats(d,m.ALL_BRANCHES).unassignedPayments,2)
 assert.equal(m.reconciliationStats(d,c).recordedPaid,0)
 assert.equal(m.reconciliationStats(d,c).unassignedPayments,0)
})
test("11 member walk-in session does not automatically become exception or duplicate deduction",()=>{
 const d=base()
 d.members=[member("1",a)]
 d.attendance=[{id:"1",member_id:"1",booking_id:null,trained_at:"",session_label:"fitness"}]
 assert.equal(m.reconciliationStats(d,a).memberVisits,1)
 assert.equal(m.reconciliationStats(d,a).memberWalkins,1)
 assert.doesNotMatch(server,/\.insert\(|\.update\(|\.delete\(/)
})
test("12 historical confirmed booking after end and without linked log is a potential investigation",()=>{
 const d=base()
 d.members=[member("1",a)]
 d.bookings=[{id:"b",member_id:"1",branch:a,status:"confirmed",start_at:"2026-10-14T00:00:00Z",end_at:"2026-10-14T01:00:00Z"}]
 assert.equal(m.reconciliationStats(d,a,new Date("2026-10-14T06:00:00Z")).possibleMissingCheckins,1)
 d.attendance=[{id:"v",member_id:"1",booking_id:"b",trained_at:"",session_label:null}]
 assert.equal(m.reconciliationStats(d,a,new Date("2026-10-14T06:00:00Z")).possibleMissingCheckins,0)
})
test("13 future bookings and bookings without end time are not called misses",()=>{
 const d=base()
 d.members=[member("1",a)]
 d.bookings=[{id:"1",member_id:"1",branch:a,status:"confirmed",end_at:null,start_at:""},{id:"2",member_id:"1",branch:a,status:"confirmed",end_at:"2026-10-14T18:00:00Z",start_at:""}]
 assert.equal(m.reconciliationStats(d,a,new Date("2026-10-14T06:00:00Z")).possibleMissingCheckins,0)
})
test("14 guest entries count entered_at, not mere registration",()=>{
 const d=base()
 d.guests=[{id:"g1",branch:c,host_member_id:null,status:"pending_approval",purpose:"trial",visit_day:date,entered_at:null,amount_verified:null,payment_reference:null},{id:"g2",branch:c,host_member_id:null,status:"entered",purpose:"paid",visit_day:date,entered_at:"x",amount_verified:200,payment_reference:"R"}]
 const r=m.reconciliationStats(d,c)
 assert.equal(r.guestEntries,1)
 assert.equal(r.guestPending,1)
 assert.equal(r.guestRecordedAmount,200)
 assert.equal(r.recordedPaid,0)
})
test("15 confirmed and accepted coach shifts do not count as unconfirmed",()=>{
 const d=base()
 d.coaches=[coach("c",a)]
 d.plans=[{id:"1",branch:a,coach_id:"c",starts_at:"",response:"confirmed"},{id:"2",branch:a,coach_id:"c",starts_at:"",response:"accepted"},{id:"3",branch:a,coach_id:"c",starts_at:"",response:null}]
 assert.equal(m.reconciliationStats(d,a).unconfirmedPlans,1)
})
test("16 approved coach conductions are counted separately from pending",()=>{
 const d=base()
 d.members=[member("m",c)]
 d.coaches=[coach("c",c)]
 d.conductions=[{id:"a",member_id:"m",coach_id:"c",branch:c,status:"approved",session_date:date,rate_snapshot:100},{id:"b",member_id:"m",coach_id:"c",branch:c,status:"pending",session_date:date,rate_snapshot:null}]
 assert.equal(m.reconciliationStats(d,c).conductionsApproved,1)
 assert.equal(m.reconciliationStats(d,c).conductionsForReview,1)
})
test("17 failed or truncated data is never reported as a verified zero",()=>{
 const d={...base(),failed:["members","paid-limit"]}
 assert.equal(m.dataComplete(d,"members","paid"),false)
 assert.match(client,/data.failed.join/)
 assert.match(client,/Affected values are shown as unavailable/)
 assert.match(client,/disabled=\{!complete\}/)
})
test("18 protected Admin-only page uses signed-in RLS client",()=>{
 assert.match(server,/await getStaffAccess\(\)/)
 assert.match(server,/role!=="admin"\)redirect\("\/staff\/schedule"\)/)
 assert.match(server,/\.select\(/)
 assert.doesNotMatch(server,/service_role|createAdminClient|\.rpc\(|\.insert\(|\.update\(|\.delete\(/)
})
test("19 day scoping is applied to each event source, not all-time records",()=>{
 for(const key of ["paid_at","created_at","trained_at","start_at","starts_at","clock_in_at"]){
  assert.ok(server.includes('.gte("'+key+'",from)'),"Date filter missing for "+key)
 }
 assert.match(server,/\.eq\("session_date",date\)/)
 assert.match(server,/\.eq\("visit_day",date\)/)
})
test("20 official financial and payroll state remains untouched",()=>{
 for(const source of [server,client,nav,home]){
  assert.doesNotMatch(source,/\.from\("(?:coach_payroll_cutoffs|member_package_cycles)"\)\.update/)
 }
 assert.match(client,/no.*signed daily closing report/)
})
test("21 Admin navigation links the new view, Staff navigation excludes it",()=>{
 assert.match(nav,/href: "\/staff\/reconciliation"/)
 assert.match(nav,/item.href!=="\/staff\/reconciliation"/)
 assert.match(home,/href="\/staff\/reconciliation"/)
})
test("22 CSV download is blocked if any data source failed",()=>{
 assert.match(client,/if\(!complete\)return/)
 assert.match(client,/Export CSV/)
 assert.match(client,/not.*bank/)
})
