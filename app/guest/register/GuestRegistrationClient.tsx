"use client"
import { useCallback,useEffect,useState,type FormEvent } from "react"
import { RefreshCw,ShieldCheck,TicketCheck,AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {parseGuestCode} from "@/lib/guest-qr"
import GuestQRCode from "@/components/bearfit/GuestQRCode"

const supabase=createClient()
type Pass={status:string;purpose:string;branch:string;visit_day:string;guest_name:string|null;registered:boolean;permitted_service:string;price_php:number|null}
const serviceName:Record<string,string>={visitor:"Visitor / accompanying only",gym_day:"Gym day pass",training:"Guest personal training",trial:"Trial workout request",xdeal:"Promotional X-deal request"}
export default function GuestRegistrationClient({token}:{token:string}) {
 const valid=parseGuestCode(token)
 const [pass,setPass]=useState<Pass|null>(null)
 const [name,setName]=useState("")
 const [phone,setPhone]=useState("")
 const [email,setEmail]=useState("")
 const [agree,setAgree]=useState(false)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 const refresh=useCallback(async()=>{
  if(!valid){setLoading(false);setError("This invitation link is invalid.");return}
  setLoading(true)
  const {data,error:e}=await supabase.rpc("guest_invitation_status",{p_token:valid})
  if(e)setError(e.message)
  else {setPass(data as Pass);setError("")}
  setLoading(false)
 },[valid])
 useEffect(()=>{void refresh()},[refresh])
 async function register(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");setNotice("")
  if(!valid)return setError("Invalid invitation")
  if(!agree)return setError("You must accept the gym rules and waiver before registering.")
  setBusy(true)
  const {data,error:e}=await supabase.rpc("guest_register_invitation",{
   p_token:valid,p_guest_name:name,p_guest_phone:phone,p_guest_email:email||null,p_accept_rules:agree
  })
  setBusy(false)
  if(e)setError(e.message)
  else {setNotice(data.status==="active"?"Visitor-only pass activated. No workout permitted.":"Registration received. Wait for official payment verification or Admin approval.");await refresh()}
 }
 const active=pass?.status==="active"
 return <main className="min-h-screen bg-[#020b1c] px-4 py-9 text-white">
  <div className="mx-auto max-w-xl space-y-5">
   <header className="border-b border-white/10 pb-5">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">BEARFIT / GUEST PASS</p>
    <h1 className="mt-2 text-3xl font-black">Welcome to BearFit</h1>
    <p className="mt-2 text-sm text-white/60">All guests register individually. Registration is not permission to work out until an eligible pass becomes active.</p>
   </header>
   {error&&<p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
   {notice&&<p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}
   {loading?<p className="rounded-xl border border-white/10 p-5 text-white/60">Loading invitation…</p>:pass&&<>
    <section className="rounded-3xl border border-white/10 bg-[#141414] p-5">
     <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-bold"><TicketCheck size={19} className="text-orange-300"/> Visit details</h2>
      <button aria-label="Refresh guest pass status" type="button" onClick={()=>void refresh()} className="rounded-xl border border-white/15 p-2"><RefreshCw size={17}/></button>
     </div>
     <p className="mt-3 text-sm text-white/70">{serviceName[pass.purpose]||pass.purpose}</p>
     <p className="mt-1 text-sm text-white/55">{pass.branch} · {pass.visit_day} (Philippine time)</p>
     <p className="mt-2 text-xs text-white/50">{pass.permitted_service}</p>
     <div className="mt-4 rounded-xl bg-white/5 p-3">
      <p className="text-xs uppercase tracking-wider text-white/45">Current pass status</p>
      <p className={"mt-1 font-bold "+(active?"text-emerald-300":"text-amber-200")}>{pass.status.replace(/_/g," ").toUpperCase()}</p>
      {pass.price_php!==null&&["gym_day","training"].includes(pass.purpose)&&
       <p className="mt-1 text-xs text-white/60">Configured official guest price: ₱{pass.price_php.toLocaleString("en-PH",{minimumFractionDigits:2})}</p>}
     </div>
    </section>
    {!pass.registered&&pass.status==="invited"&&<section className="rounded-3xl border border-white/10 bg-[#141414] p-5">
     <h2 className="text-xl font-bold">Register your own details</h2>
     <form onSubmit={e=>void register(e)} className="mt-4 space-y-4">
      <label className="block text-xs text-white/60">Full name
       <input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"
        className="mt-1 block w-full rounded-xl border border-white/15 bg-[#202020] p-3 text-sm"/>
      </label>
      <label className="block text-xs text-white/60">Mobile number
       <input required type="tel" minLength={7} maxLength={35} value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel"
        className="mt-1 block w-full rounded-xl border border-white/15 bg-[#202020] p-3 text-sm"/>
      </label>
      <label className="block text-xs text-white/60">Email (optional)
       <input type="email" value={email} maxLength={180} onChange={e=>setEmail(e.target.value)} autoComplete="email"
        className="mt-1 block w-full rounded-xl border border-white/15 bg-[#202020] p-3 text-sm"/>
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3 text-sm text-white/70">
       <input type="checkbox" required checked={agree} onChange={e=>setAgree(e.target.checked)} className="mt-1 accent-orange-500"/>
       <span>I agree to follow BearFit facility rules and safety instructions, accept the risks normally associated with physical exercise, and understand that a visitor-only pass does not permit training. I understand that access is subject to the approved service and gym policies.</span>
      </label>
      <p className="text-xs text-white/45">Your mobile number is recorded for visit administration, but is not yet verified by SMS. For minors, please contact BearFit Admin before participating in any activity.</p>
      <button disabled={busy||!agree} className="w-full rounded-xl bg-[#ff7a1a] p-3.5 font-bold disabled:opacity-40">{busy?"Submitting…":"Register guest"}</button>
     </form>
    </section>}
    {active&&valid&&<section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/5 p-5 text-center">
     <div className="flex justify-center gap-2 font-bold text-emerald-200"><ShieldCheck size={20}/> Active, one-time guest entry</div>
     <p className="mt-2 text-sm">{pass.guest_name}</p>
     <div className="mt-4 flex justify-center"><GuestQRCode token={valid}/></div>
     <p className="mt-3 text-sm text-white/80">Show this QR to an authorized BearFit coach during your permitted visit date.</p>
     <p className="mt-2 text-xs text-white/45">One use only · Correct branch and date required · Screenshot sharing is prohibited. Staff may verify your name.</p>
    </section>}
    {pass.status==="pending_payment"&&<div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
     Payment has not been verified. Pay only through an official BearFit payment channel. Admin must verify payment before this pass activates. No personal payment to a coach.
     <p className="mt-2 text-xs">No online payment integration is available on this page yet. Contact BearFit Admin for the official payment instructions.</p>
    </div>}
    {pass.status==="pending_approval"&&<p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">Free trial or X-deal requires Admin approval. No complimentary workout is authorized yet.</p>}
    {pass.status==="redeemed"&&<p className="rounded-2xl border border-white/15 p-4 text-sm">This guest pass was already used for entry. It cannot be reused.</p>}
    {pass.status==="expired"&&<p className="rounded-2xl border border-amber-400/20 p-4 text-sm">This visit date has expired. Request a new invitation.</p>}
    {pass.status==="rejected"&&<p className="rounded-2xl border border-red-400/20 p-4 text-sm">This pass was not approved. Contact BearFit Admin for details.</p>}
   </>}
   <p className="flex items-start gap-2 text-xs text-white/40"><AlertTriangle size={15} className="shrink-0"/> A valid digital pass supports the gym entry policy but cannot physically prevent unauthorized door entry. All guests must comply with on-site access checks.</p>
  </div>
 </main>
}
