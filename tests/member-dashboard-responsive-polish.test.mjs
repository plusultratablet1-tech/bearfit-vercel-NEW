import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboard = fs.readFileSync(
  new URL('../components/bearfit/BearfitDashboardClient.tsx', import.meta.url),
  'utf8'
)

test('featured session card uses a four-part countdown instead of only a compact label', () => {
  for (const required of [
    'useSessionCountdown',
    'Days',
    'Hours',
    'Minutes',
    'Seconds',
    'grid-cols-2',
    'lg:grid-cols-4',
  ]) {
    assert.match(dashboard, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('member dashboard has app-style mobile navigation and safe-area spacing', () => {
  for (const required of [
    'Mobile app navigation',
    'fixed inset-x-0 bottom-0',
    'env(safe-area-inset-bottom)',
    'lg:hidden',
    'Home',
    'Schedule',
    'Payments',
    'Profile',
  ]) {
    assert.match(dashboard, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('responsive polish keeps stats compact and session hero cinematic across screen sizes', () => {
  assert.match(dashboard, /grid-cols-2/) // compact two-column mobile stats/countdown
  assert.match(dashboard, /lg:min-h-\[430px\]/)
  assert.match(dashboard, /lg:grid-cols-\[minmax\(0,1fr\)_auto\]/)
  assert.match(dashboard, /backdrop-blur/)
})

test('activity history becomes readable touch-friendly cards on small screens', () => {
  assert.match(dashboard, /rounded-2xl border border-white\/\[0\.05\] bg-white\/\[0\.025\]/)
  assert.match(dashboard, /sm:grid-cols-\[auto_minmax\(0,1fr\)_auto\]/)
})
