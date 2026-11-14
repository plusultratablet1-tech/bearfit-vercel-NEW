"use client"
import Link from "next/link"
import {useEffect,useState} from "react"
import {useRouter} from "next/navigation"
import StaffAppShell from "@/components/bearfit/StaffAppShell"
import {createClient} from "@/lib/supabase/client"
const db=createClient()
type Case={
 id:string;booking_id:string;report_kind:string;report_notes:string;reported_at:string;
 reported_by:string;status:string;decision_note:string|null;reviewed_at:string|null;
 dispute_reason:string|null;dispute_at:string|null;member_acknowledged_at:string|null;
 dispute_resolution_note:string|null;
 members:{member_code:string;full_name:string;branch:string}[];
 bookings:{start_at:string|null;end_at:string|null;session_label:string|null;session_type:string;status:string;no_show_charged:boolean}[];
 booking_no_show_restorations:{id:string;sessions_left_after:number}[];
}
function fmt(d:string|null){return d?new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(new Date(d)):"—"}
export default function AdminNoShowClient({initialCases,loadError}:{initialCases:Case[];loadError:string|null}){
 const router=useRouter()
 const [cases,setCases]=useState(initialCases)
 const [error,setError]=useState<string|null>(loadError)
 const [success,setSuccess]=useState<string|null>(null)
 const [notes,setNotes]=useState<Record<string,string>>({})
 const [working,setWorking]=useState<string|null>(null)
 const [bookingId,setBookingId]=useState("")
 const [reportNote,setReportNote]=useState("")
 useEffect(()=>{setCases(initialCases)},[initialCases])
 async function report(){
  if(!bookingId||reportNote.trim().length<8){setError("Provide a booking ID and evidence note of at least 8 characters.");return}
  setWorking("report");setError(null);setSuccess(null)
  const {error:e}=await db.rpc("staff_report_no_show",{p_booking_id:bookingId.trim(),p_notes:reportNote.trim()})
  setWorking(null)
  if(e){setError(e.message);return}
  setSuccess("Report filed for Admin review. No sessions have been deducted.")
  setBookingId("");setReportNote("");router.refresh()
 }
 async function decide(c:Case,outcome:"charge"|"waive"|"dismiss"){
  const note=(notes[c.id]??"").trim()
  if(note.length<10){setError("Record at least 10 characters explaining evidence and decision.");return}
  if(!window.confirm(outcome==="charge"?"Charge one session after verifying attendance, policy acceptance and booking evidence?":outcome==="waive"?"Waive penalty and classify the absence without a deduction?":"Dismiss the no-show claim with no deduction?"))return
  setError(null);setSuccess(null);setWorking(c.id)
  const {error:e}=await db.rpc("admin_decide_no_show_case",{p_case_id:c.id,p_outcome:outcome,p_note:note})
  setWorking(null)
  if(e){setError(e.message);return}
  setSuccess(outcome==="charge"?"Verified: one session deducted, with an in-app member notice.":outcome==="waive"?"Penalty waived; member session balance unchanged.":"Claim dismissed; no member deduction.")
  router.refresh()
 }
 async function resolve(c:Case,restore:boolean){
  const note=(notes[c.id]??"").trim()
  if(note.length<10){setError("Describe the dispute investigation in at least 10 characters.");return}
  if(!window.confirm(restore?"Restore the disputed session? This writes an auditable credit and leaves the original charge record intact.":"Uphold this deduction after reviewing the member's dispute and all evidence?"))return
  setError(null);setSuccess(null);setWorking(c.id)
  const {error:e}=await db.rpc("admin_resolve_no_show_dispute",{
   p_case_id:c.id,p_restore:restore,p_reason:note
  })
  setWorking(null)
  if(e){setError(e.message);return}
  setSuccess(restore?"1 member session restored with a permanent correction record.":"Deduction upheld with recorded Admin reasoning.")
  router.refresh()
 }
 const queue=cases.filter(c=>c.status==="pending_review"||c.status==="disputed")
 const history=cases.filter(c=>c.status!=="pending_review"&&c.status!=="disputed")
 function render(c:Case){
  const b=c.bookings?.[0]
  return <article key={c.id} className="rounded-2xl border border-white/10 bg-[#101725] p-5">
   <div className="flex flex-wrap items-start justify-between gap-2">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-orange-300">{c.members?.[0]?.member_code??"Member"} · {c.members?.[0]?.branch??""}</p>
     <h3 className="mt-1 text-lg font-black">{c.members?.[0]?.full_name??"Client"}</h3>
     <p className="mt-1 text-sm text-white/60">{b?.session_label??b?.session_type??"Session"} · {fmt(b?.start_at??null)}</p></div>
    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase">{c.status.replaceAll("_"," ")}</span>
   </div>
   <p className="mt-3 text-sm text-white/70">Report ({c.report_kind.replaceAll("_"," ")}): {c.report_notes}</p>
   <p className="mt-2 text-xs text-white/45">Reported {fmt(c.reported_at)} · Booking {c.booking_id}</p>
   {c.decision_note&&<p className="mt-2 text-sm text-white/65">Prior Admin decision: {c.decision_note}</p>}
   {c.dispute_reason&&<p className="mt-3 rounded-xl bg-orange-500/10 p-3 text-sm text-orange-100">Client dispute: {c.dispute_reason}</p>}
   {c.dispute_resolution_note&&<p className="mt-2 text-sm text-white/60">Resolution: {c.dispute_resolution_note}</p>}
   {(c.status==="pending_review"||c.status==="disputed")&&<>
    <p className="mt-3 text-xs text-white/50">Verify attendance/check-in, cancellation timestamps, client terms acceptance, coach report and the package. The database blocks charges without recorded client consent.</p>
    <label className="mt-3 block text-sm font-semibold">Admin evidence / decision explanation
     <textarea rows={3} maxLength={1200} placeholder="Document check-in and evidence checked; not just coach's report" value={notes[c.id]??""}
      onChange={e=>setNotes(x=>({...x,[c.id]:e.target.value}))}
      className="mt-2 w-full rounded-xl border border-white/10 bg-[#1c2537] p-3 text-sm"/>
    </label>
    {c.status==="pending_review"?
     <div className="mt-3 flex flex-wrap gap-2">
      <button disabled={working!==null} onClick={()=>void decide(c,"charge")} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold disabled:opacity-50">Verify & Charge 1</button>
      <button disabled={working!==null} onClick={()=>void decide(c,"waive")} className="rounded-xl border border-green-400/40 px-4 py-2 text-sm font-bold text-green-200 disabled:opacity-50">Waive charge</button>
      <button disabled={working!==null} onClick={()=>void decide(c,"dismiss")} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold disabled:opacity-50">Dismiss claim</button>
     </div>:
     <div className="mt-3 flex flex-wrap gap-2">
      <button disabled={working!==null} onClick={()=>void resolve(c,true)} className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold disabled:opacity-50">Restore 1 Session</button>
      <button disabled={working!==null} onClick={()=>void resolve(c,false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold disabled:opacity-50">Uphold Deduction</button>
     </div>}
   </>}
   {c.member_acknowledged_at&&<p className="mt-2 text-xs text-green-200">Client acknowledged receiving notice on {fmt(c.member_acknowledged_at)} (not necessarily agreement).</p>}
   {c.status==="reversed"&&<p className="mt-2 text-sm text-green-200">Restoration audited. Original session log preserved.</p>}
  </article>
 }
 return <StaffAppShell activePath="/staff/schedule" role="admin">
  <div className="mx-auto max-w-6xl p-4 pb-28 md:p-8 lg:pb-8">
   <Link href="/staff/schedule" className="text-sm text-orange-300">← Back to Schedule</Link>
   <header className="mt-5 border-b border-white/10 pb-5">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">Admin only · Member protection</p>
    <h1 className="mt-1 text-3xl font-black">No-Show Review & Disputes</h1>
    <p className="mt-2 text-sm text-white/60">Coach reports do not deduct sessions. Only verified Admin decisions can charge. Every charge is visible to the member and can be disputed.</p>
   </header>
   {error&&<p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-4 text-red-200">{error}</p>}
   {success&&<p role="status" className="mt-4 rounded-xl bg-green-500/10 p-4 text-green-200">{success}</p>}
   <section className="mt-6 rounded-2xl border border-white/10 bg-[#101725] p-5">
    <h2 className="text-lg font-bold">File a staff-reported absence</h2>
    <p className="mt-1 text-xs text-white/50">After the scheduled end. For bookings without a linked coach report; use a genuine booking UUID.</p>
    <div className="mt-3 grid gap-3">
     <input placeholder="Booking ID" aria-label="Booking ID" value={bookingId} onChange={e=>setBookingId(e.target.value)}
       className="w-full rounded-xl border border-white/10 bg-[#1c2537] p-3 text-sm"/>
     <textarea placeholder="Evidence: when the session was scheduled, what attendance checks were performed" maxLength={1200}
      value={reportNote} onChange={e=>setReportNote(e.target.value)} rows={2}
      className="w-full rounded-xl border border-white/10 bg-[#1c2537] p-3 text-sm"/>
     <button disabled={working!==null} onClick={()=>void report()}
      className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold disabled:opacity-50">Submit report without deduction</button>
    </div>
   </section>
   <h2 className="mt-7 text-xl font-black">Pending reviews & disputes ({queue.length})</h2>
   <div className="mt-4 grid gap-4 lg:grid-cols-2">
    {!queue.length&&<p className="text-sm text-white/50">No cases awaiting Admin review.</p>}
    {queue.map(render)}
   </div>
   <h2 className="mt-8 text-xl font-black">Decision history ({history.length})</h2>
   <div className="mt-4 grid gap-4 lg:grid-cols-2">{history.map(render)}</div>
  </div>
 </StaffAppShell>
}
