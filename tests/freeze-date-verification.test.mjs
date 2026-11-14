import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const sql=readFileSync("supabase/migrations/20261114145000_freeze_package_date_verification.sql","utf8")
const page=readFileSync("app/staff/freezes/verify/page.tsx","utf8")
const client=readFileSync("app/staff/freezes/verify/VerifyFreezeDatesClient.tsx","utf8")
test("admin-only verification is required at UI and database levels",()=>{
 assert.match(page,/role!=="admin"/)
 assert.match(sql,/p\.role='admin'/)
 assert.match(sql,/revoke all on function public\.admin_verify_package_freeze_dates/)
})
test("date verification never replaces an existing expiry",()=>{
 assert.match(sql,/v_cycle\.expires_at is not null/)
 assert.match(sql,/where id=v_cycle\.id and expires_at is null/)
})
test("original start dates are immutable and evidence is required",()=>{
 assert.match(sql,/different start date/)
 assert.match(sql,/evidence_reference text not null/)
 assert.match(client,/Existing start date/)
})
test("validity verification never changes payments or sessions",()=>{
 assert.doesNotMatch(sql,/update public\.members/)
 assert.doesNotMatch(sql,/update public\.payments/)
 assert.doesNotMatch(sql,/sessions_left\s*=/)
})
