import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = new URL('../supabase/migrations/20260903090000_package_catalog_cycles.sql', import.meta.url)

test('package catalog seeds BearFit and Pilates products', () => {
  assert.equal(fs.existsSync(migration), true)
  const sql = fs.readFileSync(migration, 'utf8')
  for (const code of ['FULL24', 'FULL48', 'PARTIAL24', 'PILATES5', 'PILATES10', 'PILATES20', 'PILATES1ON1']) {
    assert.match(sql, new RegExp(code))
  }
  assert.match(sql, /PILATES5[\s\S]*5[\s\S]*30/i)
  assert.match(sql, /PILATES10[\s\S]*10[\s\S]*45/i)
  assert.match(sql, /PILATES20[\s\S]*20[\s\S]*60/i)
})

test('Partial 24 has activation, 19-left and 13-left payment stages', () => {
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /PARTIAL24[\s\S]*activation/i)
  assert.match(sql, /19/)
  assert.match(sql, /13/)
  assert.match(sql, /Renewal Soon/i)
  assert.match(sql, /Last Session/i)
})

test('package balance writes are protected by RLS and helper functions', () => {
  const sql = fs.readFileSync(migration, 'utf8')
  assert.match(sql, /alter table public\.member_package_cycles enable row level security/i)
  assert.match(sql, /private\.package_eligibility/i)
  assert.match(sql, /member_package_eligibility/i)
  assert.match(sql, /staff_package_attention_queue/i)
})
