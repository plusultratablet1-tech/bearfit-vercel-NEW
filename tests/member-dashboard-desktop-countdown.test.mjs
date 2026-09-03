import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const client = new URL('../components/bearfit/BearfitDashboardClient.tsx', import.meta.url)

test('desktop session countdown avoids unstable blur blocks and stays a readable 2x2 grid', () => {
  const src = fs.readFileSync(client,'utf8')
  const marker = src.indexOf('sessionCountdown.label')
  assert.ok(marker > -1)
  const around = src.slice(Math.max(0,marker-900), marker+1200)
  assert.match(around,/bg-\[#111111\]\/95|bg-\[#111111\]/)
  assert.match(around,/grid grid-cols-2 gap-2/)
  assert.doesNotMatch(around,/backdrop-blur-md/)
  assert.doesNotMatch(around,/lg:grid-cols-4/)
})
