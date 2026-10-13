import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function LaunchPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?source=pwa")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = profile?.role ?? "member"

  if (role === "admin") {
    redirect("/staff/home")
  }

  if (role === "staff") {
    redirect("/staff/schedule")
  }

  if (role === "coach") {
    redirect("/coach")
  }

  if (role === "member") {
    redirect("/member/dashboard")
  }

  redirect("/welcome")
}
