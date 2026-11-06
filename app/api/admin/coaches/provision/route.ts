import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { coachAliasEmail } from "@/lib/coach-login"

export const runtime = "nodejs"

type CoachRecord = {
  id: string
  display_name: string
  branch: string
  username: string | null
  user_id: string | null
  is_active: boolean
  is_demo: boolean
}

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  // Never accept a caller-chosen email, user ID, role, or password.
  const session = await createClient()
  const { data: { user }, error: authError } = await session.auth.getUser()
  if (authError || !user) return reply({ error: "Authentication required" }, 401)
  const { data: profile } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") return reply({ error: "Admin access required" }, 403)

  let payload: { coachId?: unknown; action?: unknown }
  try { payload = await request.json() } catch { return reply({ error: "Invalid request" }, 400) }
  const { coachId, action } = payload
  if (typeof coachId !== "string" || !/^[0-9a-f-]{36}$/i.test(coachId) ||
      (action !== "create" && action !== "reset")) return reply({ error: "Invalid coach action" }, 400)

  // The authenticated Admin can already see this coach via RLS in the directory.
  // Resolve the identity using the same verified session so a stale server key
  // cannot turn a real coach into a misleading "Coach not found" response.
  const { data: coach, error: coachError } = await session.from("coaches")
    .select("id,display_name,branch,username,user_id,is_active,is_demo")
    .eq("id", coachId).maybeSingle<CoachRecord>()
  if (coachError) return reply({ error: "Unable to read coach record. Reload the directory and try again." }, 503)
  if (!coach) return reply({ error: "Coach record is missing or not visible to your Admin account." }, 404)
  if (coach.is_demo || !coach.is_active) return reply({ error: "Only active, real coaches can receive logins." }, 409)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Prefer the current secret key. Fall back to the legacy service-role key
  // only when its read-only privilege check proves it belongs to this project.
  const serverKeys = [...new Set(
    [process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]
      .filter((key): key is string => Boolean(key?.trim()))
  )]
  if (!url || serverKeys.length === 0) return reply({ error: "Coach provisioning is not configured" }, 503)

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null
  for (const key of serverKeys) {
    const candidate = createSupabaseAdminClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    // Read-only preflight: never create a user with an unverified server key.
    const { data: privilegedCoach, error: accessError } = await candidate.from("coaches")
      .select("id").eq("id", coachId).maybeSingle()
    if (!accessError && privilegedCoach?.id === coach.id) {
      admin = candidate
      break
    }
  }
  if (!admin) {
    return reply({
      error: "Coach account service cannot access this Supabase project. An Admin must update the server-only Supabase secret key in Vercel.",
    }, 503)
  }
  const email = coach.username ? coachAliasEmail(coach.username) : null
  if (!email) return reply({ error: "Coach username not configured" }, 400)

  const temporaryPassword = randomBytes(24).toString("base64url")
  if (action === "reset") {
    if (!coach.user_id) return reply({ error: "Coach login has not been provisioned" }, 409)
    const { data: profileCheck, error: profileError } = await admin.from("profiles")
      .select("id,role").eq("id",coach.user_id).maybeSingle()
    if (profileError || profileCheck?.role !== "coach") return reply({ error: "Account role mismatch" }, 409)
    const { data: linkedAuth, error: linkedError } = await admin.auth.admin.getUserById(coach.user_id)
    if (linkedError || linkedAuth.user?.email?.toLowerCase() !== email) return reply({ error: "Account identity mismatch" }, 409)
    const { error: resetError } = await admin.auth.admin.updateUserById(coach.user_id, { password: temporaryPassword })
    if (resetError) return reply({ error: "Unable to reset coach password" }, 500)
    return reply({ username: coach.username, temporaryPassword, message: "Password reset. Give this new password privately to the coach." })
  }

  if (coach.user_id) return reply({ error: "This coach already has a linked account. Use Reset password instead." }, 409)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: coach.display_name },
    app_metadata: { bearfit_coach_login: true },
  })
  if (createError || !created.user) {
    if (createError?.status === 401 || createError?.status === 403) {
      return reply({ error: "Supabase server credentials cannot create Auth users. Check this project's server-only secret key in Vercel." }, 503)
    }
    return reply({ error: "Unable to create coach account. It may already exist." }, 409)
  }

  // The auth.users signup trigger creates a member profile; upgrade it to a
  // coach role before linking so new credentials never inherit broad staff access.
  const userId = created.user.id
  const { data: updatedProfile, error: profileUpdateError } = await admin.from("profiles").upsert({
    id: userId, role: "coach", full_name: coach.display_name, branch: coach.branch,
  }, { onConflict: "id" }).select("id").maybeSingle()
  if (profileUpdateError || !updatedProfile) {
    await admin.auth.admin.deleteUser(userId)
    return reply({ error: "Coach profile setup failed; account creation was rolled back" }, 500)
  }
  const { data: linkedCoach, error: linkedCoachError } = await admin.from("coaches")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq("id", coach.id).is("user_id", null).select("id").maybeSingle()
  if (linkedCoachError || !linkedCoach) {
    await admin.auth.admin.deleteUser(userId)
    return reply({ error: "Coach account linkage could not be confirmed; account creation was rolled back" }, 409)
  }

  return reply({ username: coach.username, temporaryPassword, message: "Coach account created and linked. Copy the temporary password now; it will not be shown again." }, 201)
}
