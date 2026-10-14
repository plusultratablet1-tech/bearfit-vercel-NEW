import {BEARFIT_BRANCHES,type BearFitBranch} from "@/lib/branches"
import {manilaWindow} from "@/lib/admin-home"

export type Scope=BearFitBranch|"ALL"
export type Member={id:string;member_code:string|null;full_name:string|null;branch:string;is_demo:boolean}
export type Coach={id:string;display_name:string;branch:string;is_demo:boolean}
export type Payment={id:string;member_id:string|null;amount:number|string|null;status:string;paid_at:string|null;created_at:string;payment_type:string|null}
export type Attendance={id:string;member_id:string;trained_at:string;booking_id:string|null;session_label:string|null}
export type Booking={id:string;member_id:string;branch:string;status:string;start_at:string|null;end_at:string|null}
export type WorkShift={id:string;branch:string;coach_id:string;starts_at:string;response:string|null}
export type ClockShift={id:string;branch:string;coach_id:string;clock_in_at:string;clock_out_at:string|null}
export type Conduction={id:string;member_id:string;coach_id:string;branch:string;status:string;session_date:string;rate_snapshot:number|string|null}
export type Guest={id:string;branch:string;host_member_id:string|null;status:string;purpose:string;visit_day:string;entered_at:string|null;amount_verified:number|string|null;payment_reference:string|null}
export type ReconciliationData={
 date:string;
 members:Member[];coaches:Coach[];paid:Payment[];flagged:Payment[];missingPaidDate:Payment[];
 attendance:Attendance[];bookings:Booking[];plans:WorkShift[];clockins:ClockShift[];
 conductions:Conduction[];guests:Guest[];
 failed:string[];
}
export type ReconciliationStats={
 recordedPaid:number;paidCount:number;flaggedCount:number;paidNoTimestamp:number;
 memberVisits:number;memberWalkins:number;plannedShifts:number;unconfirmedPlans:number;
 coachClockins:number;openClockins:number;conductionsApproved:number;conductionsForReview:number;
 guestEntries:number;guestPending:number;guestRecordedAmount:number;
 bookingsScheduled:number;possibleMissingCheckins:number;unassignedPayments:number;
}
export const ALL_BRANCHES="ALL" as const
const known=(branch:string|null|undefined)=>BEARFIT_BRANCHES.some(b=>b.id===branch)
const belongs=(branch:string|null|undefined,scope:Scope)=>known(branch) && (scope==="ALL"||scope===branch)
export function selectedDay(raw:string|undefined,now=new Date()):string{
 const today=manilaWindow(now).day
 if(!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw))return today
 const parsed=new Date(raw+"T00:00:00+08:00")
 if(Number.isNaN(parsed.getTime())||manilaWindow(parsed).day!==raw||raw>today||raw<"2025-01-01")return today
 return raw
}
export function dayWindow(date:string){
 const start=new Date(date+"T00:00:00+08:00")
 return {from:start.toISOString(),to:new Date(start.getTime()+86400000).toISOString()}
}
export function dataComplete(d:ReconciliationData, ...datasets:string[]){
 return datasets.every(key=>!d.failed.includes(key)&&!d.failed.includes(key+"-limit"))
}
const paid=(p:Payment)=>p.status.toLowerCase()==="paid"
export function reconciliationStats(d:ReconciliationData,scope:Scope,now=new Date()):ReconciliationStats{
 const realMembers=new Map(d.members.filter(m=>!m.is_demo&&known(m.branch)).map(m=>[m.id,m]))
 const realCoaches=new Map(d.coaches.filter(c=>!c.is_demo&&known(c.branch)).map(c=>[c.id,c]))
 const memberBranch=(id:string|null)=>id?realMembers.get(id)?.branch:null
 const membership=(id:string|null)=>!!id&&realMembers.has(id)
 const payments=d.paid.filter(p=>paid(p)&&belongs(memberBranch(p.member_id),scope))
 const flagged=d.flagged.filter(p=>belongs(memberBranch(p.member_id),scope))
 const missingPaidDate=d.missingPaidDate.filter(p=>belongs(memberBranch(p.member_id),scope))
 const attendance=d.attendance.filter(a=>belongs(memberBranch(a.member_id),scope))
 const bookingSet=new Set(attendance.map(a=>a.booking_id).filter(Boolean))
 const bookings=d.bookings.filter(b=>belongs(b.branch,scope)&&membership(b.member_id))
 const plans=d.plans.filter(s=>belongs(s.branch,scope)&&!!realCoaches.get(s.coach_id))
 const clockins=d.clockins.filter(s=>belongs(s.branch,scope)&&!!realCoaches.get(s.coach_id))
 const conductions=d.conductions.filter(c=>belongs(c.branch,scope)&&membership(c.member_id)&&!!realCoaches.get(c.coach_id))
 const guests=d.guests.filter(g=>belongs(g.branch,scope)&&(!g.host_member_id||membership(g.host_member_id)))
 const unassignedPayments=d.paid.concat(d.flagged,d.missingPaidDate).filter(p=>!memberBranch(p.member_id)).length
 return {
  recordedPaid:payments.reduce((sum,p)=>sum+Number(p.amount||0),0),paidCount:payments.length,
  flaggedCount:flagged.length,paidNoTimestamp:missingPaidDate.length,
  memberVisits:attendance.length,memberWalkins:attendance.filter(a=>!a.booking_id).length,
  plannedShifts:plans.length,unconfirmedPlans:plans.filter(s=>!["confirmed","accepted"].includes((s.response||"").toLowerCase())).length,
  coachClockins:clockins.length,openClockins:clockins.filter(s=>!s.clock_out_at).length,
  conductionsApproved:conductions.filter(c=>c.status.toLowerCase()==="approved").length,
  conductionsForReview:conductions.filter(c=>!["approved","rejected","void","cancelled"].includes(c.status.toLowerCase())).length,
  guestEntries:guests.filter(g=>!!g.entered_at).length,
  guestPending:guests.filter(g=>["pending_payment","pending_approval"].includes(g.status)).length,
  guestRecordedAmount:guests.reduce((sum,g)=>sum+Number(g.amount_verified||0),0),
  bookingsScheduled:bookings.filter(b=>["confirmed","completed"].includes(b.status.toLowerCase())).length,
  possibleMissingCheckins:bookings.filter(b=>b.status.toLowerCase()==="confirmed"&&!!b.end_at&&new Date(b.end_at).getTime()<now.getTime()&&!bookingSet.has(b.id)).length,
  unassignedPayments:scope==="ALL"?unassignedPayments:0
 }
}
