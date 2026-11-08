"use client"
import {useEffect,useMemo,useState} from "react"
import {createClient} from "@/lib/supabase/client"
import {CalendarDays,Clock3,Users,CheckCircle2,AlertTriangle,ChevronLeft,ChevronRight} from "lucide-react"
type Booking={id:string;start_at:string;end_at:string;status:string;member_name:string;member_code:string;session_label:string|null;session_type:string;branch:string;coach_response:string|null;coach_reason:string|null}
type Request={id:string;start_at:string;status:string;member_name:string;member_code:string;session_label:string|null;session_type:string;coach_response:string|null;coach_reason:string|null}
type Overview={bookings:Booking[];requests:Request[]}
type Shift={id:string;starts_at:string;ends_at:string;response:string;clock_in_at:string|null;clock_out_at:string|null}
const db=createClient()
const box="rounded-[24px] border border-white/10 bg-[#171717] p-5 md:p-6"
// Schedule dates may be absent on unconfirmed Admin booking requests.
 // Never pass an invalid Date to Intl: its RangeError previously crashed this tab.
const ph=(s:string|null|undefined)=>{
 if(!s)return "—"
 const value=new Date(s)
 return Number.isNaN(value.getTime())?"—":new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(value)
}
function localDay(s:string|null|undefined){
 if(!s)return ""
 const value=new Date(s)
 if(Number.isNaN(value.getTime()))return ""
 const p=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value)
 const v=(x:string)=>p.find(a=>a.type===x)?.value||""
 return v("year")+"-"+v("month")+"-"+v("day")
}
function addDays(s:string,n:number){
 const d=new Date(s+"T12:00:00Z")
 if(Number.isNaN(d.getTime()))return s
 d.setUTCDate(d.getUTCDate()+n)
 return d.toISOString().slice(0,10)
}
function monday(s:string){const d=new Date(s+"T12:00:00Z");const dow=d.getUTCDay();return Number.isNaN(d.getTime())?s:addDays(s,-((dow+6)%7))}
function calendarLabel(s:string){
 const value=new Date(s+"T12:00:00Z")
 return Number.isNaN(value.getTime())?"—":new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",month:"short",day:"numeric",year:"numeric"}).format(value)
}
export default function CoachScheduleOverview({shifts,onRefresh,onPunch,punchBusy}:{shifts:Shift[];onRefresh:()=>Promise<void>;onPunch:(id:string,action:"in"|"out",fix:{latitude:number;longitude:number;accuracy:number;observedAt:string})=>Promise<boolean>;punchBusy:boolean}){
 const [data,setData]=useState<Overview>({bookings:[],requests:[]}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState<string|null>(null),[reason,setReason]=useState<Record<string,string>>({}),[week,setWeek]=useState(()=>monday(localDay(new Date().toISOString()))),[selected,setSelected]=useState(()=>localDay(new Date().toISOString()))
 const [clockDialog,setClockDialog]=useState<{shiftId:string;action:"in"|"out"}|null>(null)
 const [gpsEnabled,setGpsEnabled]=useState(false)
 const [openWeek,setOpenWeek]=useState<{enabled:boolean;clock_in_at:string|null;clock_out_at:string|null}>({enabled:false,clock_in_at:null,clock_out_at:null})
 async function loadOpenWeek(){const {data}=await db.rpc("coach_open_gps_status");if(data)setOpenWeek(data)}
 useEffect(()=>{void loadOpenWeek()},[])
 useEffect(()=>{void db.rpc("coach_gps_attendance_status").then(({data})=>setGpsEnabled(Boolean(data?.enabled)))},[])
 const [clockError,setClockError]=useState("")
 const [clockSubmitting,setClockSubmitting]=useState(false)
 async function load(){const r=await db.rpc("coach_schedule_overview");if(r.error)setError(r.error.message);else{setData(r.data as Overview);setError("")}setLoading(false)}
 useEffect(()=>{void load()},[])
 const today=localDay(new Date().toISOString())
 const bookings=data.bookings||[],requests=data.requests||[]
 const todays=bookings.filter(b=>localDay(b.start_at)===today)
 const completed=todays.filter(b=>b.status==="completed")
 const pending=todays.filter(b=>b.status==="confirmed"&&!b.coach_response).length+requests.filter(b=>!b.coach_response).length+shifts.filter(s=>localDay(s.starts_at)===today&&s.response==="pending").length
 const upcoming=bookings.filter(b=>Date.parse(b.start_at)>Date.now()&&b.status==="confirmed").sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at))
 const days=Array.from({length:7},(_,i)=>addDays(week,i))
 const dayList=bookings.filter(b=>localDay(b.start_at)===selected)
 const shiftList=shifts.filter(s=>localDay(s.starts_at)===selected)
 const currentShift=shifts.find(v=>v.clock_in_at&&!v.clock_out_at)
  || shifts.find(v=>localDay(v.starts_at)===today&&v.clock_out_at)
  || shifts.find(v=>localDay(v.starts_at)===today)
 const attendance=openWeek.enabled?openWeek:currentShift
 const clockAction=attendance?.clock_in_at?"out":"in"
 const clockTime=(timestamp:string|null|undefined)=>{
   if(!timestamp)return ""
   const value=new Date(timestamp)
   return Number.isNaN(value.getTime())?"—":new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",hour:"numeric",minute:"2-digit",hour12:true}).format(value)
 }
 function openClockDialog(){
   if((!openWeek.enabled&&!currentShift)||attendance?.clock_out_at||punchBusy)return

   setClockError("")
   setClockDialog({shiftId:openWeek.enabled?"OPEN_WEEK":currentShift!.id,action:clockAction})
 }
 async function submitClock(){
   if(!clockDialog||clockSubmitting)return
   if(!navigator.geolocation){setClockError("This browser does not support location.");return}
   setClockSubmitting(true);setClockError("")
   try{
     const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}))
     const ok=await onPunch(clockDialog.shiftId,clockDialog.action,{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,observedAt:new Date(position.timestamp).toISOString()})
     if(ok){setClockDialog(null);await loadOpenWeek()}else setClockError("GPS attendance was not recorded. Check the error displayed on this page.")
   }catch(e){setClockError(e instanceof Error?e.message:"GPS location unavailable.")}
   finally{setClockSubmitting(false)}
 }
  const start=calendarLabel(week),end=calendarLabel(addDays(week,6))
 async function respond(id:string,response:"available"|"conflict"|"cancel_requested"){setBusy(id);setError("");setNotice("");const r=await db.rpc("coach_schedule_respond",{p_booking_id:id,p_response:response,p_reason:reason[id]||null});setBusy(null);if(r.error)setError(r.error.message);else{setNotice("Response saved for Admin review. Official booking status unchanged.");await load();await onRefresh()}}
 return <div className="space-y-5">
 <div className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-start xl:justify-between">
 <div><p className="text-xs font-black uppercase tracking-[.22em] text-orange-300">Coach Operations · Admin-connected</p><h1 className="mt-2 text-3xl font-black">My Schedule</h1><p className="mt-2 text-sm text-white/50">Assigned by BearFit Admin · Philippines time</p></div>
 <div className="flex shrink-0 flex-col items-start gap-1.5 xl:items-end">
  {openWeek.enabled&&<p className="text-xs text-orange-300">Open GPS testing · Nov 9–15 · Admin review required</p>}
  {!gpsEnabled&&<p className="text-xs text-amber-200">GPS branch setup required</p>}
  {attendance?.clock_in_at&&<span className="text-xs font-medium text-emerald-300">Clocked in: {clockTime(attendance.clock_in_at)}</span>}
  {attendance?.clock_out_at&&<span className="text-xs font-medium text-white/55">Clocked out: {clockTime(attendance.clock_out_at)}</span>}
  {attendance?.clock_out_at
   ?<span className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-3 text-sm font-bold text-emerald-300">Shift completed</span>
   :<button type="button" onClick={openClockDialog} disabled={(!openWeek.enabled&&!currentShift)||punchBusy||!gpsEnabled}
       title={!openWeek.enabled&&!currentShift?"Admin must assign a shift before you can clock in.":!gpsEnabled?"Admin must enable this branch GPS attendance.":undefined}
       className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-950/20 disabled:cursor-not-allowed disabled:opacity-40">
        {attendance?.clock_in_at?"Clock Out":"Clock In"}
     </button>}
 </div>
 </div>
 {error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
 {notice&&<p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}
 <section className="overflow-hidden rounded-[26px] border border-[#30394a] bg-[#121212] p-4 md:p-6">
  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[[CalendarDays,"Today's sessions",todays.length],[CheckCircle2,"Completed today",completed.length],[AlertTriangle,"Pending response",pending],[Clock3,"Next session",upcoming[0]?new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",hour:"numeric",minute:"2-digit"}).format(new Date(upcoming[0].start_at)):"—"]].map(([Icon,label,value],i)=>{const Glyph=Icon as typeof CalendarDays;return <div key={i} className="rounded-[20px] bg-[#242424] p-4"><Glyph size={20} className="text-orange-400"/><p className="mt-3 text-xs text-white/55">{label as string}</p><p className="mt-2 text-2xl font-black">{value as string|number}</p></div>})}</div>
  <section className="mt-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-300">Weekly Calendar</p><h2 className="mt-1 text-xl font-black">Assigned shifts & client sessions</h2></div><div className="flex items-center gap-2"><button aria-label="Previous week" onClick={()=>{setWeek(addDays(week,-7));setSelected(addDays(week,-7))}} className="rounded-xl border border-white/15 p-2"><ChevronLeft size={19}/></button><span className="text-xs text-white/65">{start} – {end}</span><button aria-label="Next week" onClick={()=>{setWeek(addDays(week,7));setSelected(addDays(week,7))}} className="rounded-xl border border-white/15 p-2"><ChevronRight size={19}/></button><button onClick={()=>{setWeek(monday(today));setSelected(today)}} className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold">Today</button></div></div>
  <div className="mt-4 grid grid-cols-7 gap-1.5">{days.map(day=><button key={day} onClick={()=>setSelected(day)} aria-pressed={selected===day} className={"min-h-24 rounded-xl border p-2 text-center "+(selected===day?"border-orange-500 bg-orange-500/15":"border-white/10 bg-[#242424]")}><p className="text-[10px] text-white/50">{new Intl.DateTimeFormat("en-PH",{weekday:"short",timeZone:"UTC"}).format(new Date(day+"T12:00:00Z"))}</p><p className="mt-1 font-black">{day.slice(-2)}</p><p className="mt-2 text-[10px] text-orange-300">{bookings.filter(b=>localDay(b.start_at)===day).length} session(s)</p><p className="text-[10px] text-emerald-300">{shifts.filter(s=>localDay(s.starts_at)===day).length} shift(s)</p></button>)}</div>
  <div className="mt-4 rounded-2xl bg-[#202020] p-4"><h3 className="font-bold">{selected} · Daily view</h3>{dayList.length===0&&shiftList.length===0&&<p className="mt-3 text-sm text-white/50">No sessions or shifts assigned for this day.</p>}{dayList.map(b=><div key={b.id} className="mt-3 rounded-xl border border-white/10 p-3"><p className="font-semibold">{b.member_name} · {b.member_code}</p><p className="mt-1 text-xs text-white/60">{ph(b.start_at)} · {b.session_label||b.session_type} · {b.status}</p>{b.coach_response&&<p className="mt-1 text-xs text-orange-300">Coach response: {b.coach_response}</p>}</div>)}{shiftList.map(s=><p key={s.id} className="mt-2 rounded-lg border border-white/10 p-3 text-sm">Shift: {ph(s.starts_at)} – {ph(s.ends_at)} · {s.response}</p>)}</div></section>
  <section className="mt-7"><h2 className="text-xl font-black">Today's Client Sessions</h2><p className="mt-1 text-sm text-white/50">Assigned bookings from Admin. Session deduction stays in Scan QR.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{todays.length?todays.map(b=><div key={b.id} className="rounded-[20px] bg-[#242424] p-5"><p className="font-black">{b.member_name}</p><p className="mt-1 text-sm text-orange-300">{b.member_code} · {b.session_label||b.session_type}</p><p className="mt-2 text-xs text-white/55">{ph(b.start_at)} · {b.status}</p>{b.coach_response&&<p className="mt-2 text-xs text-emerald-300">Your response: {b.coach_response}</p>}<div className="mt-3 flex flex-wrap gap-2"><button disabled={busy!==null||b.status!=="confirmed"} onClick={()=>void respond(b.id,"available")} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold disabled:opacity-40">I'm available</button><button disabled={busy!==null||b.status!=="confirmed"} onClick={()=>void respond(b.id,"cancel_requested")} className="rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-40">Request cancellation</button></div><input aria-label={"Reason for "+b.member_name} placeholder="Reason for conflict/cancellation" maxLength={300} value={reason[b.id]||""} onChange={e=>setReason(v=>({...v,[b.id]:e.target.value}))} className="mt-3 w-full rounded-lg border border-white/10 bg-[#161616] px-3 py-2 text-sm"/></div>):<p className="rounded-xl bg-[#242424] p-5 text-sm text-white/55 md:col-span-2">No confirmed client sessions assigned today.</p>}</div></section>
  <section className="mt-7 rounded-[24px] bg-[#171717] p-5"><h2 className="text-xl font-black">Session Requests</h2><p className="mt-1 text-sm text-white/50">Member requests addressed to you, awaiting Admin confirmation.</p>{requests.length===0?<p className="mt-4 text-sm text-white/50">No pending requests for this coach.</p>:requests.map(r=><div key={r.id} className="mt-4 rounded-xl border border-white/10 bg-[#242424] p-4"><p className="font-bold">{r.member_name} · {r.member_code}</p><p className="mt-1 text-xs text-white/55">{ph(r.start_at)} · {r.session_label||r.session_type}</p>{r.coach_response&&<p className="mt-1 text-xs text-orange-300">Your response: {r.coach_response}</p>}<input aria-label={"Conflict reason for "+r.member_name} placeholder="Reason if unavailable" value={reason[r.id]||""} onChange={e=>setReason(v=>({...v,[r.id]:e.target.value}))} className="mt-3 w-full rounded-lg bg-[#161616] p-2 text-sm"/><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy!==null} onClick={()=>void respond(r.id,"available")} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold">Available</button><button disabled={busy!==null} onClick={()=>void respond(r.id,"conflict")} className="rounded-lg border border-white/20 px-3 py-2 text-xs">Report conflict</button></div></div>)}</section>
 </section>
 {clockDialog&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!clockSubmitting)setClockDialog(null)}}>
  <div role="dialog" aria-modal="true" aria-labelledby="coach-clock-dialog-title" className="w-full max-w-sm rounded-[24px] border border-white/15 bg-[#171717] p-6 shadow-2xl">
    <h2 id="coach-clock-dialog-title" className="text-xl font-black">{clockDialog.action==="in"?"Clock In":"Clock Out"}</h2>
    <p className="mt-2 text-sm text-white/55">Verify your location at the gym. Exact coordinates are not stored.</p>
    {clockError&&<p role="alert" className="mt-3 text-sm text-red-300">{clockError}</p>}
    <div className="mt-5 flex gap-2"><button type="button" disabled={clockSubmitting||punchBusy} onClick={()=>void submitClock()} className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold disabled:opacity-40">{clockSubmitting?"Checking GPS…":clockDialog.action==="in"?"Verify GPS & Clock In":"Verify GPS & Clock Out"}</button><button type="button" disabled={clockSubmitting} onClick={()=>{setClockDialog(null);setClockError("")}} className="rounded-xl border border-white/15 px-4 py-3 text-sm">Cancel</button></div>
  </div>
 </div>}
 </div>
}
