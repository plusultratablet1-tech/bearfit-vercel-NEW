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
  return <CoachHomeClient coach={coach || null} />
}
