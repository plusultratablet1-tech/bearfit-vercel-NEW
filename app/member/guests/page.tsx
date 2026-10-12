import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import MemberGuestsClient from "./MemberGuestsClient"

export default async function MemberGuestsPage(){
 const supabase=await createClient()
 const {data:{user}}=await supabase.auth.getUser()
 if(!user) redirect("/login")
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle()
 if(profile?.role!=="member") redirect("/launch")
 const {data:member}=await supabase.from("members").select("branch,full_name,member_code,membership_status,status").eq("user_id",user.id).maybeSingle()
 return <MemberGuestsClient branch={member?.branch||""} memberActive={((member?.membership_status||member?.status)||"").toLowerCase()==="active"}/>
}
