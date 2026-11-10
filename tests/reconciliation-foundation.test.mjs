import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import ts from "typescript"

const read=p=>fs.readFileSync(p,"utf8")
function load(p,deps={}){
 const js=ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const exports={}
 new Function("require","exports",js)((name)=>{if(!(name in deps))throw Error("Unexpected dependency "+name);return deps[name]},exports)
 return exports
}
const branches=load("lib/branches.ts")
const adminHome=load("lib/admin-home.ts",{"@/lib/branches":branches})
const {reconciliationStats,dataComplete}=load("lib/daily-reconciliation.ts",{"@/lib/branches":branches,"@/lib/admin-home":adminHome})
const page=read("app/staff/reconciliation/page.tsx")
const client=read("app/staff/reconciliation/ReconciliationClient.tsx")
const migration=read("supabase/migrations/20261014170000_reconciliation_case_foundation.sql")
const a="Malingap Branch",b="E. Rodriguez Branch",c="Primark Cainta"
function fixture(){return {date:"2026-10-14",members:[],coaches:[],paid:[],flagged:[],missingPaidDate:[],attendance:[],bookings:[],linkedBookings:[],plans:[],clockins:[],conductions:[],guests:[],failed:[]}}
const member=(id,branch,is_demo=false)=>({id,member_code:id,full_name:id,branch,is_demo})
const booking=(id,member_id,branch)=>({id,member_id,branch,status:"completed",start_at:"2026-10-14T03:00:00Z",end_at:"2026-10-14T04:00:00Z"})
const visit=(id,member_id,booking_id=null)=>({id,member_id,booking_id,trained_at:"2026-10-14T03:00:00Z",session_label:"Fitness"})

test("01 booked check-in uses the historical booking branch over changed member branch",()=>{
 const d=fixture();d.members=[member("one",b)];d.bookings=[booking("bk","one",a)];d.attendance=[visit("v","one","bk")]
 assert.equal(reconciliationStats(d,a).memberVisits,1)
 assert.equal(reconciliationStats(d,b).memberVisits,0)
 assert.equal(reconciliationStats(d,a).bookingBranchMismatches,1)
})
test("02 related booking loaded from adjacent local day still attributes correctly",()=>{
 const d=fixture();d.members=[member("one",b)];d.linkedBookings=[booking("bk","one",c)];d.attendance=[visit("v","one","bk")]
 assert.equal(reconciliationStats(d,c).memberVisits,1)
 assert.equal(reconciliationStats(d,b).memberVisits,0)
})
test("03 unknown booking excluded from branches and sent to all-branches review",()=>{
 const d=fixture();d.members=[member("one",b)];d.attendance=[visit("v","one","absent")]
 assert.equal(reconciliationStats(d,b).memberVisits,0)
 assert.equal(reconciliationStats(d,"ALL").unattributedBookedVisits,1)
})
test("04 source booking belongs to a different member, so no visit is counted",()=>{
 const d=fixture();d.members=[member("one",a),member("two",b)];d.bookings=[booking("bk","two",b)];d.attendance=[visit("v","one","bk")]
 assert.equal(reconciliationStats(d,"ALL").memberVisits,0)
 assert.equal(reconciliationStats(d,"ALL").unattributedBookedVisits,1)
})
test("05 manual walk-ins stay attributed to real member branch",()=>{
 const d=fixture();d.members=[member("one",b)];d.attendance=[visit("v","one")]
 assert.equal(reconciliationStats(d,b).memberVisits,1)
 assert.equal(reconciliationStats(d,b).memberWalkins,1)
})
test("06 demo linked attendance is excluded from real operational counts",()=>{
 const d=fixture();d.members=[member("fake",c,true)];d.bookings=[booking("bk","fake",c)];d.attendance=[visit("v","fake","bk")]
 assert.equal(reconciliationStats(d,"ALL").memberVisits,0)
 assert.equal(reconciliationStats(d,"ALL").unattributedBookedVisits,0)
})
test("07 linked booking failure makes reliant metrics incomplete",()=>{
 const d={...fixture(),failed:["linkedBookings-limit"]}
 assert.equal(dataComplete(d,"members","attendance","bookings","linkedBookings"),false)
 assert.match(client,/disabled=\{!complete\}/)
})
test("08 related booking fetch is bounded and admin-only, with no mutation",()=>{
 assert.match(page,/role!=="admin"/)
 assert.match(page,/\.in\("id",missingBookingIds\)\.limit\(200\)/)
 assert.match(page,/missingBookingIds\.length>200/)
 assert.doesNotMatch(page,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/)
})
test("09 payment disclaimer never claims historical member-branch accuracy",()=>{
 assert.match(client,/Payments use the member's present branch/)
 assert.match(client,/historical payment branch snapshots/)
})
test("10 schema additive, with no changes to existing financial or member tables",()=>{
 assert.match(migration,/create table if not exists public\.reconciliation_cases/)
 assert.match(migration,/create table if not exists public\.reconciliation_case_events/)
 assert.doesNotMatch(migration,/(?:update|delete from|insert into|alter table) public\.(?:members|payments|session_logs|bookings|coaches|guest_invites|coach_conductions|coach_payroll_cutoffs)\b/i)
})
test("11 new exposed tables require Admin RLS and forbid authenticated writes",()=>{
 assert.match(migration,/alter table public\.reconciliation_cases enable row level security/)
 assert.match(migration,/alter table public\.reconciliation_case_events enable row level security/)
 assert.match(migration,/revoke all on public\.reconciliation_cases,public\.reconciliation_case_events from public,anon,authenticated/)
 assert.match(migration,/grant select on public\.reconciliation_cases,public\.reconciliation_case_events to authenticated/)
 assert.match(migration,/p\.role='admin'/g)
 assert.doesNotMatch(migration,/grant (?:insert|update|delete|all) on public\.reconciliation_cases/i)
})
test("12 unique case identity, branch snapshot and immutable event history",()=>{
 assert.match(migration,/unique\(source_kind,source_id,case_day,reason_code\)/)
 assert.match(migration,/Primark Cainta/)
 assert.match(migration,/before update or delete on public\.reconciliation_case_events/)
 assert.match(migration,/Reconciliation history is append-only/)
})
