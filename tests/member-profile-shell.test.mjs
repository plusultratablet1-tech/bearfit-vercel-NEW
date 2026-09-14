import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const profilePage = fs.readFileSync("app/member/profile/page.tsx", "utf8")

test("member profile uses the shared app shell", () => {
  assert.match(profilePage, /MemberAppShell/)
  assert.match(profilePage, /activePath=["']\/member\/profile["']/)
})

test("member profile no longer owns duplicate navigation", () => {
  assert.doesNotMatch(profilePage, /<aside/)
  assert.doesNotMatch(profilePage, /\/member\/dashboard#payments/)
  assert.doesNotMatch(profilePage, /Schedule[\s\S]*Soon/)
})

test("member profile has route loading feedback", () => {
  assert.equal(fs.existsSync("app/member/profile/loading.tsx"), true)
})
