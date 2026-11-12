// Usernames are public aliases; passwords are still verified by Supabase Auth.
// Reserved .invalid domains prevent sending recovery mail to fake addresses.
// Member aliases must be provisioned by verified BearFit Admin and linked to the
// existing member record; this resolver NEVER provisions accounts or reads clients.
export const COACH_ALIAS_DOMAIN = "accounts.bearfit.invalid"
export const MEMBER_ALIAS_DOMAIN = "members.bearfit.invalid"

export function normalizeCoachUsername(value: string) {
  const candidate = value.trim().toLowerCase()
  return /^coach[1-9][0-9]{0,5}$/.test(candidate) ? candidate : null
}

export function coachAliasEmail(value: string) {
  const username = normalizeCoachUsername(value)
  return username ? username + "@" + COACH_ALIAS_DOMAIN : null
}

export function normalizeMemberUsername(value: string) {
  const candidate = value.trim().toLowerCase()
  return /^m[0-9]{4,6}$/.test(candidate) ? candidate : null
}

export function memberAliasEmail(value: string) {
  const memberId = normalizeMemberUsername(value)
  return memberId ? memberId + "@" + MEMBER_ALIAS_DOMAIN : null
}

export function resolveLoginEmail(value: string) {
  return coachAliasEmail(value) ?? memberAliasEmail(value) ?? value.trim().toLowerCase()
}
