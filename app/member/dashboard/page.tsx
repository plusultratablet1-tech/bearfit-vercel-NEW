import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import MemberDashboardPageClient from "./MemberDashboardPageClient"

export default async function MemberDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/welcome")
  }

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  return <MemberDashboardPageClient user={user} member={member ?? null} />
}
