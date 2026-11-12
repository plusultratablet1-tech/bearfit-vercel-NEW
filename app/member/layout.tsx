import type {ReactNode} from "react"
import {redirect} from "next/navigation"
import MemberPersistentShell from "@/components/bearfit/MemberPersistentShell"
import {createClient} from "@/lib/supabase/server"

export default async function MemberLayout({children}:{children:ReactNode}){
 // Enforce a one-time password update for provisioned member ID aliases.
 // Authorization is always checked from server-issued Auth app metadata;
 // a client cannot self-clear the policy by editing user_metadata.
 const supabase=await createClient()
 const {data:{user}}=await supabase.auth.getUser()
 if(user?.app_metadata?.bearfit_must_change_password===true){
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle()
  if(profile?.role==="member")redirect("/account/change-password")
 }
 return <MemberPersistentShell>{children}</MemberPersistentShell>
}
