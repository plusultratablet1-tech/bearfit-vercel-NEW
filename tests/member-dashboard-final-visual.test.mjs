import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboard = fs.readFileSync(
  new URL('../components/bearfit/BearfitDashboardClient.tsx', import.meta.url),
  'utf8'
)

test('dashboard has a branded image-based featured next-session card', () => {
  for (const required of [
    'sessionVisualForType',
    '/better-form.png',
    '/onboarding/better-function1.jpg',
    'Next Session',
    'Starts in',
    'Session details',
    'object-cover',
  ]) {
    assert.match(dashboard, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('dashboard uses real package payment name when a legacy compatibility package is shown', () => {
  assert.match(dashboard, /displayPackageName/)
  assert.match(dashboard, /Legacy/i)
  assert.match(dashboard, /payments\.find/)
})

test('activity area uses richer session and payment rows without fake rewards data', () => {
  for (const required of ['Activity Log', 'Sessions', 'Payments', 'Session used', 'Payment received']) {
    assert.match(dashboard, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  for (const fake of ['Workout Streak', 'Bearforce Points', 'Prestige Member', 'Fitness Level']) {
    assert.doesNotMatch(dashboard, new RegExp(fake.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})
