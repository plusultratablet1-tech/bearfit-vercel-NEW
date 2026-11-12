"use client"

import {useEffect,useState,type FormEvent} from "react"
import {createClient} from "@/lib/supabase/client"
import {SESSION_TAXONOMY} from "@/lib/session-taxonomy"
import {CalendarPlus,ChevronDown} from "lucide-react"

type Client={member_name:string;member_code:string;membership_status?:string;assignment_source?:string}
const db=createClient()

function futurePhilippineDateTime(){
  const date=new Date(Date.now()+24*60*60*1000)
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(date)
  const part=(key:string)=>parts.find(p=>p.type===key)?.value||""
  return part("year")+"-"+part("month")+"-"+part("day")+"T09:00"
}

/**
 * Coach-owned booking proposals. Writes only pending rows through a scoped
 * Postgres RPC; Admin retains official confirmation, payroll and deductions.
 */
export default function CoachSessionPlanner({onCreated}:{onCreated:()=>Promise<void>}){
  const [open,setOpen]=useState(false)
  const [clients,setClients]=useState<Client[]>([])
  const [rosterLoading,setRosterLoading]=useState(false)
  const [rosterError,setRosterError]=useState("")
  const [memberCode,setMemberCode]=useState("")
  const [sessionLabel,setSessionLabel]=useState<string>("Strength Training")
  const [start,setStart]=useState(futurePhilippineDateTime)
  const [duration,setDuration]=useState("60")
  const [repeat,setRepeat]=useState(false)
  const [weeks,setWeeks]=useState("4")
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [success,setSuccess]=useState("")

  useEffect(()=>{
    if(!open)return
    let active=true
    setRosterLoading(true)
    void db.rpc("coach_client_cards").then(({data,error})=>{
      if(!active)return
      setRosterLoading(false)
      if(error){setRosterError(error.message);return}
      const list=Array.isArray(data)?data as Client[]:[]
      setClients(list)
      setRosterError("")
    })
    return ()=>{active=false}
  },[open])

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(busy)return
    setError("");setSuccess("")
    if(!memberCode){setError("Choose one of your assigned clients.");return}
    // datetime-local is wall time: always interpret it as Asia/Manila,
    // regardless of the coach's device timezone.
    const timestamp=new Date(start+":00+08:00")
    if(!start||Number.isNaN(timestamp.getTime())){setError("Choose a valid date and time.");return}
    if(timestamp.getTime()<=Date.now()+5*60*1000){setError("Choose a future time at least 5 minutes away.");return}
    setBusy(true)
    const {data,error:rpcError}=await db.rpc("coach_plot_sessions",{
      p_member_code:memberCode,
      p_session_label:sessionLabel,
      p_start_at:timestamp.toISOString(),
      p_duration_minutes:Number(duration),
      p_occurrences:repeat?Number(weeks):1,
    })
    setBusy(false)
    if(rpcError){setError(rpcError.message);return}
    const count=(data as {count?:number}|null)?.count||1
    setSuccess(count+" session"+(count===1?"":"s")+" plotted for Admin confirmation. No package sessions were deducted.")
    setMemberCode("")
    try{await onCreated()}catch{setError("Request saved, but refreshing your schedule failed. Reload the page to see it.")}
  }

  return <section className="rounded-[24px] border border-orange-500/25 bg-[#171717] p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-300">Daily & weekly planner</p>
        <h2 className="mt-1 text-xl font-black">Plot a client session</h2>
        <p className="mt-1 text-sm text-white/55">Choose an assigned client. Admin confirms the final booking.</p>
      </div>
      <button type="button" onClick={()=>{setOpen(v=>!v);setError("");setSuccess("")}}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white">
        <CalendarPlus size={17}/>{open?"Close planner":"Plot New Session"}<ChevronDown size={15} className={open?"rotate-180":""}/>
      </button>
    </div>

    {open&&<form onSubmit={e=>void submit(e)} className="mt-5 space-y-4 border-t border-white/10 pt-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold">Assigned client
          <select required disabled={busy||rosterLoading||!!rosterError} value={memberCode}
            onChange={e=>setMemberCode(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#242424] p-3">
            <option value="">{rosterLoading?"Loading clients…":"Select your client"}</option>
            {clients.map(client=><option key={client.member_code} value={client.member_code}>
              {client.member_name} · {client.member_code}
            </option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Training type
          <select value={sessionLabel} disabled={busy} onChange={e=>setSessionLabel(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#242424] p-3">
            {SESSION_TAXONOMY.map(item=><option key={item.label} value={item.label}>{item.label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Start date & time · Philippines
          <input type="datetime-local" required value={start} disabled={busy}
            onChange={e=>setStart(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#242424] p-3"/>
        </label>
        <label className="block text-sm font-semibold">Session duration
          <select value={duration} disabled={busy} onChange={e=>setDuration(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#242424] p-3">
            {[30,45,60,90,120].map(minutes=><option key={minutes} value={minutes}>{minutes} minutes</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#242424] p-3 text-sm">
        <input type="checkbox" checked={repeat} disabled={busy} onChange={e=>setRepeat(e.target.checked)}
          className="h-4 w-4 accent-orange-500"/>
        Repeat on this weekday (weekly schedule)
      </label>
      {repeat&&<label className="block text-sm font-semibold">Number of weekly sessions
        <select value={weeks} disabled={busy} onChange={e=>setWeeks(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#242424] p-3">
          {[2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} weeks</option>)}
        </select>
      </label>}
      <p className="text-xs text-white/50">New sessions appear as Pending in the shared schedule. Scheduling does not mark attendance, deduct credits, or alter coach payroll. Conflicts stop the entire request.</p>
      {rosterError&&<p role="alert" className="text-sm text-red-300">{rosterError}</p>}
      {clients.length===0&&!rosterLoading&&!rosterError&&<p className="text-sm text-amber-300">No clients assigned yet. Ask Admin to link your clients first.</p>}
      {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
      {success&&<p role="status" className="text-sm text-emerald-300">{success}</p>}
      <button disabled={busy||rosterLoading||!!rosterError||clients.length===0}
        className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
        {busy?"Checking schedule…":repeat?"Plot weekly sessions":"Plot daily session"}
      </button>
    </form>}
  </section>
}
