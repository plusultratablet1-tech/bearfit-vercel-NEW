import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const pagePath = "app/member/bearforce/page.tsx"
const clientPath = "app/member/bearforce/MemberBearforcePageClient.tsx"
const loaderPath = "lib/bearforce.ts"

test("member Bearforce detail route is protected and server-loaded", () => {
  assert.equal(fs.existsSync(pagePath), true)
  const page = fs.readFileSync(pagePath, "utf8")
  assert.match(page, /auth\.getUser\(\)/)
  assert.match(page, /loadMemberBearforceData/)
  assert.match(page, /redirect\("\/login"\)|redirect\("\/welcome"\)/)
})

test("Bearforce detail UI contains progression, history and season sections", () => {
  assert.equal(fs.existsSync(clientPath), true)
  const source = fs.readFileSync(clientPath, "utf8")
  for (const label of [
    "Lifetime Bearforce",
    "Season Earned",
    "Available to Spend",
    "Workout Streak",
    "Prestige",
    "BearFit Tier",
    "Based on Lifetime Bearforce Points",
    "Transaction History",
    "Previous Seasons",
  ]) assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.match(source, /Grace Week/)
  assert.match(source, /Bear Cub/)
  assert.match(source, /Grizzly/)
  assert.match(source, /Kodiak/)
  assert.match(source, /Titan Bear/)
  assert.match(source, /Apex Bear/)
})

test("Bearforce loader reads only authoritative member RPCs", () => {
  assert.equal(fs.existsSync(loaderPath), true)
  const source = fs.readFileSync(loaderPath, "utf8")
  assert.match(source, /member_bearforce_summary/)
  assert.match(source, /member_bearforce_history/)
  assert.match(source, /member_bearforce_seasons/)
  assert.doesNotMatch(source, /from\("bearforce_point_events"\)/)
})
