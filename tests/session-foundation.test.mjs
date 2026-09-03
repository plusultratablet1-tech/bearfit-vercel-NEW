import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const rootProxy = fs.readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')

test('Next.js proxy refreshes Supabase sessions', () => {
  assert.match(rootProxy, /updateSession/)
  assert.match(rootProxy, /export async function proxy/)
})

test('dynamic member route awaits Next.js params', () => {
  const source = fs.readFileSync(new URL('../app/members/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /params:\s*Promise<\{\s*id:\s*string\s*\}>/)
  assert.match(source, /await params/)
})

test('the public init-db service-key route has been removed', () => {
  assert.equal(fs.existsSync(new URL('../app/api/init-db/route.ts', import.meta.url)), false)
})

test('email confirmation callback exchanges the Supabase token for a session', () => {
  const source = fs.readFileSync(new URL('../app/auth/confirm/route.ts', import.meta.url), 'utf8')
  assert.match(source, /verifyOtp/)
  assert.match(source, /\/launch/)
})
