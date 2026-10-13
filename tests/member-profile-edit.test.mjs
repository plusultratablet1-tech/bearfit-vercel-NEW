import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
const sql=fs.readFileSync("supabase/migrations/20261013090000_admin_member_profile_edits.sql","utf8")
const page=fs.readFileSync("app/staff/members/[id]/edit/page.tsx","utf8")
const client=fs.readFileSync("app/staff/members/[id]/edit/MemberEditClient.tsx","utf8")
const profile=fs.readFileSync("app/staff/members/[id]/page.tsx","utf8")
test("admin-only authorization checked inside DB before any member changes",()=>{
 assert.match(sql,/role='admin'/)
 assert.match(sql,/Admin permission required/)
 assert.match(sql,/security definer set search_path=''/)
 assert.match(page,/account\?\.role!=="admin"/)
})
test("audit history recorded with old and new values, actor and reason",()=>{
 assert.match(sql,/member_profile_edit_events/)
 assert.match(sql,/previous_values jsonb not null/)
 assert.match(sql,/new_values jsonb not null/)
 assert.match(sql,/admin_user_id uuid not null/)
 assert.match(sql,/insert into public.member_profile_edit_events/)
 assert.match(page,/member_profile_edit_events/)
})
test("no direct client table write or financial edits",()=>{
 assert.doesNotMatch(client,/\.from\(["']members["']\)\.update/)
 assert.match(client,/\.rpc\("admin_edit_member_profile"/)
 assert.doesNotMatch(sql,/update public\.(payments|session_logs|member_package_cycles|coach_conductions)/)
 assert.doesNotMatch(sql,/sessions_left=|payment_status=|total_paid=/)
})
test("secure optimistic concurrency and required edit reason",()=>{
 assert.match(sql,/for update/)
 assert.match(sql,/v_old.updated_at is distinct from p_expected_updated_at/)
 assert.match(sql,/length\(btrim\(coalesce\(p_reason,''\)\)\) not between 8 and 500/)
})
test("branch changes protect future bookings and open guest invites",()=>{
 assert.match(sql,/p_branch is distinct from v_old.branch/)
 assert.match(sql,/public.bookings b/)
 assert.match(sql,/public.guest_invites g/)
 assert.match(sql,/Cannot move branches while future bookings/)
})
test("coaches selected only when active and same branch",()=>{
 assert.match(sql,/from public.coaches c where c.branch=p_branch and c.is_active/)
 assert.match(client,/availableCoaches=coaches.filter\(c=>c.branch===member.branch\)/)
})
test("profile edits keep linked member display and branch in sync",()=>{
 assert.match(sql,/update public.profiles set full_name=v_name,phone=v_phone,branch=p_branch/)
 assert.match(sql,/where member_id=p_member_id and role='member'/)
})
test("address and emergency contacts safely modeled as optional values",()=>{
 for(const col of ["address","emergency_contact_name","emergency_contact_phone"])
  assert.match(sql,new RegExp("add column if not exists "+col+" text"))
})
test("email change does not claim to change auth email",()=>{
 assert.match(client,/does not change their authentication\/login email/)
 assert.doesNotMatch(sql,/update auth\.users|auth\.admin\.updateUser/)
})
test("admin can reach the editor, with cancel and save",()=>{
 assert.match(profile,/role==="admin"/)
 assert.match(profile,/Edit Profile/)
 assert.match(client,/Save changes/)
 assert.match(client,/Cancel/)
})
test("edit history RLS is admin read-only",()=>{
 assert.match(sql,/alter table public.member_profile_edit_events enable row level security/)
 assert.match(sql,/grant select on public.member_profile_edit_events to authenticated/)
 assert.match(sql,/role='admin'/)
 assert.doesNotMatch(sql,/grant (insert|update|delete) on public.member_profile_edit_events to authenticated/)
})
test("contact and status inputs validated server-side",()=>{
 assert.match(sql,/Name must be 2–120 characters/)
 assert.match(sql,/Invalid email/)
 assert.match(sql,/Invalid emergency phone/)
 assert.match(sql,/Unsupported membership status/)
})
