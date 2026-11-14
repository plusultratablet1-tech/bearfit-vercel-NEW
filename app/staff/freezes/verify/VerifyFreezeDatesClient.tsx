"use client"

import Link from "next/link"
import {useRouter} from "next/navigation"
import {useState} from "react"
import StaffAppShell from "@/components/bearfit/StaffAppShell"
import {createClient} from "@/lib/supabase/client"

const supabase=createClient()
type Cycle={
  id:string;status:string;starts_at:string|null;expires_at:string|null;
  package_definitions:{name:string;validity_days:number|null}[];
  members:{member_code:string;full_name:string;branch:string}[];
}
function ph(d:string|null){
  return d?new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(d)):""
}
export default function VerifyFreezeDatesClient({cycles,loadError}:{cycles:Cycle[];loadError:string|null}){
  const router=useRouter()
  const [items,setItems]=useState(cycles)
  const [values,setValues]=useState<Record<string,{start:string;expiry:string;reference:string}>>({})
  const [working,setWorking]=useState<string|null>(null)
  const [error,setError]=useState<string|null>(loadError)
  const [message,setMessage]=useState<string|null>(null)
  function get(row:Cycle){return values[row.id]??{start:ph(row.starts_at),expiry:"",reference:""}}
  function set(id:string,key:"start"|"expiry"|"reference",value:string){
    setValues(old=>({...old,[id]:{...(old[id]??{start:ph(items.find(i=>i.id===id)?.starts_at??null),expiry:"",reference:""}),[key]:value}}))
  }
  async function verify(row:Cycle){
    const form=get(row)
    if(!form.start||!form.expiry||form.reference.trim().length<8){
      setError("Original dates and an evidence reference of at least eight characters are required.");return
    }
    if(!window.confirm("Confirm these are the VERIFIED ORIGINAL package dates? This will set a currently missing expiry date. Existing dates cannot be overwritten here."))return
    setWorking(row.id);setError(null);setMessage(null)
    const {error:saveError}=await supabase.rpc("admin_verify_package_freeze_dates",{
      p_member_package_id:row.id,p_start_date:form.start,p_expiry_date:form.expiry,
      p_evidence_reference:form.reference.trim()
    })
    setWorking(null)
    if(saveError){setError(saveError.message);return}
    setItems(old=>old.filter(i=>i.id!==row.id))
    setMessage("Verified original package dates saved with an Admin audit entry. This package is now eligible for policy checks.")
    router.refresh()
  }
  return <StaffAppShell activePath="/staff/packages" role="admin">
    <div className="mx-auto max-w-5xl px-4 py-6 pb-28 md:p-8 lg:pb-8">
      <Link href="/staff/freezes" className="text-sm font-bold text-orange-300">← Back to Freeze Approvals</Link>
      <h1 className="mt-5 text-3xl font-black">Verify Original Package Dates</h1>
      <p className="mt-2 text-sm text-white/60">A freeze request cannot be approved without a verified original expiry. Existing dates are never overwritten. Only use the signed package agreement or another reliable original record. Do not estimate dates from remaining sessions.</p>
      {error&&<p role="alert" className="mt-5 rounded-xl bg-red-500/10 p-4 text-red-200">{error}</p>}
      {message&&<p role="status" className="mt-5 rounded-xl bg-green-500/10 p-4 text-green-200">{message}</p>}
      <p className="mt-6 font-bold">{items.length} package cycle{items.length===1?"":"s"} need verified expiry dates</p>
      <div className="mt-4 grid gap-4">{items.map(row=>{
        const v=get(row)
        return <article key={row.id} className="rounded-2xl border border-white/10 bg-[#101725] p-5">
          <h2 className="text-xl font-bold">{row.members?.[0]?.full_name??"Member"} · {row.members?.[0]?.member_code??"Unknown code"}</h2>
          <p className="mt-1 text-sm text-white/55">{row.members?.[0]?.branch} · {row.package_definitions?.[0]?.name??"Training package"} · {row.package_definitions?.[0]?.validity_days??"No configured"} validity days</p>
          {row.starts_at&&<p className="mt-2 text-xs text-white/50">Existing start date: {ph(row.starts_at)} — cannot be changed here.</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Verified original start
              <input type="date" required disabled={Boolean(row.starts_at)}
                value={v.start} onChange={e=>set(row.id,"start",e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#1c2537] px-4 py-3 disabled:opacity-50"/>
            </label>
            <label className="text-sm font-semibold">Verified original expiry (last valid day)
              <input type="date" required value={v.expiry} onChange={e=>set(row.id,"expiry",e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#1c2537] px-4 py-3"/>
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold">Source of dates / package agreement reference
            <textarea rows={2} maxLength={500} value={v.reference}
              onChange={e=>set(row.id,"reference",e.target.value)}
              placeholder="E.g., original signed contract dated ...; no assumptions"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#1c2537] px-4 py-3"/>
          </label>
          <button disabled={working!==null} onClick={()=>void verify(row)}
            className="mt-4 rounded-xl bg-[#ff7a1a] px-5 py-3 font-bold disabled:opacity-50">
            {working===row.id?"Verifying…":"Verify Original Dates"}
          </button>
        </article>})}</div>
    </div>
  </StaffAppShell>
}
