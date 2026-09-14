import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const migration = "supabase/migrations/20260914154000_bearforce_history_order_fix.sql"

test("Bearforce history limits ordered rows before aggregating", () => {
  assert.equal(fs.existsSync(migration), true, "ordering fix migration must exist")
  const sql = fs.readFileSync(migration, "utf8")

  assert.match(sql, /member_bearforce_history\(p_limit integer default 100\)/i)
  assert.match(sql, /from\s*\(\s*select\s+occurred_at\s*,\s*item[\s\S]*order by occurred_at desc[\s\S]*limit v_limit[\s\S]*\) limited/i)
  assert.match(sql, /jsonb_agg\(item order by occurred_at desc\)/i)
  assert.doesNotMatch(sql, /\)\s*combined\s*\n\s*order by occurred_at desc\s*\n\s*limit v_limit\s*;/i)
})
