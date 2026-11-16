import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import CoachHomeClient from "./CoachHomeClient"

export default async function CoachHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle()
  if (profile?.role !== "coach") redirect("/launch")
  const { data: coach } = await supabase.from("coaches")
    .select("id,display_name,branch,username,is_active").eq("user_id",user.id).maybeSingle()
  let allowedBranches: string[] | undefined
  if (coach?.username?.toLowerCase() === "coachnate") {
    const {data:grants,error:grantError} = await supabase.from("coach_branch_access")
      .select("branch").eq("coach_id",coach.id)
    if (grantError || !grants || grants.length !== 3) {
      throw new Error("CoachNate branch permissions are not ready; contact Admin")
    }
    allowedBranches = [...new Set(grants.map(grant=>grant.branch))]
  }
  return <CoachHomeClient coach={coach ? {...coach,allowedBranches} : null} />
}
