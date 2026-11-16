import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const helper = fs.readFileSync("lib/coach-login.ts", "utf8")
const signin = fs.readFileSync("app/api/auth/signin/route.ts", "utf8")
const launch = fs.readFileSync("app/launch/page.tsx", "utf8")

test("Admin1 is resolved as a username alias without changing coach/member logins", () => {
  assert.match(helper, /export function normalizeAdminUsername/)
  assert.match(helper, /\^admin\[1-9\]\[0-9\]\{0,5\}\$/)
  assert.match(helper, /export function adminAliasEmail/)
  assert.match(helper, /adminAliasEmail\(input\)/)
  assert.match(helper, /coachAliasEmail\(input\)/)
  assert.match(helper, /memberAliasEmail\(friendlyMemberHandle\?\.\[1\] \?\? input\)/)
  assert.match(signin, /resolveLoginEmail\(email\)/)
  assert.match(launch, /role === "admin"/)
})
test("Alias mapping cannot assign admin permissions", () => {
  assert.doesNotMatch(helper, /updateUserById|\.from\("profiles"\)|role:\s*"admin"/)
})
