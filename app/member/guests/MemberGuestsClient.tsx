"use client"
import { useEffect,useState,type FormEvent } from "react"
import Link from "next/link"
import { UsersRound, Copy, ArrowLeft, ShieldCheck, CalendarDays, ExternalLink } from "lucide-react"
import MemberAppShell from "@/components/bearfit/MemberAppShell"
import { createClient } from "@/lib/supabase/client"
import { addDay, manilaDay } from "@/lib/coach-attendance-board"

const supabase=createClient()
type Invite={id:string;guest_name:string|null;branch:string;visit_day:string;purpose:string;status:string;created_at:string}
const types=[
 {value:"visitor",label:"Accompanying only",detail:"May visit, but NO workout or coaching. Visitor pass is issued after registration."},
 {value:"gym_day",label:"Guest gym day pass",detail:"Gym use only. Official BearFit payment must be verified before activation."},
 {value:"training",label:"Guest training pass",detail:"Requires official payment verification; coaching sessions are separately recorded."},
 {value:"trial",label:"Request trial session",detail:"Not automatically free. Admin must approve eligibility for a one-time trial."},
 {value:"xdeal",label:"Request promotional X-deal",detail:"Admin approval and a documented reason are required."},
]
export default function MemberGuestsClient({branch,memberActive}:{branch:string;memberActive:boolean}) {
 const [day,setDay]=useState(()=>manilaDay(new Date()))
 const [purpose,setPurpose]=useState("gym_day")
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState("")
 const [invite,setInvite]=useState<{token:string;id:string}|null>(null)
 const [past,setPast]=useState<Invite[]>([])
 const [message,setMessage]=useState("")
 const [copied,setCopied]=useState(false)
 const load=async()=>{
  const {data,error:e}=await supabase.rpc("member_guest_invites")
  if(e)setError(e.message);else setPast((data||[]) as Invite[])
 }
 useEffect(()=>{void load()},[])
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError("");setMessage("");setInvite(null);setCopied(false)
  if(!memberActive||!branch)return setError("An active linked membership is required.")
  setBusy(true)
  const {data,error:e}=await supabase.rpc("member_invite_guest",{p_branch:branch,p_visit_day:day,p_purpose:purpose})
  setBusy(false)
  if(e)setError(e.message)
  else {setInvite({token:data.token,id:data.id});setMessage("Invitation created. Send the registration link directly to your friend.");await load()}
 }
 const url=invite && typeof window!=="undefined"?window.location.origin+"/guest/register?invite="+invite.token:""
 async function share(){
  if(!url)return
  try{
   if(navigator.share)await navigator.share({title:"BearFit guest invitation",text:"Register your visit at BearFit before coming.",url})
   else {await navigator.clipboard.writeText(url);setCopied(true)}
  }catch(e){if(e instanceof Error&&e.name!=="AbortError")setError("Unable to share automatically. Copy the invitation link instead.")}
 }
 return <MemberAppShell activePath="/member/guests"><div className="mx-auto max-w-3xl space-y-5 px-4 py-7 pb-28 text-white md:px-6">
  <Link href="/member/dashboard" className="inline-flex items-center gap-2 text-sm text-white/55"><ArrowLeft size={16}/> Member Dashboard</Link>
  <header className="border-b border-white/10 pb-5">
   <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">BearFit / Guest Access</p>
   <h1 className="mt-2 text-3xl font-black">Bring a Friend</h1>
   <p className="mt-2 text-sm text-white/60">Each guest must register before using the facility. A guest day pass does not automatically include coaching.</p>
  </header>
  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
   <ShieldCheck size={18} className="mr-2 inline"/>No coach can waive guest payment, grant a free training session, or issue an X-deal. All complimentary access follows Admin rules.
  </div>
  <section className="rounded-3xl border border-white/10 bg-[#141414] p-5">
   <h2 className="flex items-center gap-2 text-lg font-bold"><UsersRound size={20} className="text-[#ff7a1a]"/> Invite your guest</h2>
   <p className="mt-2 text-sm text-white/50">Registered host branch: {branch||"Not linked"}</p>
   <form onSubmit={e=>void create(e)} className="mt-5 space-y-4">
    <label className="block text-xs text-white/60">Visit date (Philippine time)
     <input required type="date" value={day} min={manilaDay(new Date())} max={addDay(manilaDay(new Date()),14)}
       onChange={e=>setDay(e.target.value)} className="mt-2 block w-full rounded-xl border border-white/15 bg-[#202020] px-4 py-3 text-sm"/>
    </label>
    <fieldset><legend className="mb-2 text-xs text-white/60">What will your friend do?</legend>
     <div className="space-y-2">{types.map(type=><label key={type.value} className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 "+(purpose===type.value?"border-orange-400/40 bg-orange-400/10":"border-white/10")}>
      <input type="radio" value={type.value} name="purpose" checked={purpose===type.value} onChange={()=>setPurpose(type.value)} className="mt-1 accent-orange-500"/>
      <span><strong className="text-sm">{type.label}</strong><span className="mt-1 block text-xs text-white/50">{type.detail}</span></span>
     </label>)}</div>
    </fieldset>
    <button disabled={busy||!memberActive||!branch} className="w-full rounded-xl bg-[#ff7a1a] p-3.5 font-bold disabled:opacity-40">{busy?"Creating invitation…":"Create guest invitation"}</button>
   </form>
   {error&&<p role="alert" className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
   {message&&<p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}
   {invite&&<div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
    <h3 className="font-bold">Your friend's private registration link</h3>
    <p className="mt-1 text-xs text-white/60">Share privately. The invitation link is shown only now; it is not available again after refreshing.</p>
    <p className="mt-3 break-all rounded-xl bg-black/30 p-3 text-xs text-white/75">{url}</p>
    <div className="mt-3 flex flex-wrap gap-2">
     <button type="button" onClick={()=>void share()} className="rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold"><Copy size={15} className="mr-2 inline"/>{copied?"Link copied":"Share / copy link"}</button>
     <a className="rounded-xl border border-white/15 px-4 py-2.5 text-sm" href={url} target="_blank" rel="noreferrer"><ExternalLink size={15} className="mr-2 inline"/>Open guest form</a>
    </div>
   </div>}
  </section>
  <section className="rounded-3xl border border-white/10 bg-[#141414] p-5">
   <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays size={20} className="text-[#ff7a1a]"/> Recent invitations</h2>
   <p className="mt-1 text-xs text-white/50">Pass activation depends on the guest's registration and the applicable access rules.</p>
   {past.length===0?<p className="mt-4 text-sm text-white/45">You haven't invited any guests yet.</p>:
    <div className="mt-4 space-y-2">{past.map(g=><div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
      <div><p className="font-semibold">{g.guest_name||"Awaiting guest registration"}</p><p className="text-xs text-white/50">{g.visit_day} · {g.branch} · {types.find(t=>t.value===g.purpose)?.label||g.purpose}</p></div>
      <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium">{g.status.replace(/_/g," ")}</span>
    </div>)}</div>}
  </section>
  <p className="text-xs text-white/40">A guest invitation never deducts sessions from your package. Guests must present their own active, single-use pass. Entrance enforcement still depends on the branch verifying every pass.</p>
 </div></MemberAppShell>
}
