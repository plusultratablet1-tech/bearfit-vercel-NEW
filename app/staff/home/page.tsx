import {redirect} from "next/navigation"
import {getStaffAccess} from "@/lib/staff-access-server"
import AdminHomeClient from "./AdminHomeClient"
import {manilaWindow,type HomeData,type HomeMember,type HomeBooking,type HomeGuest,type HomePayment,type HomeShift,type HomeCheckin} from "@/lib/admin-home"

export default async function AdminHomePage(){
 const {supabase,role}=await getStaffAccess()
 if(role!=="admin")redirect("/staff/schedule")
 const {day,startUtc,endUtc}=manilaWindow(new Date())
 const [members,bookings,pendingBookings,shifts,guests,pendingPayments,paidToday,checkins]=await Promise.all([
  supabase.from("members").select("id,branch,membership_status,status,sessions_left,payment_status").eq("is_demo",false).order("id").limit(2000),
  supabase.from("bookings").select("id,branch,status,start_at,requested_start_at").gte("start_at",startUtc).lt("start_at",endUtc).limit(1000),
  supabase.from("bookings").select("id,branch,status,start_at,requested_start_at").eq("status","pending").limit(1000),
  supabase.from("coach_work_shifts").select("id,branch,response,starts_at").gte("starts_at",startUtc).lt("starts_at",endUtc).limit(1000),
  supabase.from("guest_invites").select("id,branch,status,visit_day").in("status",["pending_payment","pending_approval"]).limit(1000),
  supabase.from("payments").select("id,member_id,amount,status,paid_at").in("status",["pending","failed","overdue"]).limit(1000),
  supabase.from("payments").select("id,member_id,amount,status,paid_at").eq("status","paid").gte("paid_at",startUtc).lt("paid_at",endUtc).limit(1000),
  supabase.from("session_logs").select("id,member_id,trained_at").gte("trained_at",startUtc).lt("trained_at",endUtc).limit(1000),
 ])
 const requests={members,bookings,pendingBookings,shifts,guests,pendingPayments,paidToday,checkins}
 const failed=Object.entries(requests).filter(([,result])=>Boolean(result.error)).map(([key])=>key)
 for(const [key,result] of Object.entries(requests)){
  if(result.data?.length=== (key==="members"?2000:1000))failed.push(key+"-limit")
 }
 const data:HomeData={
  members:(members.data??[]) as HomeMember[],
  bookings:(bookings.data??[]) as HomeBooking[],
  pendingBookings:(pendingBookings.data??[]) as HomeBooking[],
  shifts:(shifts.data??[]) as HomeShift[],
  guests:(guests.data??[]) as HomeGuest[],
  pendingPayments:(pendingPayments.data??[]) as HomePayment[],
  paidToday:(paidToday.data??[]) as HomePayment[],
  checkins:(checkins.data??[]) as HomeCheckin[],
  failed,todayLabel:day,startUtc,endUtc
 }
 return <AdminHomeClient data={data}/>
}
