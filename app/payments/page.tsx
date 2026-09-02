import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import PaymentsPageClient from "./PaymentsPageClient"

export default async function PaymentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = profile?.role ?? "member"
  if (role !== "staff" && role !== "admin") {
    redirect("/member/dashboard")
  }

  return <PaymentsPageClient role={role} />
}
