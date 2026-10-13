import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const sql=fs.readFileSync("supabase/migrations/20261013093000_one_free_guest_per_month.sql","utf8")
const member=fs.readFileSync("app/member/guests/MemberGuestsClient.tsx","utf8")
const guest=fs.readFileSync("app/guest/register/GuestRegistrationClient.tsx","utf8")
const coach=fs.readFileSync("app/coach/CoachHomeClient.tsx","utf8")
const admin=fs.readFileSync("app/staff/guests/GuestControlClient.tsx","utf8")

test("01 one free guest purpose is additive and no paid guest service changes",()=>{
 assert.match(sql,/add constraint guest_invites_purpose_check/)
 assert.match(sql,/'free_guest'/)
 assert.doesNotMatch(sql,/alter table public\.guest_access_prices|insert into public\.payments/)
})
test("02 a free guest invitation counts in the target month, not the creation month",()=>{
 assert.match(sql,/date_trunc\('month',g\.visit_day::timestamp\)=date_trunc\('month',p_visit_day::timestamp\)/)
 assert.match(sql,/guest_free_per_member_month_uq/)
 assert.match(sql,/where purpose='free_guest' and status<>'rejected'/)
})
test("03 no automatic rollover; quota = one in chosen calendar month",()=>{
 assert.match(sql,/'allowance',1/)
 assert.match(sql,/'remaining',greatest\(1-v_used,0\)/)
 assert.match(sql,/'carryover',false/)
 assert.match(member,/Resets on the 1st; no rollover/)
})
test("04 all free guest invitations require active host identity and assigned branch",()=>{
 assert.match(sql,/function public\.member_invite_guest/)
 assert.match(sql,/v_member\.membership_status/)
 assert.match(sql,/p_branch is distinct from v_member\.branch/)
})
test("05 member cannot reserve two free slots in same month even through concurrent requests",()=>{
 assert.match(sql,/create unique index guest_free_per_member_month_uq/)
 assert.match(sql,/This month''s free guest pass has already been reserved/)
})
test("06 an unregistered invitation can be cancelled, safely returning its slot",()=>{
 assert.match(sql,/function public\.member_cancel_unused_guest/)
 assert.match(sql,/v_pass\.status<>'invited'/)
 assert.match(sql,/v_pass\.registered_at is not null/)
 assert.match(sql,/update public\.guest_invites set status='rejected'/)
 assert.match(sql,/guest_free_per_member_month_uq/)
})
test("07 a registered or active free guest pass cannot be cancelled by member",()=>{
 assert.match(sql,/Only your own unregistered invitations can be cancelled/)
 assert.match(sql,/where id=p_invite_id and host_member_id=v_member\.id for update/)
})
test("08 only visitor and free guest activate automatically on registration",()=>{
 assert.match(sql,/v_new:=case when v\.purpose in \('visitor','free_guest'\) then 'active'/)
 assert.match(sql,/in \('gym_day','training'\) then 'pending_payment'/)
 assert.match(sql,/else 'pending_approval'/)
})
test("09 first-time free or trial guest requires normalized PH mobile and checks prior usage",()=>{
 assert.match(sql,/v\.purpose in \('free_guest','trial'\)/)
 assert.match(sql,/left\(v_digits,2\)='09'/)
 assert.match(sql,/left\(v_digits,3\)='639'/)
 assert.match(sql,/First-time complimentary guests need a valid Philippine mobile number/)
 assert.match(sql,/This guest has already used a complimentary visit or trial/)
})
test("10 free and trial phone collision is protected by unique partial database index",()=>{
 assert.match(sql,/create unique index guest_first_complimentary_phone_uq/)
 assert.match(sql,/purpose in \('free_guest','trial'\)/)
 assert.match(sql,/status in \('active','redeemed'\)/)
})
test("11 race with Admin trial approval serialized on same guest phone lock",()=>{
 const count=(sql.match(/hashtextextended\(v_phone,101\)/g)||[]).length
 assert.equal(count,2)
 assert.match(sql,/Guest already received a complimentary visit or trial/)
})
test("12 host must verify own free pass on correct day and branch",()=>{
 assert.match(sql,/function public\.member_confirm_free_guest_arrival/)
 assert.match(sql,/host_member_id=v_member\.id for update/)
 assert.match(sql,/v_pass\.purpose<>'free_guest'/)
 assert.match(sql,/v_pass\.visit_day<>\(now\(\) at time zone 'Asia\/Manila'\)::date/)
 assert.match(sql,/v_pass\.branch<>v_member\.branch/)
})
test("13 host confirmation is short-lived and required at coach admission",()=>{
 assert.match(sql,/host_confirmed_at<now\(\)-interval '10 minutes'/)
 assert.match(sql,/Hosting member must confirm arrival in their BearFit account within 10 minutes/)
 assert.match(sql,/host_arrival_confirmed/)
})
test("14 clocked-in coach still verifies actual guest and correct branch",()=>{
 assert.match(sql,/function public\.coach_check_guest_pass/)
 assert.match(sql,/Verified clock-in is required to check guest passes/)
 assert.match(sql,/v_branch<>v\.branch/)
})
test("15 no auto personal training/coach conduction/session deductions",()=>{
 assert.match(sql,/Free gym-only benefit — NO coaching/)
 assert.doesNotMatch(sql,/insert into public\.(coach_conductions|session_logs|bookings|payments)/)
 assert.doesNotMatch(sql,/update public\.(members|member_package_cycles|coach_payroll_cutoffs)/)
})
test("16 member free quota and host confirmation RPCs are only callable by authenticated role",()=>{
 assert.match(sql,/p\.role='member'/)
 assert.match(sql,/revoke all on function public\.member_free_guest_quota\(date\) from public,anon/)
 assert.match(sql,/grant execute on function public\.member_confirm_free_guest_arrival\(uuid\) to authenticated/)
})
test("17 member app defaults free option and displays remaining per selected visit month",()=>{
 assert.match(member,/useState\("free_guest"\)/)
 assert.match(member,/member_free_guest_quota/)
 assert.match(member,/of 1 free gym-only pass remaining/)
 assert.match(member,/purpose==="free_guest"&&quota\?\.remaining!==1/)
})
test("18 member can cancel unused and confirm arrival but cannot issue free exceptions",()=>{
 assert.match(member,/member_cancel_unused_guest/)
 assert.match(member,/member_confirm_free_guest_arrival/)
 assert.doesNotMatch(member,/admin_decide_guest|approve_promotion/)
})
test("19 guest registration explicitly warns there is no SMS verification",()=>{
 assert.match(guest,/SMS verification is not enabled/)
 assert.match(guest,/personal training/)
 assert.match(guest,/Confirm we arrived together/)
})
test("20 coach must acknowledge seeing both guest and hosting member",()=>{
 assert.match(coach,/guestWitnessed/)
 assert.match(coach,/guestPreview\.host_arrival_confirmed/)
 assert.match(coach,/BOTH physically present/)
 assert.match(coach,/NO personal training/)
})
test("21 Admin guest page displays monthly free entries as separate service",()=>{
 assert.match(admin,/Monthly FREE · gym-only · host required/)
 assert.match(admin,/one first-time guest for a free gym-only visit/)
})
test("22 no new public direct-write table grants or unsafe Admin waivers",()=>{
 assert.doesNotMatch(sql,/grant (insert|update|delete) on (table )?public\.guest_invites/)
 assert.doesNotMatch(sql,/function public\.coach_approve/)
})
