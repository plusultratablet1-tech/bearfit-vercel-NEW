import {getStaffAccess} from "@/lib/staff-access-server"
import Link from "next/link"
import {notFound,redirect} from "next/navigation"
import MemberEditClient from "./MemberEditClient"

export default async function MemberEditPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 const {supabase,role}=await getStaffAccess()
 if(role!=="admin")redirect("/staff/members/"+id)
 const [memberResult,coachResult,historyResult]=await Promise.all([
  supabase.from("members").select("id,member_code,full_name,email,phone,address,emergency_contact_name,emergency_contact_phone,branch,coach_name,membership_status,updated_at").eq("id",id).maybeSingle(),
  supabase.from("coaches").select("display_name,branch").eq("is_active",true).order("display_name"),
  supabase.from("member_profile_edit_events").select("id,changed_at,admin_user_id,previous_values,new_values,reason").eq("member_id",id).order("changed_at",{ascending:false}).limit(30)
 ])
 if(!memberResult.data)notFound()
 return <MemberEditClient initial={memberResult.data} coaches={coachResult.data||[]}
    events={historyResult.data||[]} loadError={[coachResult.error?.message,historyResult.error?.message].filter(Boolean).join(" / ")}/>
}
