import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import ts from "typescript"
const read=p=>fs.readFileSync(p,"utf8")
const load=(path,dependencies={})=>{
 const js=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const exports={}
 new Function("require","exports",js)((id)=>{if(!(id in dependencies))throw Error("Unexpected import "+id);return dependencies[id]},exports)
 return exports
}
const branches=load("lib/branches.ts")
const ops=load("lib/admin-home.ts",{"@/lib/branches":branches})
const server=read("app/staff/home/page.tsx")
const client=read("app/staff/home/AdminHomeClient.tsx")
const launch=read("app/launch/page.tsx")
const nav=read("components/bearfit/StaffPersistentShell.tsx")
const sql=read("supabase/migrations/20261014100000_primark_cainta_branch.sql")
const schedule=read("app/staff/schedule/StaffSchedulePageClient.tsx")
const taxonomy=read("lib/session-taxonomy.ts")
const date=ops.manilaWindow(new Date("2026-10-14T00:00:00Z"))
const base={members:[],bookings:[],pendingBookings:[],shifts:[],guests:[],pendingPayments:[],paidToday:[],checkins:[],failed:[],todayLabel:date.day,startUtc:date.startUtc,endUtc:date.endUtc}
const a="Malingap Branch",b="E. Rodriguez Branch",c="Primark Cainta"
test("01 branch catalog includes exactly three unique canonical IDs",()=>{
 assert.deepEqual(branches.BRANCH_IDS,[a,b,c])
 assert.equal(new Set(branches.BRANCH_IDS).size,3)
})
test("02 Primark service identity is Pilates and Strength & Conditioning",()=>{
 assert.deepEqual(branches.findBranch(c).services,["Pilates","Strength & Conditioning"])
 assert.equal(branches.findBranch(a).services.length,0)
})
test("03 Philippine date window uses 08:00 offset not UTC midnight",()=>{
 assert.equal(date.day,"2026-10-14")
 assert.equal(date.startUtc,"2026-10-13T16:00:00.000Z")
 assert.equal(date.endUtc,"2026-10-14T16:00:00.000Z")
})
test("04 new branch has zero data without invented activity",()=>{
 assert.equal(ops.statsFor(base,c).members,0)
 assert.equal(ops.statsFor(base,c).recordedPaid,0)
})
test("05 active membership and low-session renewal queue are distinct",()=>{
 const d={...base,members:[
 {id:"1",branch:a,membership_status:"active",status:"active",sessions_left:3,payment_status:"pending"},
 {id:"2",branch:a,membership_status:"inactive",status:"inactive",sessions_left:0,payment_status:"pending"},
 {id:"3",branch:c,membership_status:"renewal_due",status:"renewal_due",sessions_left:20,payment_status:"pending"}]}
 assert.equal(ops.statsFor(d,a).renewals,1)
 assert.equal(ops.statsFor(d,a).active,1)
 assert.equal(ops.statsFor(d,c).renewals,1)
 assert.equal(ops.statsFor(d,ops.ALL_BRANCHES).renewals,2)
})
test("06 pending imported member labels are NOT counted as pending transactions",()=>{
 const d={...base,members:[{id:"1",branch:b,membership_status:"active",status:"active",sessions_left:10,payment_status:"pending"}]}
 assert.equal(ops.statsFor(d,b).paymentsPending,0)
})
test("07 real pending payments join to their member's branch",()=>{
 const d={...base,members:[
 {id:"1",branch:a,membership_status:"active",status:"active",sessions_left:10,payment_status:"pending"},
 {id:"2",branch:c,membership_status:"active",status:"active",sessions_left:5,payment_status:"paid"}
 ],pendingPayments:[{id:"p",member_id:"2",status:"pending",amount:100,paid_at:null}]}
 assert.equal(ops.statsFor(d,c).paymentsPending,1)
 assert.equal(ops.statsFor(d,a).paymentsPending,0)
})
test("08 paid totals never bleed across branches",()=>{
 const d={...base,members:[
 {id:"1",branch:a,membership_status:"active",status:"active",sessions_left:2,payment_status:"paid"},
 {id:"2",branch:c,membership_status:"active",status:"active",sessions_left:2,payment_status:"paid"}
 ],paidToday:[{id:"p1",member_id:"1",amount:500,status:"paid",paid_at:"2026-10-14T00:00:00Z"},{id:"p2",member_id:"2",amount:1200,status:"paid",paid_at:"2026-10-14T01:00:00Z"}]}
 assert.equal(ops.statsFor(d,a).recordedPaid,500)
 assert.equal(ops.statsFor(d,c).recordedPaid,1200)
 assert.equal(ops.statsFor(d,ops.ALL_BRANCHES).recordedPaid,1700)
})
test("09 guest reviews and unconfirmed shifts split correctly",()=>{
 const d={...base,
 guests:[{id:"g",branch:c,status:"pending_approval",visit_day:date.day},{id:"x",branch:a,status:"pending_payment",visit_day:date.day}],
 shifts:[{id:"s",branch:c,response:null,starts_at:date.startUtc},{id:"t",branch:a,response:"confirmed",starts_at:date.startUtc}]
 }
 assert.equal(ops.statsFor(d,c).guestsPending,1)
 assert.equal(ops.statsFor(d,c).shiftUnconfirmed,1)
 assert.equal(ops.statsFor(d,a).shiftUnconfirmed,0)
})
test("10 bookings and attendance are branch-scoped",()=>{
 const d={...base,members:[{id:"m",branch:c,membership_status:"active",status:"active",sessions_left:2,payment_status:"paid"}],
 bookings:[{id:"b",branch:c,status:"confirmed",start_at:date.startUtc,requested_start_at:date.startUtc}],
 pendingBookings:[{id:"p",branch:c,status:"pending",start_at:null,requested_start_at:date.startUtc}],
 checkins:[{id:"x",member_id:"m",trained_at:date.startUtc}]}
 assert.equal(ops.statsFor(d,c).bookings,1)
 assert.equal(ops.statsFor(d,c).pendingBookings,1)
 assert.equal(ops.statsFor(d,c).checkins,1)
 assert.equal(ops.statsFor(d,a).checkins,0)
})
test("11 unexpected branch records do not pollute All branch totals",()=>{
 const d={...base,members:[{id:"orphan",branch:"unknown",membership_status:"active",status:"active",sessions_left:1,payment_status:null}]}
 assert.equal(ops.statsFor(d,ops.ALL_BRANCHES).members,0)
})
test("12 Admin Home is SSR protected, read-only and checks admin role",()=>{
 assert.match(server,/await getStaffAccess\(\)/)
 assert.match(server,/role!=="admin"/)
 assert.match(server,/redirect\("\/staff\/schedule"\)/)
 assert.doesNotMatch(server,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/)
})
test("13 Admin Home loads real records with bounded parallel reads",()=>{
 assert.match(server,/Promise\.all\(\[/)
 for(const t of ["members","bookings","coach_work_shifts","guest_invites","payments","session_logs"])assert.match(server,new RegExp('from\\("'+t+'"\\)'))
 assert.match(server,/\.limit\(1000\)/)
 assert.match(server,/failed/)
})
test("14 client displays unavailable on failed queries instead of zero",()=>{
 assert.match(client,/dataIncomplete/)
 assert.match(client,/\?"—":/)
 assert.match(client,/data.failed.length>0/)
})
test("15 financial numbers described accurately; not bank-reconciled",()=>{
 assert.match(client,/Recorded paid transactions today/)
 assert.match(client,/not bank or cash reconciliation/)
 assert.match(client,/not automatically overdue/)
})
test("16 Admin sees Home and Staff retains Schedule landing",()=>{
 assert.match(nav,/href: "\/staff\/home"/)
 assert.match(nav,/role==="admin"\?navItems:navItems.filter/)
 assert.match(launch,/role === "admin"/)
 assert.match(launch,/redirect\("\/staff\/home"\)/)
 assert.match(launch,/role === "staff"/)
 assert.match(launch,/redirect\("\/staff\/schedule"\)/)
})
test("17 third branch allowed in admin edit, guest and coach workflows",()=>{
 for(const path of ["app/staff/members/[id]/edit/MemberEditClient.tsx","app/staff/guests/GuestControlClient.tsx","app/staff/coaches/directory/CoachDirectoryClient.tsx","app/staff/coaches/attendance/CoachAttendanceAdminClient.tsx"])
  assert.match(read(path),/BRANCH_IDS/)
})
test("18 third-branch validator migration extends only existing branch whitelists",()=>{
 assert.match(sql,/guest_invites_branch_check/)
 assert.match(sql,/guest_access_prices_branch_check/)
 for(const name of ["admin_edit_member_profile","admin_set_guest_price","member_invite_guest","issue_coach_branch_code"])
  assert.match(sql,new RegExp(name))
 assert.match(sql,/Primark Cainta/)
 assert.doesNotMatch(sql,/update public\.members|insert into public\.payments|update public\.payments/)
})
test("19 Primark availability restricted to Pilates and Strength & Conditioning",()=>{
 assert.match(taxonomy,/label: "Strength & Conditioning", category: "fitness"/)
 assert.match(schedule,/availableServices\(recurring.branch\)/)
 assert.match(schedule,/availableServices\(oneOff.branch\)/)
 assert.match(schedule,/Primark Cainta/)
})
test("20 Home remains a review surface and routes to existing workflows",()=>{
 for(const link of ["/staff/members","/staff/schedule","/staff/payments","/staff/guests","/staff/coaches/attendance"])
  assert.ok(client.includes(link),link)
 assert.match(client,/Admin Home is read-only/)
})
