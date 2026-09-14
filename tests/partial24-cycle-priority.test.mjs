import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const migration = "supabase/migrations/20260914150000_package_cycle_priority.sql"

test("package cycle priority migration exists", () => {
  assert.equal(fs.existsSync(migration), true)
})

test("real active packages are preferred over legacy fitness", () => {
  const sql = fs.readFileSync(migration, "utf8")
  assert.match(sql, /LEGACY_FITNESS/i)
  assert.match(sql, /c\.status\s*=\s*'active'/i)
  assert.match(sql, /case[\s\S]*LEGACY_FITNESS[\s\S]*active/i)
})

test("oldest active real package is consumed before a newer renewal", () => {
  const sql = fs.readFileSync(migration, "utf8")
  assert.match(sql, /c\.created_at[\s\S]*asc/i)
})

test("depleted real package blocks before legacy fallback when no renewal exists", () => {
  const sql = fs.readFileSync(migration, "utf8")
  assert.match(sql, /when d\.code <> 'LEGACY_FITNESS' then 1/i)
  assert.match(sql, /when c\.status='active' then 2/i)
  assert.match(sql, /No sessions remaining/i)
})
