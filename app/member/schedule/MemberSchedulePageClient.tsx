"use client"

import {useEffect,useMemo,useState,type FormEvent} from "react"
import Link from "next/link"
import {useRouter} from "next/navigation"
import {CalendarDays,ChevronLeft,ChevronRight,Clock3,Users} from "lucide-react"
import MemberAppShell from "@/components/bearfit/MemberAppShell"
import {createClient} from "@/lib/supabase/client"
import type {MemberScheduleData,BookingRow} from "@/lib/scheduling"
import {SESSION_TAXONOMY,displaySessionLabel} from "@/lib/session-taxonomy"

type CalendarSlot = {
  id:string;coach_user_id:string;coach_name:string;branch:string;
  session_type:string;session_label:string|null;start_at:string;end_at:string;
  capacity:number;booked:number;remaining:number
}
const supabase=createClient()
const zone="Asia/Manila"
function dateKey(iso:string){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(iso))
  const part=(name:string)=>parts.find(p=>p.type===name)?.value??""
  return part("year")+"-"+part("month")+"-"+part("day")
}
function philippineNow(){return dateKey(new Date().toISOString())}
function fmt(iso:string){return new Intl.DateTimeFormat("en-PH",{timeZone:zone,month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(iso))}
function time(iso:string){return new Intl.DateTimeFormat("en-PH",{timeZone:zone,hour:"numeric",minute:"2-digit"}).format(new Date(iso))}
function monthLabel(month:string){return new Intl.DateTimeFormat("en-PH",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(month+"-01T00:00:00Z"))}
function nextMonth(month:string,offset:number){
  const [year,mon]=month.split("-").map(Number)
  const d=new Date(Date.UTC(year,mon-1+offset,1))
  return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")
}
const services:Record<string,string>={fitness:"Fitness",pilates_group:"Reformer Pilates Group",pilates_1on1:"Pilates 1-on-1"}

export default function MemberSchedulePageClient({initialData}:{initialData:MemberScheduleData}){
  const router=useRouter()
  const [month,setMonth]=useState(()=>philippineNow().slice(0,7))
  const [selected,setSelected]=useState(()=>philippineNow())
  const [calendarSlots,setCalendarSlots]=useState<CalendarSlot[]>([])
  const [monthBookings,setMonthBookings]=useState<BookingRow[]>(initialData.bookings)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(initialData.loadError)
  const [success,setSuccess]=useState<string|null>(null)
  const [working,setWorking]=useState<string|null>(null)
  const [customOpen,setCustomOpen]=useState(false)
  const [custom,setCustom]=useState({sessionLabel:"Strength & Conditioning",start:"",coach:"",duration:"60"})
  const [reload,setReload]=useState(0)
  const today=philippineNow()

  useEffect(()=>{
    let active=true
    setLoading(true)
    const first=month+"-01T00:00:00+08:00"
    const last=nextMonth(month,1)+"-01T00:00:00+08:00"
    void Promise.all([
      supabase.rpc("member_calendar_slots",{p_month:month+"-01"}),
      supabase.from("bookings").select("*").gte("requested_start_at",new Date(first).toISOString()).lt("requested_start_at",new Date(last).toISOString()).order("requested_start_at").limit(200),
    ]).then(([slotsResult,bookingsResult])=>{
      if(!active)return
      setLoading(false)
      if(slotsResult.error||bookingsResult.error){
        setError(slotsResult.error?.message??bookingsResult.error?.message??"Calendar unavailable.")
      }else{
        setError(null)
      }
      setCalendarSlots((slotsResult.data??[]) as CalendarSlot[])
      setMonthBookings((bookingsResult.data??[]) as BookingRow[])
    }).catch(()=>{
      if(active){setLoading(false);setError("Unable to load this month's schedule.")}
    })
    return ()=>{active=false}
  },[month,reload])

  const cells=useMemo(()=>{
    const [y,m]=month.split("-").map(Number)
    const offset=new Date(Date.UTC(y,m-1,1)).getUTCDay()
    const length=new Date(Date.UTC(y,m,0)).getUTCDate()
    return [...Array.from({length:offset},()=>null),...Array.from({length},(_,i)=>month+"-"+String(i+1).padStart(2,"0"))]
  },[month])
  const selectedSlots=useMemo(()=>calendarSlots.filter(s=>dateKey(s.start_at)===selected),[calendarSlots,selected])
  const selectedBookings=useMemo(()=>monthBookings.filter(b=>dateKey(b.start_at??b.requested_start_at)===selected),[monthBookings,selected])
  const upcoming=useMemo(()=>monthBookings.filter(b=>b.status==="pending"||b.status==="confirmed"),[monthBookings])

  function moveMonth(offset:number){
    const next=nextMonth(month,offset)
    setMonth(next);setSelected(next+"-01");setSuccess(null)
  }
  async function requestSlot(slot:CalendarSlot){
    if(slot.remaining<=0)return
    setWorking(slot.id);setError(null);setSuccess(null)
    const {error:rpcError}=await supabase.rpc("member_request_slot",{p_slot_id:slot.id})
    setWorking(null)
    if(rpcError){setError(rpcError.message);return}
    setSuccess("Request sent to BearFit Admin for confirmation. No sessions deducted.")
    setReload(v=>v+1);router.refresh()
  }
  async function requestCustom(event:FormEvent){
    event.preventDefault()
    if(!custom.start){setError("Choose your preferred date and time.");return}
    const start=new Date(custom.start+":00+08:00")
    if(Number.isNaN(start.getTime())){setError("Invalid date or time.");return}
    setWorking("custom");setError(null);setSuccess(null)
    const {error:rpcError}=await supabase.rpc("member_request_custom_session",{
      p_session_label:custom.sessionLabel,p_requested_start_at:start.toISOString(),
      p_requested_coach_user_id:custom.coach||null,p_duration_minutes:Number(custom.duration)
    })
    setWorking(null)
    if(rpcError){setError(rpcError.message);return}
    setSuccess("Custom request submitted. Admin must confirm it.")
    setCustomOpen(false);setReload(v=>v+1);router.refresh()
  }
  async function cancelBooking(booking:BookingRow){
    setWorking(booking.id);setError(null);setSuccess(null)
    const {data,error:rpcError}=await supabase.rpc("member_cancel_booking",{p_booking_id:booking.id,p_reason:"Member schedule change"})
    setWorking(null)
    if(rpcError){setError(rpcError.message);return}
    if((data as {staff_contact_required?:boolean}|null)?.staff_contact_required){
      setError("Inside the 4-hour change window. Please contact staff/admin.");return
    }
    setSuccess("Booking cancelled.");setReload(v=>v+1);router.refresh()
  }

  return <MemberAppShell activePath="/member/schedule">
    <div className="mx-auto max-w-7xl p-4 pb-28 md:p-8 lg:pb-8">
      <header className="mb-6 border-b border-white/10 pb-5">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-orange-300">Member Schedule</p>
        <h1 className="mt-1 text-3xl font-extrabold">Your training calendar</h1>
        <p className="mt-2 text-sm text-white/55">Home branch: <b className="text-white">{initialData.member?.branch}</b> · Requests require at least 24 hours' notice · All times Philippines</p>
        <Link href="/member/freeze" className="mt-3 inline-flex rounded-xl border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm font-bold text-orange-200 hover:bg-orange-400/20">Request Package Freeze / Extension</Link>
      </header>
      {error&&<p role="alert" className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {success&&<p role="status" className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{success}</p>}
      <section className="mb-6 grid gap-3 md:grid-cols-3" aria-label="Package balances">
        {Object.entries(initialData.eligibility).map(([key,e])=><div key={key} className="rounded-2xl border border-white/10 bg-[#141414] p-4">
          <p className="text-sm font-bold">{services[key]??key}</p>
          <p className="mt-1 text-2xl font-extrabold">{e.sessions_left??0} sessions</p>
          <p className="mt-1 text-xs text-white/50">{e.warning_message||e.blocking_reason||"Eligible to request"}</p>
        </div>)}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
        <div className="space-y-5">
          <section className="rounded-[24px] border border-white/10 bg-[#141414] p-4 md:p-6" aria-label="Monthly calendar">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-widest text-orange-300">Monthly view</p><h2 className="mt-1 text-2xl font-bold">{monthLabel(month)}</h2></div>
              <div className="flex items-center gap-2">
                <button aria-label="Previous month" onClick={()=>moveMonth(-1)} className="rounded-xl border border-white/10 p-2"><ChevronLeft size={20}/></button>
                <button onClick={()=>{const now=philippineNow();setMonth(now.slice(0,7));setSelected(now)}} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold">Today</button>
                <button aria-label="Next month" onClick={()=>moveMonth(1)} className="rounded-xl border border-white/10 p-2"><ChevronRight size={20}/></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-white/45">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=><div key={day} className="py-2">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((day,i)=>day?<button key={day} aria-label={"Select "+day} aria-pressed={selected===day} onClick={()=>setSelected(day)}
                className={"min-h-16 rounded-xl border p-1.5 text-left transition md:min-h-20 "+(selected===day?"border-orange-400 bg-orange-500/15":"border-white/5 bg-[#202020] hover:border-white/20")}>
                <span className={"text-xs font-bold "+(day===today?"text-orange-300":"")}>{Number(day.slice(8))}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {monthBookings.some(b=>dateKey(b.start_at??b.requested_start_at)===day)&&<span title="My session" className="h-1.5 w-1.5 rounded-full bg-orange-400"/>}
                  {calendarSlots.some(s=>dateKey(s.start_at)===day&&s.remaining>0)&&<span title="Available slots" className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>}
                </div>
              </button>:<div key={"blank-"+i} aria-hidden className="min-h-16"/>)}
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-4 text-xs text-white/55">
              <span><span className="mr-1.5 text-emerald-400">●</span>Available slots</span>
              <span><span className="mr-1.5 text-orange-400">●</span>My sessions</span>
            </p>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-[#141414] p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-bold">{new Intl.DateTimeFormat("en-PH",{timeZone:"UTC",weekday:"long",month:"long",day:"numeric"}).format(new Date(selected+"T00:00:00Z"))}</h2><p className="text-sm text-white/50">Available per coach and training type</p></div>
              <button onClick={()=>setCustomOpen(v=>!v)} className="rounded-xl bg-[#ff7a1a] px-4 py-3 text-sm font-bold">Custom request</button>
            </div>
            {loading?<p className="py-5 text-sm text-white/50">Loading calendar…</p>:selectedSlots.length===0?<p className="rounded-xl bg-white/5 p-5 text-sm text-white/50">No published coach slots for this date. You can send a Custom request.</p>:<div className="grid gap-3 md:grid-cols-2">
              {selectedSlots.map(slot=>{
                const eligible=initialData.eligibility[slot.session_type]
                const late=(new Date(slot.start_at).getTime()-Date.now())<24*3600000
                const disabled=slot.remaining<=0||late||!eligible?.can_request_booking||working===slot.id
                return <article key={slot.id} className="rounded-2xl border border-white/10 bg-[#202020] p-4">
                  <p className="font-bold">{displaySessionLabel(slot.session_label,slot.session_type)}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-white/65"><Clock3 size={15}/>{time(slot.start_at)} – {time(slot.end_at)}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-white/65"><Users size={15}/>{slot.coach_name}</p>
                  <p className={"mt-3 text-sm font-bold "+(slot.remaining>0?"text-emerald-300":"text-amber-300")}>{slot.remaining>0?slot.remaining+" of "+slot.capacity+" spots left":"Fully booked"} <span className="font-normal text-white/45">· {slot.booked} confirmed</span></p>
                  {late&&<p className="mt-2 text-xs text-amber-300">Less than 24 hours: contact staff/admin</p>}
                  {eligible?.blocking_reason&&<p className="mt-2 text-xs text-red-300">{eligible.blocking_reason}</p>}
                  <button disabled={disabled} onClick={()=>void requestSlot(slot)} className="mt-3 w-full rounded-xl bg-[#ff7a1a] px-4 py-3 text-sm font-bold disabled:bg-white/10 disabled:text-white/35">{working===slot.id?"Requesting…":"Request session"}</button>
                </article>
              })}
            </div>}
            {selectedBookings.length>0&&<div className="mt-5 border-t border-white/10 pt-4"><h3 className="mb-3 font-bold">My sessions on this day</h3>
              {selectedBookings.map(b=><div key={b.id} className="mb-2 rounded-xl bg-white/5 p-3 text-sm"><b>{displaySessionLabel(b.session_label,b.session_type)}</b><span className="ml-2 text-xs uppercase text-orange-300">{b.status}</span><p className="mt-1 text-xs text-white/50">{fmt(b.start_at??b.requested_start_at)}</p></div>)}
            </div>}
          </section>
        </div>
        <aside className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-[#141414] p-5">
            <h2 className="flex items-center gap-2 text-xl font-bold"><CalendarDays size={19}/>My requests</h2>
            <p className="mt-1 text-xs text-white/50">Pending requests require Admin confirmation. Confirmed sessions can be cancelled until 4 hours before start.</p>
            <div className="mt-4 space-y-3">{upcoming.length===0?<p className="text-sm text-white/45">No pending or confirmed bookings this month.</p>:upcoming.map(b=><article key={b.id} className="rounded-2xl bg-white/5 p-4">
              <div className="flex items-start justify-between gap-2"><b className="text-sm">{displaySessionLabel(b.session_label,b.session_type)}</b><span className="text-xs uppercase text-orange-300">{b.status}</span></div>
              <p className="mt-2 text-sm text-white/55">{fmt(b.start_at??b.requested_start_at)}</p>
              <button disabled={working===b.id} onClick={()=>void cancelBooking(b)} className="mt-3 text-xs font-bold text-red-300">Cancel / change</button>
            </article>)}</div>
          </div>
          {customOpen&&<form onSubmit={requestCustom} className="rounded-[24px] border border-orange-400/25 bg-[#141414] p-5">
            <h2 className="text-lg font-bold">Custom session request</h2>
            <p className="mt-1 text-xs text-white/50">Choose a preferred time at least 24 hours ahead. Admin confirms the final slot.</p>
            <label className="mt-4 block text-xs text-white/65">Training type
              <select value={custom.sessionLabel} onChange={e=>setCustom({...custom,sessionLabel:e.target.value})} className="mt-1 w-full rounded-xl bg-[#242424] p-3 text-sm">{SESSION_TAXONOMY.map(x=><option key={x.label} value={x.label}>{x.label}</option>)}</select>
            </label>
            <label className="mt-3 block text-xs text-white/65">Date & time (Philippines)
              <input type="datetime-local" required value={custom.start} onChange={e=>setCustom({...custom,start:e.target.value})} className="mt-1 w-full rounded-xl bg-[#242424] p-3 text-sm"/>
            </label>
            <label className="mt-3 block text-xs text-white/65">Preferred coach
              <select value={custom.coach} onChange={e=>setCustom({...custom,coach:e.target.value})} className="mt-1 w-full rounded-xl bg-[#242424] p-3 text-sm"><option value="">Any available coach</option>{initialData.coaches.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select>
            </label>
            <label className="mt-3 block text-xs text-white/65">Duration
              <select value={custom.duration} onChange={e=>setCustom({...custom,duration:e.target.value})} className="mt-1 w-full rounded-xl bg-[#242424] p-3 text-sm">{[30,45,60,90].map(n=><option key={n} value={n}>{n} minutes</option>)}</select>
            </label>
            <button disabled={working==="custom"} className="mt-4 w-full rounded-xl bg-[#ff7a1a] px-4 py-3 text-sm font-bold">{working==="custom"?"Sending…":"Submit request"}</button>
          </form>}
        </aside>
      </div>
    </div>
  </MemberAppShell>
}
