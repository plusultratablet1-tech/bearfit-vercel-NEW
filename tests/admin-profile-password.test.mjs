import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read = (path) => fs.readFileSync(path,"utf8")
const nav = read("components/bearfit/StaffPersistentShell.tsx")
const route = read("app/staff/profile/page.tsx")
const client = read("app/staff/profile/AdminProfileClient.tsx")

test("Admin desktop and mobile menu share an active Profile entry",()=>{
  assert.match(nav,/label: "Profile", icon: UserRound, href: "\/staff\/profile"/)
  assert.match(nav,/visibleNavItems\.map\(\(item\)/)
  assert.match(nav,/activePath === item\.href/)
})
test("Admin Profile is not in ordinary staff's navigation",()=>{
  assert.match(nav,/role==="admin"\?navItems/)
  assert.match(nav,/item\.href!=="\/staff\/profile"/)
})
test("Profile uses the signed-in account and server-verified Admin role",()=>{
  assert.match(route,/await getStaffAccess\(\)/)
  assert.match(route,/role !== "admin"/)
  assert.match(route,/\.from\("profiles"\)\.select\("full_name,branch"\)\.eq\("id", user\.id\)/)
  assert.doesNotMatch(route,/\.update\(|\.insert\(|\.delete\(|service_role/i)
})
test("The form verifies CURRENT password without replacing the live app session",()=>{
  assert.match(client,/createTemporaryAuthClient/)
  assert.match(client,/persistSession: false/)
  assert.match(client,/autoRefreshToken: false/)
  assert.match(client,/verification\.auth\.signInWithPassword/)
  assert.match(client,/reauthenticated\.user\.id !== expectedUserId/)
  assert.match(client,/current_password: currentPassword/)
  assert.match(client,/verification\.auth\.updateUser/)
})
test("Requires matching 12-128 character new password, not same password",()=>{
  assert.match(client,/newPassword\.length < 12 \|\| newPassword\.length > 128/)
  assert.match(client,/newPassword !== confirmPassword/)
  assert.match(client,/newPassword === currentPassword/)
  assert.match(client,/autoComplete="current-password"/)
  assert.match(client,/autoComplete="new-password"/)
  assert.match(client,/type=\{showPasswords \? "text" : "password"\}/)
})
test("New password belongs only to the logged-in Supabase user",()=>{
  assert.doesNotMatch(client,/admin\.updateUserById|\.from\("profiles"\)|\.from\("members"\)|\.rpc\(/)
  assert.match(client,/scope: "local"/)
  assert.match(client,/setCurrentPassword\(" "\)|setCurrentPassword\(""/)
  assert.match(client,/setNewPassword\(""/)
  assert.match(client,/setConfirmPassword\(""/)
  assert.match(client,/href="\/login"/)
})
