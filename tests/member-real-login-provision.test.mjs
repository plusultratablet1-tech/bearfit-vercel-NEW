import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const route=fs.readFileSync("app/api/admin/members/provision/route.ts","utf8")
const login=fs.readFileSync("lib/coach-login.ts","utf8")
const admin=fs.readFileSync("app/staff/members/[id]/page.tsx","utf8")
const form=fs.readFileSync("app/staff/members/[id]/MemberLoginProvision.tsx","utf8")

test("member username resolves only to reserved member auth alias",()=>{
  assert.match(login,/members\.bearfit\.invalid/)
  assert.match(login,/\^m\[0-9\]\{4,6\}\$/)
  assert.match(login,/memberAliasEmail\(value\)/)
})
test("member account create and reset are admin-scoped",()=>{
  assert.match(route,/session\.auth\.getUser\(\)/)
  assert.match(route,/adminProfile\?\.role!=="admin"/)
  assert.match(route,/admin_issue_member_signup_token/)
  assert.match(route,/bearfit_member_signup_token/)
  assert.match(route,/linked\?\.user_id!==authId/)
  assert.match(route,/profile\.member_id!==member\.id/)
  assert.doesNotMatch(route,/auth\.admin\.deleteUser/)
  assert.match(route,/randomBytes\(24\)/)
  assert.match(route,/member\.is_demo/)
  assert.match(route,/member\.user_id/)
  assert.doesNotMatch(route,/update\(\{\s*sessions_left/)
})
test("admin can provision via existing member detail page and shows password once",()=>{
  assert.match(admin,/MemberLoginProvision/)
  assert.match(admin,/role==="admin"/)
  assert.match(form,/Create Member Login/)
  assert.match(form,/Reset member password/)
  assert.match(form,/temporaryPassword/)
  assert.match(form,/Copy login details/)
})
