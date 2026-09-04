import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

test("new Bearforce and package settings routes are role protected",()=>{
  for(const file of ["app/member/bearforce/page.tsx","app/staff/packages/page.tsx"]) assert.equal(fs.existsSync(file),true)
  const bearforce=fs.readFileSync("app/member/bearforce/page.tsx","utf8")
  const packages=fs.readFileSync("app/staff/packages/page.tsx","utf8")
  assert.match(bearforce,/auth\.getUser/)
  assert.match(bearforce,/redirect\(["']\/login["']/)
  assert.match(packages,/auth\.getUser/)
  assert.match(packages,/role !== ["']staff["'] && role !== ["']admin["']/)
})

test("member rewards links to Bearforce while staff workspaces link to Packages",()=>{
  const memberRewards=fs.readFileSync("app/member/rewards/MemberRewardsPageClient.tsx","utf8")
  assert.match(memberRewards,/href=["']\/member\/bearforce["']/)
  for(const file of ["app/staff/schedule/StaffSchedulePageClient.tsx","app/staff/rewards/StaffRewardsPageClient.tsx","app/payments/PaymentsPageClient.tsx"]){
    const src=fs.readFileSync(file,"utf8")
    assert.match(src,/href=["']\/staff\/packages["']/)
  }
})
