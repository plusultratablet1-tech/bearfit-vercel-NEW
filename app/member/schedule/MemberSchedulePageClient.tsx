"use client"

import Link from "next/link"
import { useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Clock3, Home, UserRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { MemberScheduleData, BookingRow } from "@/lib/scheduling"

const supabase = createClient()
const serviceLabels: Record<string,string> = { fitness:"Fitness", pilates_group:"Reformer Pilates Group", pilates_1on1:"Pilates 1-on-1" }

function manilaDate(iso:string) { return new Intl.DateTimeFormat("en-PH", { timeZone:"Asia/Manila", weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }).format(new Date(iso)) }
function hoursAway(iso:string) { return (new Date(iso).getTime()-Date.now())/36e5 }

export default function MemberSchedulePageClient({ initialData }:{ initialData:MemberScheduleData }) {
  const router = useRouter()
  const [error,setError] = useState<string|null>(initialData.loadError)
  const [success,setSuccess] = useState<string|null>(null)
  const [working,setWorking] = useState<string|null>(null)
  const [customOpen,setCustomOpen] = useState(false)
  const [custom,setCustom] = useState({ sessionType:"fitness", start:"", coach:"", duration:"60" })
  const slots = initialData.slots
  const bookings = initialData.bookings

  const grouped = useMemo(() => {
    const map = new Map<string, typeof slots>()
    for (const slot of slots) {
      const key = new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",weekday:"long",month:"long",day:"numeric"}).format(new Date(slot.start_at))
      map.set(key,[...(map.get(key)??[]),slot])
    }
    return [...map.entries()]
  },[slots])

  async function requestSlot(slotId:string) {
    setWorking(slotId); setError(null); setSuccess(null)
    const { error:rpcError } = await supabase.rpc("member_request_slot", { p_slot_id:slotId })
    setWorking(null)
    if (rpcError) return setError(rpcError.message)
    setSuccess("Booking request sent to BearFit staff for confirmation.")
    router.refresh()
  }

  async function requestCustom(event:FormEvent) {
    event.preventDefault(); setError(null);setSuccess(null)
    if (!custom.start) return setError("Choose your preferred date and time.")
    const start = new Date(custom.start)
    if (Number.isNaN(start.getTime())) return setError("Choose a valid date and time.")
    setWorking("custom")
    const { error:rpcError } = await supabase.rpc("member_request_custom_session", {
      p_session_type:custom.sessionType,
      p_requested_start_at:start.toISOString(),
      p_requested_coach_user_id:custom.coach || null,
      p_duration_minutes:Number(custom.duration)||60,
    })
    setWorking(null)
    if (rpcError) return setError(rpcError.message)
    setSuccess("Custom request sent. Staff/admin will confirm the final schedule.")
    setCustomOpen(false); router.refresh()
  }

  async function cancelBooking(booking:BookingRow) {
    setWorking(booking.id);setError(null);setSuccess(null)
    const { data,error:rpcError } = await supabase.rpc("member_cancel_booking", { p_booking_id:booking.id,p_reason:"Member schedule change" })
    setWorking(null)
    if (rpcError) return setError(rpcError.message)
    const result = data as { staff_contact_required?:boolean } | null
    if (result?.staff_contact_required) return setError("This session is inside the 4 hours change window. Please message staff/admin to change or cancel it.")
    setSuccess("Booking cancelled."); router.refresh()
  }

  return <main className="min-h-screen bg-[#020b1c] text-white"><div className="mx-auto max-w-7xl p-4 md:p-8">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-orange-300">Member Schedule</p><h1 className="text-3xl font-extrabold">Book your BearFit session</h1><p className="mt-2 text-white/55">Home branch: <b className="text-white">{initialData.member?.branch}</b>. Member requests must be at least 24 hours before the session.</p></div><div className="flex gap-2"><Link href="/member/dashboard" className="rounded-full bg-[#25324a] px-5 py-3 text-sm font-semibold"><Home className="mr-2 inline h-4 w-4"/>Dashboard</Link><Link href="/member/profile" className="rounded-full bg-[#25324a] px-5 py-3 text-sm font-semibold"><UserRound className="mr-2 inline h-4 w-4"/>Profile</Link></div></header>
    {error&&<div className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}{success&&<div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{success}</div>}

    <section className="mb-6 grid gap-3 md:grid-cols-3">{Object.entries(initialData.eligibility).map(([key,e])=><div key={key} className="rounded-2xl border border-white/10 bg-[#141414] p-4"><div className="text-sm font-bold">{serviceLabels[key]??key}</div><div className="mt-1 text-2xl font-extrabold">{e.sessions_left ?? 0} sessions</div><div className="mt-1 text-xs text-white/50">{e.warning_message||e.blocking_reason||"Eligible to request"}</div></div>)}</section>

    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-6"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold">Available slots</h2><p className="text-sm text-white/50">Only your assigned branch is shown.</p></div><button onClick={()=>setCustomOpen(v=>!v)} className="rounded-2xl bg-[#ff7a1a] px-4 py-3 text-sm font-bold">Custom request</button></div>
        {customOpen&&<form onSubmit={requestCustom} className="rounded-[24px] border border-orange-400/30 bg-[#141414] p-5"><h3 className="font-bold">Custom request</h3><p className="mt-1 text-xs text-white/50">Choose Any available coach by leaving coach blank. Staff/admin must confirm the request.</p><select value={custom.sessionType} onChange={e=>setCustom({...custom,sessionType:e.target.value})} className="mt-4 w-full rounded-xl bg-[#242424] p-3"><option value="fitness">Fitness</option><option value="pilates_group">Reformer Pilates Group</option><option value="pilates_1on1">Pilates 1-on-1</option></select><input type="datetime-local" value={custom.start} onChange={e=>setCustom({...custom,start:e.target.value})} className="mt-3 w-full rounded-xl bg-[#242424] p-3"/><select value={custom.coach} onChange={e=>setCustom({...custom,coach:e.target.value})} className="mt-3 w-full rounded-xl bg-[#242424] p-3"><option value="">Any available coach</option>{initialData.coaches.map(coach=><option key={coach.id} value={coach.id}>{coach.full_name}</option>)}</select><select value={custom.duration} onChange={e=>setCustom({...custom,duration:e.target.value})} className="mt-3 w-full rounded-xl bg-[#242424] p-3"><option value="60">60 minutes</option><option value="45">45 minutes</option><option value="30">30 minutes</option><option value="90">90 minutes</option></select><button disabled={working==="custom"} className="mt-4 rounded-xl bg-[#ff7a1a] px-5 py-3 font-bold">{working==="custom"?"Sending…":"Request custom session"}</button></form>}
        {grouped.length===0?<div className="rounded-[24px] border border-white/10 bg-[#141414] p-8 text-center text-white/50">No open slots yet. You can send a Custom request.</div>:grouped.map(([day,daySlots])=><div key={day}><h3 className="mb-3 text-lg font-bold">{day}</h3><div className="grid gap-3 md:grid-cols-2">{daySlots.map(slot=>{const e=initialData.eligibility[slot.session_type];const late=hoursAway(slot.start_at)<24;const disabled=late||!e?.can_request_booking||working===slot.id;return <article key={slot.id} className="rounded-[24px] border border-white/10 bg-[#141414] p-5"><div className="flex items-start justify-between"><div><div className="font-bold">{serviceLabels[slot.session_type]??slot.session_type}</div><div className="mt-2 flex items-center gap-2 text-sm text-white/60"><CalendarDays size={15}/>{manilaDate(slot.start_at)}</div><div className="mt-1 flex items-center gap-2 text-sm text-white/60"><Clock3 size={15}/>{Math.round((new Date(slot.end_at).getTime()-new Date(slot.start_at).getTime())/60000)} minutes</div></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs">Capacity {slot.capacity}</span></div><p className="mt-3 text-xs text-white/45">Coach: {slot.coach_user_id ? (initialData.coaches.find(coach=>coach.id===slot.coach_user_id)?.full_name ?? "Specific coach") : "Any available coach"}</p>{late&&<p className="mt-3 text-xs text-amber-300">Inside 24 hours — contact staff/admin.</p>}{e?.warning_message&&<p className="mt-3 text-xs text-amber-300">{e.warning_message}</p>}{e?.blocking_reason&&<p className="mt-3 text-xs text-red-300">{e.blocking_reason}</p>}<button disabled={disabled} onClick={()=>void requestSlot(slot.id)} className="mt-4 w-full rounded-xl bg-[#ff7a1a] px-4 py-3 text-sm font-bold disabled:bg-white/10 disabled:text-white/30">{working===slot.id?"Requesting…":"Request"}</button></article>})}</div></div>)}
      </section>
      <aside><div className="rounded-[24px] border border-white/10 bg-[#141414] p-5"><h2 className="text-xl font-bold">My requests</h2><p className="mt-1 text-xs text-white/50">Confirmed sessions may be changed by you until 4 hours before start.</p><div className="mt-4 space-y-3">{bookings.length===0?<p className="text-sm text-white/45">No upcoming requests.</p>:bookings.map(b=><div key={b.id} className="rounded-2xl bg-white/5 p-4"><div className="flex items-center justify-between"><b>{serviceLabels[b.session_type]??b.session_type}</b><span className="text-xs uppercase text-orange-300">{b.status}</span></div><p className="mt-2 text-sm text-white/55">{manilaDate(b.start_at??b.requested_start_at)}</p><button disabled={working===b.id} onClick={()=>void cancelBooking(b)} className="mt-3 text-xs font-bold text-red-300">Cancel / change</button></div>)}</div></div></aside>
    </div>
  </div></main>
}
