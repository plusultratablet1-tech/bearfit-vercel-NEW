import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const coach = readFileSync("app/coach/CoachHomeClient.tsx","utf8")
const page = readFileSync("app/coach/page.tsx","utf8")

test("coach sign-out clears only the current device session",()=>{
  assert.match(coach,/supabase\.auth\.signOut\(\{ scope: "local" \}\)/)
  assert.doesNotMatch(coach,/async function signOut\(\)\{await supabase\.auth\.signOut\(\);window\.location\.href/)
})
test("coach sign-out confirms session is absent before navigation",()=>{
  assert.match(coach,/supabase\.auth\.getSession\(\)/)
  assert.match(coach,/if \(session\) \{/)
  assert.match(coach,/window\.location\.replace\("\/login"\)/)
})
test("logout failures remain visible and logout button prevents double clicks",()=>{
  assert.match(coach,/setError\(logoutError\?\.message/)
  assert.match(coach,/catch \{/)
  assert.match(coach,/if \(busy === "signout"\) return/)
  assert.match(coach,/disabled=\{busy==="signout"\}/)
  assert.match(coach,/aria-label="Sign out of Coach Portal"/)
})
test("fix preserves coach roster and portal scope",()=>{
  assert.match(page,/role !== "coach"/)
  assert.match(coach,/CoachSessionPlanner/)
  assert.match(coach,/CoachPaymentsDashboard/)
  assert.doesNotMatch(coach,/\.from\("auth\.sessions"\)/)
  assert.doesNotMatch(coach,/\.from\("(members|payments|session_logs)"\)\.update/)
})
