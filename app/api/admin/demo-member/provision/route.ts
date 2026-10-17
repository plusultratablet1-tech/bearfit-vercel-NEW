import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEMO_ID = "DEMO-NATHAN-001"
const DEMO_EMAIL = "nathan.demo@bearfit.example.invalid"

function reply(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  })
}

export async function POST(request: Request) {
  // Vercel preview deployments may point to the production Supabase project.
  // Do not allow a preview visit to provision a production authentication user.
  if (process.env.VERCEL_ENV === "preview") {
    return reply({ error: "Activate demo credentials only after approved production release" }, 403)
  }
  // This single-purpose action never accepts caller-supplied IDs, roles,
  // emails, passwords, branches, or package/session changes.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return reply({ error: "Cross-site requests are not allowed" }, 403)
  }
  const origin = request.headers.get("origin")
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return reply({ error: "Request origin mismatch" }, 403)
  }

  const session = await createClient()
  const { data: { user }, error: authError } = await session.auth.getUser()
  if (authError || !user) return reply({ error: "Authentication required" }, 401)

  const { data: caller, error: profileError } = await session
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profileError || caller?.role !== "admin") {
    return reply({ error: "Admin access required" }, 403)
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!key || !url) return reply({ error: "Secure account provisioning is not configured" }, 503)

  const admin = createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: demo, error: demoError } = await admin
    .from("members")
    .select("id,full_name,email,branch,is_demo,user_id,membership_id,status")
    .eq("membership_id", DEMO_ID)
    .eq("is_demo", true)
    .maybeSingle()

  if (demoError || !demo || demo.email !== DEMO_EMAIL || demo.status !== "inactive") {
    return reply({ error: "The expected inactive Nathan demo record is missing or changed" }, 409)
  }
  if (demo.user_id) {
    return reply({ error: "Nathan's demo account is already linked. No password was changed." }, 409)
  }

  const temporaryPassword = randomBytes(24).toString("base64url")
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: demo.full_name },
    app_metadata: { bearfit_demo_member_login: true },
  })
  if (createError || !created.user) {
    // Do not disclose account enumeration or internal authentication errors.
    return reply({ error: "Unable to create the demo sign-in. Verify the Auth configuration." }, 409)
  }

  const createdUserId = created.user.id
  let linkedTarget = false
  const rollback = async () => {
    if (linkedTarget) {
      await admin.from("members").update({ user_id: null })
        .eq("id", demo.id).eq("user_id", createdUserId).eq("is_demo", true)
    }
    await admin.auth.admin.deleteUser(createdUserId)
  }

  // Existing signup trigger creates a second member automatically. Immediately
  // reclassify it as inactive/demo before touching the desired existing record.
  const { data: autoMember, error: autoError } = await admin
    .from("members")
    .update({
      is_demo: true,
      user_id: null,
      status: "inactive",
      membership_status: "inactive",
      total_sessions: 0,
      sessions_used: 0,
      sessions_left: 0,
      total_paid: 0,
      payment_status: "not_recorded",
    })
    .eq("user_id", createdUserId)
    .select("id")
    .maybeSingle()
  if (autoError || !autoMember) {
    await rollback()
    return reply({ error: "Demo signup isolation failed; newly created account was rolled back" }, 500)
  }

  const { data: linked, error: linkError } = await admin
    .from("members")
    .update({ user_id: createdUserId })
    .eq("id", demo.id).eq("is_demo", true).is("user_id", null)
    .select("id")
    .maybeSingle()
  if (linkError || !linked) {
    await rollback()
    return reply({ error: "Could not link the Nathan demo membership" }, 409)
  }
  linkedTarget = true

  const { data: profile, error: updateError } = await admin
    .from("profiles")
    .update({
      role: "member",
      member_id: demo.id,
      membership_id: demo.membership_id,
      full_name: demo.full_name,
      branch: demo.branch,
    })
    .eq("id", createdUserId).eq("role", "member")
    .select("id,member_id,role")
    .maybeSingle()
  if (updateError || !profile || profile.member_id !== demo.id || profile.role !== "member") {
    await rollback()
    return reply({ error: "Member role/profile verification failed; account rolled back" }, 500)
  }

  // The trigger-created empty member is safe to remove only after the verified
  // profile has been relinked. This does not delete the original demo record.
  const { data: cleanup, error: cleanupError } = await admin.from("members")
    .delete().eq("id", autoMember.id).eq("is_demo", true).is("user_id", null)
    .select("id").maybeSingle()
  if (cleanupError || !cleanup) {
    // Linked login is valid; do not discard the generated temporary password.
    return reply({
      email: DEMO_EMAIL,
      temporaryPassword,
      role: "member",
      memberId: demo.membership_id,
      warning: "Login is ready, but an extra empty demo row needs Admin cleanup.",
    }, 201)
  }

  return reply({
    email: DEMO_EMAIL,
    temporaryPassword,
    role: "member",
    memberId: demo.membership_id,
    redirectTo: "/member/dashboard",
    message: "Nathan's existing dummy membership is linked. Copy the temporary password now.",
  }, 201)
}
