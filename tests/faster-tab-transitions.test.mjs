import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
const read=(path)=>fs.readFileSync(path,"utf8")
const ctx=read("lib/staff-access-server.ts")
const staffLayout=read("app/staff/layout.tsx")
const pages=[
 "app/staff/schedule/page.tsx",
 "app/staff/coaches/page.tsx",
 "app/staff/members/page.tsx",
 "app/staff/rewards/page.tsx",
 "app/staff/packages/page.tsx",
 "app/staff/guests/page.tsx",
 "app/staff/coaches/attendance/page.tsx",
 "app/staff/members/[id]/page.tsx",
 "app/staff/members/[id]/edit/page.tsx",
 "app/payments/page.tsx",
 "app/checkin/page.tsx"
]
const staffFrame=read("components/bearfit/StaffPersistentShell.tsx")
const memberFrame=read("components/bearfit/MemberPersistentShell.tsx")
const proxy=read("lib/supabase/proxy.ts")
test("01 staff auth is request-scoped React cache, not persistent process-level cache",()=>{
 assert.match(ctx,/import \{cache\} from "react"/)
 assert.match(ctx,/getStaffAccess = cache\(async \(\) =>/)
 assert.doesNotMatch(ctx,/unstable_cache|use cache|localStorage|globalThis/)
})
test("02 shared staff layout and main staff pages reuse the same access helper",()=>{
 assert.match(staffLayout,/await getStaffAccess\(\)/)
 for(const file of pages)assert.match(read(file),/await getStaffAccess\(\)/,file)
})
test("03 staff pages avoid duplicate network-level getUser checks",()=>{
 for(const file of pages){
  const code=read(file)
  assert.doesNotMatch(code,/\.auth\.getUser\(\)/,file)
  assert.doesNotMatch(code,/\.from\("profiles"\)\.select\("role"\)/,file)
 }
})
test("04 helper validates session and staff role using Supabase, fails closed",()=>{
 assert.match(ctx,/supabase\.auth\.getUser\(\)/)
 assert.match(ctx,/if\(error \|\| !user\) redirect\("\/login"\)/)
 assert.match(ctx,/if\(profileError\) throw new Error/)
 assert.match(ctx,/role!=="admin" && role!=="staff"/)
})
test("05 cache shares the RLS-scoped Supabase client and authenticated user",()=>{
 assert.match(ctx,/return \{supabase,user,role\}/)
 assert.match(read("app/staff/schedule/page.tsx"),/currentUserId=\{user\.id\}/)
 assert.match(read("app/staff/members/page.tsx"),/\.from\("members"\)/)
})
test("06 Admin-only guests, attendance and edits still require Admin",()=>{
 for(const path of ["app/staff/guests/page.tsx","app/staff/coaches/attendance/page.tsx","app/staff/members/[id]/edit/page.tsx"])
  assert.match(read(path),/if\(role!=="admin"\)/,path)
})
test("07 proxy still verifies sessions on real page requests",()=>{
 assert.match(proxy,/supabase\.auth\.getUser\(\)/)
 assert.match(read("proxy.ts"),/updateSession\(request\)/)
})
test("08 no background prefetch of every data-heavy admin page",()=>{
 assert.match(staffFrame,/prefetch=\{item\.href==="\/staff\/schedule" \|\| item\.href==="\/staff\/members" \? true : undefined\}/)
 assert.doesNotMatch(staffFrame,/prefetch=\{true\}/)
 assert.match(memberFrame,/prefetch=\{item\.href==="\/member\/schedule" \? true : undefined\}/)
})
test("09 both navs prefetch on hover, focus and touch intent",()=>{
 for(const code of [staffFrame,memberFrame]){
  assert.match(code,/onPointerEnter=\{\(\)=>router\.prefetch\(item\.href\)\}/)
  assert.match(code,/onFocus=\{\(\)=>router\.prefetch\(item\.href\)\}/)
  assert.match(code,/onTouchStart=\{\(\)=>router\.prefetch\(item\.href\)\}/)
 }
})
test("10 auth and role not stored in cross-request application cache",()=>{
 assert.doesNotMatch(ctx,/revalidateTag|cacheTag|revalidatePath|unstable_cache|persist/i)
})
test("11 no membership, payment, booking, guest or coach payroll writes introduced",()=>{
 for(const code of [ctx,staffLayout,staffFrame,memberFrame]){
  assert.doesNotMatch(code,/supabase\.from\(["'](?:members|payments|bookings|coach_conductions|guest_invites)["']\)\.(insert|update|delete)/)
 }
})
