"use client"

import Link from "next/link"
import {useRouter} from "next/navigation"
import {useState,type FormEvent} from "react"
import MemberAppShell from "@/components/bearfit/MemberAppShell"
import {createClient} from "@/lib/supabase/client"

const supabase=createClient()
const timeZone="Asia/Manila"
type Cycle={id:string;status:string;starts_at:string|null;expires_at:string|null;
  sessions_left:number;package_definitions:{name:string;validity_days:number|null}|null}
type Request={id:string;reason:string;start_date:string;end_date:string;
  status:string;requested_at:string;decision_note:string|null;
  approved_days:number|null;revised_expires_at:string|null;member_package_id:string}
function fmt(d:string|null){return d?new Intl.DateTimeFormat("en-PH",{timeZone,year:"numeric",month:"short",day:"numeric"}).format(new Date(d)):"Not verified"}

export default function MemberFreezeClient({userId,memberName,cycles,requests,loadError}:{
  userId:string;memberName:string;cycles:Cycle[];requests:Request[];loadError:string|null
}){
  const router=useRouter()
  const eligible=cycles.filter(c=>c.starts_at&&c.expires_at)
  const [cycle,setCycle]=useState(eligible[0]?.id??"")
  const [reason,setReason]=useState<"travel"|"medical">("travel")
  const [start,setStart]=useState("")
  const [end,setEnd]=useState("")
  const [details,setDetails]=useState("")
  const [file,setFile]=useState<File|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(loadError)
  const [success,setSuccess]=useState<string|null>(null)

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    setError(null);setSuccess(null)
    if(!cycle||!start||!end||!file){setError("Choose a verified package, freeze dates, and proof document.");return}
    const ext=file.type==="application/pdf"?"pdf":file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":null
    if(!ext||file.size>5*1024*1024||file.size===0){
      setError("Upload a PDF, JPG, or PNG document up to 5 MB.");return
    }
    setBusy(true)
    try{
      const proofPath=userId+"/"+crypto.randomUUID()+"."+ext
      const {error:uploadError}=await supabase.storage.from("bearfit-freeze-proofs")
        .upload(proofPath,file,{contentType:file.type,upsert:false})
      if(uploadError)throw new Error(uploadError.message)
      const {error:requestError}=await supabase.rpc("member_request_package_freeze",{
        p_member_package_id:cycle,p_reason:reason,p_start_date:start,p_end_date:end,
        p_proof_path:proofPath,p_details:details.trim()||null
      })
      if(requestError)throw new Error(requestError.message)
      setSuccess("Your evidence-backed request was submitted. Only Admin can approve it. No package dates have changed.")
      setFile(null);setStart("");setEnd("");setDetails("")
      const input=document.getElementById("freeze-proof") as HTMLInputElement|null
      if(input)input.value=""
      router.refresh()
    }catch(e){setError(e instanceof Error?e.message:"Unable to submit request.")}
    finally{setBusy(false)}
  }

  return <MemberAppShell activePath="/member/schedule">
    <div className="mx-auto max-w-5xl p-4 pb-28 md:p-8 lg:pb-8">
      <Link href="/member/schedule" className="text-sm text-orange-300 hover:underline">← Back to Schedule</Link>
      <header className="mt-4 border-b border-white/10 pb-5">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-orange-300">Membership Services</p>
        <h1 className="mt-1 text-3xl font-black">Package Freeze Request</h1>
        <p className="mt-2 text-sm text-white/60">{memberName} · Evidence required · Admin approval only</p>
      </header>
      <div className="mt-5 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm text-orange-100">
        <b>Strict BearFit policy.</b> One approved freeze per package. Travel: 3–7 days with ticket, at least
        7 days before departure. Medical: 3–14 days with certificate, reported within 72 hours.
        Maximum is also capped at 25% of original validity. No reason or document means no approval.
        Freeze dates must fall within your existing package. An approved freeze adds calendar days,
        never training sessions. A freeze blocks training for the approved dates.
      </div>
      {error&&<p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {success&&<p role="status" className="mt-4 rounded-xl border border-green-400/30 bg-green-400/10 p-4 text-sm text-green-200">{success}</p>}
      <section className="mt-6 rounded-3xl border border-white/10 bg-[#101725] p-5">
        <h2 className="text-xl font-bold">Request a freeze</h2>
        <p className="mt-1 text-sm text-white/50">Upload the actual ticket or medical certificate. A diagnosis is not required.</p>
        {eligible.length===0?
          <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            Your package's original start and expiration dates have not been verified.
            Please contact BearFit Admin to confirm them before submitting a freeze request.
          </p>:
          <form onSubmit={submit} className="mt-5 grid gap-4">
            <label className="text-sm font-semibold">Package
              <select required value={cycle} onChange={e=>setCycle(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#1c2537] px-4 py-3">
                {eligible.map(c=><option key={c.id} value={c.id}>{c.package_definitions?.name??"Training package"} · Expires {fmt(c.expires_at)} · {c.sessions_left} sessions left</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Reason
              <select value={reason} onChange={e=>setReason(e.target.value as "travel"|"medical")}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#1c2537] px-4 py-3">
                <option value="travel">Travel — ticket required</option>
                <option value="medical">Medical — certificate required</option>
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">First day of freeze
                <input required type="date" value={start} onChange={e=>setStart(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#1c2537] px-4 py-3"/>
              </label>
              <label className="text-sm font-semibold">Last day of freeze
                <input required type="date" value={end} onChange={e=>setEnd(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#1c2537] px-4 py-3"/>
              </label>
            </div>
            <label className="text-sm font-semibold">Proof document (PDF, JPG, PNG · 5 MB max)
              <input id="freeze-proof" required type="file" accept="application/pdf,image/jpeg,image/png"
                onChange={e=>setFile(e.target.files?.[0]??null)}
                className="mt-2 block w-full rounded-xl border border-white/10 bg-[#1c2537] px-4 py-3 text-sm"/>
            </label>
            <label className="text-sm font-semibold">Additional explanation (optional)
              <textarea maxLength={1000} rows={3} value={details} onChange={e=>setDetails(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#1c2537] px-4 py-3"/>
            </label>
            <p className="text-xs text-white/45">Your document is private and accessible only to you and authorized BearFit Admin reviewers. Do not include unnecessary medical details.</p>
            <button type="submit" disabled={busy}
              className="rounded-xl bg-[#ff7a1a] px-5 py-3 font-bold disabled:opacity-50">{busy?"Submitting…":"Submit for Admin Review"}</button>
          </form>}
      </section>
      <section className="mt-6 rounded-3xl border border-white/10 bg-[#101725] p-5">
        <h2 className="text-xl font-bold">My request history</h2>
        {requests.length===0?<p className="mt-4 text-sm text-white/50">No freeze requests yet.</p>:
          <div className="mt-4 space-y-3">{requests.map(r=>
            <article key={r.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="capitalize">{r.reason} · {r.start_date} to {r.end_date}</b>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase">{r.status}</span>
              </div>
              <p className="mt-2 text-sm text-white/50">Submitted {fmt(r.requested_at)}</p>
              {r.status==="approved"&&<p className="mt-2 text-sm text-green-200">Approved {r.approved_days} days · New expiration {fmt(r.revised_expires_at)}</p>}
              {r.decision_note&&<p className="mt-2 text-sm text-white/70">Admin note: {r.decision_note}</p>}
            </article>)}</div>}
      </section>
    </div>
  </MemberAppShell>
}
