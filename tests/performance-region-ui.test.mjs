import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
const proxy=fs.readFileSync("proxy.ts","utf8")
const auth=fs.readFileSync("lib/supabase/proxy.ts","utf8")
const member=fs.readFileSync("app/member/dashboard/page.tsx","utf8")
const memberLoader=fs.readFileSync("app/member/dashboard/loading.tsx","utf8")
const directory=fs.readFileSync("app/staff/members/page.tsx","utf8")
const directoryLoader=fs.readFileSync("app/staff/members/loading.tsx","utf8")
const profile=fs.readFileSync("app/staff/members/[id]/page.tsx","utf8")
const profileLoader=fs.readFileSync("app/staff/members/[id]/loading.tsx","utf8")
const welcome=fs.readFileSync("app/welcome/page.tsx","utf8")
const memberData=fs.readFileSync("lib/member-account-server.ts","utf8")

test("01 public welcome is excluded from proxy auth calls",()=>{
 assert.match(proxy,/welcome\(\?:\/\|\$\)/)
})
test("02 public guest self-registration excluded from proxy auth calls",()=>{
 assert.match(proxy,/guest\/register\(\?:\/\|\$\)/)
})
test("03 all protected routes still covered by generic matcher",()=>{
 assert.match(proxy,/matcher: \[/)
 assert.match(proxy,/\/\(\(\?!_next\/static/)
 assert.doesNotMatch(proxy,/member\(\?:\/\|\$\)/)
 assert.doesNotMatch(proxy,/staff\(\?:\/\|\$\)/)
})
test("04 auth refresh and validation remains in protected-route proxy",()=>{
 assert.match(auth,/supabase\.auth\.getUser\(\)/)
 assert.match(proxy,/updateSession\(request\)/)
})
test("05 member dashboard protects on server",()=>{
 assert.match(member,/supabase\.auth\.getUser\(\)/)
 assert.match(member,/loadMemberAccountData\(user\.id\)/)
})
test("06 staff members still checks role",()=>{
 assert.match(directory,/getStaffAccess\(\)/)
 assert.match(fs.readFileSync("lib/staff-access-server.ts","utf8"),/supabase\.auth\.getUser\(\)/)
 assert.match(fs.readFileSync("lib/staff-access-server.ts","utf8"),/role!=="admin" && role!=="staff"/)
})
test("07 member detail still role protected",()=>{
 assert.match(profile,/getStaffAccess\(\)/)
 assert.match(fs.readFileSync("lib/staff-access-server.ts","utf8"),/role!=="admin" && role!=="staff"/)
})
test("08 existing member loading skeleton retained",()=>{
 assert.match(memberLoader,/MemberRouteLoading/)
})
test("09 admin list has immediate route loading state",()=>{
 assert.match(directoryLoader,/aria-live="polite"/)
 assert.match(directoryLoader,/Loading member directory/)
})
test("10 member profile has immediate route loading state",()=>{
 assert.match(profileLoader,/aria-live="polite"/)
 assert.match(profileLoader,/Loading profile and activity/)
})
test("11 welcome media pauses when not visible",()=>{
 assert.match(welcome,/function WelcomeVideo/)
 assert.match(welcome,/else video\.pause\(\)/)
 assert.match(welcome,/<WelcomeVideo src=\{slide\.video\} active=\{active\}\s*\/>/)
})
test("12 hidden onboarding images are not eager priority preload",()=>{
 assert.doesNotMatch(welcome,/priority=\{i === 1\}/)
 assert.match(welcome,/loading="lazy"/)
})
test("13 account aggregation still preserves eligibility checks and package rules",()=>{
 assert.match(memberData,/member_package_eligibility/)
 assert.match(memberData,/member_bearforce_summary/)
 assert.match(memberData,/Promise\.all/)
})
test("14 no database schema, session or payment logic rewritten",()=>{
 assert.doesNotMatch(proxy,/\.from\(|\.rpc\(/)
 assert.doesNotMatch(welcome,/\.from\(|\.rpc\(/)
 assert.doesNotMatch(directoryLoader,/supabase\.from\(|supabase\.rpc\(/)
})
