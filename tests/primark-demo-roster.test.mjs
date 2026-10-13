import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
const sql=fs.readFileSync("supabase/migrations/20261014120000_primark_demo_roster.sql","utf8")
const home=fs.readFileSync("app/staff/home/page.tsx","utf8")
const coach=fs.readFileSync("app/staff/coaches/directory/CoachDirectoryClient.tsx","utf8")
const profile=fs.readFileSync("app/staff/members/[id]/page.tsx","utf8")
test("sample roster uses four explicit synthetic member identities",()=>{
 assert.equal((sql.match(/DEMO-PRIM-00[1-4]/g)||[]).length,4)
 assert.equal((sql.match(/example\.invalid/g)||[]).length,4)
})
test("coaches are inactive demo roster records with no auth account",()=>{
 assert.match(sql,/coaches_demo_safety_check/)
 assert.match(sql,/is_active=false and user_id is null and username is null/)
 assert.equal((sql.match(/'DEMO_PRIMARK_(?:PILATES|STRENGTH)'/g)||[]).length,2)
})
test("seed cannot create sessions or financial credits",()=>{
 assert.doesNotMatch(sql,/insert into public\.(?:payments|session_logs|bookings|member_package_cycles|coach_rate_history|coach_work_shifts)/i)
 assert.match(sql,/0,0,0,'not_recorded',0,true/)
})
test("seed is idempotent",()=>{
 assert.equal((sql.match(/on conflict \(/g)||[]).length,2)
})
test("Admin Home counts only real members",()=>{
 assert.match(home,/\.eq\("is_demo",false\)/)
})
test("coach directory clearly labels demo records",()=>{
 assert.match(coach,/Demo coach/)
 assert.match(coach,/is_demo/)
})
test("demo coach account, payroll and activation controls fail closed",()=>{
 assert.match(coach,/Demo coaches cannot receive payroll rates/)
 assert.match(coach,/Demo coaches cannot be activated/)
 assert.match(coach,/Demo coaches cannot be linked to real accounts/)
 assert.match(coach,/Demo coaches cannot be given login credentials/)
})
test("member admin profile opens unlinked sample record and marks demo",()=>{
 assert.match(profile,/\.eq\("id", memberId\)\.maybeSingle\(\)/)
 assert.match(profile,/member\.is_demo/)
})
