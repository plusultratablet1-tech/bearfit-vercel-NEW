import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../app/welcome/page.tsx', import.meta.url), 'utf8')

test('welcome onboarding does not use the protected dashboard as its completion destination', () => {
  assert.doesNotMatch(source, /const START_PAGE\s*=\s*["']\/member\/dashboard["']/)
})

test('welcome onboarding completion sends visitors to login', () => {
  assert.match(source, /const START_PAGE\s*=\s*["']\/login["']/)
})
