"use client"

import { CalendarDays, ClipboardCheck, CreditCard, QrCode, UserRound } from "lucide-react"

type Booking = {id:string;start_at:string;end_at:string;branch:string;session_type:string;session_label:string|null;status:string;member_name:string;member_code:string}
type Conduction = {id:string;session_date:string;status:string;member_name:string}
type Shift = {clock_in_at:string|null;clock_out_at:string|null}
type Coach = {display_name:string;branch:string;username:string|null}
type Props = {coach:Coach;bookings:Booking[];conductions:Conduction[];shifts:Shift[]}

function day(v:string){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(v))}
function when(v:string){return new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(new Date(v))}
const panel="rounded-[26px] border border-[#30394a] bg-[#121212] p-5 shadow-xl md:p-7"

export default function CoachMemberStyleOverview({coach,bookings,conductions,shifts}:Props){
  const date=day(new Date().toISOString())
  const month=date.slice(0,7)
  const thisMonth=bookings.filter(b=>day(b.start_at).slice(0,7)===month)
  const approved=conductions.filter(c=>c.status==="approved"&&c.session_date.slice(0,7)===month)
  const today=bookings.filter(b=>day(b.start_at)===date)
  const lastThreeDays=bookings.filter(b=>Date.parse(b.start_at)<=Date.now()&&Date.parse(b.start_at)>=Date.now()-3*86400000).sort((a,b)=>Date.parse(b.start_at)-Date.parse(a.start_at))
  const idPart=coach.username?.match(/^coach(\d+)$/i)?.[1]
  const displayId=idPart?"C"+idPart.padStart(4,"0"):"Not assigned"
  const onDuty=shifts.some(s=>Boolean(s.clock_in_at&&!s.clock_out_at))
  return <div className="space-y-5">
    <section className={panel}>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">Coach Profile</p>
      <div className="mt-4 flex gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-[3px] border-[#ff7a1a] bg-[#25324a] text-2xl font-black text-orange-300"><UserRound size={30}/></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-black">{coach.display_name}</h2>
          <div className="mt-4 flex justify-between gap-2 text-xs text-white/60"><span>Monthly Session Progress</span><span>{approved.length} of {thisMonth.length}</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#243246]"><div className="h-full bg-[#ff7a1a]" style={{width:thisMonth.length?Math.min(100,approved.length/thisMonth.length*100)+"%":"0%"}}/></div>
        </div>
      </div>
      <p className="mt-3 text-xs text-white/45">Approved conductions versus assigned bookings visible this month.</p>
      <div className="mt-5 rounded-2xl bg-[#1c1c1c] p-5 text-center">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Coach ID</p>
        <p className="mt-1 text-4xl font-black">{displayId}</p>
        <p className="mt-2 text-sm text-white/55">{coach.branch}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="rounded-xl bg-white/10 px-3 py-2 text-xs">Coach: Strength &amp; Conditioning</span>
          <span className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs text-emerald-300">{onDuty?"On Duty":"Off Duty"}</span>
        </div>
        <p className="mt-3 text-xs text-white/35">Display coach ID is derived from username; coaching type is a provisional label.</p>
      </div>
    </section>
    <section className={panel}>
      <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-orange-300">Today's Schedule</p><h2 className="mt-1 flex items-center gap-2 text-xl font-black"><CalendarDays size={18}/> Client Sessions</h2><p className="mt-1 text-xs text-white/50">Up to four real client bookings</p></div><p className="text-sm text-white/60">{new Intl.DateTimeFormat("en-PH",{dateStyle:"full",timeZone:"Asia/Manila"}).format(new Date())}</p></div>
      {today.length?<div className="mt-4 grid gap-3 md:grid-cols-2">{today.slice(0,4).map(b=><article key={b.id} className="rounded-2xl border border-white/10 bg-[#101725] p-4"><p className="text-xs font-semibold text-orange-300">{when(b.start_at)}</p><h3 className="mt-2 text-lg font-bold">{b.member_name}</h3><p className="mt-1 text-sm text-white/60">{b.member_code} · {b.session_label||b.session_type}</p><p className="mt-3 text-xs capitalize text-white/60">Status: {b.status}</p><span className="mt-3 inline-flex rounded-lg border border-white/15 px-3 py-2 text-xs text-white/55">Cancellation / status changes require Admin</span></article>)}</div>:<p className="mt-4 text-sm text-white/50">No client sessions assigned today. Requests may still be pending with Admin.</p>}
      {today.length>4&&<p className="mt-3 text-sm text-white/55">+{today.length-4} more bookings in My Member Sessions below.</p>}
    </section>
    <section className={panel}><h2 className="flex items-center gap-2 text-xl font-black"><QrCode size={19}/> Session Requests / Confirm Sessions</h2><p className="mt-3 text-sm text-white/60">Coaches can review assigned bookings and use the Member QR Scanner below to verify a client. Admin approval is still required for cancellations and booking changes. QR scanning does not deduct member sessions or credit payroll.</p></section>
    <section className={panel}><h2 className="flex items-center gap-2 text-xl font-black"><ClipboardCheck size={19}/> Coaches Activity</h2><p className="mt-1 text-xs text-white/55">Linked client bookings during the last three days</p>{lastThreeDays.length?<div className="mt-4 space-y-2">{lastThreeDays.map(b=><div key={b.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm"><span>{b.member_name} · {b.member_code}</span><span className="text-white/55">{when(b.start_at)} · {b.status}</span></div>)}</div>:<p className="mt-4 text-sm text-white/50">No sessions in the last three days.</p>}
      <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#101725] p-4"><p className="text-xs text-white/55">Monthly bookings</p><p className="mt-2 text-2xl font-black">{thisMonth.length}</p></div><div className="rounded-xl bg-[#101725] p-4"><p className="text-xs text-white/55">Approved sessions</p><p className="mt-2 text-2xl font-black">{approved.length}</p></div></div>
    </section>
    <section className={panel}><h2 className="flex items-center gap-2 text-xl font-black"><CreditCard size={19}/> Client Payments &amp; Upcoming Dues</h2><p className="mt-3 text-sm text-white/60">Payment lists are not enabled for coach accounts yet. Admin handles payment verification and renewal reminders. Client financial information stays private until role-based access has been tested.</p></section>
  </div>
}
