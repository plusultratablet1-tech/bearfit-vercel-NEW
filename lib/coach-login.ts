// Usernames are public aliases; passwords are still verified by Supabase Auth.
// Reserved .invalid domain prevents sending recovery mail to any real mailbox.
export const COACH_ALIAS_DOMAIN = "accounts.bearfit.invalid"

export function normalizeCoachUsername(value: string) {
  const candidate = value.trim().toLowerCase()
  return /^coach[1-9][0-9]{0,5}$/.test(candidate) ? candidate : null
}

export function coachAliasEmail(value: string) {
  const username = normalizeCoachUsername(value)
  return username ? username + "@" + COACH_ALIAS_DOMAIN : null
}

// Member IDs resolve to reserved aliases; no public member signup can use them.
export const MEMBER_ALIAS_DOMAIN = "members.bearfit.invalid"
export function memberAliasEmail(memberCode:string){
  const code=memberCode.trim().toLowerCase()
  return /^m[0-9]{4,6}$/.test(code) ? code+"@"+MEMBER_ALIAS_DOMAIN : null
}

export function resolveLoginEmail(value: string) {
  const input = value.trim().toLowerCase()
  // Keep existing Supabase Auth aliases unchanged; the .ph address is a public
  // member-facing login handle and must not require a data migration.
  const friendlyMemberHandle = input.match(/^(m[0-9]{4,6})@members\.bearfit\.ph$/)
  return coachAliasEmail(input) ?? memberAliasEmail(friendlyMemberHandle?.[1] ?? input) ?? input
}
