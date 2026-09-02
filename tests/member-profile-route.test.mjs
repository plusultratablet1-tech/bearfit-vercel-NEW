import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboardClient = fs.readFileSync(
  new URL('../components/bearfit/BearfitDashboardClient.tsx', import.meta.url),
  'utf8'
)
const mePage = fs.readFileSync(new URL('../app/me/page.tsx', import.meta.url), 'utf8')

test('member dashboard sends Profile links to /member/profile', () => {
  assert.match(dashboardClient, /href:\s*["']\/member\/profile["']/)
  assert.match(dashboardClient, /href=["']\/member\/profile["']/)
  assert.doesNotMatch(dashboardClient, /["']\/me["']/)
})

test('/me is retired and redirects to the real member profile route', () => {
  assert.match(mePage, /redirect\(["']\/member\/profile["']\)/)
  assert.doesNotMatch(mePage, /My Account|Session Timeline|Payment History/)
})

test('member dashboard renders only one welcome heading', () => {
  const matches = dashboardClient.match(/Welcome,/g) ?? []
  assert.equal(matches.length, 1)
})

test('/member/profile is a protected real-data member page', () => {
  const source = fs.readFileSync(new URL('../app/member/profile/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /loadMemberAccountData/)
  assert.match(source, /member\.member_code/)
  assert.match(source, /member\.package_name/)
  assert.match(source, /member\.sessions_left/)
  assert.match(source, /member\.payment_status/)
})
