import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { loadMemberPaymentsData } from "@/lib/member-payments-server"
import MemberPaymentsPageClient from "./MemberPaymentsPageClient"

export default async function MemberPaymentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect("/login")

  const data = await loadMemberPaymentsData(user.id)
  const role = data.profile?.role

  if (role === "staff" || role === "admin") redirect("/payments")
  if (!data.member) redirect("/welcome")

  return <MemberPaymentsPageClient data={data} />
}
