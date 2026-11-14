import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const directory=fs.readFileSync("app/staff/members/StaffMembersPageClient.tsx","utf8")
const page=fs.readFileSync("app/staff/members/page.tsx","utf8")
const bulk=fs.readFileSync("app/staff/members/ActiveMemberBulkProvision.tsx","utf8")
const provision=fs.readFileSync("app/api/admin/members/provision/route.ts","utf8")

test("only administrators see bulk activation and only existing active Malingap users are eligible",()=>{
  assert.match(directory,/role==="admin"&&!loadError/)
  assert.match(directory,/m\.branch==="Malingap Branch"/)
  assert.match(directory,/m\.is_demo===false/)
  assert.match(directory,/m\.status==="active"/)
  assert.match(directory,/m\.membership_status==="active"/)
  assert.match(directory,/!m\.user_id/)
  assert.match(page,/id,user_id,member_code/)
})

test("bulk operation reuses verified, admin-scoped single-member account creation",()=>{
  assert.match(bulk,/\/api\/admin\/members\/provision/)
  assert.match(bulk,/memberId:member\.id,action:"create"/)
  assert.doesNotMatch(bulk,/action:"reset"/)
  assert.match(provision,/adminProfile\?\.role!=="admin"/)
  assert.match(provision,/admin_issue_member_signup_token/)
  assert.match(provision,/linked\?\.user_id!==authId/)
})

test("temporary credentials only exist client-side and are exported privately by admin",()=>{
  assert.match(bulk,/temporaryPassword/)
  assert.match(bulk,/URL\.createObjectURL/)
  assert.match(bulk,/members\.bearfit\.ph/)
  assert.match(bulk,/csvCell/)
  assert.doesNotMatch(bulk,/localStorage|sessionStorage|console\.log/)
})

test("bulk activation avoids duplicate account creation and halts on account service problems",()=>{
  assert.match(bulk,/createdIds\.has\(member\.id\)/)
  assert.match(bulk,/\[401,403,429,503\]/)
  assert.match(bulk,/Network connection lost/)
  assert.doesNotMatch(bulk,/auth\.admin\.deleteUser|\.from\("members"\)\.update/)
})
