import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import StaffMembersPageClient, { type MemberDirectoryItem } from "./StaffMembersPageClient"

export default async function StaffMembersPage() {
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
  if (role !== "staff" && role !== "admin") redirect("/member/dashboard")

  const { data, error } = await supabase
    .from("members")
    .select(
      "id,member_code,membership_id,name,full_name,email,phone,branch,package_name,package_type,status,membership_status,total_sessions,sessions_used,sessions_left,payment_status,last_paid_at,last_paid_amount,total_paid,join_date,is_demo",
    )
    .order("full_name", { ascending: true })

  return (
    <StaffMembersPageClient
      role={role}
      initialMembers={(data ?? []) as MemberDirectoryItem[]}
      loadError={error?.message ?? null}
    />
  )
}
