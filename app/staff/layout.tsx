import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import StaffPersistentShell from "@/components/bearfit/StaffPersistentShell"

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {data:{user},error} = await supabase.auth.getUser()
  if(error || !user) redirect("/login")

  const {data:profile} = await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle()
  const role = profile?.role
  if(role!=="admin" && role!=="staff") redirect("/launch")

  return <StaffPersistentShell role={role}>{children}</StaffPersistentShell>
}
