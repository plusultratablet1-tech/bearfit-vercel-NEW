import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const path = "supabase/migrations/20260904100000_bearforce_history_seasons.sql"

test("member Bearforce APIs are owner-resolved and normalized", () => {
  assert.equal(fs.existsSync(path), true, "history/season migration must exist")
  const sql = fs.readFileSync(path, "utf8")
  assert.match(sql, /member_bearforce_history\(p_limit integer default 100\)/i)
  assert.match(sql, /where user_id\s*=\s*\(select auth\.uid\(\)\)/i)
  assert.match(sql, /'kind'\s*,\s*'earned'/i)
  assert.match(sql, /'kind'\s*,\s*'redeemed'/i)
  assert.match(sql, /member_bearforce_seasons\(\)/i)
  assert.match(sql, /private\.bearforce_prestige/i)
  assert.doesNotMatch(sql, /member_bearforce_history\([^)]*p_member_id/i)
  assert.doesNotMatch(sql, /member_bearforce_seasons\([^)]*p_member_id/i)
})

test("history API clamps requested rows and returns signed point deltas", () => {
  const sql = fs.readFileSync(path, "utf8")
  assert.match(sql, /least\(greatest\(coalesce\(p_limit,100\),1\),200\)/i)
  assert.match(sql, /'points_delta'\s*,\s*e\.points/i)
  assert.match(sql, /'points_delta'\s*,\s*-r\.points_spent/i)
  assert.match(sql, /order by occurred_at desc/i)
})
