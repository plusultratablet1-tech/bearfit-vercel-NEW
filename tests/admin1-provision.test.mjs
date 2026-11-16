import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const route = fs.readFileSync("app/api/admin/admin1/provision/route.ts","utf8")
const serverPage = fs.readFileSync("app/staff/admin-accounts/page.tsx","utf8")
const clientPage = fs.readFileSync("app/staff/admin-accounts/Admin1ProvisionClient.tsx","utf8")
const alias = fs.readFileSync("lib/coach-login.ts","utf8")

test("admin1 username resolves to reserved internal email", () => {
  assert.match(alias,/function adminAliasEmail/)
  assert.match(alias,/adminAliasEmail\(input\)/)
  assert.match(route,/adminAliasEmail\(username\)/)
})
test("provision requires verified Admin session and same origin", () => {
  assert.match(route,/request\.headers\.get\("origin"\)/)
  assert.match(route,/session\.auth\.getUser\(\)/)
  assert.match(route,/currentProfile\?\.role !== "admin"/)
  assert.match(route,/verified\.role === "admin"/)
  assert.match(serverPage,/getStaffAccess\(\)/)
  assert.match(serverPage,/role !== "admin"/)
})
test("provision does not accept user-supplied identity, role, or password", () => {
  assert.doesNotMatch(route,/await request\.json\(\)/)
  assert.match(route,/const username = "admin1"/)
  assert.match(route,/randomBytes\(24\)\.toString\("base64url"\)/)
})
test("provision checks duplicates and verifies role linkage", () => {
  assert.match(route,/auth\.admin\.listUsers/)
  assert.match(route,/auth\.admin\.createUser/)
  assert.match(route,/auth\.admin\.updateUserById/)
  assert.match(route,/auth\.admin\.getUserById/)
  assert.match(route,/roleCheck\?\.role !== "admin"/)
})
test("temporary member cleanup is scoped to brand-new user, never real clients", () => {
  assert.match(route,/temporaryMemberId/)
  assert.match(route,/\.eq\("user_id",newUserId\)/)
  assert.match(route,/\.eq\("sessions_used",0\)\.eq\("total_paid",0\)/)
  assert.doesNotMatch(route,/\.from\("(payments|session_logs|bookings|coach_conductions)"\)/)
})
test("one-time credentials are displayed only after successful provisioning", () => {
  assert.match(clientPage,/if \(!response\.ok\)/)
  assert.match(clientPage,/setCredentials\(result as Credentials\)/)
  assert.match(clientPage,/!result\.temporaryPassword/)
  assert.match(clientPage,/Copy username and password/)
})
