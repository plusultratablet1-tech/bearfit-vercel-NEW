"use client"
import Link from "next/link"
import {useEffect,useState} from "react"
import {useRouter} from "next/navigation"
import MemberAppShell from "@/components/bearfit/MemberAppShell"
import {createClient} from "@/lib/supabase/client"

const db=createClient()
type Case={
 id:string;booking_id:string;report_kind:string;report_notes:string;reported_at:string;
 status:string;decision_note:string|null;reviewed_at:string|null;
 member_first_seen_at:string|null;member_acknowledged_at:string|null;
 dispute_at:string|null;dispute_reason:string|null;dispute_resolution_note:string|null;
 bookings:{start_at:string|null;session_label:string|null;session_type:string}[];
}
function fmt(d:string|null){return d?new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(new Date(d)):"—"}
export default function MemberNoShowClient({initialCases,loadError}:{initialCases:Case[];loadError:string|null}){
 const router=useRouter()
 const [cases,setCases]=useState(initialCases)
 const [error,setError]=useState<string|null>(loadError)
 const [success,setSuccess]=useState<string|null>(null)
 const [reason,setReason]=useState<Record<string,string>>({})
 const [busy,setBusy]=useState<string|null>(null)
 useEffect(()=>{setCases(initialCases)},[initialCases])
 useEffect(()=>{if(initialCases.some(c=>["charged","disputed","reversed","upheld"].includes(c.status)&&!c.member_first_seen_at)){
   void db.rpc("member_open_no_show_notices").then(({error:e})=>{if(!e)router.refresh()})
 }},[initialCases,router])
 async function respond(c:Case,action:"acknowledge"|"dispute"){
  if(action==="dispute"&&(reason[c.id]??"").trim().length<10){setError("Describe why the charge is incorrect (at least 10 characters).");return}
  setBusy(c.id);setError(null);setSuccess(null)
  const {error:e}=await db.rpc("member_respond_no_show_case",{
   p_case_id:c.id,p_action:action,p_reason:action==="dispute"?reason[c.id].trim():null
  })
  setBusy(null)
  if(e){setError(e.message);return}
  setSuccess(action==="dispute"?"Dispute submitted. Admin must review before it can be closed.":"Notice acknowledged. You can still dispute the charged session within the permitted window.")
  router.refresh()
 }
 return <MemberAppShell activePath="/member/schedule">
  <div className="mx-auto max-w-5xl px-4 py-6 pb-28 md:p-8 lg:pb-8">
   <Link href="/member/schedule" className="text-sm font-semibold text-orange-300">← Back to Schedule</Link>
   <header className="mt-5 border-b border-white/10 pb-5">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-orange-300">Membership transparency</p>
    <h1 className="mt-2 text-3xl font-black">Session Charges & Notices</h1>
    <p className="mt-2 text-sm text-white/60">Every no-show deduction requires Admin approval and documented booking-policy acceptance. You can acknowledge receiving a notice without agreeing with it.</p>
   </header>
   <div className="mt-5 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm">
    <b>Cancellation deadline:</b> 10:00 PM Philippine time the night before a confirmed session. Free cancellation before the deadline; later requests go to Admin review. In-app notices are available here; SMS, email and push delivery are not yet enabled.
   </div>
   {error&&<p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">{error}</p>}
   {success&&<p role="status" className="mt-4 rounded-xl border border-green-400/20 bg-green-400/10 p-4 text-green-200">{success}</p>}
   <h2 className="mt-7 text-xl font-bold">My reported and reviewed sessions</h2>
   <div className="mt-4 space-y-4">
    {!cases.length&&<p className="rounded-2xl border border-white/10 p-6 text-sm text-white/55">There are no no-show or late-cancellation cases on your account.</p>}
    {cases.map(c=><article key={c.id} className="rounded-2xl border border-white/10 bg-[#101725] p-5">
     <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs uppercase tracking-widest text-orange-300">{c.report_kind.replaceAll("_"," ")}</p>
       <h3 className="mt-1 text-lg font-bold">{c.bookings?.[0]?.session_label??c.bookings?.[0]?.session_type??"Training session"}</h3>
       <p className="mt-1 text-sm text-white/60">{fmt(c.bookings?.[0]?.start_at??null)}</p></div>
      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase">{c.status.replaceAll("_"," ")}</span>
     </div>
     <p className="mt-4 text-sm text-white/70">Reported: {c.report_notes}</p>
     {c.decision_note&&<p className="mt-3 text-sm text-white/65">Admin decision: {c.decision_note}</p>}
     {c.dispute_resolution_note&&<p className="mt-3 text-sm text-white/65">Dispute resolution: {c.dispute_resolution_note}</p>}
     {c.status==="charged"&&<div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4">
      <p className="font-semibold text-red-200">1 session deducted — reviewed by BearFit Admin</p>
      <p className="mt-1 text-xs text-white/60">You have up to 48 hours after first viewing this notice to file a dispute. Acknowledgment means you saw this notice, not that you agree with the decision.</p>
      <div className="mt-3 flex flex-wrap gap-2">
       {!c.member_acknowledged_at&&<button type="button" disabled={busy===c.id} onClick={()=>void respond(c,"acknowledge")}
         className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold disabled:opacity-50">Acknowledge receipt</button>}
       {!c.dispute_at&&<div className="w-full">
        <label className="block text-xs font-semibold">Dispute reason
         <textarea rows={2} maxLength={1200} value={reason[c.id]??""}
          onChange={e=>setReason(old=>({...old,[c.id]:e.target.value}))}
          placeholder="Explain why this deduction is incorrect"
          className="mt-2 w-full rounded-lg border border-white/10 bg-[#1c2537] px-3 py-2 text-sm"/></label>
        <button type="button" disabled={busy===c.id} onClick={()=>void respond(c,"dispute")}
         className="mt-2 rounded-lg border border-orange-400/30 px-4 py-2 text-sm font-bold text-orange-200 disabled:opacity-50">Dispute deduction</button>
       </div>}
      </div>
     </div>}
     {c.status==="disputed"&&<p className="mt-3 text-sm text-orange-200">Dispute under Admin review — no automatic denial.</p>}
     {c.status==="reversed"&&<p className="mt-3 text-sm text-green-300">The session credit was restored after review. The original charge remains in the audit history.</p>}
     {c.status==="upheld"&&<p className="mt-3 text-sm text-orange-200">Your dispute was reviewed and the original deduction was upheld.</p>}
     {(c.status==="waived"||c.status==="dismissed")&&<p className="mt-3 text-sm text-green-300">No session deducted for this case.</p>}
    </article>)}
   </div>
  </div>
 </MemberAppShell>
}
