import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sharedAccount = fs.readFileSync(
  new URL('../lib/member-account.ts', import.meta.url),
  'utf8'
)
const serverAccountPath = new URL('../lib/member-account-server.ts', import.meta.url)

test('member account shared module is client-safe and server loader stays server-only', () => {
  assert.doesNotMatch(sharedAccount, /@\/lib\/supabase\/server|next\/headers/)
  assert.match(sharedAccount, /displayPackageNameForMember/)

  assert.equal(fs.existsSync(serverAccountPath), true)
  const serverAccount = fs.readFileSync(serverAccountPath, 'utf8')
  assert.match(serverAccount, /@\/lib\/supabase\/server/)
  assert.match(serverAccount, /loadMemberAccountData/)
})
