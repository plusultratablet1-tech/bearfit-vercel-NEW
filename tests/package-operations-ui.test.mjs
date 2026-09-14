import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const staffPage = fs.readFileSync("app/staff/packages/page.tsx", "utf8")
const staffClient = fs.readFileSync("app/staff/packages/StaffPackagesPageClient.tsx", "utf8")
const paymentsPage = fs.readFileSync("app/payments/page.tsx", "utf8")
const paymentsClient = fs.readFileSync("app/payments/PaymentsPageClient.tsx", "utf8")

test("staff packages loads the member package attention queue", () => {
  assert.match(staffPage, /staff_package_attention_queue/)
  assert.match(staffClient, /Member Package Attention/)
  assert.match(staffClient, /Payment Due/)
  assert.match(staffClient, /Renewal Soon/)
  assert.match(staffClient, /Last Session/)
})

test("package attention links hand off member and package context to payments", () => {
  assert.match(staffClient, /memberId:\s*item\.member_id/)
  assert.match(staffClient, /packageCode:\s*item\.package_code/)
  assert.match(staffClient, /params\.set\(["']memberPackageId["']/)
  assert.match(staffClient, /params\.set\(["']stageKey["'],\s*["']activation["']\)/)
})

test("payments page accepts server parsed prefill values", () => {
  assert.match(paymentsPage, /searchParams/)
  assert.match(paymentsPage, /prefill=/)
  assert.match(paymentsClient, /PaymentPrefill/)
})

test("payments loads package trigger metadata and stage payment statuses", () => {
  assert.match(paymentsClient, /trigger_type/)
  assert.match(paymentsClient, /trigger_sessions_left/)
  assert.match(paymentsClient, /blocks_new_bookings_when_due/)
  assert.match(paymentsClient, /member_package_stage_payments/)
})

test("payment prefill validates cycle ownership and derives the highest unpaid due stage", () => {
  assert.match(paymentsClient, /cycle\s*&&\s*cycle\.member_id\s*===\s*member\.id/)
  assert.match(paymentsClient, /cycle\.package_id\s*===\s*pkg\.id/)
  assert.match(paymentsClient, /status\s*!==\s*["']paid["']/)
  assert.match(paymentsClient, /status\s*!==\s*["']waived["']/)
  assert.match(paymentsClient, /b\.stage_order\s*-\s*a\.stage_order/)
})

test("renewal activation can create a new cycle instead of reusing the old cycle", () => {
  assert.match(staffClient, /params\.set\(["']stageKey["'],\s*["']activation["']\)/)
  assert.match(paymentsClient, /memberPackageId:\s*validCycle\s*&&[\s\S]*\?\s*validCycle\.id\s*:\s*["']["']/)
})
