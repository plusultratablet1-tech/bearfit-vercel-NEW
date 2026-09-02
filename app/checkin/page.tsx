import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import CheckInPageClient from "./CheckInPageClient"

export default async function CheckInPage() {
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

  return <CheckInPageClient role={role} />
}
