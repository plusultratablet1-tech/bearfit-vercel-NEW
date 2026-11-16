import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read=(path)=>fs.readFileSync(path,"utf8")
const login=read("lib/coach-login.ts")
const migration=read("supabase/migrations/20261116234000_coachnate_multibranch_access.sql")
const api=read("app/api/admin/coaches/nate/provision/route.ts")
const adminPage=read("app/staff/coaches/nate/page.tsx")
const setup=read("app/staff/coaches/nate/CoachNateProvisionClient.tsx")
const coachPage=read("app/coach/page.tsx")
const coachHome=read("app/coach/CoachHomeClient.tsx")
const adminAttendance=read("app/staff/coaches/attendance/CoachAttendanceAdminClient.tsx")

test("CoachNate is named coach alias, other coach and admin logins unaffected",()=>{
  assert.match(login,/coach\[1-9\]\[0-9\]\{0,5\}/)
  assert.match(login,/coachnate/)
  assert.match(login,/adminAliasEmail\(input\)/)
  assert.match(login,/coachAliasEmail\(input\)/)
})
test("three canonical branch grants use unique coach-branch rows and RLS",()=>{
  assert.match(migration,/create table if not exists public\.coach_branch_access/)
  for(const name of ["Malingap Branch","E. Rodriguez Branch","Primark Cainta"])assert.ok(migration.includes(name))
  assert.match(migration,/primary key\(coach_id,branch\)/)
  assert.match(migration,/alter table public\.coach_branch_access enable row level security/)
  assert.match(migration,/for select to authenticated using/)
  assert.doesNotMatch(migration,/grant (insert|update|delete|all) on public\.coach_branch_access to authenticated/i)
  assert.match(migration,/v_drift is not null/)
})
test("multi-branch queries require active verified coach ownership",()=>{
  assert.match(migration,/private\.coach_branch_allowed/)
  assert.match(migration,/c\.is_active and not c\.is_demo/)
  for(const fn of ["coach_operational_dashboard","coach_schedule_overview","coach_client_cards","coach_activity_overview","coach_payment_tracking_overview","coach_plot_sessions","coach_gps_time_punch","coach_schedule_respond","coach_report_client_transfer"]){
    assert.ok(migration.includes("CREATE OR REPLACE FUNCTION public."+fn+"("),fn)
  }
  assert.match(migration,/A coach cannot have overlapping sessions at different branches/)
  assert.match(migration,/b\.branch is distinct from v_member\.branch/)
  assert.match(migration,/private\.coach_branch_allowed\(c\.id,w\.branch\)/)
})
test("admin cross-branch shift planner keeps legacy three-argument RPC",()=>{
  assert.match(migration,/CREATE OR REPLACE FUNCTION public\.admin_plan_coach_shift\(p_coach_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_branch text\)/)
  assert.match(migration,/p_branch is null or not private\.coach_branch_allowed\(v_coach\.id,p_branch\)/)
  assert.match(adminAttendance,/nateSelected/)
  assert.match(adminAttendance,/p_branch:selectedShiftBranch/)
})
test("Nate setup is Admin-only, fixed-name, same-origin and uses protected signup token",()=>{
  assert.match(adminPage,/await getStaffAccess\(\)/)
  assert.match(adminPage,/role!=="admin"/)
  assert.match(api,/origin !== new URL\(request\.url\)\.origin/)
  assert.match(api,/session\.auth\.getUser\(\)/)
  assert.match(api,/profile\?\.role !== "admin"/)
  assert.match(api,/admin_issue_coach_signup_token/)
  assert.match(api,/admin\.auth\.admin\.createUser/)
  assert.match(api,/admin\.auth\.admin\.updateUserById/)
  assert.match(api,/username:"coachnate"/)
  assert.match(api,/originalAdmin1/)
  assert.doesNotMatch(api,/await request\.json\(\)/)
})
test("CoachNate onboarding issues copy-once credentials, not fake numbers",()=>{
  assert.match(api,/randomBytes\(28\)/)
  assert.match(setup,/Create CoachNate login/)
  assert.match(setup,/Copy coach credentials/)
  assert.match(setup,/res\.ok/)
  assert.match(setup,/body\.branches\?\.length!==3/)
  assert.match(coachPage,/grants\.length !== 3/)
  assert.match(coachHome,/allowedBranches/)
})
test("migration never modifies members, payments, balances, payroll, or admin1",()=>{
  for(const table of ["members","payments","member_package_cycles","coach_payroll_cutoffs","session_logs"]){
    assert.doesNotMatch(migration,new RegExp("(?:update|delete from|insert into)\\s+public\\."+table+"\\b","i"))
  }
  assert.doesNotMatch(api,/\.from\("(members|payments|session_logs|coach_payroll_cutoffs)"\)/)
  assert.doesNotMatch(api,/updateUserById\(originalAdmin1\.id/)
})
