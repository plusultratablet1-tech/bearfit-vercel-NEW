"use client"
import {BRANCH_IDS} from "@/lib/branches"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import {
  AlertTriangle, ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, ChevronDown,
  Clock3, RefreshCw, ShieldCheck, UsersRound, FlaskConical, Database,
  CheckCircle2, Download, ClipboardCheck, Settings2,
} from "lucide-react"
import StaffAppShell from "@/components/bearfit/StaffAppShell"
import { createClient } from "@/lib/supabase/client"
import { buildCoachAttendanceDemo } from "@/lib/coach-attendance-demo"
import {
  addDay, manilaDay, manilaWeek, shiftDay, evaluateShift, csvEscape,
  type Attention,
} from "@/lib/coach-attendance-board"

const supabase=createClient()
type Coach={id:string;display_name:string;branch:string;username:string|null;user_id:string|null;is_active:boolean}
type Plan={id:string;coach_id:string;branch:string;starts_at:string;ends_at:string;response:"pending"|"confirmed"|"unavailable";response_at:string|null;unavailable_reason:string|null;created_at:string}
type Punch={id:string;work_shift_id:string|null;coach_id:string;clock_in_at:string;clock_out_at:string|null}
type Conduction={id:string;coach_id:string;session_date:string;status:"pending"|"approved"|"rejected"}
type Issued={code:string;branch:string;expires_at:string}
type Tab="today"|"weekly"|"history"
const branches=BRANCH_IDS
const timeZone="Asia/Manila"
const field="w-full rounded-xl border border-white/10 bg-[#1b2434] px-3 py-2.5 text-sm text-white"
const card="rounded-[24px] border border-white/10 bg-[#141414] p-4 md:p-5"
const mainButton="rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
function fmt(value:string) {return new Intl.DateTimeFormat("en-PH",{timeZone,dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}
function time(value:string) {return new Intl.DateTimeFormat("en-PH",{timeZone,hour:"numeric",minute:"2-digit"}).format(new Date(value))}
function dayLabel(day:string) {return new Intl.DateTimeFormat("en-PH",{timeZone:"UTC",weekday:"short",month:"short",day:"numeric"}).format(new Date(day+"T12:00:00Z"))}
function longDay(day:string) {return new Intl.DateTimeFormat("en-PH",{timeZone:"UTC",weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(new Date(day+"T12:00:00Z"))}
function dateInput(offsetDays:number) {return addDay(manilaDay(new Date()),offsetDays)}
function tone(t:Attention) {return t==="ok"?"border-emerald-400/20 bg-emerald-400/10 text-emerald-300":t==="attention"?"border-amber-400/20 bg-amber-400/10 text-amber-200":"border-white/10 bg-white/5 text-white/60"}
function Status({label,status}:{label:string;status:Attention}) {
  return <span className={"inline-flex max-w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold "+tone(status)}>{label}</span>
}
function Metric({label,count,icon:Icon}:{label:string;count:number;icon:typeof UsersRound}) {
  return <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
    <Icon size={18} className="text-[#ff7a1a]"/><p className="mt-2 text-xs text-white/55">{label}</p><p className="mt-1 text-2xl font-black">{count}</p>
  </div>
}

export default function CoachAttendanceAdminClient() {
  // Demo values stay in memory only; they have deliberately invalid UUIDs.
  const [demoMode,setDemoMode]=useState(true)
  const [sample,setSample]=useState(()=>buildCoachAttendanceDemo(new Date()))
  const [coaches,setCoaches]=useState<Coach[]>([])
  const [plans,setPlans]=useState<Plan[]>([])
  const [punches,setPunches]=useState<Punch[]>([])
  const [conductions,setConductions]=useState<Conduction[]>([])
  const [loading,setLoading]=useState(true)
  const [dataLimit,setDataLimit]=useState(false)
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")
  const [busy,setBusy]=useState(false)
  const [selectedCoach,setSelectedCoach]=useState("")
  const [day,setDay]=useState(()=>dateInput(1))
  const [start,setStart]=useState("08:00")
  const [end,setEnd]=useState("17:00")
  const [branch,setBranch]=useState<string>(branches[0])
  const [issued,setIssued]=useState<Issued|null>(null)
  const [filter,setFilter]=useState("all")
  const [coachFilter,setCoachFilter]=useState("all")
  const [view,setView]=useState<Tab>("today")
  const [selectedDate,setSelectedDate]=useState(()=>dateInput(0))
  const [historyDays,setHistoryDays]=useState(30)
  const [attentionOnly,setAttentionOnly]=useState(false)
  const [updated,setUpdated]=useState<Date|null>(null)
  const [clock,setClock]=useState(()=>Date.now())

  const load=useCallback(async()=>{
    setLoading(true)
    const [c,w,p,con]=await Promise.all([
      supabase.from("coaches").select("id,display_name,branch,username,user_id,is_active").order("display_name"),
      supabase.from("coach_work_shifts").select("id,coach_id,branch,starts_at,ends_at,response,response_at,unavailable_reason,created_at")
        .gte("starts_at",new Date(Date.now()-46*86400000).toISOString())
        .lte("starts_at",new Date(Date.now()+35*86400000).toISOString())
        .order("starts_at").limit(1500),
      supabase.from("coach_shifts").select("id,work_shift_id,coach_id,clock_in_at,clock_out_at")
        .gte("clock_in_at",new Date(Date.now()-47*86400000).toISOString())
        .order("clock_in_at",{ascending:false}).limit(1500),
      supabase.from("coach_conductions").select("id,coach_id,session_date,status")
        .gte("session_date",addDay(manilaDay(new Date()),-46))
        .order("session_date",{ascending:false}).limit(1500),
    ])
    const problems=[c.error,w.error,p.error,con.error].filter(Boolean).map(e=>e?.message).join(" · ")
    if(problems) setError("Unable to load all live attendance information: "+problems)
    else setError("")
    setCoaches((c.data||[]) as Coach[])
    setPlans((w.data||[]) as Plan[])
    setPunches((p.data||[]) as Punch[])
    setConductions((con.data||[]) as Conduction[])
    setDataLimit([w,p,con].some(r=>(r.data?.length||0)>=1500))
    setLoading(false)
    setUpdated(new Date())
    setClock(Date.now())
  },[])

  useEffect(()=>{void load()},[load])
  useEffect(()=>{
    const id=window.setInterval(()=>{
      setClock(Date.now())
      if(!document.hidden && !demoMode) void load()
    },60_000)
    return ()=>window.clearInterval(id)
  },[demoMode,load])

  async function schedule(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if (demoMode) { setError("Switch to Live Data before creating a real shift."); return }
    if(!selectedCoach) {setError("Choose a coach.");return}
    const startsAt=new Date(day+"T"+start+":00+08:00")
    const endsAt=new Date(day+"T"+end+":00+08:00")
    if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt) {
      setError("Choose a valid start and end time (overnight shifts require Admin planning later).");return
    }
    setBusy(true);setError("");setNotice("")
    const {error:x}=await supabase.rpc("admin_plan_coach_shift",{
      p_coach_id:selectedCoach,p_starts_at:startsAt.toISOString(),p_ends_at:endsAt.toISOString()
    })
    setBusy(false)
    if(x)setError(x.message)
    else {setNotice("Shift assigned. Coach can confirm by 8:00 PM the preceding day.");await load()}
  }
  async function issue(){
    if (demoMode) { setError("Switch to Live Data before issuing an actual attendance code."); return }
    setBusy(true);setError("");setNotice("");setIssued(null)
    const {data,error:x}=await supabase.rpc("issue_coach_branch_code",{p_branch:branch})
    setBusy(false)
    if(x)setError(x.message)
    else {setIssued(data as Issued);setNotice("Attendance code issued for reception. Do not share it remotely.")}
  }

  const now=clock
  const displayCoaches:Coach[]=demoMode ? sample.coaches : coaches
  const displayPlans:Plan[]=demoMode ? sample.plans : plans
  const displayPunches:Punch[]=demoMode ? sample.punches : punches
  const punchesByPlan=useMemo(()=>new Map(displayPunches.filter(p=>p.work_shift_id).map(p=>[p.work_shift_id!,p])),[displayPunches])
  const eligibleCoaches=displayCoaches.filter(c=>(filter==="all"||c.branch===filter)&&(coachFilter==="all"||c.id===coachFilter))
  const eligibleIds=new Set(eligibleCoaches.map(c=>c.id))
  const filteredPlans=displayPlans.filter(w=>eligibleIds.has(w.coach_id)&&(filter==="all"||w.branch===filter))
  const todayShifts=filteredPlans.filter(w=>shiftDay(w)===selectedDate).sort((a,b)=>{
    const aAttention=evaluateShift(a,punchesByPlan.get(a.id),now).needsAttention
    const bAttention=evaluateShift(b,punchesByPlan.get(b.id),now).needsAttention
    return Number(bAttention)-Number(aAttention)||a.starts_at.localeCompare(b.starts_at)
  })
  const attentionShifts=todayShifts.filter(w=>evaluateShift(w,punchesByPlan.get(w.id),now).needsAttention)
  const clockedIn=todayShifts.filter(w=>punchesByPlan.get(w.id)?.clock_in_at)
  const confirmed=todayShifts.filter(w=>w.response==="confirmed")
  const chosenDayIsToday=selectedDate===manilaDay(new Date(now))
  const week=useMemo(()=>manilaWeek(selectedDate),[selectedDate])
  const historyStart=addDay(manilaDay(new Date(now)),-historyDays+1)
  const historyEnd=manilaDay(new Date(now))
  const history=filteredPlans.filter(w=>shiftDay(w)>=historyStart&&shiftDay(w)<=historyEnd)
    .sort((a,b)=>b.starts_at.localeCompare(a.starts_at))
  const liveConductions=conductions.filter(c=>c.status==="approved"||c.status==="pending")
  function countConductions(coachId:string,dayValue:string){
    if(demoMode) return dayValue===manilaDay(new Date(now))?(sample.sampleConductions[coachId]||0):0
    return liveConductions.filter(c=>c.coach_id===coachId&&c.session_date===dayValue&&c.status==="approved").length
  }
  function exportHistory(){
    if(demoMode)return // Never let fictional attendance be exported as a real report.
    const headings=["Date (PH)","Coach","Branch","Shift Start (PH)","Shift End (PH)","Confirmation","Response At","Clock In","Clock Out","Attendance","Needs Attention","Approved Conductions"]
    const rows=history.map(w=>{
      const coach=displayCoaches.find(c=>c.id===w.coach_id)
      const p=punchesByPlan.get(w.id)
      const status=evaluateShift(w,p,now)
      return [shiftDay(w),coach?.display_name||"Unknown",w.branch,fmt(w.starts_at),fmt(w.ends_at),status.confirmation,w.response_at?fmt(w.response_at):"",p?.clock_in_at?fmt(p.clock_in_at):"",p?.clock_out_at?fmt(p.clock_out_at):"",status.attendance,status.needsAttention?"Review":"",countConductions(w.coach_id,shiftDay(w))]
    })
    const csv="\uFEFF"+[headings,...rows].map(row=>row.map(csvEscape).join(",")).join("\r\n")
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"})
    const objectUrl=URL.createObjectURL(blob)
    const anchor=document.createElement("a")
    anchor.href=objectUrl
    anchor.download="bearfit-coach-attendance-"+historyStart+"-to-"+historyEnd+".csv"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  }
  const changeDate=(offset:number)=>setSelectedDate(d=>addDay(d,offset))
  return (
    <StaffAppShell activePath="/staff/coaches" role="admin">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-28 md:px-6 lg:px-8 lg:pb-8">
        <Link href="/staff/coaches" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft size={16}/> Coaches overview</Link>
        <header className="border-b border-white/10 pb-5">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">BearFit / Team Operations</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black md:text-3xl">Coach Attendance</h1>
              <p className="mt-1 text-sm text-white/55">Today's arrivals, 8 PM confirmations, weekly coverage and historical attendance.</p>
            </div>
            <button type="button" onClick={()=>{setClock(Date.now());if(demoMode)setSample(buildCoachAttendanceDemo(new Date()));else void load()}}
              className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5">
              <RefreshCw size={16}/> Refresh
            </button>
          </div>
        </header>

        <section aria-label="Attendance data source" className={demoMode?"rounded-2xl border border-orange-400/30 bg-orange-400/10 p-4":"rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {demoMode?<FlaskConical className="mt-0.5 shrink-0 text-orange-300" size={22}/>:<Database className="mt-0.5 shrink-0 text-emerald-300" size={22}/>}
              <div>
                <p className="text-sm font-bold">{demoMode?"DEMO MODE — SAMPLE DATA ONLY":"LIVE DATA — ACTUAL BEARFIT RECORDS"}</p>
                <p className="mt-1 max-w-2xl text-xs text-white/65">
                  {demoMode?"All entries are fictional examples for layout review. No sample shifts, punches, conductions or alerts are saved to Supabase.":
                   "Showing actual approved and pending records. Refreshes approximately every 60 seconds while this tab is open and visible."}
                </p>
              </div>
            </div>
            <div role="group" aria-label="Attendance data mode" className="flex rounded-xl border border-white/15 bg-black/20 p-1">
              <button type="button" aria-pressed={demoMode} onClick={()=>{setDemoMode(true);setSample(buildCoachAttendanceDemo(new Date()));setSelectedDate(manilaDay(new Date()));setIssued(null);setError("");setNotice("")}}
                className={demoMode?"rounded-lg bg-[#ff7a1a] px-4 py-2 text-sm font-bold":"rounded-lg px-4 py-2 text-sm text-white/70"}>Sample view</button>
              <button type="button" aria-pressed={!demoMode} onClick={()=>{setDemoMode(false);setSelectedDate(manilaDay(new Date()));setIssued(null);setError("");setNotice("");void load()}}
                className={!demoMode?"rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold":"rounded-lg px-4 py-2 text-sm text-white/70"}>Live data</button>
            </div>
          </div>
        </section>

        {error&&!demoMode&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
        {notice&&!demoMode&&<p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}
        {dataLimit&&!demoMode&&<p role="status" className="rounded-xl border border-amber-400/20 p-3 text-xs text-amber-200">Record limit reached. Use a shorter date period before relying on totals or export.</p>}

        <section aria-label="Attendance views" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Coach attendance view" className="inline-flex rounded-xl border border-white/10 bg-[#101725] p-1">
              {(["today","weekly","history"] as Tab[]).map(tab=>(
                <button key={tab} type="button" role="tab" aria-selected={view===tab} onClick={()=>{setView(tab);setAttentionOnly(false)}}
                  className={view===tab?"rounded-lg bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold text-white":"rounded-lg px-4 py-2.5 text-sm font-medium text-white/60 hover:text-white"}>
                  {tab==="today"?"Today":tab==="weekly"?"Weekly":"History"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Filter by branch" value={filter} onChange={e=>setFilter(e.target.value)} className={field+" max-w-48"}>
                <option value="all">All branches</option>{branches.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
              <select aria-label="Filter by coach" value={coachFilter} onChange={e=>setCoachFilter(e.target.value)} className={field+" max-w-44"}>
                <option value="all">All coaches</option>{displayCoaches.filter(c=>filter==="all"||c.branch===filter).map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}
              </select>
            </div>
          </div>

          {view!=="history"&&<div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{view==="today"?"Daily Attendance Board":"Weekly Coach Coverage"}</h2>
              <p className="text-xs text-white/50">{view==="today"?longDay(selectedDate):dayLabel(week[0])+" – "+dayLabel(week[6])} · Philippine time</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label={view==="weekly"?"Previous week":"Previous day"} onClick={()=>changeDate(view==="weekly"?-7:-1)}
                className="rounded-xl border border-white/15 p-2.5 hover:bg-white/10"><ChevronLeft size={16}/></button>
              <input type="date" aria-label="Jump to attendance date" value={selectedDate} onChange={e=>{if(e.target.value)setSelectedDate(e.target.value)}} className={field+" w-[155px]"}/>
              <button type="button" aria-label={view==="weekly"?"Next week":"Next day"} onClick={()=>changeDate(view==="weekly"?7:1)}
                className="rounded-xl border border-white/15 p-2.5 hover:bg-white/10"><ChevronRight size={16}/></button>
              <button type="button" onClick={()=>setSelectedDate(manilaDay(new Date()))} className="rounded-xl border border-white/15 px-3 py-2.5 text-xs font-semibold">Jump to today</button>
            </div>
          </div>}

          {loading&&!demoMode?<p className={card+" text-white/50"}>Loading live attendance records…</p>:
          view==="today"?<>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric icon={CalendarDays} label={demoMode?"Sample shifts expected":"Coaches scheduled"} count={todayShifts.length}/>
              <Metric icon={Clock3} label={demoMode?"Sample time-ins":"Recorded time-ins"} count={clockedIn.length}/>
              <Metric icon={CheckCircle2} label="Shift confirmations" count={confirmed.length}/>
              <Metric icon={AlertTriangle} label={demoMode?"Sample alerts":"Need attention"} count={attentionShifts.length}/>
            </div>
            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold">Coach roster for {dayLabel(selectedDate)}</h3>
                  <p className="mt-1 text-xs text-white/50">
                    Confirmation and actual attendance appear separately. An unverified arrival is never automatically labeled absent.
                  </p>
                </div>
                <button type="button" aria-pressed={attentionOnly} onClick={()=>setAttentionOnly(v=>!v)}
                  className={attentionOnly?"rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200":"rounded-xl border border-white/15 px-3 py-2 text-xs text-white/70"}>
                  {attentionOnly?"Showing alerts only":"Show alerts only"}
                </button>
              </div>
              {todayShifts.length===0?<p className="mt-5 rounded-xl border border-dashed border-white/15 p-7 text-center text-sm text-white/50">No coach shifts scheduled for this date.</p>:
              <div className="mt-4 grid gap-3">
                {todayShifts.filter(w=>!attentionOnly||evaluateShift(w,punchesByPlan.get(w.id),now).needsAttention).map(w=>{
                  const coach=displayCoaches.find(c=>c.id===w.coach_id)
                  const p=punchesByPlan.get(w.id)
                  const s=evaluateShift(w,p,now)
                  return <article key={w.id} className="rounded-2xl border border-white/10 bg-[#101725] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-base font-bold">{coach?.display_name||"Unknown coach"} <span className="text-xs font-normal text-white/50">{coach?.username}</span></h4>
                        <p className="mt-1 text-xs text-white/55">{w.branch} · {time(w.starts_at)}–{time(w.ends_at)}</p>
                      </div>
                      {s.needsAttention&&<span className="flex items-center gap-1 text-xs font-medium text-amber-200"><AlertTriangle size={14}/> Needs review</span>}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-white/45">Previous-day confirmation</p><Status label={s.confirmation} status={s.confirmationTone}/></div>
                      <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-white/45">Actual attendance</p><Status label={s.attendance} status={s.attendanceTone}/></div>
                      <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-white/45">Verified time-in / out</p><p className="text-xs font-semibold">{p?.clock_in_at?time(p.clock_in_at):"Not recorded"} / {p?.clock_out_at?time(p.clock_out_at):"Not recorded"}</p></div>
                      <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-white/45">{demoMode?"Sample member conductions today":"Approved conductions"}</p>
                        <p className="text-lg font-bold">{countConductions(w.coach_id,shiftDay(w))} <span className="text-xs font-normal text-white/40">{demoMode?"not payable":"verified"}</span></p></div>
                    </div>
                    {w.unavailable_reason&&<p className="mt-3 text-xs text-amber-200">Coach reason: {w.unavailable_reason}</p>}
                  </article>
                })}
                {attentionOnly&&todayShifts.length>0&&attentionShifts.length===0&&<p className="p-4 text-sm text-white/55">No shifts currently flagged for attention.</p>}
              </div>}
              <p className="mt-4 text-xs text-white/45">The arrival grace period is 15 minutes. Late clock-ins, unresolved attendance, and missed 8 PM confirmations are flagged—not automatically marked as absences.</p>
            </section>
          </>:view==="weekly"?<>
            <section className={card}>
              <h3 className="font-bold">Seven-day coach coverage</h3>
              <p className="mt-1 text-xs text-white/50">Select a day to open its daily board. Empty cells mean no work shift was planned, not an absence.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[830px] border-separate border-spacing-1 text-sm">
                  <thead><tr><th className="px-3 py-2 text-left text-xs font-semibold text-white/50">Coach / branch</th>
                    {week.map(d=><th key={d} className="px-1 py-2 text-center text-xs font-semibold text-white/50">{dayLabel(d)}</th>)}
                  </tr></thead>
                  <tbody>{eligibleCoaches.map(c=><tr key={c.id}>
                    <th scope="row" className="min-w-36 px-2 py-3 text-left font-medium">{c.display_name}<p className="text-[11px] font-normal text-white/45">{c.branch}</p></th>
                    {week.map(d=>{
                      const matches=filteredPlans.filter(w=>w.coach_id===c.id&&shiftDay(w)===d)
                      const evaluations=matches.map(w=>evaluateShift(w,punchesByPlan.get(w.id),now))
                      const issue=evaluations.some(s=>s.needsAttention)
                      const finished=evaluations.some(s=>s.attendance==="Completed shift"||s.attendance.startsWith("Completed ·"))
                      const present=evaluations.some(s=>["On duty","Late arrival · on duty"].includes(s.attendance))
                      const label=matches.length===0?"Off duty":issue?"Needs review":finished?"Completed":present?"On duty":"Scheduled"
                      const status=matches.length===0?"neutral":issue?"attention":finished||present?"ok":"neutral"
                      return <td key={d} className="p-0.5 text-center">
                        <button type="button" onClick={()=>{setSelectedDate(d);setView("today");setAttentionOnly(false)}} title={matches.length?matches.map(w=>time(w.starts_at)+" "+evaluateShift(w,punchesByPlan.get(w.id),now).attendance).join("; "):"No planned shift"} className={"w-full rounded-xl border px-1 py-3 text-[11px] font-semibold hover:brightness-125 "+(status==="neutral"?"border-white/10 bg-white/5 text-white/50":tone(status))}>
                          {matches.length?label:"—"}
                          {matches.length>1&&<span className="block text-[10px]">{matches.length} shifts</span>}
                        </button>
                      </td>
                    })}
                  </tr>)}</tbody>
                </table>
              </div>
              {eligibleCoaches.length===0&&<p className="text-sm text-white/55">No coach identities match these filters.</p>}
              <p className="mt-3 text-xs text-white/45">Coverage is based on assigned work shifts, not inferred from member bookings. Scroll sideways on smaller screens.</p>
            </section>
          </>:<>
            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-bold">Attendance History</h2>
                  <p className="mt-1 text-xs text-white/50">Verified time punches, confirmations and exceptions for administrative review.</p></div>
                <div className="flex flex-wrap gap-2">
                  <select aria-label="History date range" value={historyDays} onChange={e=>setHistoryDays(Number(e.target.value))} className={field+" max-w-36"}>
                    <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={45}>Last 45 days</option>
                  </select>
                  <button type="button" disabled={demoMode||dataLimit||history.length===0} onClick={exportHistory}
                    className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm disabled:opacity-40">
                    <Download size={16}/> Export CSV
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/45">{historyStart} through {historyEnd} · Asia/Manila · {history.length} work shift records</p>
              {demoMode&&<p className="mt-2 text-xs text-amber-200">Sample history cannot be exported as a real attendance report.</p>}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead><tr className="border-b border-white/10 text-xs text-white/45">
                    {["Date / Coach","Branch","Confirmation","Arrival","Departure","Result"].map(h=><th key={h} className="px-3 py-3 font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>{history.map(w=>{
                    const c=displayCoaches.find(co=>co.id===w.coach_id)
                    const p=punchesByPlan.get(w.id)
                    const s=evaluateShift(w,p,now)
                    return <tr key={w.id} className="border-b border-white/10">
                      <td className="px-3 py-3"><strong>{shiftDay(w)}</strong><p className="mt-0.5 text-xs text-white/60">{c?.display_name||"Unknown coach"} · {time(w.starts_at)}–{time(w.ends_at)}</p></td>
                      <td className="px-3 py-3 text-xs text-white/60">{w.branch}</td>
                      <td className="px-3 py-3"><Status label={s.confirmation} status={s.confirmationTone}/></td>
                      <td className="px-3 py-3 text-xs">{p?.clock_in_at?fmt(p.clock_in_at):"—"}</td>
                      <td className="px-3 py-3 text-xs">{p?.clock_out_at?fmt(p.clock_out_at):"—"}</td>
                      <td className="px-3 py-3"><Status label={s.attendance} status={s.attendanceTone}/></td>
                    </tr>
                  })}</tbody>
                </table>
              </div>
              {history.length===0&&<p className="mt-5 text-sm text-white/55">No historical shifts found for these filters.</p>}
              <p className="mt-4 text-xs text-white/45">Payroll amounts are not included. Corrections remain subject to separate Admin approval and audit rules; this view does not edit historical punches.</p>
            </section>
          </>}
        </section>

        <details className={card+" group"} id="coach-attendance-management">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-bold"><Settings2 size={18} className="text-[#ff7a1a]"/> Shift planning &amp; reception tools</span>
            <ChevronDown size={18} className="text-white/60 transition-transform group-open:rotate-180"/>
          </summary>
          <p className="mt-2 text-xs text-white/50">Keep operational setup separate from the daily attendance overview.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-[#101725] p-4">
              <h3 className="font-semibold">Plan coach shift</h3>
              {demoMode&&<p className="mt-3 rounded-lg border border-orange-300/20 bg-orange-300/5 p-3 text-xs text-orange-100">Demo preview — switch to Live data to assign real shifts.</p>}
              <form className={"mt-4 grid grid-cols-2 gap-3 "+(demoMode?"pointer-events-none opacity-40":"")} onSubmit={e=>void schedule(e)}>
                <label className="col-span-2 text-xs text-white/55">Coach
                  <select value={selectedCoach} onChange={e=>setSelectedCoach(e.target.value)} className={field+" mt-1"}>
                    <option value="">Select coach</option>{coaches.filter(c=>c.is_active).map(c=><option key={c.id} value={c.id}>{c.display_name} · {c.branch}{!c.user_id?" (login not created)":""}</option>)}
                  </select>
                </label>
                <label className="col-span-2 text-xs text-white/55">Work date (PH)
                  <input className={field+" mt-1"} type="date" min={dateInput(0)} value={day} onChange={e=>setDay(e.target.value)}/>
                </label>
                <label className="text-xs text-white/55">Start<input className={field+" mt-1"} type="time" value={start} onChange={e=>setStart(e.target.value)}/></label>
                <label className="text-xs text-white/55">End<input className={field+" mt-1"} type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label>
                <button disabled={demoMode||busy||!selectedCoach} className={"col-span-2 "+mainButton}>Assign shift</button>
              </form>
            </section>
            <section className="rounded-2xl border border-white/10 bg-[#101725] p-4">
              <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-[#ff7a1a]"/> Reception attendance code</h3>
              <p className="mt-2 text-xs text-white/55">Authorized reception staff displays a branch code to coaches on site. Code expires after 2 minutes. Never share remotely.</p>
              <label className="mt-4 block text-xs text-white/55">Branch
                <select value={branch} onChange={e=>{setBranch(e.target.value);setIssued(null)}} className={field+" mt-1"}>
                  {branches.map(b=><option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <button type="button" disabled={demoMode||busy} onClick={()=>void issue()} className={"mt-3 "+mainButton}>Generate new branch code</button>
              {demoMode&&<p className="mt-3 rounded-lg border border-orange-300/20 bg-orange-300/5 p-3 text-xs text-orange-100">Demo preview — real attendance codes are disabled.</p>}
              {issued&&!demoMode&&<div className="mt-4 rounded-xl border border-orange-400/30 bg-orange-400/5 p-4">
                <p className="text-xs text-orange-200">On-site only · {issued.branch}</p>
                <p className="mt-2 select-all break-all font-mono text-3xl font-black tracking-widest">{issued.code}</p>
                <p className="mt-2 text-xs text-white/60">Expires {fmt(issued.expires_at)}.</p>
                <button type="button" onClick={()=>setIssued(null)} className="mt-3 text-xs underline">Hide code</button>
              </div>}
            </section>
          </div>
          <div className="mt-3 text-xs text-white/45">8:00 PM Manila previous day is the confirmation deadline. Alerts are in-app and calculated when viewed/refreshed. Missing a clock-in is flagged for review, not proof of absence. Login accounts must be provisioned in Coach Directory to let coaches respond.</div>
          <Link href="/staff/coaches/directory" className="mt-3 inline-flex text-xs font-semibold text-orange-300 hover:underline">Manage Coach Directory &amp; Rates →</Link>
        </details>
        <p className="text-xs text-white/40">
          {demoMode?"Sample coaches · Sample time-ins · Sample alerts · Sample member conductions today · not payable.":"Live data refreshed "+(updated?time(updated.toISOString()):"when loaded")+". Confirmation and time punches remain separate verified records."}
        </p>
      </div>
    </StaffAppShell>
  )
}
