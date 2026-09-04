import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const migration = "supabase/migrations/20260904101000_package_pricing_admin.sql"

test("package pricing migration seeds only approved real prices", () => {
  assert.equal(fs.existsSync(migration), true)
  const sql = fs.readFileSync(migration, "utf8")
  assert.match(sql, /standard_price numeric\(12,2\)/i)
  assert.match(sql, /standard_price is null or standard_price >= 0/i)
  assert.match(sql, /4450[^\n]*PILATES5|PILATES5[^\n]*4450/i)
  assert.match(sql, /8900[^\n]*PILATES10|PILATES10[^\n]*8900/i)
  assert.match(sql, /16400[^\n]*PILATES20|PILATES20[^\n]*16400/i)
  assert.match(sql, /1600[^\n]*PILATES1ON1|PILATES1ON1[^\n]*1600/i)
  for (const code of ["FULL24","FULL48","PARTIAL24"]) assert.match(sql, new RegExp(`null[^\\n]*${code}|${code}[^\\n]*null`, "i"))
})

test("package settings are staff-readable but admin-only writable", () => {
  const sql = fs.readFileSync(migration, "utf8")
  assert.match(sql, /staff_package_catalog\(\)/i)
  assert.match(sql, /admin_update_package_settings\(/i)
  assert.match(sql, /v_role[\s\S]*<>\s*'admin'|role[\s\S]*=\s*'admin'/i)
  assert.match(sql, /LEGACY_FITNESS/i)
  assert.match(sql, /cannot be activated|cannot activate/i)
})

test("staff package settings route exists and keeps structural fields read-only", () => {
  assert.equal(fs.existsSync("app/staff/packages/page.tsx"), true)
  assert.equal(fs.existsSync("app/staff/packages/StaffPackagesPageClient.tsx"), true)
  const src = fs.readFileSync("app/staff/packages/StaffPackagesPageClient.tsx", "utf8")
  assert.match(src, /Price not configured/)
  assert.match(src, /Included sessions/)
  assert.match(src, /Billing mode/)
  assert.match(src, /admin_update_package_settings/)
})

test("payments show standard price as guidance but keep explicit amount", () => {
  const src = fs.readFileSync("app/payments/PaymentsPageClient.tsx", "utf8")
  assert.match(src, /standard_price/)
  assert.match(src, /Standard price/)
  assert.match(src, /Amount \(PHP\)/)
  assert.match(src, /p_amount:\s*amount/)
})
