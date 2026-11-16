import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { adminAliasEmail } from "@/lib/coach-login"

export const runtime = "nodejs"

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Pragma": "no-cache" },
  })
}

// Fixed, reserved identity. This endpoint never accepts a caller-selected
// email, role, user ID, password, or permission level.
const username = "admin1"
const aliasEmail = adminAliasEmail(username)

export async function POST(request: Request) {
  // Session-cookie-backed mutations require a same-origin request.
  const origin = request.headers.get("origin")
  if (!origin || origin !== new URL(request.url).origin) {
    return reply({ error: "Same-origin request required" }, 403)
  }

  const session = await createClient()
  const { data: { user }, error: sessionError } = await session.auth.getUser()
  if (sessionError || !user) return reply({ error: "Sign in as a current BearFit Admin first" }, 401)
  const { data: currentProfile, error: roleError } = await session
    .from("profiles").select("id,role,branch").eq("id", user.id).maybeSingle()
  if (roleError || currentProfile?.role !== "admin") {
    return reply({ error: "An existing administrator must approve this account" }, 403)
  }
  if (!aliasEmail) return reply({ error: "Admin alias configuration error" }, 500)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serverKeys = [...new Set(
    [process.env.BEARFIT_SUPABASE_SECRET_KEY,
     process.env.SUPABASE_SECRET_KEY,
     process.env.SUPABASE_SERVICE_ROLE_KEY]
      .filter((key): key is string => Boolean(key?.trim()))
  )]
  if (!url || serverKeys.length === 0) {
    return reply({ error: "Supabase admin provisioning is not configured" }, 503)
  }

  // Verify this server key can see the logged-in Admin's exact profile in
  // this database before any privileged write. Integration keys can be stale.
  let admin = createSupabaseAdminClient(url, serverKeys[0], {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  let privilegedAccessVerified = false
  for (const key of serverKeys) {
    const candidate = createSupabaseAdminClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: verified, error: verifyError } = await candidate.from("profiles")
      .select("id,role").eq("id",user.id).maybeSingle()
    if (!verifyError && verified?.id === user.id && verified.role === "admin") {
      admin = candidate
      privilegedAccessVerified = true
      break
    }
  }
  if (!privilegedAccessVerified) return reply({ error: "The server's Supabase Admin key is not authorized for this project" }, 503)

  // A second click must never reset or overwrite an existing account.
  const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({
    page: 1, perPage: 1000,
  })
  if (listError || !existingUsers) return reply({ error: "Unable to confirm whether admin1 already exists" }, 503)
  if (existingUsers.users.some((item) => item.email?.toLowerCase() === aliasEmail)) {
    return reply({ error: "admin1 already exists. Existing credentials were left unchanged." }, 409)
  }

  // The existing auth.users trigger rejects reserved @accounts.bearfit.invalid
  // INSERTs and automatically creates a member during regular sign-up.
  // First create a private one-off temporary identity via the supported Auth
  // Admin API, promote ONLY its brand-new profile, remove ONLY its generated
  // temporary member record, then rename the Auth user to the reserved alias.
  const tempEmail = "admin1-setup-" + randomBytes(12).toString("hex") + "@setup.bearfit.invalid"
  const temporaryPassword = randomBytes(24).toString("base64url")
  let newUserId: string | null = null
  let temporaryMemberId: string | null = null
  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: tempEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: "BearFit Admin 1" },
    })
    if (createError || !created.user) {
      return reply({ error: "Auth could not create the new account" }, 502)
    }
    newUserId = created.user.id

    const { data: memberProfile, error: memberProfileError } = await admin.from("profiles")
      .select("id,role,member_id").eq("id",newUserId).maybeSingle()
    if (memberProfileError || memberProfile?.role !== "member" || !memberProfile.member_id) {
      throw new Error("New account setup did not create the expected linked temporary member")
    }
    temporaryMemberId = memberProfile.member_id

    const { data: promoted, error: promotionError } = await admin.from("profiles").update({
      role: "admin",
      member_id: null,
      membership_id: null,
      full_name: "BearFit Admin 1",
      branch: currentProfile.branch,
    }).eq("id",newUserId).eq("role","member").eq("member_id",temporaryMemberId)
      .select("id,role,member_id").maybeSingle()
    if (promotionError || promoted?.id !== newUserId || promoted.role !== "admin" || promoted.member_id !== null) {
      throw new Error("New account admin profile could not be confirmed")
    }

    // Safeguards prevent deletion of anyone's existing member or activity.
    const { data: removed, error: removeError } = await admin.from("members")
      .delete().eq("id",temporaryMemberId).eq("user_id",newUserId)
      .eq("sessions_used",0).eq("total_paid",0).select("id")
    if (removeError || removed?.length !== 1) {
      throw new Error("New account's automatically generated member record could not be removed")
    }
    temporaryMemberId = null

    const { data: renamed, error: renameError } = await admin.auth.admin.updateUserById(newUserId,{
      email: aliasEmail,
      email_confirm: true,
    })
    if (renameError || renamed.user?.email?.toLowerCase() !== aliasEmail) {
      throw new Error("Reserved admin username could not be assigned")
    }

    const { data: authCheck, error: authCheckError } = await admin.auth.admin.getUserById(newUserId)
    const { data: roleCheck, error: roleCheckError } = await admin.from("profiles")
      .select("role,member_id").eq("id",newUserId).maybeSingle()
    if (authCheckError || roleCheckError || authCheck.user?.email !== aliasEmail ||
        roleCheck?.role !== "admin" || roleCheck.member_id !== null) {
      throw new Error("Final auth and role verification failed")
    }

    console.info("BearFit admin1 provisioned", { issuedBy: user.id, newUserId })
    return reply({
      username,
      temporaryPassword,
      message: "Admin1 is created and linked to the Admin role. Save the temporary password now.",
    }, 201)
  } catch (err) {
    let rollbackVerified = false
    if (newUserId) {
      // Roll back exclusively the account created during this call.
      if (temporaryMemberId) {
        await admin.from("profiles").update({ member_id: null, membership_id: null })
          .eq("id",newUserId)
        await admin.from("members").delete()
          .eq("id",temporaryMemberId).eq("user_id",newUserId)
          .eq("sessions_used",0).eq("total_paid",0)
      }
      const { error: deleteError } = await admin.auth.admin.deleteUser(newUserId)
      rollbackVerified = !deleteError
    }
    console.error("BearFit admin1 provisioning failed", {
      reason: err instanceof Error ? err.message : "Unknown error",
      issuedBy: user.id,
      rollbackVerified,
    })
    return reply({
      error: rollbackVerified
        ? "Admin1 setup failed; the newly created account was rolled back."
        : "Admin1 setup could not be verified. Contact support before retrying.",
    }, 500)
  }
}
