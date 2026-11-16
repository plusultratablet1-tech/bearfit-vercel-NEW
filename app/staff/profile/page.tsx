import { redirect } from "next/navigation"
import { getStaffAccess } from "@/lib/staff-access-server"
import AdminProfileClient from "./AdminProfileClient"

export const dynamic = "force-dynamic"

export default async function AdminProfilePage() {
  const { supabase, user, role } = await getStaffAccess()
  if (role !== "admin") redirect("/staff/schedule")

  const { data: profile, error } = await supabase
    .from("profiles").select("full_name,branch").eq("id", user.id).maybeSingle()
  if (error || !profile) throw new Error("Unable to load the current administrator profile")

  const authEmail = user.email ?? ""
  // The reserved .invalid address is an internal alias, not a real inbox.
  const match = authEmail.toLowerCase().match(/^(admin[1-9][0-9]{0,5})@accounts\.bearfit\.invalid$/)
  return (
    <AdminProfileClient
      expectedUserId={user.id}
      authEmail={authEmail}
      loginHandle={match?.[1] ?? authEmail}
      fullName={profile.full_name || "BearFit Administrator"}
      branch={profile.branch || "Not assigned"}
      usesUsername={Boolean(match)}
    />
  )
}
