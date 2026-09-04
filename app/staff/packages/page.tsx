import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import StaffPackagesPageClient, { type StaffPackageSnapshot } from "./StaffPackagesPageClient"

export default async function StaffPackagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = profile?.role ?? "member"
  if (role !== "staff" && role !== "admin") redirect("/member/dashboard")
  const { data, error } = await supabase.rpc("staff_package_catalog")
  return <StaffPackagesPageClient role={role as "staff"|"admin"} initialSnapshot={(data ?? {packages:[],stages:[]}) as StaffPackageSnapshot} initialError={error?.message ?? null}/>
}
