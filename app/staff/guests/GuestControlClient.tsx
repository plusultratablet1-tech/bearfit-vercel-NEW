"use client"
import Link from "next/link"
import {useCallback,useEffect,useState} from "react"
import {RefreshCw,ShieldCheck,UsersRound,TicketCheck,Settings2,ArrowLeft} from "lucide-react"
import StaffAppShell from "@/components/bearfit/StaffAppShell"
import {createClient} from "@/lib/supabase/client"
const supabase=createClient()
type Guest={id:string;guest_name:string|null;guest_phone:string|null;guest_email:string|null;branch:string;visit_day:string;purpose:string;status:string;registered_at:string|null;created_at:string;decision_note:string|null;payment_reference:string|null;amount_verified:number|null;host_member_id:string;entered_at:string|null}
type Price={branch:string;purpose:string;amount:number}
const branches=["Malingap Branch","E. Rodriguez Branch"]
const purposes=[["gym_day","Gym day pass"],["training","Guest training pass"]]
const input="block w-full rounded-xl border border-white/15 bg-[#1b2434] px-3 py-2.5 text-sm text-white"
const money=(v:number)=>"₱"+Number(v).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})
export default function GuestControlClient(){
 const [guests,setGuests]=useState<Guest[]>([])
 const [prices,setPrices]=useState<Price[]>([])
 const [hostNames,setHostNames]=useState<Record<string,string>>({})
 const [filter,setFilter]=useState("all")
 const [branch,setBranch]=useState(branches[0])
 const [purpose,setPurpose]=useState("gym_day")
 const [price,setPrice]=useState("")
 const [reference,setReference]=useState<Record<string,string>>({})
 const [amount,setAmount]=useState<Record<string,string>>({})
 const [notes,setNotes]=useState<Record<string,string>>({})
 const [busy,setBusy]=useState<string|null>(null)
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 const [loading,setLoading]=useState(true)
 const refresh=useCallback(async()=>{
  setLoading(true)
  const [g,p]=await Promise.all([
   supabase.from("guest_invites").select("id,guest_name,guest_phone,guest_email,branch,visit_day,purpose,status,registered_at,created_at,decision_note,payment_reference,amount_verified,host_member_id,entered_at").order("created_at",{ascending:false}).limit(300),
   supabase.from("guest_access_prices").select("branch,purpose,amount"),
  ])
  if(g.error||p.error)setError([g.error?.message,p.error?.message].filter(Boolean).join(" / "))
  else {setGuests((g.data||[]) as Guest[]);setPrices((p.data||[]) as Price[]);setError("")}
  // Host names are read through Admin's existing members-select policy.
  const ids=[...new Set((g.data||[]).map(v=>v.host_member_id))]
  if(ids.length){
   const {data:m}=await supabase.from("members").select("id,full_name").in("id",ids)
   const h:Record<string,string>={}
   for(const r of m||[])h[r.id]=r.full_name
   setHostNames(h)
  }
  setLoading(false)
 },[])
 useEffect(()=>{void refresh()},[refresh])
 async function setGuestFee(){
  setError("");setNotice("");setBusy("price")
  const value=Number(price)
  if(!Number.isFinite(value)||value<=0||!Number.isInteger(value*100)){setBusy(null);setError("Enter a positive price with at most two decimals.");return}
  const {error:e}=await supabase.rpc("admin_set_guest_price",{p_branch:branch,p_purpose:purpose,p_amount:value})
  setBusy(null)
  if(e)setError(e.message)
  else {setNotice("Official guest fee saved. This does not enable automatic online payment.");setPrice("");await refresh()}
 }
 async function decide(g:Guest,action:"verify_payment"|"approve_promotion"|"reject"){
  setError("");setNotice("")
  if(!window.confirm("Confirm "+action.replace(/_/g," ")+" for "+(g.guest_name||"this invitation")+"? This is an Admin access decision."))return
  setBusy(g.id)
  const args={p_invite_id:g.id,p_action:action,p_note:notes[g.id]||null,
    p_payment_reference:action==="verify_payment"?(reference[g.id]||null):null,
    p_amount:action==="verify_payment"?Number(amount[g.id]||0):null}
  const {error:e}=await supabase.rpc("admin_decide_guest",args)
  setBusy(null)
  if(e)setError(e.message)
  else {setNotice("Guest access decision saved and audited.");await refresh()}
 }
 const visible=guests.filter(g=>filter==="all"||g.status===filter)
 const needAction=guests.filter(g=>g.status==="pending_payment"||g.status==="pending_approval").length
 return <StaffAppShell activePath="/staff/guests" role="admin"><div className="mx-auto max-w-6xl space-y-5 px-4 py-7 pb-28 md:px-6 lg:pb-8">
  <Link href="/staff/coaches" className="inline-flex items-center gap-2 text-xs text-white/50"><ArrowLeft size={15}/> Operations</Link>
  <header className="border-b border-white/10 pb-5">
   <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">Admin / Access Control</p>
   <h1 className="mt-2 text-2xl font-black md:text-3xl">Guest Pass Control</h1>
   <p className="mt-2 text-sm text-white/55">Track guest registrations, verified payments, official promotions and single-use arrivals. Coaches cannot authorize complimentary service.</p>
  </header>
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
   {[["Registrations",guests.filter(g=>g.registered_at).length],["Pending decisions",needAction],["Active passes",guests.filter(g=>g.status==="active").length],["Admitted guests",guests.filter(g=>g.status==="redeemed").length]].map(([label,value])=>
    <div key={label} className="rounded-2xl border border-white/10 bg-[#141414] p-4"><p className="text-xs text-white/55">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}
  </div>
  <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
   <ShieldCheck size={18} className="mr-2 inline"/>Manual payment verification only. Confirm money actually reached an official BearFit account before approving. A submitted reference alone is not proof of payment.
  </section>
  {error&&<p role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}
  <details className="rounded-3xl border border-white/10 bg-[#141414] p-5">
   <summary className="flex cursor-pointer items-center gap-2 font-bold"><Settings2 size={18} className="text-orange-300"/> Configure official guest fees</summary>
   <p className="mt-2 text-xs text-white/50">Guest fees must be configured before Admin can verify a paid guest pass. No amounts were assumed.</p>
   <div className="mt-4 grid gap-2 sm:grid-cols-4">
    <select aria-label="Fee branch" className={input} value={branch} onChange={e=>setBranch(e.target.value)}>{branches.map(b=><option key={b}>{b}</option>)}</select>
    <select aria-label="Fee purpose" className={input} value={purpose} onChange={e=>setPurpose(e.target.value)}>{purposes.map(p=><option value={p[0]} key={p[0]}>{p[1]}</option>)}</select>
    <input aria-label="Fee amount in PHP" placeholder="Official amount ₱" className={input} type="number" min=".01" max="50000" step=".01" value={price} onChange={e=>setPrice(e.target.value)}/>
    <button onClick={()=>void setGuestFee()} disabled={busy!==null||!price} className="rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold disabled:opacity-40">Save fee</button>
   </div>
   <div className="mt-3 flex flex-wrap gap-2">{prices.map(p=><span key={p.branch+p.purpose} className="rounded-lg border border-white/10 p-2 text-xs">{p.branch} · {p.purpose}: {money(p.amount)}</span>)}</div>
  </details>
  <section className="rounded-3xl border border-white/10 bg-[#141414] p-5">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <h2 className="flex items-center gap-2 text-lg font-bold"><UsersRound size={19} className="text-orange-300"/> Guest applications</h2>
    <div className="flex flex-wrap gap-2">
     <select aria-label="Filter guest pass status" value={filter} onChange={e=>setFilter(e.target.value)} className={input+" max-w-40"}>
      <option value="all">All statuses</option>{["invited","pending_payment","pending_approval","active","redeemed","rejected"].map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
     </select>
     <button type="button" aria-label="Refresh guests" onClick={()=>void refresh()} className="rounded-xl border border-white/15 p-2.5"><RefreshCw size={18}/></button>
    </div>
   </div>
   {loading?<p className="mt-4 text-sm text-white/50">Loading guest passes…</p>:visible.length===0?<p className="mt-4 text-sm text-white/50">No guest invitations found in this view.</p>:
   <div className="mt-4 space-y-3">{visible.map(g=>{
    const priceRow=prices.find(p=>p.branch===g.branch&&p.purpose===g.purpose)
    return <article key={g.id} className="rounded-2xl border border-white/10 bg-[#101725] p-4">
     <div className="flex flex-wrap justify-between gap-2">
      <div><h3 className="font-bold">{g.guest_name||"Not registered"}</h3>
       <p className="mt-1 text-xs text-white/55">Host: {hostNames[g.host_member_id]||"Member"} · {g.branch} · {g.visit_day}</p>
       <p className="mt-1 text-xs text-white/55">{g.purpose.replace(/_/g," ")} · Contact: {g.guest_phone||"not provided"}</p>
      </div>
      <span className={"rounded-xl border px-3 py-1.5 text-xs font-semibold "+(g.status==="active"||g.status==="redeemed"?"border-emerald-400/25 text-emerald-300":"border-amber-400/20 text-amber-200")}>{g.status.replace(/_/g," ").toUpperCase()}</span>
     </div>
     {g.entered_at&&<p className="mt-2 text-xs text-emerald-300">Entry verified: {new Date(g.entered_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</p>}
     {g.decision_note&&<p className="mt-2 text-xs text-white/50">Decision: {g.decision_note}</p>}
     {(g.status==="pending_payment"||g.status==="pending_approval")&&<div className="mt-4 space-y-3 border-t border-white/10 pt-3">
      <p className="text-xs text-white/50">{g.status==="pending_payment"?"Required configured fee: "+(priceRow?money(priceRow.amount):"Not set"):"Complimentary access requires an Admin reason and approval"}</p>
      {g.status==="pending_payment"&&<div className="grid gap-2 sm:grid-cols-2">
       <input aria-label={"Official payment reference for "+g.guest_name} placeholder="Official transaction reference" value={reference[g.id]||""} onChange={e=>setReference(x=>({...x,[g.id]:e.target.value}))} className={input}/>
       <input aria-label={"Verified payment amount for "+g.guest_name} placeholder="Amount actually received" type="number" step=".01" min=".01" value={amount[g.id]||""} onChange={e=>setAmount(x=>({...x,[g.id]:e.target.value}))} className={input}/>
      </div>}
      <textarea aria-label={"Admin decision reason for "+g.guest_name} placeholder={g.status==="pending_approval"?"Reason for complimentary authorization (required)":"Admin notes / rejection reason"} value={notes[g.id]||""} onChange={e=>setNotes(x=>({...x,[g.id]:e.target.value}))} className={input+" min-h-20"} maxLength={500}/>
      <div className="flex flex-wrap gap-2">
       <button disabled={busy!==null} onClick={()=>void decide(g,g.status==="pending_payment"?"verify_payment":"approve_promotion")} className="rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold disabled:opacity-40">
        {g.status==="pending_payment"?"Verify payment & activate":"Approve trial / X-deal"}
       </button>
       <button disabled={busy!==null} onClick={()=>void decide(g,"reject")} className="rounded-xl border border-red-400/30 px-4 py-2.5 text-sm text-red-200 disabled:opacity-40">Reject</button>
      </div>
     </div>}
    </article>
   })}</div>}
   {guests.length>=300&&<p className="mt-3 text-xs text-amber-200">Showing the 300 most recent records. Do not assume totals are complete; add date filters before operational reporting.</p>}
  </section>
  <p className="text-xs text-white/40">All approval decisions are audited. Guest entry passes authorize their labeled access only; member package sessions, coach conductions and payroll are not modified here.</p>
 </div></StaffAppShell>
}
