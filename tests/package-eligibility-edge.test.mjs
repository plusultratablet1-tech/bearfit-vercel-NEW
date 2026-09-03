import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = new URL('../supabase/migrations/20260903097000_package_eligibility_zero_session_fix.sql', import.meta.url)

test('package eligibility handles zero-session cycles without reading an unassigned record', () => {
  assert.equal(fs.existsSync(migration), true)
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /v_due_stage_id\s+uuid/i)
  assert.match(sql, /v_due_stage_key\s+text/i)
  assert.match(sql, /v_due_stage_label\s+text/i)
  assert.doesNotMatch(sql, /v_due_stage\.id/i)
  assert.doesNotMatch(sql, /v_due_stage\.stage_key/i)
  assert.doesNotMatch(sql, /v_due_stage\.label/i)
})
