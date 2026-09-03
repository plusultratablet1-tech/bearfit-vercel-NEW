import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboard = fs.readFileSync(
  new URL('../components/bearfit/BearfitDashboardClient.tsx', import.meta.url),
  'utf8'
)

test('member dashboard restores the approved visual hierarchy using real data', () => {
  for (const copy of [
    'Member Portal',
    'Package Progress',
    'Your Stats',
    'Sessions Used',
    'Sessions Remaining',
    'Total Sessions',
    'Total Paid',
    'Upcoming Sessions',
    'Member Activity',
    'Book your next session',
  ]) {
    assert.match(dashboard, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('restored dashboard does not reintroduce fake rewards or invented package data', () => {
  for (const fakeValue of [
    'Workout Streak',
    'Bearforce Points',
    'Prestige Member',
    'Fitness Level',
    'Full 48 Package+',
    'Top Member',
    'On Target',
    'On Fire',
  ]) {
    assert.doesNotMatch(dashboard, new RegExp(fakeValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})
