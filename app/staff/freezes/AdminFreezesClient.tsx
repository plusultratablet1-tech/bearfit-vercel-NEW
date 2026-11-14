"use client"

import Link from "next/link"
import {useRouter} from "next/navigation"
import {useState} from "react"
import StaffAppShell from "@/components/bearfit/StaffAppShell"
import {createClient} from "@/lib/supabase/client"

const supabase=createClient()
type Request={
  id:string;member_id:string;member_package_id:string;reason:"travel"|"medical";
  start_date:string;end_date:string;status:string;requested_at:string;proof_path:string;
  details:string|null;decision_note:string|null;approved_days:number|null;
  original_expires_at:string|null;revised_expires_at:string|null;
  members:{member_code:string;full_name:string}[];
  member_package_cycles:{starts_at:string|null;expires_at:string|null}[];
}
function phDate(d:string|null){return d?new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",year:"numeric",month:"short",day:"numeric"}).format(new Date(d)):"Unverified"}

export default function AdminFreezesClient({initialRequests,loadError}:{
  initialRequests:Request[];loadError:string|null
}){
  const router=useRouter()
  const [requests,setRequests]=useState(initialRequests)
  const [notes,setNotes]=useState<Record<string,string>>({})
  const [evidence,setEvidence]=useState<Record<string,string>>({})
  const [working,setWorking]=useState<string|null>(null)
  const [error,setError]=useState<string|null>(loadError)
  const [notice,setNotice]=useState<string|null>(null)
  const pending=requests.filter(r=>r.status==="pending")
  const history=requests.filter(r=>r.status!=="pending")

  async function viewEvidence(row:Request){
    setWorking("proof:"+row.id);setError(null)
    const {data,error:e}=await supabase.storage.from("bearfit-freeze-proofs")
      .createSignedUrl(row.proof_path,90)
    setWorking(null)
    if(e||!data?.signedUrl){setError(e?.message??"Unable to open private evidence");return}
    setEvidence(old=>({...old,[row.id]:data.signedUrl}))
  }
  async function decide(row:Request,approve:boolean){
    if(!approve&&(notes[row.id]??"").trim().length<5){setError("Rejection requires a reason of at least five characters.");return}
    if(approve&&!evidence[row.id]){setError("Open and review the supporting document before approval.");return}
    if(!window.confirm(approve?
      "Approve this freeze, block training on its dates, and extend package expiry? This cannot be undone automatically.":
      "Reject this freeze request?"))return
    setWorking("decide:"+row.id);setError(null);setNotice(null)
    const {data,error:e}=await supabase.rpc("admin_review_package_freeze",{
      p_request_id:row.id,p_approve:approve,p_note:notes[row.id]?.trim()||null
    })
    setWorking(null)
    if(e){setError(e.message);return}
    const result=data as {status:string;approved_days?:number;original_expires_at?:string;revised_expires_at?:string}
    setRequests(old=>old.map(r=>r.id!==row.id?r:{...r,status:result.status,
      decision_note:notes[row.id]?.trim()||null,approved_days:result.approved_days??null,
      original_expires_at:result.original_expires_at??null,
      revised_expires_at:result.revised_expires_at??null}))
    setNotice(approve?"Approved: original expiry retained in the audit record; package expiry extended once.":"Request rejected; package dates unchanged.")
    router.refresh()
  }
  function card(row:Request){
    return <article key={row.id} className="rounded-2xl border border-white/10 bg-[#101725] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-orange-300">{row.members?.[0]?.member_code??"Member"}</p>
          <h3 className="mt-1 text-lg font-black">{row.members?.[0]?.full_name??"Member record"}</h3>
          <p className="mt-1 text-sm capitalize text-white/60">{row.reason} · {row.start_date} to {row.end_date}</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase">{row.status}</span>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-white/60 sm:grid-cols-2">
        <p>Original/current expiry: <b className="text-white">{phDate(row.original_expires_at??row.member_package_cycles?.[0]?.expires_at??null)}</b></p>
        <p>Package start: <b className="text-white">{phDate(row.member_package_cycles?.[0]?.starts_at??null)}</b></p>
      </div>
      {row.details&&<p className="mt-3 rounded-xl bg-white/[.04] p-3 text-sm text-white/70">{row.details}</p>}
      <p className="mt-3 text-xs text-white/45">Submitted {phDate(row.requested_at)} · Evidence private; signed links expire in 90 seconds.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={()=>void viewEvidence(row)} disabled={working!==null}
          className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {working==="proof:"+row.id?"Loading evidence…":"Review supporting proof"}
        </button>
        {evidence[row.id]&&<a href={evidence[row.id]} target="_blank" rel="noopener noreferrer"
          className="text-sm font-semibold text-orange-300 underline">Open private document (90s)</a>}
      </div>
      {row.status==="pending"?<>
        <label className="mt-4 block text-sm font-semibold">Admin decision note
          <textarea rows={2} maxLength={1000} value={notes[row.id]??""}
            onChange={e=>setNotes(old=>({...old,[row.id]:e.target.value}))}
            placeholder="Reason for rejection or optional approval notes"
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#1c2537] px-3 py-2"/>
        </label>
        <div className="mt-3 flex flex-wrap gap-3">
          <button disabled={working!==null} onClick={()=>void decide(row,true)}
            className="rounded-xl bg-green-700 px-4 py-2 font-bold disabled:opacity-50">Approve & Extend</button>
          <button disabled={working!==null} onClick={()=>void decide(row,false)}
            className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-2 font-bold text-red-200 disabled:opacity-50">Reject</button>
        </div>
      </>:<>
        {row.status==="approved"&&<p className="mt-3 text-sm font-bold text-green-200">
          +{row.approved_days} approved days · New expiry {phDate(row.revised_expires_at)}</p>}
        {row.decision_note&&<p className="mt-2 text-sm text-white/60">Decision note: {row.decision_note}</p>}
      </>}
    </article>
  }

  return <StaffAppShell activePath="/staff/packages" role="admin">
    <div className="mx-auto max-w-6xl px-4 py-5 pb-28 md:px-6 lg:py-7 lg:pb-7">
      <Link href="/staff/packages" className="text-sm text-orange-300 hover:underline">← Back to Packages</Link>
      <header className="mt-4 border-b border-white/10 pb-5">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">Admin only · Package Control</p>
        <h1 className="mt-1 text-3xl font-black">Freeze & Extension Approvals</h1>
        <p className="mt-2 text-sm text-white/55">No proof, no approval. One approved freeze per package. The system enforces dates, limits, bookings and audit history.</p>
        <Link href="/staff/freezes/verify" className="mt-4 inline-flex rounded-xl border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm font-bold text-orange-200">Verify Missing Original Package Dates</Link>
      </header>
      {error&&<p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-4 text-red-200">{error}</p>}
      {notice&&<p role="status" className="mt-4 rounded-xl bg-green-500/10 p-4 text-green-200">{notice}</p>}
      <h2 className="mt-7 text-xl font-bold">Pending requests ({pending.length})</h2>
      {pending.length===0?<p className="mt-3 rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/45">No requests awaiting approval.</p>:
        <div className="mt-4 grid gap-4 lg:grid-cols-2">{pending.map(card)}</div>}
      <h2 className="mt-8 text-xl font-bold">Decision history ({history.length})</h2>
      {history.length===0?<p className="mt-3 text-sm text-white/45">No past decisions.</p>:
        <div className="mt-4 grid gap-4 lg:grid-cols-2">{history.map(card)}</div>}
    </div>
  </StaffAppShell>
}
