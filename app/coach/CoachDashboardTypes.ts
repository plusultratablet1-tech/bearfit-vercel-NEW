export type Coach = {id:string;display_name:string;branch:string;username:string|null;is_active:boolean}
export type Booking = {id:string;start_at:string;end_at:string;branch:string;session_type:string;session_label:string|null;status:string;member_name:string;member_code:string}
export type Conduction = {id:string;session_date:string;status:"pending"|"approved"|"rejected";member_name:string}
export type Shift = {clock_in_at:string|null;clock_out_at:string|null}
export type Paid = {id:string;member_name:string;member_code:string;amount:number;package_name:string;paid_at:string}
export type Due = {id:string;member_name:string;member_code:string;stage:string;due_at:string|null;status:string}
export type Request = {id:string;member_name:string;member_code:string;requested_at:string;session_label:string|null;session_type:string}
export type Marker = {booking_id:string;event_type:string;created_at:string}
export type CoachInsights = {month_scheduled:number;month_approved:number;payments:Paid[];dues:Due[];requests:Request[];markers:Marker[]}
export function manilaDay(v:string) {const p=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(v));const a=(s:string)=>p.find(x=>x.type===s)?.value||"";return a("year")+"-"+a("month")+"-"+a("day")}
export function formatCoachDate(v:string){return new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(new Date(v))}
export const panel="rounded-[24px] border border-white/[0.04] bg-[#171717]"
