import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import CoachHomeClient from "../CoachHomeClient"
import CoachQrPage from "../CoachQrPage"

const sections = ["schedule","scan-qr","activity","payments","profile"] as const
type Section = typeof sections[number]

export default async function CoachSectionPage({
  params,
}: {
  params: Promise<{section:string}>
}) {
  const {section}=await params
  if (!sections.includes(section as Section)) notFound()
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if (!user) redirect("/login")
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle()
  if (profile?.role!=="coach") redirect("/launch")
  const {data:coach}=await supabase.from("coaches")
    .select("id,display_name,branch,username,is_active").eq("user_id",user.id).maybeSingle()
  if(section==="scan-qr") return <CoachQrPage/>
  return <CoachHomeClient coach={coach||null} tab={section as "schedule"|"activity"|"payments"|"profile"}/>
}
