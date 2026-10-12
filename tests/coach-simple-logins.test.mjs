import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const read = (path) => fs.readFileSync(path,"utf8")
const migration=read("supabase/migrations/20261012114000_simple_coach_logins.sql")
const route=read("app/api/admin/coaches/provision/route.ts")
const signin=read("app/api/auth/signin/route.ts")
const login=read("app/login/page.tsx")
const coachPage=read("app/coach/page.tsx")
const coachClient=read("app/coach/CoachHomeClient.tsx")
const launch=read("app/launch/page.tsx")
const directory=read("app/staff/coaches/directory/CoachDirectoryClient.tsx")
const helper=read("lib/coach-login.ts")

test("Coach1, Coach2, Coach3, Coach4 aliases are unique, explicit, and correctly mapped",()=>{
  for(const [name,n] of [["amiel",1],["joaquin",2],["andrei",3],["hunejin",4]]) {
    assert.match(migration,new RegExp("username='coach"+n+"'"))
    assert.match(migration,new RegExp("roster_key='"+name+"'"))
  }
  assert.match(migration,/coaches_username_unique_idx/)
})
test("restricted coach role is separate from staff and admin",()=>{
  assert.match(migration,/role in \('member','staff','leads','admin','coach'\)/)
  assert.match(migration,/coaches_select_own_login/)
  assert.doesNotMatch(migration,/private\.is_staff_or_admin/)
})
test("provision requires real session and admin profile",()=>{
  assert.match(route,/session\.auth\.getUser\(\)/)
  assert.match(route,/profile\?\.role !== "admin"/)
  assert.match(route,/403/)
})
test("password generation is cryptographic, not Coach1 or 1234",()=>{
  assert.match(route,/randomBytes\(24\)\.toString\("base64url"\)/)
  assert.doesNotMatch(route,/password:\s*"1234"/i)
  assert.doesNotMatch(route,/password:\s*"coach1"/i)
})
test("service role remains in server-only provisioning route",()=>{
  assert.match(route,/process\.env\.SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(route,/auth\.admin\.createUser/)
  assert.doesNotMatch(directory,/SUPABASE_SERVICE_ROLE_KEY/)
})
test("coach identity is derived from server roster, not caller-provided email",()=>{
  assert.match(route,/\.from\("coaches"\)/)
  assert.match(route,/coachAliasEmail\(coach\.username\)/)
  assert.match(route,/\.eq\("id", coachId\)/)
  assert.doesNotMatch(route,/payload\.email/)
})
test("account receives coach, not staff, role and explicit link",()=>{
  assert.match(route,/role: "coach"/)
  assert.match(route,/\.update\(\{ user_id: userId/)
  assert.match(route,/\.is\("user_id", null\)/)
  assert.match(route,/auth\.admin\.deleteUser\(userId\)/)
})
test("reset requires existing linked coach account and matching alias",()=>{
  assert.match(route,/profileCheck\?\.role !== "coach"/)
  assert.match(route,/linkedAuth\.user\?\.email\?\.toLowerCase\(\) !== email/)
  assert.match(route,/auth\.admin\.updateUserById/)
})
test("coach alias uses non-routable email without fake recovery inbox",()=>{
  assert.match(helper,/accounts\.bearfit\.invalid/)
  assert.match(helper,/\^coach\[1-9\]\[0-9\]\{0,5\}\$/)
  assert.match(signin,/resolveLoginEmail\(email\)/)
})
test("email login and signup remain available",()=>{
  assert.match(login,/isSignup \? "email" : "text"/)
  assert.match(login,/Email or Coach1/)
  assert.match(signin,/signInWithPassword/)
})
test("coach login redirects to restricted coach home",()=>{
  assert.match(launch,/role === "coach"/)
  assert.match(launch,/redirect\("\/coach"\)/)
  assert.match(coachPage,/profile\?\.role !== "coach"/)
  assert.match(coachPage,/\.eq\("user_id",user\.id\)/)
})
test("coach password can be updated without admin access",()=>{
  assert.match(coachClient,/supabase\.auth\.updateUser\(\{ password \}\)/)
  assert.match(coachClient,/password\.length < 12/)
})
test("admin creates/rotates passwords without storing password in tables",()=>{
  assert.match(directory,/provisionLogin\(coach, action/)
  assert.match(directory,/Create coach login/)
  assert.match(directory,/Reset coach password/)
  assert.match(directory,/setCredentials\(null\)/)
})
test("no coach action touches member deductions or payroll",()=>{
  assert.doesNotMatch(migration,/update public\.(members|member_package_cycles|session_logs)/)
  assert.doesNotMatch(route,/\.from\("(bookings|session_logs|coach_conductions|coach_payroll_cutoffs)"\)/)
})
