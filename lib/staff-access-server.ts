import {cache} from "react"
import {redirect} from "next/navigation"
import {createClient} from "@/lib/supabase/server"

// React's cache is scoped to one server render/request, NEVER shared between users.
// When /staff/layout.tsx and its active page render together, reuse the same
// verified auth result, profile lookup and RLS-scoped Supabase client.
export const getStaffAccess = cache(async () => {
  const supabase = await createClient()
  const {data:{user},error} = await supabase.auth.getUser()
  if(error || !user) redirect("/login")
  const {data:profile,error:profileError} = await supabase
    .from("profiles").select("role").eq("id",user.id).maybeSingle()
  if(profileError) throw new Error("Unable to verify staff permissions")
  const role = profile?.role
  if(role!=="admin" && role!=="staff") redirect("/launch")
  return {supabase,user,role}
})
