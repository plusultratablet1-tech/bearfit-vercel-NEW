"use client"
import Link from "next/link"
import {useState,type FormEvent} from "react"
import {useRouter} from "next/navigation"
import {ArrowLeft,Save,History,ShieldCheck,AlertTriangle} from "lucide-react"
import StaffAppShell from "@/components/bearfit/StaffAppShell"
import {createClient} from "@/lib/supabase/client"

type Editable={id:string;member_code:string|null;full_name:string;email:string|null;phone:string|null;address:string|null;emergency_contact_name:string|null;emergency_contact_phone:string|null;branch:string;coach_name:string|null;membership_status:string;updated_at:string}
type EditEvent={id:string;changed_at:string;admin_user_id:string;previous_values:Record<string,unknown>;new_values:Record<string,unknown>;reason:string}
const branches=["Malingap Branch","E. Rodriguez Branch"]
const statuses=["active","inactive","paused","renewal_due","unknown"]
const input="mt-1.5 block w-full rounded-xl border border-white/15 bg-[#1b2434] px-3 py-3 text-sm text-white outline-none focus:border-[#ff7a1a]/60"
const supabase=createClient()
const fields:[keyof Editable,string][]=[["full_name","Full name"],["email","Email"],["phone","Phone"],["address","Address"],["emergency_contact_name","Emergency contact"],["emergency_contact_phone","Emergency phone"],["branch","Branch"],["coach_name","Coach"],["membership_status","Membership status"]]
function changes(event:EditEvent){
 return fields.filter(([key])=>event.previous_values?.[key]!==event.new_values?.[key])
}
export default function MemberEditClient({initial,coaches,events,loadError}:{initial:Editable;coaches:{display_name:string;branch:string}[];events:EditEvent[];loadError:string}){
 const router=useRouter()
 const [member,setMember]=useState(initial)
 const [reason,setReason]=useState("")
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 const set=(key:keyof Editable,value:string)=>setMember(old=>({...old,[key]:value, ...(key==="branch"&&value!==old.branch?{coach_name:null}:{})}))
 const availableCoaches=coaches.filter(c=>c.branch===member.branch)
 const hasChanges=fields.some(([key])=>(member[key]||"")!==(initial[key]||""))
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");setNotice("")
  if(!hasChanges){setNotice("No profile changes to save.");return}
  if(reason.trim().length<8){setError("Please enter a reason of at least 8 characters.");return}
  if(!window.confirm("Save these member profile changes? An audit entry will be created."))return
  setSaving(true)
  const {data,error:saveError}=await supabase.rpc("admin_edit_member_profile",{
   p_member_id:initial.id,p_expected_updated_at:initial.updated_at,
   p_full_name:member.full_name,p_email:member.email||null,p_phone:member.phone||null,
   p_address:member.address||null,p_emergency_name:member.emergency_contact_name||null,
   p_emergency_phone:member.emergency_contact_phone||null,p_branch:member.branch,
   p_coach_name:member.coach_name||null,p_membership_status:member.membership_status,
   p_reason:reason.trim()
  })
  setSaving(false)
  if(saveError){setError(saveError.message);return}
  if(!data?.changed){setNotice("No fields changed.");return}
  router.push("/staff/members/"+initial.id)
  router.refresh()
 }
 return <StaffAppShell activePath="/staff/members" role="admin">
  <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 pb-28 md:px-7 lg:pb-8">
   <Link href={"/staff/members/"+initial.id} className="inline-flex items-center gap-2 text-sm text-white/60"><ArrowLeft size={16}/> Back to member profile</Link>
   <header className="border-b border-white/10 pb-4">
    <p className="text-xs font-bold uppercase tracking-widest text-[#ff9b54]">Admin / Member Management</p>
    <h1 className="mt-2 text-2xl font-black md:text-3xl">Edit Member Profile</h1>
    <p className="mt-1 text-sm text-white/55">{initial.member_code||"Member"} · {initial.full_name}</p>
   </header>
   <div className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-100">
    <ShieldCheck size={18} className="shrink-0"/>Only Admin may save these details. Every change is recorded with the old and new values and your edit reason.
   </div>
   {loadError&&<p role="alert" className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">Some supporting records could not be loaded: {loadError}</p>}
   {error&&<p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
   {notice&&<p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
   <form onSubmit={e=>void submit(e)} className="space-y-5">
    <section className="rounded-2xl border border-white/10 bg-[#141414] p-5">
     <h2 className="text-lg font-bold">Personal Information</h2>
     <div className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="text-xs font-semibold text-white/65">Full name<input required maxLength={120} minLength={2} value={member.full_name} onChange={e=>set("full_name",e.target.value)} className={input}/></label>
      <label className="text-xs font-semibold text-white/65">Email<input type="email" maxLength={180} value={member.email||""} onChange={e=>set("email",e.target.value)} className={input}/></label>
      <label className="text-xs font-semibold text-white/65">Phone<input type="tel" maxLength={35} value={member.phone||""} onChange={e=>set("phone",e.target.value)} className={input}/></label>
      <label className="text-xs font-semibold text-white/65">Address<input maxLength={350} value={member.address||""} onChange={e=>set("address",e.target.value)} className={input}/></label>
      <label className="text-xs font-semibold text-white/65">Emergency contact name<input maxLength={120} value={member.emergency_contact_name||""} onChange={e=>set("emergency_contact_name",e.target.value)} className={input}/></label>
      <label className="text-xs font-semibold text-white/65">Emergency contact number<input type="tel" maxLength={35} value={member.emergency_contact_phone||""} onChange={e=>set("emergency_contact_phone",e.target.value)} className={input}/></label>
     </div>
     <p className="mt-3 text-xs text-white/45">Updating the member's contact email here does not change their authentication/login email. Login changes require a separate verified procedure.</p>
    </section>
    <section className="rounded-2xl border border-white/10 bg-[#141414] p-5">
     <h2 className="text-lg font-bold">Membership & Assignment</h2>
     <div className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="text-xs font-semibold text-white/65">Assigned branch
       <select value={member.branch} onChange={e=>set("branch",e.target.value)} className={input}>{branches.map(b=><option key={b}>{b}</option>)}</select>
      </label>
      <label className="text-xs font-semibold text-white/65">Assigned coach
       <select value={member.coach_name||""} onChange={e=>set("coach_name",e.target.value)} className={input}>
        <option value="">No coach assigned</option>
        {availableCoaches.map(c=><option key={c.display_name} value={c.display_name}>{c.display_name}</option>)}
        {member.coach_name&&!availableCoaches.some(c=>c.display_name===member.coach_name)&&<option value={member.coach_name} disabled>Previously assigned: {member.coach_name}</option>}
       </select>
      </label>
      <label className="text-xs font-semibold text-white/65">Membership status
       <select value={member.membership_status} onChange={e=>set("membership_status",e.target.value)} className={input}>
        {statuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}
       </select>
      </label>
     </div>
     <p className="mt-3 text-xs text-amber-200">Changing branch is blocked if there are future active bookings or uncompleted guest passes. Membership status changes do not award sessions or confirm payments.</p>
    </section>
    <section className="rounded-2xl border border-white/10 bg-[#141414] p-5">
     <h2 className="text-lg font-bold">Reason for edit</h2>
     <label className="mt-3 block text-xs text-white/65">Required for audit history
      <textarea required minLength={8} maxLength={500} rows={3} value={reason} onChange={e=>setReason(e.target.value)}
       placeholder="e.g. Member requested correction of contact details" className={input+" resize-y"}/>
     </label>
     <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="submit" disabled={saving||!hasChanges} className="inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] px-5 py-3 text-sm font-bold disabled:opacity-40"><Save size={17}/>{saving?"Saving…":"Save changes"}</button>
      <Link href={"/staff/members/"+initial.id} className="rounded-xl border border-white/15 px-5 py-3 text-sm">Cancel</Link>
     </div>
     <p className="mt-3 flex items-start gap-2 text-xs text-white/50"><AlertTriangle size={15}/>Session balances, packages, payments, and coach payroll cannot be edited here. Use their separate authorized workflows.</p>
    </section>
   </form>
   <section className="rounded-2xl border border-white/10 bg-[#141414] p-5">
    <h2 className="flex items-center gap-2 text-lg font-bold"><History size={19} className="text-orange-300"/> Edit history</h2>
    <p className="mt-1 text-xs text-white/45">Last 30 audited profile edits. Visible to Admin only.</p>
    {events.length===0?<p className="mt-4 text-sm text-white/50">No recorded profile edits yet.</p>:
     <div className="mt-4 space-y-3">{events.map(ev=><div key={ev.id} className="rounded-xl border border-white/10 p-3">
      <p className="text-xs font-semibold text-white/70">{new Date(ev.changed_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})} · Admin ID: {ev.admin_user_id.slice(0,8)}…</p>
      <p className="mt-1 text-sm">{ev.reason}</p>
      <div className="mt-2 space-y-1">{changes(ev).map(([key,label])=><p key={key} className="break-words text-xs text-white/50">{label}: {String(ev.previous_values[key]??"—")} → {String(ev.new_values[key]??"—")}</p>)}</div>
     </div>)}</div>}
   </section>
  </div>
 </StaffAppShell>
}
