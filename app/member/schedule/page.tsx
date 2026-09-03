import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { loadMemberScheduleData } from "@/lib/scheduling"
import MemberSchedulePageClient from "./MemberSchedulePageClient"

export default async function MemberSchedulePage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect("/login")
  const data = await loadMemberScheduleData(user.id)
  if (!data.member) redirect("/welcome")
  return <MemberSchedulePageClient initialData={data} />
}
