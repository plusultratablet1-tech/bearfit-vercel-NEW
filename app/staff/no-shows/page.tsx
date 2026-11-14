import {redirect} from "next/navigation"
import {getStaffAccess} from "@/lib/staff-access-server"
import AdminNoShowClient from "./AdminNoShowClient"
export default async function AdminNoShowsPage(){
 const {supabase,role}=await getStaffAccess()
 if(role!=="admin")redirect("/staff/schedule")
 const {data,error}=await supabase.from("booking_no_show_cases")
  .select("id,booking_id,report_kind,report_notes,reported_at,reported_by,status,decision_note,reviewed_at,dispute_reason,dispute_at,member_acknowledged_at,dispute_resolution_note,members(member_code,full_name,branch),bookings(start_at,end_at,session_label,session_type,status,no_show_charged),booking_no_show_restorations(id,sessions_left_after)")
  .order("reported_at",{ascending:false}).limit(150)
 return <AdminNoShowClient initialCases={data??[]} loadError={error?.message??null}/>
}
