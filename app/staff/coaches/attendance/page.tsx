import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import CoachAttendanceAdminClient from "./CoachAttendanceAdminClient"

export default async function AdminCoachAttendancePage() {
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) redirect("/login")
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle()
  if(profile?.role!=="admin") redirect("/staff/coaches")
  return <CoachAttendanceAdminClient />
}
