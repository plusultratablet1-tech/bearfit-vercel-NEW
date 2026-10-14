import {redirect} from "next/navigation"
import {getStaffAccess} from "@/lib/staff-access-server"
import {dayWindow,selectedDay,type ReconciliationData,type Member,type Coach,type Payment,type Attendance,type Booking,type WorkShift,type ClockShift,type Conduction,type Guest} from "@/lib/daily-reconciliation"
import ReconciliationClient from "./ReconciliationClient"

// This page is a read-only investigation view. It never approves payments,
// adjusts member balances, certifies a coach conduction, or closes a period.
export default async function DailyReconciliationPage({searchParams}:{searchParams:Promise<{date?:string}>}){
 const {supabase,role}=await getStaffAccess()
 if(role!=="admin")redirect("/staff/schedule")
 const {date:requestedDate}=await searchParams
 const date=selectedDay(requestedDate)
 const {from,to}=dayWindow(date)
 const [
  members,coaches,paid,flagged,missingPaidDate,attendance,bookings,plans,clockins,conductions,guests
 ]=await Promise.all([
  supabase.from("members").select("id,member_code,full_name,branch,is_demo").limit(3000),
  supabase.from("coaches").select("id,display_name,branch,is_demo").limit(500),
  supabase.from("payments").select("id,member_id,amount,status,paid_at,created_at,payment_type").eq("status","paid").gte("paid_at",from).lt("paid_at",to).limit(1000),
  supabase.from("payments").select("id,member_id,amount,status,paid_at,created_at,payment_type").in("status",["pending","failed","overdue"]).gte("created_at",from).lt("created_at",to).limit(1000),
  supabase.from("payments").select("id,member_id,amount,status,paid_at,created_at,payment_type").eq("status","paid").is("paid_at",null).gte("created_at",from).lt("created_at",to).limit(1000),
  supabase.from("session_logs").select("id,member_id,trained_at,booking_id,session_label").gte("trained_at",from).lt("trained_at",to).limit(1000),
  supabase.from("bookings").select("id,member_id,branch,status,start_at,end_at").gte("start_at",from).lt("start_at",to).limit(1000),
  supabase.from("coach_work_shifts").select("id,branch,coach_id,starts_at,response").gte("starts_at",from).lt("starts_at",to).limit(1000),
  supabase.from("coach_shifts").select("id,branch,coach_id,clock_in_at,clock_out_at").gte("clock_in_at",from).lt("clock_in_at",to).limit(1000),
  supabase.from("coach_conductions").select("id,member_id,coach_id,branch,status,session_date,rate_snapshot").eq("session_date",date).limit(1000),
  supabase.from("guest_invites").select("id,branch,host_member_id,status,purpose,visit_day,entered_at,amount_verified,payment_reference").eq("visit_day",date).limit(1000)
 ])
 // Resolve booked visits crossing the selected-day boundary without guessing branch.
 const presentIds=new Set((bookings.data??[]).map(b=>b.id))
 const missingBookingIds=[...new Set((attendance.data??[]).map(a=>a.booking_id)
  .filter((id):id is string=>typeof id==="string"&&!presentIds.has(id)))]
 const linkedBookings=missingBookingIds.length>0&&missingBookingIds.length<=200
  ? await supabase.from("bookings").select("id,member_id,branch,status,start_at,end_at").in("id",missingBookingIds).limit(200)
  : {data:[] as Booking[],error:null}
 const results={members,coaches,paid,flagged,missingPaidDate,attendance,bookings,linkedBookings,plans,clockins,conductions,guests}
 const caps:Record<string,number>={members:3000,coaches:500}
 const failed=Object.entries(results).flatMap(([key,r])=>[
   ...(r.error?[key]:[]),
   ...((r.data?.length??0)>=(caps[key]??(key==="linkedBookings"?200:1000))?[key+"-limit"]:[])
 ])
 if(missingBookingIds.length>200)failed.push("linkedBookings-limit")
 const data:ReconciliationData={
  date,
  members:(members.data??[]) as Member[],
  coaches:(coaches.data??[]) as Coach[],
  paid:(paid.data??[]) as Payment[],
  flagged:(flagged.data??[]) as Payment[],
  missingPaidDate:(missingPaidDate.data??[]) as Payment[],
  attendance:(attendance.data??[]) as Attendance[],
  bookings:(bookings.data??[]) as Booking[],
  linkedBookings:(linkedBookings.data??[]) as Booking[],
  plans:(plans.data??[]) as WorkShift[],
  clockins:(clockins.data??[]) as ClockShift[],
  conductions:(conductions.data??[]) as Conduction[],
  guests:(guests.data??[]) as Guest[],
  failed
 }
 return <ReconciliationClient data={data}/>
}
