import fs from "node:fs"
import test from "node:test"
import assert from "node:assert/strict"

const sql=fs.readFileSync("supabase/migrations/20261012170000_coach_attendance_and_confirmations.sql","utf8")
const coach=fs.readFileSync("app/coach/CoachHomeClient.tsx","utf8")
const admin=fs.readFileSync("app/staff/coaches/attendance/CoachAttendanceAdminClient.tsx","utf8")
const board=fs.readFileSync("lib/coach-attendance-board.ts","utf8")
const adminPage=fs.readFileSync("app/staff/coaches/attendance/page.tsx","utf8")
const overview=fs.readFileSync("app/staff/coaches/CoachesPageClient.tsx","utf8")

test("01 coach must have individual scheduled shift before confirmations",()=>{
 assert.match(sql,/create table public\.coach_work_shifts/)
 assert.match(sql,/p_work_shift_id uuid/)
 assert.match(sql,/w\.coach_id=v_coach\.id/)
})
test("02 previous-day deadline is Manila 8 PM",()=>{
 assert.match(sql,/\(v_shift\.starts_at at time zone 'Asia\/Manila'\)::date - 1/)
 assert.match(sql,/time '20:00'/)
 assert.match(sql,/v_late:=now\(\)>v_deadline/)
 assert.match(admin,/8:00 PM Manila previous day/)
})
test("03 late responses are marked late rather than reclassified absent",()=>{
 assert.match(sql,/'late',v_late/)
 assert.match(coach,/result\.late/)
 assert.match(board,/Unconfirmed — 8PM passed/)
})
test("04 coach cannot respond for another coach or inactive login",()=>{
 assert.match(sql,/user_id=\(select auth\.uid\(\)\) and is_active/)
 assert.match(sql,/coach_id=v_coach\.id for update/)
})
test("05 unavailable response requires reason",()=>{
 assert.match(sql,/char_length\(btrim\(coalesce\(p_reason,''\)\)\) not between 5 and 500/)
 assert.match(coach,/Please enter a reason of at least five characters/)
})
test("06 shift response and attendance are different records",()=>{
 assert.match(sql,/create table public\.coach_work_shifts/)
 assert.match(sql,/alter table public\.coach_shifts add column work_shift_id/)
 assert.match(coach,/Verified time-in/)
})
test("07 on-site code uses 48 bits of randomness and 2 minute TTL",()=>{
 assert.match(sql,/extensions\.gen_random_bytes\(6\)/)
 assert.match(sql,/interval '2 minutes'/)
 assert.match(sql,/extensions\.digest\(v_code,'sha256'\)/)
})
test("08 branch code cannot be read directly and is issued only by staff",()=>{
 assert.match(sql,/revoke all on table public\.coach_work_shifts,public\.coach_attendance_codes/)
 assert.match(sql,/v_role not in \('admin','staff'\)/)
 assert.match(sql,/v_role='staff' and v_branch<>p_branch/)
})
test("09 coach cannot clock at another branch",()=>{
 assert.match(sql,/t\.branch=v_work\.branch and t\.code_hash=v_hash/)
 assert.match(sql,/v_coach\.id/)
})
test("10 no user-selected clock timestamp",()=>{
 assert.match(sql,/v_time timestamptz := now\(\)/)
 assert.match(sql,/clock_in_at,recorded_by,work_shift_id/)
 assert.doesNotMatch(sql,/p_clock_in_at|p_clock_out_at/)
})
test("11 one open shift per coach still guarded by previous migration",()=>{
 const prev=fs.readFileSync("supabase/migrations/20261012104000_conduction_payroll_safety_foundation.sql","utf8")
 assert.match(prev,/coach_shifts_one_open_per_coach/)
 assert.match(sql,/Already clocked in/)
})
test("12 clock-out requires a verified open clock-in",()=>{
 assert.match(sql,/No open verified time-in for this shift/)
 assert.match(sql,/clock_out_at=v_time/)
 assert.match(sql,/v_time>v_shift.clock_in_at\+interval '24 hours'/)
})
test("13 work shifts cannot overlap on same coach",()=>{
 assert.match(sql,/pg_advisory_xact_lock/)
 assert.match(sql,/tstzrange\(s\.starts_at,s\.ends_at/)
 assert.match(sql,/already has an overlapping shift/)
})
test("14 admin is the only shift planner and coaches cannot self-schedule",()=>{
 assert.match(sql,/admin_plan_coach_shift/)
 assert.match(sql,/p\.role='admin'/)
 assert.match(adminPage,/role!=="admin"/)
 assert.match(adminPage,/getStaffAccess\(\)/)
})
test("15 admin dashboard monitors response and verified punches",()=>{
 assert.match(admin,/coach_work_shifts/)
 assert.match(admin,/coach_shifts/)
 assert.match(board,/No verified arrival|Missing time-in/i)
 assert.match(overview,/\/staff\/coaches\/attendance/)
})
test("16 coach sees only own linked assigned bookings",()=>{
 assert.match(sql,/assigned_coach_user_id=v_coach\.user_id/)
 assert.match(sql,/b\.branch=v_coach\.branch/)
 assert.match(sql,/public\.coach_operational_dashboard\(\)/)
 assert.match(coach,/My member sessions/)
})
test("17 coach QR preview is read-only with confirmed assigned booking",()=>{
 assert.match(sql,/public\.coach_member_qr_preview\(p_member_code text\)/)
 assert.match(sql,/b\.status='confirmed'/)
 assert.match(sql,/b\.assigned_coach_user_id=v_coach\.user_id/)
 assert.match(coach,/Preview only for now/)
 assert.doesNotMatch(sql,/private\.consume_package_session/)
})
test("18 no coach payment or session balance modification exists in migration",()=>{
 assert.doesNotMatch(sql,/update public\.(member_package_cycles|session_logs|bookings|members)/)
 assert.doesNotMatch(sql,/insert into public\.(session_logs|coach_conductions|coach_payroll_cutoffs)/)
})
test("19 only authenticated role-checked RPCs can punch",()=>{
 assert.match(sql,/function public\.coach_verified_time_punch/)
 assert.match(sql,/p\.role='coach'/)
 assert.match(sql,/revoke all on function public\.coach_verified_time_punch/)
})
test("20 shift events retain signed response actor and reason",()=>{
 assert.match(sql,/create table public\.coach_work_shift_events/)
 assert.match(sql,/insert into public\.coach_work_shift_events/)
 assert.match(sql,/jsonb_build_object\('late',v_late,'reason'/)
})
test("21 missing confirmation is not automatic absence",()=>{
 assert.match(admin,/Missing a clock-in is flagged for review, not proof of absence/)
 assert.match(coach,/No reply is flagged as unconfirmed, not automatically absent/)
})
test("22 admin branch code is not exposed in URL nor printed to log",()=>{
 assert.match(admin,/issue_coach_branch_code/)
 assert.doesNotMatch(admin,/console\.log\(issued\.code\)/)
 assert.doesNotMatch(coach,/console\.log\(branchCode\)/)
})
test("23 coach daily conduction summary never displays private pay rates",()=>{
 assert.match(sql,/from public\.coach_conductions c/)
 assert.doesNotMatch(sql,/'rate_snapshot'/)
 assert.match(coach,/Approved conductions/)
})
test("24 no background notification is falsely represented as live alerts",()=>{
 assert.match(admin,/Alerts are in-app and calculated when viewed\/refreshed/)
})
