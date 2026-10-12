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

export function resolveLoginEmail(value: string) {
  return coachAliasEmail(value) ?? value.trim().toLowerCase()
}
