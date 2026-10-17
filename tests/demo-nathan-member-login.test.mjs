import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const route = fs.readFileSync("app/api/admin/demo-member/provision/route.ts", "utf8")
const ui = fs.readFileSync("app/staff/demo-access/DemoNathanActivation.tsx", "utf8")
const page = fs.readFileSync("app/staff/demo-access/page.tsx", "utf8")
const login = fs.readFileSync("app/api/auth/signin/route.ts", "utf8")
const launch = fs.readFileSync("app/launch/page.tsx", "utf8")

test("Nathan provisioning is admin-only and same origin", () => {
  assert.match(route, /session\.auth\.getUser\(\)/)
  assert.match(route, /caller\?\.role !== "admin"/)
  assert.match(page, /role !== "admin"/)
  assert.match(route, /sec-fetch-site/)
  assert.match(route, /origin.*request\.url/)
})

test("Only the existing inactive Nathan demo row can be linked", () => {
  assert.match(route, /DEMO-NATHAN-001/)
  assert.match(route, /nathan\.demo@bearfit\.example\.invalid/)
  assert.match(route, /\.eq\("is_demo", true\)/)
  assert.match(route, /demo\.status !== "inactive"/)
  assert.match(route, /if \(demo\.user_id\)/)
  assert.doesNotMatch(route, /request\.json\(/)
})

test("Only a member account is created; admin access is not granted", () => {
  assert.match(route, /auth\.admin\.createUser/)
  assert.match(route, /randomBytes\(24\)\.toString\("base64url"\)/)
  assert.match(route, /role: "member"/)
  assert.match(route, /\.eq\("role", "member"\)/)
  assert.match(launch, /redirect\("\/member\/dashboard"\)/)
  assert.match(login, /signInWithPassword/)
  assert.doesNotMatch(route, /role: "admin"/)
})

test("Signup trigger member is marked demo then cleaned up safely", () => {
  assert.match(route, /is_demo: true/)
  assert.match(route, /user_id: null/)
  assert.match(route, /status: "inactive"/)
  assert.match(route, /membership_status: "inactive"/)
  assert.match(route, /\.delete\(\)\.eq\("id", autoMember\.id\)/)
  assert.match(route, /auth\.admin\.deleteUser\(createdUserId\)/)
  assert.doesNotMatch(route, /\.from\("(payments|bookings|session_logs|coach_conductions|member_package_cycles)"\)/)
})

test("Temporary credentials are one time, not hardcoded or in local storage", () => {
  assert.match(route, /Cache-Control/)
  assert.match(route, /private, no-store/)
  assert.match(ui, /setCredentials\(null\)/)
  assert.match(ui, /navigator\.clipboard\.writeText/)
  assert.doesNotMatch(ui, /localStorage|sessionStorage|console\.log/)
  assert.doesNotMatch(route, /console\.log/)
})
