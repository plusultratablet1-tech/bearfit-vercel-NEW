import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { loadMemberBearforceData } from "@/lib/bearforce"
import MemberBearforcePageClient from "./MemberBearforcePageClient"

export default async function MemberBearforcePage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role === "staff" || profile?.role === "admin") redirect("/staff/schedule")

  const data = await loadMemberBearforceData()
  return <MemberBearforcePageClient initialData={data} />
}
