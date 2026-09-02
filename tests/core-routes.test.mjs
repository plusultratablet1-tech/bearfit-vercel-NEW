import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

for (const file of ['app/payments/page.tsx', 'app/checkin/page.tsx', 'app/members/[id]/page.tsx']) {
  test(`${file} does not link to the nonexistent /dashboard route`, () => {
    const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /href=["']\/dashboard["']/)
  })
}

test('signup does not manually create members because the auth trigger owns profile creation', () => {
  const source = fs.readFileSync(new URL('../app/api/auth/signup/route.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\.from\(["']members["']\)/)
})
