import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const migration="supabase/migrations/20260904103000_session_taxonomy.sql"
const helper="lib/session-taxonomy.ts"
const labels=["Strength Training","Weight Training","Boxing","Conditioning","Cardio","Group Fitness","Pilates Group","Pilates 1-on-1"]

test("taxonomy migration adds session_label to every scheduling/attendance table",()=>{
  assert.equal(fs.existsSync(migration),true)
  const sql=fs.readFileSync(migration,"utf8")
  for(const table of ["availability_rules","schedule_slots","bookings","session_logs"]) assert.match(sql,new RegExp(`alter table public\\.${table}[\\s\\S]*session_label`,"i"))
  assert.match(sql,/session_label_category\(p_session_label text\)/i)
  for(const label of labels) assert.match(sql,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))
  assert.match(sql,/Unknown session label/i)
  assert.match(sql,/when 'Strength Training' then return 'fitness'/i)
  assert.doesNotMatch(sql,/return\s+case/i)
  assert.match(sql,/end case;/i)
})

test("client taxonomy exports exact production labels and safe fallbacks",()=>{
  assert.equal(fs.existsSync(helper),true)
  const src=fs.readFileSync(helper,"utf8")
  for(const label of labels) assert.match(src,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))
  assert.match(src,/Fitness Session/)
  assert.match(src,/Pilates Group/)
  assert.match(src,/Pilates 1-on-1/)
  assert.match(src,/Training Session/)
})
