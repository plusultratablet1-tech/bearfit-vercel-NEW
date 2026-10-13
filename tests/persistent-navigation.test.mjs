import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
const read=(path)=>fs.readFileSync(path,"utf8")
const staffLayout=read("app/staff/layout.tsx")
const memberLayout=read("app/member/layout.tsx")
const staffFrame=read("components/bearfit/StaffPersistentShell.tsx")
const memberFrame=read("components/bearfit/MemberPersistentShell.tsx")
const staffWrapper=read("components/bearfit/StaffAppShell.tsx")
const memberWrapper=read("components/bearfit/MemberAppShell.tsx")
const dashboard=read("components/bearfit/BearfitDashboardClient.tsx")
const memberLoading=read("components/bearfit/MemberRouteLoading.tsx")
const staffLoading=read("app/staff/loading.tsx")
const staffMembersLoading=read("app/staff/members/loading.tsx")
const memberProfileLoading=read("app/staff/members/[id]/loading.tsx")
const paymentAlias=read("app/staff/payments/page.tsx")
const checkinAlias=read("app/staff/checkin/page.tsx")
const oldPayment=read("app/payments/page.tsx")
const oldCheckin=read("app/checkin/page.tsx")

test("01 staff app layout owns persistent navigation frame",()=>{
 assert.match(staffLayout,/StaffPersistentShell/)
 assert.match(staffLayout,/<StaffPersistentShell role=\{role\}>\{children\}/)
})
test("02 staff shared frame does not recreate nav per page",()=>{
 assert.match(staffFrame,/<aside/)
 assert.match(staffFrame,/<nav/)
 assert.match(staffFrame,/Mobile app navigation|app navigation/)
 assert.doesNotMatch(staffWrapper,/<nav|<aside/)
})
test("03 member app layout owns persistent member navigation frame",()=>{
 assert.match(memberLayout,/MemberPersistentShell/)
 assert.match(memberLayout,/<MemberPersistentShell>\{children\}/)
})
test("04 member shared frame owns only sidebar and mobile tab bar",()=>{
 assert.match(memberFrame,/<aside/)
 assert.match(memberFrame,/<nav/)
 assert.doesNotMatch(memberWrapper,/<aside|<nav/)
})
test("05 protected staff role is validated server-side",()=>{
 assert.match(staffLayout,/supabase\.auth\.getUser\(\)/)
 assert.match(staffLayout,/\.from\("profiles"\)\.select\("role"\)/)
 assert.match(staffLayout,/role!=="admin" && role!=="staff"/)
})
test("06 member page auth remains in existing server route",()=>{
 const page=read("app/member/dashboard/page.tsx")
 assert.match(page,/auth\.getUser\(\)/)
 assert.match(page,/loadMemberAccountData\(user\.id\)/)
})
test("07 active tab reflects actual URL even on nested routes",()=>{
 assert.match(staffFrame,/usePathname\(\)/)
 assert.match(staffFrame,/activePath\.startsWith\(item\.href \+ "\/"\)/)
 assert.match(memberFrame,/usePathname\(\)/)
 assert.match(memberFrame,/activePath\.startsWith\(item\.href \+ "\/"\)/)
})
test("08 member dashboard no longer renders its own duplicate nav",()=>{
 assert.doesNotMatch(dashboard,/<aside|MobileNavItem|navItems\.map/)
 assert.match(dashboard,/Welcome,/)
})
test("09 all route loaders render placeholders without sidebar/navigation",()=>{
 for(const loader of [memberLoading,staffLoading,staffMembersLoading,memberProfileLoading]){
  assert.doesNotMatch(loader,/<aside|<nav|fixed inset-x-0 bottom-0/)
  assert.match(loader,/aria-live="polite"/)
 }
})
test("10 staff Check-In and Payments main tabs remain in persistent layout",()=>{
 assert.match(staffFrame,/href: "\/staff\/checkin"/)
 assert.match(staffFrame,/href: "\/staff\/payments"/)
 assert.match(checkinAlias,/from "@\/app\/checkin\/page"/)
 assert.match(paymentAlias,/from "@\/app\/payments\/page"/)
})
test("11 original payment and checkin routes remain protected",()=>{
 assert.match(oldPayment,/supabase\.auth\.getUser\(\)/)
 assert.match(oldCheckin,/supabase\.auth\.getUser\(\)/)
 assert.match(oldPayment,/role !== "staff" && role !== "admin"/)
 assert.match(oldCheckin,/role !== "staff" && role !== "admin"/)
})
test("12 legacy checkin/payment screens still show their navigation",()=>{
 assert.match(staffWrapper,/usePathname\(\)/)
 assert.match(staffWrapper,/return <StaffPersistentShell role=\{role\}>/)
 assert.match(staffWrapper,/pathname\.startsWith\("\/staff\/"\)/)
})
test("13 member navigation still has real Schedule Rewards Payments Profile links",()=>{
 for(const path of ["/member/dashboard","/member/schedule","/member/rewards","/member/payments","/member/profile"])assert.ok(memberFrame.includes(path))
})
test("14 staff navigation still has access to Members Schedule Coaches Guests Packages Rewards",()=>{
 for(const path of ["/staff/schedule","/staff/coaches","/staff/members","/staff/guests","/staff/packages","/staff/rewards"])assert.ok(staffFrame.includes(path))
})
test("15 member and staff logout actions still present",()=>{
 assert.match(memberFrame,/supabase\.auth\.signOut\(\)/)
 assert.match(staffFrame,/supabase\.auth\.signOut\(\)/)
})
test("16 no package payments guest or payroll logic touched by navigation refactor",()=>{
 for(const text of [staffFrame,memberFrame,staffLayout,memberLayout]){
  assert.doesNotMatch(text,/update public\.|\.from\("payments"\)|\.rpc\("admin_/)
 }
})


test("17 member profile and package actions stay within persistent staff routes",()=>{
 const details=read("app/staff/members/[id]/page.tsx")
 const packages=read("app/staff/packages/StaffPackagesPageClient.tsx")
 assert.match(details,/\/staff\/checkin/)
 assert.match(details,/\/staff\/payments\?memberId=/)
 assert.match(packages,/\/staff\/payments\?\$\{params\.toString\(\)\}/)
})
