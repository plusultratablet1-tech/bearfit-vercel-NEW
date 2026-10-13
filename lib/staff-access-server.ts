import * as React from "react"
import {redirect} from "next/navigation"
import {createClient} from "@/lib/supabase/server"

// A fresh, RLS-scoped Supabase client and fully verified role are required
// for EVERY server request. Never store these results between requests.
async function loadVerifiedStaffAccess(){
  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  if(error || !user) redirect("/login")
  const {data:profile,error:profileError}=await supabase
    .from("profiles").select("role").eq("id",user.id).maybeSingle()
  if(profileError) throw new Error("Unable to verify staff permissions")
  const role=profile?.role
  if(role!=="admin" && role!=="staff") redirect("/launch")
  return {supabase,user,role}
}

// React 19 supports cache() in Server Components. React 18 may not expose it,
// so preserve correctness by falling back to the same verified request.
// On supported versions, React's cache automatically expires each request.
const reactRequestCache = (
  React as unknown as {cache?: (fn: typeof loadVerifiedStaffAccess)=>typeof loadVerifiedStaffAccess}
).cache
export const getStaffAccess = typeof reactRequestCache==="function"
  ? reactRequestCache(loadVerifiedStaffAccess)
  : loadVerifiedStaffAccess
