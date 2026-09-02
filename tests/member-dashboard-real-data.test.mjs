import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboardClient = fs.readFileSync(
  new URL('../components/bearfit/BearfitDashboardClient.tsx', import.meta.url),
  'utf8'
)
const dashboardPage = fs.readFileSync(
  new URL('../app/member/dashboard/page.tsx', import.meta.url),
  'utf8'
)
const mePage = fs.readFileSync(new URL('../app/me/page.tsx', import.meta.url), 'utf8')

test('member dashboard does not fall back to invented membership values', () => {
  for (const fakeValue of [
    'M00-1',
    'Full 48 Package+',
    'Workout Streak',
    'Bearforce Points',
    '1540',
    'Prestige Member',
    'Fitness Level',
    'Top Member',
    'On Target',
    'On Fire',
  ]) {
    assert.doesNotMatch(dashboardClient, new RegExp(fakeValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.doesNotMatch(dashboardClient, /sessions_used\s*\?\?\s*40/)
  assert.doesNotMatch(dashboardClient, /total_sessions\s*\?\?\s*48/)
  assert.doesNotMatch(dashboardClient, /images\.unsplash\.com/)
})

test('member dashboard receives real profile, sessions, and payments data', () => {
  assert.match(dashboardPage, /loadMemberAccountData/)
  assert.match(dashboardPage, /profile=/)
  assert.match(dashboardPage, /sessionLogs=/)
  assert.match(dashboardPage, /payments=/)
})

test('/me uses the shared server-side member account loader', () => {
  assert.doesNotMatch(mePage, /["']use client["']/)
  assert.match(mePage, /loadMemberAccountData/)
  assert.match(mePage, /sessions_used/)
  assert.match(mePage, /payment_status/)
  assert.match(mePage, /Session Timeline/)
})
