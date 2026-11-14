import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const sql=readFileSync("supabase/migrations/20261114133000_strict_proof_based_package_freezes.sql","utf8")
const member=readFileSync("app/member/freeze/MemberFreezeClient.tsx","utf8")
const admin=readFileSync("app/staff/freezes/AdminFreezesClient.tsx","utf8")
const adminPage=readFileSync("app/staff/freezes/page.tsx","utf8")

test("only authenticated members can request freezes for owned package cycles",()=>{
  assert.match(sql,/where user_id=v_uid and is_demo=false/)
  assert.match(sql,/member_id=v_member for update/)
  assert.match(sql,/v_uid is null/)
})
test("one pending and one approved freeze constraint per cycle",()=>{
  assert.match(sql,/unique index if not exists package_freeze_one_pending/)
  assert.match(sql,/unique index if not exists package_freeze_one_approved/)
})
test("proof is required and lives in a private limited bucket",()=>{
  assert.match(sql,/bearfit-freeze-proofs','bearfit-freeze-proofs',false,5242880/)
  assert.match(sql,/from storage\.objects o/)
  assert.match(sql,/o\.name=p_proof_path/)
  assert.match(member,/file\.size>5\*1024\*1024/)
})
test("medical evidence is not made public to staff or coaches",()=>{
  assert.match(sql,/Member uploads their own immutable freeze evidence/)
  assert.match(sql,/Owner or admin may securely read freeze evidence/)
  assert.match(sql,/p\.role='admin'/)
  assert.doesNotMatch(sql,/public\s*,\s*true\s*,\s*5242880/)
})
test("travel and medical limits are applied server side",()=>{
  assert.match(sql,/p_reason='travel' then 7 else 14/)
  assert.match(sql,/v_validity\/4/)
  assert.match(sql,/v_days<3 or v_days>v_limit/)
  assert.match(sql,/p_start_date<v_today\+7/)
  assert.match(sql,/p_start_date<v_today-3/)
})
test("unverified package dates prevent changes",()=>{
  assert.match(sql,/v_cycle\.starts_at is null or v_cycle\.expires_at is null/)
  assert.match(member,/original start and expiration dates have not been verified/)
})
test("only admin can approve and decisions carry expiry audit",()=>{
  assert.match(sql,/role='admin'/)
  assert.match(sql,/original_expires_at=v_cycle\.expires_at,revised_expires_at=v_new_expiry/)
  assert.match(adminPage,/role!=="admin"/)
  assert.match(admin,/Review supporting proof/)
})
test("approval refuses sessions or bookings during freeze",()=>{
  assert.match(sql,/Cancel or reschedule conflicting member bookings/)
  assert.match(sql,/Completed sessions already exist/)
  assert.match(sql,/bearfit_block_frozen_bookings/)
  assert.match(sql,/bearfit_block_frozen_session_logs/)
})
test("member portal cannot auto-approve",()=>{
  assert.match(member,/member_request_package_freeze/)
  assert.doesNotMatch(member,/admin_review_package_freeze/)
  assert.match(admin,/admin_review_package_freeze/)
})
