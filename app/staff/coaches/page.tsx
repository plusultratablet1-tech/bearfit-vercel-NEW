import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import CoachesPageClient from "./CoachesPageClient"

export default async function CoachesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "staff" && profile?.role !== "admin") redirect("/member/dashboard")

  return <CoachesPageClient role={profile.role} />
}
