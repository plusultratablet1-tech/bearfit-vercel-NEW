import {redirect} from "next/navigation"
import {createClient} from "@/lib/supabase/server"
import MemberFreezeClient from "./MemberFreezeClient"

export default async function MemberFreezePage(){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) redirect("/login")
  const {data:member,error:memberError}=await supabase.from("members")
    .select("id,member_code,full_name").eq("user_id",user.id).maybeSingle()
  if(memberError||!member) redirect("/welcome")
  const [cyclesResult,requestsResult]=await Promise.all([
    supabase.from("member_package_cycles")
      .select("id,status,starts_at,expires_at,sessions_left,package_definitions(name,validity_days)")
      .eq("member_id",member.id).eq("status","active").order("created_at",{ascending:false}),
    supabase.from("package_freeze_requests").select("*")
      .eq("member_id",member.id).order("requested_at",{ascending:false}).limit(30)
  ])
  return <MemberFreezeClient userId={user.id} memberName={member.full_name}
    cycles={cyclesResult.data??[]} requests={requestsResult.data??[]}
    loadError={cyclesResult.error?.message??requestsResult.error?.message??null}/>
}
