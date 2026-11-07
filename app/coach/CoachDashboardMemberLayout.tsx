"use client"
import Link from "next/link"
import CoachClientCards from "./CoachClientCards"
import CoachActivityPanel from "./CoachActivityPanel"
import {useState} from "react"
import {CalendarDays,Activity,MapPin,Dumbbell,ReceiptText} from "lucide-react"
type B={id:string;start_at:string;session_label:string|null;session_type:string;member_name:string;member_code:string;status:string}
type C={display_name:string;branch:string;username:string|null;is_active:boolean}
type D={session_date:string;status:string;member_name:string}
type S={clock_in_at:string|null;clock_out_at:string|null}
function day(s:string){const p=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(s));const x=(v:string)=>p.find(z=>z.type===v)?.value||"";return x("year")+"-"+x("month")+"-"+x("day")}
const date=(s:string)=>new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(new Date(s))
export default function CoachDashboard({coach,bookings,conductions,shifts}:{coach:C;bookings:B[];conductions:D[];shifts:S[]}){
const [tab,setTab]=useState("Activity Log")
const today=day(new Date().toISOString()),month=today.slice(0,7)
const todays=bookings.filter(b=>day(b.start_at)===today)
const monthBookings=bookings.filter(b=>day(b.start_at).startsWith(month))
const approved=conductions.filter(c=>c.session_date.startsWith(month)&&c.status==="approved")
const recent=bookings.filter(b=>Date.parse(b.start_at)<=Date.now()&&Date.parse(b.start_at)>=Date.now()-3*86400000)
const id="C"+(coach.username?.match(/^coach(\d+)$/i)?.[1]||"0").padStart(4,"0")
return <div className="w-full min-w-0"><div className="py-5"><h1 className="text-2xl text-white/75 md:text-3xl">Welcome, <b className="text-white">{coach.display_name}</b></h1><p className="mt-2 text-sm text-white/45">{coach.branch} · {coach.username}</p></div><div className="overflow-hidden rounded-[26px] border border-[#30394a] bg-[#121212] shadow-2xl"><div className="p-4 md:p-6">
<section className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-[3px] border-[#ff7a1a] bg-[#25324a] text-2xl font-black text-orange-300">{coach.display_name.slice(0,1)}</div><div className="flex-1"><h2 className="text-2xl font-black">{coach.display_name} <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">Active</span></h2><div className="mt-4 flex justify-between text-xs uppercase text-white/50"><span>Monthly Session Progress</span><span>{approved.length} of {monthBookings.length} sessions</span></div><div className="mt-2 h-2 rounded-full bg-[#243246]"><div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" style={{width:monthBookings.length?Math.min(100,100*approved.length/monthBookings.length)+"%":"0%"}}/></div><p className="mt-2 text-xs text-white/50">Approved conductions / assigned bookings</p></div></section>
<section className="mt-6 rounded-[22px] bg-[#1c1c1c] p-6 text-center"><p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Coach ID</p><p className="mt-1 text-5xl font-black">{id}</p><p className="mt-2 flex justify-center gap-2 text-white/60"><MapPin size={18} className="text-orange-500"/>{coach.branch}</p><div className="mt-5 flex flex-wrap justify-center gap-3 text-xs"><span className="rounded-full bg-emerald-500/15 p-3 text-emerald-300">Coach: Strength &amp; Conditioning</span><span className="rounded-full bg-white/10 p-3">{shifts.some(s=>s.clock_in_at&&!s.clock_out_at)?"On Duty":"Off Duty"}</span></div></section>
<CoachClientCards/>
<section className="mt-7"><div className="mb-4 flex justify-between"><h3 className="text-xl font-black">Upcoming Session Requests</h3><Link href="/coach/schedule" className="rounded-full bg-orange-500 px-4 py-2 text-xs font-bold">Manage Schedule</Link></div><div className="relative min-h-[260px] overflow-hidden rounded-[24px] border border-white/10"><img src="/better-form.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25"/><div className="absolute inset-0 bg-gradient-to-r from-black/95 to-black/45"/><div className="relative flex min-h-[260px] flex-col items-center justify-center px-5 text-center"><CalendarDays size={32} className="text-orange-500"/><h4 className="mt-3 text-xl font-bold">Check for session requests</h4><p className="mt-2 max-w-lg text-sm text-white/60">Admin reviews new client requests. Confirm your assigned shifts and check upcoming sessions.</p><Link href="/coach/schedule" className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-bold text-black">Confirm Sessions</Link></div></div></section>
<CoachActivityPanel/>
<div className="mt-7"><h3 className="mb-3 text-lg font-black">Updates &amp; Reminders</h3><div className="relative min-h-[220px] overflow-hidden rounded-[24px]"><img src="/onboarding/better-form1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-r from-[#ff6b0a]/95 to-[#ff8a2a]/75"/><div className="relative p-7"><p className="text-xs uppercase">Schedule</p><h3 className="mt-3 text-2xl font-black">Confirm your next session</h3><p className="mt-3 text-sm">Review client sessions and verify arrivals using the QR scanner.</p><Link href="/coach/schedule" className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-black">Open Schedule</Link></div></div></div>
</div></div></div>
}
