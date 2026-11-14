import {redirect} from "next/navigation"
import {createClient} from "@/lib/supabase/server"
import MemberNoShowClient from "./MemberNoShowClient"
export default async function MemberNoShowsPage(){
 const supabase=await createClient()
 const {data:{user}}=await supabase.auth.getUser()
 if(!user)redirect("/login")
 const {data:member}=await supabase.from("members").select("id").eq("user_id",user.id).maybeSingle()
 if(!member)redirect("/welcome")
 const {data,error}=await supabase.from("booking_no_show_cases")
  .select("id,booking_id,report_kind,report_notes,reported_at,status,decision_note,reviewed_at,member_first_seen_at,member_acknowledged_at,dispute_at,dispute_reason,dispute_resolution_note,bookings(start_at,session_label,session_type)")
  .eq("member_id",member.id).order("reported_at",{ascending:false}).limit(100)
 return <MemberNoShowClient initialCases={data??[]} loadError={error?.message??null}/>
}
