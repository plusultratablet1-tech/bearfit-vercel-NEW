import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { coachAliasEmail } from "@/lib/coach-login"
import { BRANCH_IDS } from "@/lib/branches"

export const runtime = "nodejs"

const coachLogin = "CoachNate"
const authEmail = coachAliasEmail(coachLogin)
const temporaryUsername = "coach6"
const temporaryEmail = coachAliasEmail(temporaryUsername)
const homeBranch = "Malingap Branch"
const coachName = "Nate"

function reply(body: Record<string,unknown>, status = 200) {
  return NextResponse.json(body, {status, headers:{"Cache-Control":"no-store"}})
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin || origin !== new URL(request.url).origin) {
    return reply({error:"Same-origin request required"},403)
  }
  if (!authEmail || !temporaryEmail || !BRANCH_IDS.includes(homeBranch)) {
    return reply({error:"Account alias configuration unavailable"},500)
  }

  const session = await createClient()
  const {data:{user},error:authError} = await session.auth.getUser()
  if (authError || !user) return reply({error:"Existing BearFit Admin sign-in required"},401)
  const {data:profile,error:profileError} = await session.from("profiles")
    .select("id,role").eq("id",user.id).maybeSingle()
  if (profileError || profile?.role !== "admin") return reply({error:"Administrator access required"},403)

  // Use the same proven server-only Supabase credential strategy as existing
  // BearFit coach provisioning. No browser or database row receives this key.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const keys = [...new Set(
    [process.env.BEARFIT_SUPABASE_SECRET_KEY,
      process.env.SUPABASE_SECRET_KEY,
      process.env.SUPABASE_SERVICE_ROLE_KEY]
      .filter((key):key is string=>Boolean(key?.trim()))
  )]
  if (!url || !keys.length) return reply({error:"Coach account service is unavailable"},503)
  let admin = createSupabaseAdminClient(url,keys[0],{
    auth:{persistSession:false,autoRefreshToken:false},
  })
  let privileged = false
  for (const key of keys) {
    const candidate = createSupabaseAdminClient(url,key,{
      auth:{persistSession:false,autoRefreshToken:false},
    })
    const {data:staff,error:e} = await candidate.from("profiles")
      .select("id,role").eq("id",user.id).maybeSingle()
    if (!e && staff?.id===user.id && staff.role==="admin") {
      admin=candidate; privileged=true; break
    }
  }
  if (!privileged) return reply({error:"Server keys cannot verify this BearFit project"},503)

  const {data:existingNate,error:nateError} = await admin.from("coaches")
    .select("id,username,user_id").ilike("display_name","%nate%").limit(4)
  const {data:existingCoach6,error:coach6Error} = await admin.from("coaches")
    .select("id").eq("username",temporaryUsername).maybeSingle()
  const {data:reservedUsername,error:reservedError} = await admin.from("coaches")
    .select("id").ilike("username","coachnate").maybeSingle()
  if (nateError || coach6Error || reservedError) {
    return reply({error:"Unable to confirm Nate's coach roster and username availability"},503)
  }
  if ((existingNate?.length||0)>0 || existingCoach6 || reservedUsername) {
    return reply({error:"A Nate or reserved coach account already exists; nothing was overwritten"},409)
  }

  const {data:allUsers,error:usersError} = await admin.auth.admin.listUsers({page:1,perPage:1000})
  if (usersError || !allUsers) return reply({error:"Unable to confirm authentication username availability"},503)
  if (allUsers.users.some(x=>[authEmail,temporaryEmail].includes(x.email?.toLowerCase()||""))) {
    return reply({error:"A reserved coach login is already in use; no changes made"},409)
  }
  const originalAdmin1 = allUsers.users.find(x=>x.email?.toLowerCase()==="admin1@accounts.bearfit.invalid")
  if (!originalAdmin1) return reply({error:"Existing admin1 account could not be verified"},409)
  const {data:admin1Profile,error:admin1Error} = await admin.from("profiles")
    .select("id,role").eq("id",originalAdmin1.id).maybeSingle()
  if (admin1Error || admin1Profile?.role!=="admin") return reply({error:"admin1 has no verified administrator role"},409)

  const temporaryPassword = randomBytes(28).toString("base64url")
  let createdCoachId:string|null = null
  let createdUserId:string|null = null
  let rolledBack = false

  try {
    // coach6 is strictly temporary and never issued as a username.
    // Existing protected auth.users signup trigger authorizes numbered coaches
    // only via an Admin-issued one-time, five-minute token.
    const {data:coach,error:coachError} = await admin.from("coaches").insert({
      display_name:coachName,branch:homeBranch,
      username:temporaryUsername,is_active:true,is_demo:false,
      scheduling_specialization:"strength_conditioning",
    }).select("id").maybeSingle()
    if (coachError || !coach) throw new Error("Failed to create Nate's coach roster")
    createdCoachId=coach.id

    const {data:signupToken,error:tokenError} = await session.rpc(
      "admin_issue_coach_signup_token",{p_coach_id:coach.id},
    )
    if (tokenError || typeof signupToken!=="string" || signupToken.length!==64) {
      throw new Error("Admin one-time coach signup authorization failed")
    }

    const {data:created,error:createError} = await admin.auth.admin.createUser({
      email:temporaryEmail,password:temporaryPassword,email_confirm:true,
      user_metadata:{full_name:coachName,bearfit_coach_signup_token:signupToken},
      app_metadata:{bearfit_coach_login:true},
    })
    if (createError || !created.user) throw new Error("Supabase Auth could not create Nate's coach login")
    createdUserId=created.user.id

    const {data:createdProfile,error:createdProfileError} = await admin.from("profiles")
      .select("id,role").eq("id",createdUserId).maybeSingle()
    if (createdProfileError || createdProfile?.role!=="coach") {
      throw new Error("Coach role was not confirmed by the protected signup trigger")
    }

    // Renaming the already-authorized Auth user does not trigger a new signup.
    const {data:renamed,error:renameError} = await admin.auth.admin.updateUserById(createdUserId,{
      email:authEmail,email_confirm:true,
      user_metadata:{full_name:coachName},
    })
    if (renameError || renamed.user?.email?.toLowerCase()!==authEmail) {
      throw new Error("Could not apply permanent CoachNate login")
    }
    const {data:linked,error:linkError} = await admin.from("coaches")
      .update({username:"coachnate",user_id:createdUserId,updated_at:new Date().toISOString()})
      .eq("id",createdCoachId).eq("username",temporaryUsername).is("user_id",null)
      .select("id,user_id,username").maybeSingle()
    if (linkError || !linked || linked.user_id!==createdUserId || linked.username!=="coachnate") {
      throw new Error("Could not link permanent username to Nate's coach record")
    }

    const {error:profileBranchError} = await admin.from("profiles")
      .update({full_name:coachName,branch:homeBranch})
      .eq("id",createdUserId).eq("role","coach")
    if (profileBranchError) throw new Error("Could not configure Nate's coach profile")

    const {data:grants,error:grantError} = await admin.from("coach_branch_access").insert(
      BRANCH_IDS.map(branch=>({coach_id:createdCoachId,branch,granted_by:user.id}))
    ).select("branch")
    if (grantError || grants?.length!==BRANCH_IDS.length) {
      throw new Error("Unable to assign all three BearFit branches")
    }

    const {data:authCheck,error:authCheckError} = await admin.auth.admin.getUserById(createdUserId)
    const {data:linkedProfile,error:linkedProfileError} = await admin.from("profiles")
      .select("id,role").eq("id",createdUserId).maybeSingle()
    const {data:linkedCoach,error:linkedCoachError} = await admin.from("coaches")
      .select("user_id,username,branch").eq("id",createdCoachId).maybeSingle()
    if (authCheckError || linkedProfileError || linkedCoachError ||
        authCheck.user?.email!==authEmail || linkedProfile?.role!=="coach" ||
        linkedCoach?.user_id!==createdUserId || linkedCoach?.username!=="coachnate") {
      throw new Error("Final Nate coach identity verification failed")
    }

    console.info("CoachNate provisioned",{adminId:user.id,coachId:createdCoachId})
    return reply({
      username:coachLogin,temporaryPassword,
      coachId:createdCoachId,
      branches:[...BRANCH_IDS],
      adminLogin:"admin1",
      message:"CoachNate created for three branches. Admin1 was not modified.",
    },201)
  } catch(error) {
    // Rollback touches ONLY this operation's new coach and Auth user.
    // It never changes the existing admin1 account or any gym activity.
    try {
      if(createdUserId) {
        const {error:deleteUserError} = await admin.auth.admin.deleteUser(createdUserId)
        if (deleteUserError) throw deleteUserError
      }
      if(createdCoachId) {
        const {error:deleteCoachError} = await admin.from("coaches")
          .delete().eq("id",createdCoachId).eq("display_name",coachName)
        if (deleteCoachError) throw deleteCoachError
      }
      rolledBack=true
    } catch(rollbackError) {
      console.error("CoachNate rollback could not be verified", {
        adminId:user.id,coachId:createdCoachId,
        error:rollbackError instanceof Error?rollbackError.message:"unknown",
      })
    }
    console.error("CoachNate provisioning failed",{
      adminId:user.id,coachId:createdCoachId,
      error:error instanceof Error?error.message:"unknown",
      rolledBack,
    })
    return reply({
      error:rolledBack
        ? "CoachNate setup failed. New provisional records were rolled back."
        : "CoachNate setup is incomplete. Ask Admin to review before retrying.",
    },500)
  }
}
