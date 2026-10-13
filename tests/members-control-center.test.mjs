import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import ts from "typescript"

const pure=fs.readFileSync("lib/member-control-center.ts","utf8")
const membersUI=fs.readFileSync("app/staff/members/StaffMembersPageClient.tsx","utf8")
const route=fs.readFileSync("app/staff/members/page.tsx","utf8")
const details=fs.readFileSync("app/staff/members/[id]/page.tsx","utf8")
const compiled=ts.transpileModule(pure,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const moduleBox={exports:{}}
new Function("module","exports",compiled)(moduleBox,moduleBox.exports)
const {
 memberDisplayName,memberPackage,membershipState,isActiveMember,
 remainingSessions,hasLowSessions,hasPaymentException,paymentLabel,
 needsMemberAttention,isRenewalCandidate,memberAction,urgencyRank,
 matchesMemberView,compareMembers,memberStats,sessionGroup,
}=moduleBox.exports
function record(values={}){
 return {
  id:"00000000-0000-0000-0000-000000000001",member_code:"M0001",membership_id:null,
  name:"Member Test",full_name:"Sample Member",email:null,phone:null,branch:"Malingap Branch",
  coach_name:"Amiel",package_name:"Full 24",package_type:null,status:"active",
  membership_status:"active",total_sessions:24,sessions_used:22,sessions_left:2,
  payment_status:"pending",join_date:"2026-01-01",is_demo:false,...values,
 }
}
const activeLow=record()
const activeZero=record({id:"zero",sessions_left:0})
const activeFine=record({id:"fine",sessions_left:10,sessions_used:14})
const renewal=record({id:"renewal",membership_status:"renewal_due",sessions_left:14})
const inactiveZero=record({id:"inactive",membership_status:"inactive",sessions_left:0})
const failed=record({id:"failed",membership_status:"active",payment_status:"failed",sessions_left:10})
const pending=record({id:"pending",membership_status:"active",payment_status:"pending",sessions_left:10})
const missing=record({id:"missing",sessions_left:null,membership_status:"active",payment_status:null})

test("01 control center displays existing member names without altering source",()=>{
 assert.equal(memberDisplayName(activeLow),"Sample Member")
 assert.equal(memberDisplayName(record({full_name:null})),"Member Test")
 assert.equal(memberPackage(activeLow),"Full 24")
})
test("02 status normalization recognizes source field without assuming active",()=>{
 assert.equal(membershipState(record({membership_status:"renewal_due"})),"renewal_due")
 assert.equal(isActiveMember(inactiveZero),false)
})
test("03 0 to 3 remaining sessions count only ACTIVE members",()=>{
 assert.equal(hasLowSessions(activeLow),true)
 assert.equal(hasLowSessions(activeZero),true)
 assert.equal(hasLowSessions(inactiveZero),false)
 assert.equal(hasLowSessions(activeFine),false)
})
test("04 null sessions are UNKNOWN, not silently converted to zero",()=>{
 assert.equal(remainingSessions(missing),null)
 assert.equal(hasLowSessions(missing),false)
 assert.equal(sessionGroup(missing),"Sessions unknown")
})
test("05 imported pending payment label is unverified and neutral",()=>{
 assert.deepEqual(paymentLabel(pending),{label:"Pending / unverified",tone:"neutral"})
 assert.equal(hasPaymentException(pending),false)
 assert.equal(needsMemberAttention(pending),false)
})
test("06 failed and overdue are genuine payment exceptions",()=>{
 assert.equal(paymentLabel(failed).tone,"attention")
 assert.equal(hasPaymentException(failed),true)
 assert.equal(hasPaymentException(record({payment_status:"overdue"})),true)
})
test("07 unknown payment is not an arrears alert",()=>{
 assert.equal(paymentLabel(missing).tone,"neutral")
 assert.equal(hasPaymentException(missing),false)
})
test("08 renewal list includes explicitly flagged and low-session active only",()=>{
 assert.equal(isRenewalCandidate(renewal),true)
 assert.equal(isRenewalCandidate(activeZero),true)
 assert.equal(isRenewalCandidate(activeLow),true)
 assert.equal(isRenewalCandidate(inactiveZero),false)
 assert.equal(isRenewalCandidate(activeFine),false)
})
test("09 action labels distinguish no sessions, low sessions, and renewal due",()=>{
 assert.equal(memberAction(activeZero).label,"No sessions left")
 assert.equal(memberAction(activeLow).label,"Renewal soon")
 assert.equal(memberAction(renewal).label,"Renewal due")
})
test("10 no urgent attention for merely inactive or pending-payment imported data",()=>{
 assert.equal(needsMemberAttention(inactiveZero),false)
 assert.equal(needsMemberAttention(pending),false)
 assert.equal(needsMemberAttention(failed),true)
})
test("11 ALL ACTIVE ATTENTION and RENEWALS quick views filter correctly",()=>{
 const items=[activeLow,activeFine,renewal,inactiveZero,failed]
 assert.equal(items.filter(x=>matchesMemberView(x,"all")).length,5)
 assert.equal(items.filter(x=>matchesMemberView(x,"active")).length,3)
 assert.equal(items.filter(x=>matchesMemberView(x,"renewals")).length,2)
 assert.equal(items.filter(x=>matchesMemberView(x,"attention")).length,3)
})
test("12 priority sorting puts renewal and exhausted members first",()=>{
 const ordered=[activeFine,activeLow,activeZero,renewal,inactiveZero].sort((a,b)=>compareMembers(a,b,"priority"))
 assert.deepEqual(ordered.map(x=>x.id),["renewal","zero",activeLow.id,"fine","inactive"])
})
test("13 session sort places unknown balances last",()=>{
 const items=[activeLow,activeFine,missing,activeZero]
 assert.deepEqual([...items].sort((a,b)=>compareMembers(a,b,"sessions_asc")).map(x=>x.id),
  ["zero",activeLow.id,"fine","missing"])
 assert.equal([...items].sort((a,b)=>compareMembers(a,b,"sessions_desc")).at(-1).id,"missing")
})
test("14 sort by member name uses sensible alphabetical comparison",()=>{
 const alpha=record({full_name:"Anna",id:"a"})
 const zeta=record({full_name:"Zach",id:"z"})
 assert.deepEqual([zeta,alpha].sort((a,b)=>compareMembers(a,b,"name")).map(x=>x.id),["a","z"])
})
test("15 stats separate renewal pipeline from imported pending payments",()=>{
 const s=memberStats([activeLow,activeZero,activeFine,renewal,inactiveZero,failed,pending,missing])
 assert.equal(s.total,8)
 assert.equal(s.lowSessions,2)
 assert.equal(s.zeroSessions,1)
 assert.equal(s.renewals,3)
 assert.equal(s.explicitRenewalDue,1)
 assert.equal(s.paymentUnverified,7)
 assert.equal(s.paymentExceptions,1)
})
test("16 directory remains read-only and preserves original authenticated RLS-scoped fetch",()=>{
 assert.match(route,/profile\?\.role/)
 assert.match(route,/role !== "staff" && role !== "admin"/)
 assert.match(route,/\.from\("members"\)/)
 assert.match(route,/\.select\(/)
 assert.doesNotMatch(membersUI,/\.from\(["']members["']\)\.update|\.rpc\("admin_update_member/)
})
test("17 existing profile page and link remain unchanged",()=>{
 assert.match(details,/export default async function StaffMemberDetailPage/)
 assert.match(membersUI,/["']\/staff\/members\/["']\+m\.id/)
})
test("18 quick view exposes All, Needs Attention, Renewals, Active",()=>{
 for(const name of ["All Members","Needs Attention","Renewals","Active"])assert.match(membersUI,new RegExp(name))
 assert.match(membersUI,/setQuickView/)
 assert.match(membersUI,/matchesMemberView\(m,quickView\)/)
})
test("19 branch coach package status and search filtering are present",()=>{
 for(const k of ["branchFilter","coachFilter","packageFilter","statusFilter","setSearch","m.member_code"])
  assert.match(membersUI,new RegExp(k.replace(".","\\.")))
})
test("20 compact table, mobile cards and optional desktop card mode all link profiles",()=>{
 assert.match(membersUI,/<table/)
 assert.match(membersUI,/lg:hidden/)
 assert.match(membersUI,/lg:grid/)
 assert.match(membersUI,/setLayout\("cards"\)/)
 assert.match(membersUI,/MemberCard/)
})
test("21 pagination is bounded at 25 and resets on filter changes",()=>{
 assert.match(membersUI,/const PER_PAGE=25/)
 assert.match(membersUI,/Math\.max\(1,Math\.ceil\(ordered\.length\/PER_PAGE\)\)/)
 assert.match(membersUI,/const shownPage=Math\.min\(page,pages\)/)
 assert.match(membersUI,/resetPage\(\)/)
})
test("22 source terminology does not misrepresent pending payments as arrears",()=>{
 assert.match(membersUI,/Payment pending \/ unverified/)
 assert.match(membersUI,/Pending is unverified, not an overdue balance/)
 assert.doesNotMatch(membersUI,/paymentAttention|Payment Attention/)
})
test("23 no new database writes, payment balance mutations, or payroll changes",()=>{
 assert.doesNotMatch(membersUI,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/)
 assert.doesNotMatch(pure,/supabase|fetch\(/i)
})
test("24 grouping supports branch coach package and session buckets",()=>{
 for(const x of ['value="branch"','value="coach"','value="package"','value="sessions"'])
 assert.ok(membersUI.includes(x))
})
