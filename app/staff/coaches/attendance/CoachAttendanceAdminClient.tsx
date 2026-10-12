"use client"
import Link from "next/link"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import { AlertTriangle, ArrowLeft, CalendarDays, Clock3, RefreshCw, ShieldCheck, UsersRound, FlaskConical, Database } from "lucide-react"
import StaffAppShell from "@/components/bearfit/StaffAppShell"
import { createClient } from "@/lib/supabase/client"
import { buildCoachAttendanceDemo } from "@/lib/coach-attendance-demo"

const supabase=createClient()
type Coach={id:string;display_name:string;branch:string;username:string|null;user_id:string|null;is_active:boolean}
type Plan={id:string;coach_id:string;branch:string;starts_at:string;ends_at:string;response:"pending"|"confirmed"|"unavailable";response_at:string|null;unavailable_reason:string|null;created_at:string}
type Punch={id:string;work_shift_id:string|null;coach_id:string;clock_in_at:string;clock_out_at:string|null}
type Issued={code:string;branch:string;expires_at:string}
const branches=["Malingap Branch","E. Rodriguez Branch"]
function phParts(date:Date) {
  const a=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date)
  const p=(name:string)=>a.find(x=>x.type===name)?.value||""
  return p("year")+"-"+p("month")+"-"+p("day")
}
function fmt(date:string) {return new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(new Date(date))}
function atTomorrowEight(iso:string) {
  const d=phParts(new Date(iso))
  return new Date(Date.parse(d+"T12:00:00Z")-86400000).toISOString().slice(0,10)+"T20:00:00+08:00"
}
function dateInput(offsetDays:number) {
  const d=new Date(Date.now()+offsetDays*86400000)
  return phParts(d)
}
function description(w:Plan,p:Punch|undefined,now:number) {
  if(w.response==="unavailable")return {label:"Cannot report",danger:true}
  if(w.response==="pending"&&now>=Date.parse(atTomorrowEight(w.starts_at)))return {label:"Unconfirmed — 8PM passed",danger:true}
  if(p?.clock_in_at && Date.parse(p.clock_in_at)>Date.parse(w.starts_at)+15*60000)
    return {label:p.clock_out_at?"Completed — late arrival":"Late clock-in",danger:true}
  if(p?.clock_in_at&&!p.clock_out_at)return {label:"Clocked in",danger:false}
  if(p?.clock_out_at)return {label:"Shift completed",danger:false}
  if(now>Date.parse(w.starts_at)+15*60000 && now<Date.parse(w.ends_at)+86400000)return {label:"No verified clock-in",danger:true}
  if(w.response==="confirmed")return {label:"Confirmed",danger:false}
  return {label:"Awaiting response",danger:false}
}
export default function CoachAttendanceAdminClient() {
  // Explicit UI-only demo: these records have non-UUID IDs and can never be submitted to live RPCs.
  const [demoMode,setDemoMode]=useState(true)
  const [sample,setSample]=useState(()=>buildCoachAttendanceDemo(new Date()))
  const [coaches,setCoaches]=useState<Coach[]>([])
  const [plans,setPlans]=useState<Plan[]>([])
  const [punches,setPunches]=useState<Punch[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")
  const [busy,setBusy]=useState(false)
  const [selectedCoach,setSelectedCoach]=useState("")
  const [day,setDay]=useState(()=>dateInput(1))
  const [start,setStart]=useState("08:00")
  const [end,setEnd]=useState("17:00")
  const [branch,setBranch]=useState(branches[0])
  const [issued,setIssued]=useState<Issued|null>(null)
  const [filter,setFilter]=useState("all")
  const load=useCallback(async()=>{
    setLoading(true)
    const [c,w,p]=await Promise.all([
      supabase.from("coaches").select("id,display_name,branch,username,user_id,is_active").order("display_name"),
      supabase.from("coach_work_shifts").select("id,coach_id,branch,starts_at,ends_at,response,response_at,unavailable_reason,created_at")
        .gte("starts_at",new Date(Date.now()-8*86400000).toISOString())
        .lte("starts_at",new Date(Date.now()+35*86400000).toISOString())
        .order("starts_at").limit(500),
      supabase.from("coach_shifts").select("id,work_shift_id,coach_id,clock_in_at,clock_out_at").order("clock_in_at",{ascending:false}).limit(500)
    ])
    const errors=[c.error,w.error,p.error].filter(Boolean).map(e=>e?.message).join(" · ")
    if(errors)setError(errors)
    else setError("")
    setCoaches((c.data||[]) as Coach[])
    setPlans((w.data||[]) as Plan[])
    setPunches((p.data||[]) as Punch[])
    setLoading(false)
  },[])
  useEffect(()=>{void load()},[load])
  async function schedule(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if (demoMode) { setError("Switch to Live Data before creating a real shift."); return }
    if(!selectedCoach){setError("Choose a coach.");return}
    const startsAt=new Date(day+"T"+start+":00+08:00")
    const endsAt=new Date(day+"T"+end+":00+08:00")
    if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt){
      setError("Choose a valid start and end time (overnight shifts require Admin planning later).");return
    }
    setBusy(true);setError("");setNotice("")
    const {error:x}=await supabase.rpc("admin_plan_coach_shift",{
      p_coach_id:selectedCoach,p_starts_at:startsAt.toISOString(),p_ends_at:endsAt.toISOString()
    })
    setBusy(false)
    if(x)setError(x.message)
    else {setNotice("Shift assigned. Coach can now confirm it before 8:00 PM on the preceding day.");await load()}
  }
  async function issue(){
    if (demoMode) { setError("Switch to Live Data before issuing an actual attendance code."); return }
    setBusy(true);setError("");setNotice("");setIssued(null)
    const {data,error:x}=await supabase.rpc("issue_coach_branch_code",{p_branch:branch})
    setBusy(false)
    if(x)setError(x.message)
    else {setIssued(data as Issued);setNotice("Attendance code issued. Display it at the branch reception for authorized coach time punches.")}
  }
  const now=Date.now()
  const displayCoaches:Coach[] = demoMode ? sample.coaches : coaches
  const displayPlans:Plan[] = demoMode ? sample.plans : plans
  const displayPunches:Punch[] = demoMode ? sample.punches : punches
  const punchesByPlan=new Map(displayPunches.filter(p=>p.work_shift_id).map(p=>[p.work_shift_id,p]))
  const visible=displayPlans.filter(w=>filter==="all"||w.branch===filter)
  const alerts=visible.filter(w=>description(w,punchesByPlan.get(w.id),now).danger)
  const card="rounded-[24px] border border-white/10 bg-[#141414] p-5"
  const field="w-full rounded-xl border border-white/10 bg-[#1b2434] px-3 py-2.5 text-sm"
  return <StaffAppShell activePath="/staff/coaches" role="admin"><div className="mx-auto max-w-6xl space-y-5 px-4 py-6 pb-28 md:px-6 lg:pb-8">
    <Link href="/staff/coaches" className="inline-flex items-center gap-2 text-sm text-white/60"><ArrowLeft size={16}/> Coaches overview</Link>
    <header className="border-b border-white/10 pb-5">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">Admin / Coach operations</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-black md:text-3xl">Attendance & Shift Confirmations</h1>
          <p className="mt-1 text-sm text-white/55">Track who plans to report, who actually clocked in, and which shifts need attention.</p></div>
        <button onClick={() => {
          if (demoMode) setSample(buildCoachAttendanceDemo(new Date()))
          else void load()
        }} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm"><RefreshCw size={16}/> Refresh</button>
      </div>
    </header>
    <section aria-label="Data preview mode" className={demoMode
      ? "rounded-2xl border border-orange-400/30 bg-orange-400/10 p-4"
      : "rounded-2xl border border-white/10 bg-[#101725] p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {demoMode ? <FlaskConical className="mt-0.5 shrink-0 text-orange-300" size={22}/> :
            <Database className="mt-0.5 shrink-0 text-emerald-300" size={22}/>}
          <div>
            <p className="text-sm font-bold">{demoMode ? "DEMO MODE — SAMPLE DATA ONLY" : "LIVE DATA — ACTUAL BEARFIT RECORDS"}</p>
            <p className="mt-1 max-w-2xl text-xs text-white/65">
              {demoMode
                ? "Example coach shifts, confirmations, clock-in/out and conductions are shown for design review. No demo records are saved to Supabase, and all attendance actions are disabled."
                : "Showing actual Supabase shifts and punches. Scheduling and attendance codes create real records."}
            </p>
          </div>
        </div>
        <div role="group" aria-label="Attendance data source" className="flex rounded-xl border border-white/15 bg-black/20 p-1">
          <button type="button" aria-pressed={demoMode} onClick={()=>{setDemoMode(true);setSample(buildCoachAttendanceDemo(new Date()));setIssued(null);setError("");setNotice("")}}
            className={demoMode?"rounded-lg bg-[#ff7a1a] px-4 py-2 text-sm font-bold text-white":"rounded-lg px-4 py-2 text-sm font-medium text-white/65"}>
            Sample view
          </button>
          <button type="button" aria-pressed={!demoMode} onClick={()=>{setDemoMode(false);setError("");setNotice("");void load()}}
            className={!demoMode?"rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white":"rounded-lg px-4 py-2 text-sm font-medium text-white/65"}>
            Live data
          </button>
        </div>
      </div>
    </section>
    {error&&!demoMode&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    {notice&&!demoMode&&<p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Metric icon={UsersRound} label={demoMode?"Sample coaches":"Coach identities"} count={displayCoaches.length}/>
      <Metric icon={CalendarDays} label={demoMode?"Sample shifts":"Planned shifts"} count={visible.length}/>
      <Metric icon={Clock3} label={demoMode?"Sample time-ins":"Verified time-ins"} count={visible.filter(w=>punchesByPlan.get(w.id)?.clock_in_at).length}/>
      <Metric icon={AlertTriangle} label={demoMode?"Sample alerts":"Attention needed"} count={alerts.length}/>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={card}>
        <h2 className="text-lg font-bold">Plan coach shift</h2>
        {demoMode&&<p className="mt-3 rounded-xl border border-orange-300/20 bg-orange-300/5 p-3 text-xs text-orange-100">
          Planning is disabled in Sample view. Switch to Live data to create a real shift.
        </p>}
        <p className="mt-2 text-sm text-white/50">Assign a real work shift. A booking alone does not confirm staff attendance.</p>
        <form className={"mt-4 grid grid-cols-2 gap-3 "+(demoMode?"pointer-events-none opacity-40":"")} onSubmit={e=>void schedule(e)}>
          <label className="col-span-2 text-xs text-white/55">Coach
            <select value={selectedCoach} onChange={e=>setSelectedCoach(e.target.value)} className={field+" mt-1"}>
              <option value="">Select coach</option>{coaches.filter(c=>c.is_active).map(c=><option key={c.id} value={c.id}>{c.display_name} · {c.branch}{!c.user_id?" (login not created)":""}</option>)}
            </select>
          </label>
          <label className="col-span-2 text-xs text-white/55">Work date (PH)
            <input className={field+" mt-1"} type="date" min={dateInput(0)} value={day} onChange={e=>setDay(e.target.value)}/>
          </label>
          <label className="text-xs text-white/55">Start
            <input className={field+" mt-1"} type="time" value={start} onChange={e=>setStart(e.target.value)}/>
          </label>
          <label className="text-xs text-white/55">End
            <input className={field+" mt-1"} type="time" value={end} onChange={e=>setEnd(e.target.value)}/>
          </label>
          <button disabled={demoMode||busy||!selectedCoach} className="col-span-2 rounded-xl bg-[#ff7a1a] px-4 py-3 text-sm font-bold disabled:opacity-40">Assign shift</button>
        </form>
      </section>
      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={19} className="text-[#ff7a1a]"/> On-site attendance code</h2>
        <p className="mt-2 text-sm text-white/50">Staff/Admin issues a short-lived code at reception. Coaches enter it to verify clock-in or out. Never send this code remotely.</p>
        <label className="mt-4 block text-xs text-white/55">Branch
          <select value={branch} onChange={e=>{setBranch(e.target.value);setIssued(null)}} className={field+" mt-1"}>
            {branches.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <button disabled={demoMode||busy} onClick={()=>void issue()} className="mt-3 rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold disabled:opacity-40">Generate new branch code</button>
        {demoMode&&<p className="mt-3 rounded-xl border border-orange-300/20 bg-orange-300/5 p-3 text-xs text-orange-100">Demo preview — real attendance codes cannot be generated here.</p>}
        {issued&&!demoMode&&<div className="mt-4 rounded-xl border border-orange-400/30 bg-orange-400/5 p-4">
          <p className="text-xs text-orange-200">On-site only · {issued.branch}</p>
          <p className="mt-2 select-all break-all font-mono text-3xl font-black tracking-widest">{issued.code}</p>
          <p className="mt-2 text-xs text-white/60">Expires {fmt(issued.expires_at)}. Reissue after expiry.</p>
          <button onClick={()=>setIssued(null)} className="mt-3 text-xs underline">Hide code</button>
        </div>}
      </section>
    </div>
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-lg font-bold">Coach shift monitor</h2>
          <p className="mt-1 text-xs text-white/50">8:00 PM Manila previous day is the confirmation deadline. Alerts are in-app and calculated when viewed/refreshed.</p></div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className={field+" max-w-48"}><option value="all">All branches</option>{branches.map(b=><option key={b} value={b}>{b}</option>)}</select>
      </div>
      {loading&&!demoMode?<p className="mt-5 text-sm text-white/55">Loading records…</p>:visible.length===0?<p className="mt-5 text-sm text-white/55">No shifts have been planned for the selected period.</p>:
      <div className="mt-4 space-y-3">{visible.map(w=>{
        const coach=displayCoaches.find(c=>c.id===w.coach_id)
        const p=punchesByPlan.get(w.id)
        const status=description(w,p,now)
        return <article key={w.id} className="rounded-xl border border-white/10 bg-[#101725] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-bold">{coach?.display_name||"Unknown coach"} <span className="text-xs font-normal text-white/50">{coach?.username||""}</span></p>
              <p className="mt-1 text-sm text-white/70">{fmt(w.starts_at)} – {new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",hour:"numeric",minute:"2-digit"}).format(new Date(w.ends_at))} · {w.branch}</p>
              <p className="mt-1 text-xs text-white/50">Confirmed: {w.response==="confirmed"?"Yes":w.response==="unavailable"?"Cannot report":"No response"}{w.response_at?" · "+fmt(w.response_at):""}</p>
              <p className="mt-1 text-xs text-white/50">Time in: {p?.clock_in_at?fmt(p.clock_in_at):"Not recorded"} · Time out: {p?.clock_out_at?fmt(p.clock_out_at):"Not recorded"}</p>
              {w.unavailable_reason&&<p className="mt-1 text-xs text-amber-200">Coach reason: {w.unavailable_reason}</p>}
              {demoMode&&<p className="mt-2 text-xs text-orange-200">
                Sample member conductions today: {sample.sampleConductions[w.coach_id] ?? 0} · not payable
              </p>}
            </div>
            <span className={status.danger?"rounded-full bg-red-400/10 px-3 py-1.5 text-xs font-bold text-red-200":"rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200"}>{status.label}</span>
          </div>
        </article>
      })}</div>}
      <p className="mt-4 text-xs text-white/45">
        {demoMode
          ? "All entries are fictional examples for testing this dashboard layout. No sample shift, coach response, attendance punch or conduction is stored or payable."
          : "Missing a clock-in is flagged for review, not proof of absence. Login accounts must be provisioned in Coach Directory to let coaches respond."}
      </p>
    </section>
  </div></StaffAppShell>
}
function Metric({label,count,icon:Icon}:{label:string;count:number;icon:typeof UsersRound}) {
  return <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
    <Icon size={18} className="text-[#ff7a1a]"/><p className="mt-2 text-xs text-white/55">{label}</p><p className="mt-1 text-2xl font-black">{count}</p>
  </div>
}
