import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboardClient = fs.readFileSync(
  new URL('../components/bearfit/BearfitDashboardClient.tsx', import.meta.url),
  'utf8'
)

const clientHelpersPath = new URL('../lib/member-account-client.ts', import.meta.url)

test('member dashboard keeps server-only Supabase code out of the client bundle', () => {
  assert.doesNotMatch(
    dashboardClient,
    /import\s+\{\s*displayPackageNameForMember\s*\}\s+from\s+["']@\/lib\/member-account["']/
  )

  assert.equal(fs.existsSync(clientHelpersPath), true)
  const clientHelpers = fs.readFileSync(clientHelpersPath, 'utf8')
  assert.doesNotMatch(clientHelpers, /@\/lib\/supabase\/server|next\/headers/)
  assert.match(clientHelpers, /displayPackageNameForMember/)
})
