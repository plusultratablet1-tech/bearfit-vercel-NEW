import {BEARFIT_BRANCHES,type BearFitBranch} from "@/lib/branches"

export const ALL_BRANCHES="ALL" as const
export type DashboardBranch=BearFitBranch|typeof ALL_BRANCHES
export type HomeMember={
 id:string;branch:string|null;membership_status:string|null;status:string|null;
 sessions_left:number|null;payment_status:string|null
}
export type HomeBooking={id:string;branch:string|null;status:string|null;start_at:string|null;requested_start_at:string|null}
export type HomeShift={id:string;branch:string|null;response:string|null;starts_at:string}
export type HomeGuest={id:string;branch:string|null;status:string|null;visit_day:string|null}
export type HomePayment={id:string;member_id:string|null;amount:number|null;status:string|null;paid_at:string|null}
export type HomeCheckin={id:string;member_id:string|null;trained_at:string}
export type HomeData={
 members:HomeMember[];bookings:HomeBooking[];pendingBookings:HomeBooking[];
 shifts:HomeShift[];guests:HomeGuest[];pendingPayments:HomePayment[];
 paidToday:HomePayment[];checkins:HomeCheckin[];
 failed:string[];todayLabel:string;startUtc:string;endUtc:string
}
export function manilaWindow(now:Date){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now)
 const byType=Object.fromEntries(parts.map(p=>[p.type,p.value]))
 const day=`${byType.year}-${byType.month}-${byType.day}`
 // Philippines observes UTC+8 and currently no daylight saving time.
 const startUtc=new Date(day+"T00:00:00+08:00")
 return {day,startUtc:startUtc.toISOString(),endUtc:new Date(startUtc.getTime()+86400000).toISOString()}
}
const norm=(status:string|null|undefined)=>(status||"").toLowerCase()
export function inBranch(value:string|null|undefined,selected:DashboardBranch){
 return selected===ALL_BRANCHES ? !!BEARFIT_BRANCHES.some(branch=>branch.id===value) : value===selected
}
export function lowSession(m:HomeMember){
 const status=norm(m.membership_status||m.status)
 return status==="active" && m.sessions_left!==null && m.sessions_left>=0 && m.sessions_left<=3
}
export function needsRenewal(m:HomeMember){
 return norm(m.membership_status||m.status)==="renewal_due" || lowSession(m)
}
export function isPendingGuest(g:HomeGuest){
 return g.status==="pending_payment" || g.status==="pending_approval"
}
export function statsFor(data:HomeData,selected:DashboardBranch){
 const members=data.members.filter(m=>inBranch(m.branch,selected))
 const bookings=data.bookings.filter(b=>inBranch(b.branch,selected))
 const pendingBookings=data.pendingBookings.filter(b=>inBranch(b.branch,selected))
 const shifts=data.shifts.filter(s=>inBranch(s.branch,selected))
 const guests=data.guests.filter(g=>inBranch(g.branch,selected))
 const memberBranches=new Map(data.members.map(m=>[m.id,m.branch]))
 const paid=data.paidToday.filter(p=>inBranch(memberBranches.get(p.member_id||"")||null,selected))
 const pendingPayments=data.pendingPayments.filter(p=>inBranch(memberBranches.get(p.member_id||"")||null,selected))
 const checkins=data.checkins.filter(c=>inBranch(memberBranches.get(c.member_id||"")||null,selected))
 return {
  members:members.length,active:members.filter(m=>norm(m.membership_status||m.status)==="active").length,
  renewals:members.filter(needsRenewal).length,lowSessions:members.filter(lowSession).length,
  bookings:bookings.length,pendingBookings:pendingBookings.filter(b=>norm(b.status)==="pending").length,
  shifts:shifts.length,shiftUnconfirmed:shifts.filter(s=>norm(s.response)!=="confirmed").length,
  checkins:checkins.length,guestsPending:guests.filter(isPendingGuest).length,
  paymentsPending:pendingPayments.length,
  recordedPaid:paid.reduce((n,p)=>n+Number(p.amount||0),0),
  paidTransactions:paid.length,
 }
}
