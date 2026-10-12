"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client"
import { CalendarDays, CheckCircle2, Clock3, ClipboardCheck, LogOut, QrCode, ShieldCheck, RefreshCw, LockKeyhole } from "lucide-react"

const supabase = createClient()
type Coach = { id: string; display_name: string; branch: string; username: string | null; is_active: boolean }
type Shift = { id: string; starts_at: string; ends_at: string; branch: string; response: "pending" | "confirmed" | "unavailable"; response_at: string | null; reason: string | null; clock_in_at: string | null; clock_out_at: string | null }
type Booking = { id: string; start_at: string; end_at: string; branch: string; session_label: string | null; session_type: string; status: string; member_name: string; member_code: string }
type Conduction = { id: string; session_date: string; status: "pending" | "approved" | "rejected"; member_name: string }
type Dashboard = { coach_id: string; name: string; username: string; branch: string; shifts: Shift[]; bookings: Booking[]; conductions: Conduction[] }
type Preview = { member_name: string; member_code: string; booking_id: string; start_at: string; session_label: string | null; note: string }
function format(v: string) { return new Intl.DateTimeFormat("en-PH", { timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short" }).format(new Date(v)) }
function dateOnly(v: string) { return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Manila", year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date(v)) }
function countdownDeadline(shift: Shift) {
  const shiftDate = dateOnly(shift.starts_at)
  const deadline = new Date(Date.parse(shiftDate+"T12:00:00Z") - 24*60*60*1000)
  const d = deadline.toISOString().slice(0,10)
  return new Date(d+"T12:00:00Z").getTime() + 0 // display separate Manila date at 8 PM
}
function deadlineLabel(shift: Shift) {
  const day = new Date(Date.parse(dateOnly(shift.starts_at)+"T12:00:00Z") - 86400000).toISOString().slice(0,10)
  return day + " at 8:00 PM (PH)"
}
function normalizeCode(raw:string) {
  const direct=raw.trim().match(/\bM\d{3,}\b/i)
  if(direct) return direct[0].toUpperCase()
  try { const u=new URL(raw);return u.searchParams.get("member")?.match(/\bM\d{3,}\b/i)?.[0]?.toUpperCase()??"" } catch { return "" }
}
export default function CoachHomeClient({coach}:{coach:Coach|null}) {
  const [data,setData]=useState<Dashboard|null>(null)
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState<string|null>(null)
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")
  const [reason,setReason]=useState<Record<string,string>>({})
  const [branchCode,setBranchCode]=useState("")
  const [memberCode,setMemberCode]=useState("")
  const [preview,setPreview]=useState<Preview|null>(null)
  const [password,setPassword]=useState("")
  const [confirm,setConfirm]=useState("")
  const [scanner,setScanner]=useState(false)
  const videoRef=useRef<HTMLVideoElement|null>(null)
  const streamRef=useRef<MediaStream|null>(null)
  const cameraRef=useRef<number|undefined>(undefined)
  const [scannerError,setScannerError]=useState("")
  const refresh=useCallback(async()=>{
    if(!coach?.is_active) {setLoading(false);return}
    setLoading(true)
    const {data:result,error:e}=await supabase.rpc("coach_operational_dashboard")
    if(e) setError(e.message)
    else {setData(result as Dashboard);setError("")}
    setLoading(false)
  },[coach?.is_active])
  useEffect(()=>{void refresh()},[refresh])
  useEffect(()=>{
    if(!scanner)return
    let cancelled=false
    async function run() {
      const Detector=(window as unknown as {BarcodeDetector?:new(opts:{formats:string[]})=>{detect:(v:HTMLVideoElement)=>Promise<Array<{rawValue?:string}>>}}).BarcodeDetector
      if(!Detector){setScannerError("Camera scanning is not supported here. Enter the member code manually.");return}
      try {
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false})
        if(cancelled){stream.getTracks().forEach(t=>t.stop());return}
        streamRef.current=stream
        if(!videoRef.current)return
        videoRef.current.srcObject=stream
        await videoRef.current.play()
        const d=new Detector({formats:["qr_code"]})
        const tick=async()=>{
          if(cancelled||!videoRef.current)return
          try{
            const codes=await d.detect(videoRef.current)
            const member=normalizeCode(codes[0]?.rawValue??"")
            if(member){setMemberCode(member);setScanner(false);return}
          }catch{}
          if(!cancelled)cameraRef.current=requestAnimationFrame(()=>void tick())
        }
        void tick()
      }catch(e){setScannerError(e instanceof Error?e.message:"Unable to start camera")}
    }
    void run()
    return()=>{cancelled=true;if(cameraRef.current!==undefined)cancelAnimationFrame(cameraRef.current);streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null}
  },[scanner])
  async function respond(id:string,response:"confirmed"|"unavailable") {
    if(response==="unavailable" && (reason[id]||"").trim().length<5){setError("Please enter a reason of at least five characters.");return}
    setBusy(id+":response");setError("");setNotice("")
    const {data:result,error:e}=await supabase.rpc("coach_respond_to_shift",{p_work_shift_id:id,p_response:response,p_reason:response==="unavailable"?reason[id]:null})
    if(e)setError(e.message)
    else {setNotice(result.late?"Response recorded after the 8 PM deadline. Admin will see it as late.":"Response saved and visible to Admin.");await refresh()}
    setBusy(null)
  }
  async function punch(shiftId:string,action:"in"|"out") {
    if(!/^[a-f0-9]{12}$/i.test(branchCode.trim())){setError("Ask reception for the current 12-character branch attendance code.");return}
    setBusy(shiftId+":punch");setError("");setNotice("")
    const {error:e}=await supabase.rpc("coach_verified_time_punch",{p_work_shift_id:shiftId,p_code:branchCode.trim().toUpperCase(),p_action:action})
    if(e)setError(e.message)
    else {setNotice(action==="in"?"Verified clock-in recorded. Admin can see your arrival.":"Verified clock-out recorded. Admin can see your departure.");setBranchCode("");await refresh()}
    setBusy(null)
  }
  async function memberLookup(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");setNotice("");setPreview(null)
    const member=normalizeCode(memberCode)
    if(!member){setError("Enter or scan a valid member QR code (e.g., M0001).");return}
    setBusy("preview")
    const {data:result,error:e}=await supabase.rpc("coach_member_qr_preview",{p_member_code:member})
    if(e)setError(e.message)
    else setPreview(result as Preview)
    setBusy(null)
  }
  async function changePassword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");setNotice("")
    if(password.length<12||password.length>128)return setError("Use at least 12 characters.")
    if(password!==confirm)return setError("Passwords do not match.")
    setBusy("password")
    const {error:e}=await supabase.auth.updateUser({password})
    setBusy(null);setPassword("");setConfirm("")
    if(e)setError(e.message);else setNotice("Password updated.")
  }
  async function signOut(){await supabase.auth.signOut();window.location.href="/login"}
  const shifts=data?.shifts||[]
  const now=Date.now()
  const todays=shifts.filter(s=>dateOnly(s.starts_at)===dateOnly(new Date().toISOString()))
  const upcoming=shifts.filter(s=>Date.parse(s.ends_at)>=now-86400000)
  const assigned=data?.bookings||[]
  const conductions=data?.conductions||[]
  const card="rounded-[24px] border border-white/10 bg-[#141414] p-5"
  const btn="rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
  return <main className="min-h-screen bg-[#020b1c] px-4 py-8 text-white md:py-12">
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">BEARFIT / COACH PORTAL</p>
          <h1 className="mt-2 text-2xl font-black">Welcome{coach?", "+coach.display_name:""}</h1>
          <p className="mt-1 text-sm text-white/55">{coach?.branch||"Account setup needed"} · {coach?.username||"Account not linked"}</p></div>
        <div className="flex gap-2"><button onClick={()=>void refresh()} className="rounded-xl border border-white/15 p-2.5" aria-label="Refresh"><RefreshCw size={17}/></button>
        <button onClick={()=>void signOut()} className="flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-sm"><LogOut size={16}/> Sign out</button></div>
      </header>
      {error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {notice&&<p role="status" className="rounded-xl border border-green-400/20 bg-green-400/10 p-4 text-sm text-green-200">{notice}</p>}
      {(!coach||!coach.is_active)&&<p className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4">Your coach account is not linked or is inactive. Ask Admin for help.</p>}
      {loading?<p className={card}>Loading your schedule…</p>:data&&<>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric name="Upcoming shifts" value={upcoming.length}/>
          <Metric name="Today's assigned shifts" value={todays.length}/>
          <Metric name="Approved conductions (31d)" value={conductions.filter(c=>c.status==="approved").length}/>
          <Metric name="Pending review" value={conductions.filter(c=>c.status==="pending").length}/>
        </div>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays size={19} className="text-[#ff7a1a]"/> Shift confirmation</h2>
          <p className="mt-2 text-sm text-white/50">Confirm by 8:00 PM Philippine time on the day before each scheduled shift. No reply is flagged as unconfirmed, not automatically absent.</p>
          <div className="mt-4 space-y-3">
            {upcoming.length===0&&<p className="text-sm text-white/55">No work shifts assigned yet. Admin must plan your shift before you can confirm or clock in.</p>}
            {upcoming.map(s=><div key={s.id} className="rounded-xl border border-white/10 bg-[#101725] p-4">
              <div className="flex flex-wrap justify-between gap-2"><div className="font-semibold">{format(s.starts_at)} – {new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",hour:"numeric",minute:"2-digit"}).format(new Date(s.ends_at))}</div>
                <span className={s.response==="confirmed"?"text-emerald-300":s.response==="unavailable"?"text-red-300":"text-amber-300"}>{s.response==="confirmed"?"Confirmed":s.response==="unavailable"?"Can't report":"Awaiting response"}</span></div>
              <p className="mt-1 text-xs text-white/50">{s.branch} · Deadline: {deadlineLabel(s)}</p>
              {s.reason&&<p className="mt-1 text-sm text-red-200">Reason: {s.reason}</p>}
              {Date.parse(s.starts_at)>now&&<div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy!==null} className={btn} onClick={()=>void respond(s.id,"confirmed")}>Yes, I'll report</button>
                <button disabled={busy!==null} className="rounded-xl border border-white/20 px-4 py-2 text-sm disabled:opacity-40" onClick={()=>void respond(s.id,"unavailable")}>Can't make it</button>
                <input aria-label="Reason if unable to report" placeholder="Reason if unavailable (required)" maxLength={500} value={reason[s.id]||""}
                  onChange={e=>setReason(x=>({...x,[s.id]:e.target.value}))}
                  className="w-full rounded-lg border border-white/10 bg-[#1b2434] px-3 py-2 text-sm md:w-auto md:flex-1"/>
              </div>}
            </div>)}
          </div>
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Clock3 size={19} className="text-[#ff7a1a]"/> Verified time-in / time-out</h2>
          <p className="mt-2 text-sm text-white/50">At the branch, ask reception for the current attendance code. Each code expires after 2 minutes. A code verifies possession, not physical location with certainty.</p>
          <label className="mt-4 block text-xs font-medium text-white/70">Current branch attendance code
            <input value={branchCode} onChange={e=>setBranchCode(e.target.value.toUpperCase().slice(0,12))}
              placeholder="12-character code" maxLength={12} autoCapitalize="characters"
              className="mt-2 block w-full rounded-xl border border-white/15 bg-[#202020] px-4 py-3 font-mono tracking-widest md:max-w-sm"/>
          </label>
          <div className="mt-4 space-y-3">
            {upcoming.length===0&&<p className="text-sm text-white/55">No assigned shift available for clock-in.</p>}
            {upcoming.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
              <div><p className="font-medium">{format(s.starts_at)}</p>
                <p className="text-xs text-white/50">Time in: {s.clock_in_at?format(s.clock_in_at):"Not yet"} · Time out: {s.clock_out_at?format(s.clock_out_at):"Not yet"}</p></div>
              {s.clock_in_at&&!s.clock_out_at?<button disabled={busy!==null} className={btn} onClick={()=>void punch(s.id,"out")}>Clock out</button>:
                !s.clock_in_at?<button disabled={busy!==null} className={btn} onClick={()=>void punch(s.id,"in")}>Clock in</button>:<span className="text-sm text-emerald-300">Shift completed</span>}
            </div>)}
          </div>
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays size={19} className="text-[#ff7a1a]"/> My member sessions</h2>
          <p className="mt-2 text-sm text-white/50">Only bookings linked to your coach login appear here. Ask Admin to assign the booking to you if anything is missing.</p>
          {assigned.length===0?<p className="mt-4 text-sm text-white/55">No linked member bookings in this period.</p>:
          <div className="mt-4 space-y-2">{assigned.map(b=><div key={b.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-white/10 p-3 text-sm"><div><strong>{format(b.start_at)}</strong> · {b.member_name}<p className="text-xs text-white/50">{b.member_code} · {b.session_label||b.session_type}</p></div><span className={b.status==="completed"?"text-emerald-300":"text-white/60"}>{b.status}</span></div>)}</div>}
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-lg font-bold"><QrCode size={19} className="text-[#ff7a1a]"/> Member QR scanner</h2>
          <p className="mt-2 text-sm text-amber-200">Preview only for now. Coach scanning will not deduct a member session or credit payroll until the supervised QR check-in integration passes transaction testing.</p>
          <form onSubmit={e=>void memberLookup(e)} className="mt-4 flex flex-wrap gap-2">
            <input value={memberCode} onChange={e=>setMemberCode(e.target.value)} placeholder="Scan or enter M0001" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#202020] px-4 py-3 text-sm"/>
            <button disabled={busy!==null} className={btn}>Verify assignment</button>
            <button type="button" onClick={()=>{setScanner(v=>!v);setScannerError("")}} className="rounded-xl border border-white/20 px-3 py-2 text-sm">{scanner?"Stop camera":"Scan QR"}</button>
          </form>
          {scanner&&<div className="mt-3"><video ref={videoRef} muted playsInline className="h-56 w-full rounded-xl bg-black object-cover"/>{scannerError&&<p className="text-sm text-amber-300">{scannerError}</p>}</div>}
          {preview&&<div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4">
            <p className="font-bold">{preview.member_name} · {preview.member_code}</p>
            <p className="mt-1 text-sm text-white/60">{format(preview.start_at)} · {preview.session_label||"Booked training"}</p>
            <p className="mt-2 text-xs text-amber-200">{preview.note}</p>
          </div>}
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-lg font-bold"><ClipboardCheck size={19} className="text-[#ff7a1a]"/> My conductions</h2>
          <p className="mt-2 text-sm text-white/50">Verified member-level conduction records appear here once the integration is enabled; an empty list does not mean you were absent.</p>
          {conductions.length===0?<p className="mt-4 text-sm text-white/55">No verified conduction records yet.</p>:
          <div className="mt-4 space-y-2">{conductions.map(c=><div key={c.id} className="flex justify-between gap-3 border-b border-white/10 py-2 text-sm"><span>{c.session_date} · {c.member_name}</span><span>{c.status}</span></div>)}</div>}
        </section>
      </>}
      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-bold"><LockKeyhole size={18} className="text-[#ff7a1a]"/> Change password</h2>
        <form onSubmit={e=>void changePassword(e)} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs text-white/60">New password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-[#202020] px-3 py-2.5 text-sm"/></label>
          <label className="text-xs text-white/60">Confirm password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-[#202020] px-3 py-2.5 text-sm"/></label>
          <button className={btn+" self-end"} disabled={busy!==null}>Save password</button>
        </form>
      </section>
      <p className="flex items-center gap-2 text-xs text-white/45"><ShieldCheck size={14}/> Your attendance and shift responses are visible to Admin. Payroll calculation and member deductions are controlled separately.</p>
    </div>
  </main>
}
function Metric({name,value}:{name:string;value:number}) {return <div className="rounded-xl border border-white/10 bg-[#141414] p-4"><p className="text-xs text-white/55">{name}</p><p className="mt-2 text-2xl font-black">{value}</p></div>}
