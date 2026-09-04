"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { Archive, Check, Gift, PackagePlus, Pencil, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { StaffRewardCatalogItem, StaffRewardRequestItem, StaffRewardSnapshot } from "./page"

const supabase = createClient()

type RewardForm = { title: string; description: string; category: string; pointsCost: string; stock: string; unlimited: boolean; imageUrl: string; requiresActiveMembership: boolean; active: boolean }
const emptyForm: RewardForm = { title: "", description: "", category: "general", pointsCost: "", stock: "", unlimited: true, imageUrl: "", requiresActiveMembership: true, active: true }

function fmt(iso: string | null) { if (!iso) return "—"; return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) }
function pts(value: number) { return new Intl.NumberFormat("en-PH").format(value) }

export default function StaffRewardsPageClient({ role, initialSnapshot, initialError }: { role: "staff" | "admin"; initialSnapshot: StaffRewardSnapshot | null; initialError: string | null }) {
  const [snapshot, setSnapshot] = useState<StaffRewardSnapshot | null>(initialSnapshot)
  const [form, setForm] = useState<RewardForm>(emptyForm)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<RewardForm>(emptyForm)
  const [notes, setNotes] = useState<Record<string,string>>({})
  const [error, setError] = useState<string | null>(initialError)
  const [success, setSuccess] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  async function reload() {
    const { data, error: nextError } = await supabase.rpc("staff_reward_snapshot")
    if (nextError) return setError(nextError.message)
    setSnapshot(data as StaffRewardSnapshot)
  }

  async function createReward(e: FormEvent) {
    e.preventDefault(); setError(null); setSuccess(null); setWorking("create")
    const { error: createError } = await supabase.rpc("staff_create_reward", {
      p_title: form.title,
      p_points_cost: Number(form.pointsCost),
      p_description: form.description,
      p_category: form.category,
      p_image_url: form.imageUrl || null,
      p_stock_quantity: form.unlimited ? null : Number(form.stock),
      p_requires_active_membership: form.requiresActiveMembership,
      p_active: form.active,
    })
    setWorking(null)
    if (createError) return setError(createError.message)
    setForm(emptyForm); setSuccess("Reward created and published according to its Active setting."); await reload()
  }

  function startEdit(reward: StaffRewardCatalogItem) {
    setEditing(reward.id)
    setEditForm({ title: reward.title, description: reward.description, category: reward.category, pointsCost: String(reward.points_cost), stock: reward.stock_quantity === null ? "" : String(reward.stock_quantity), unlimited: reward.stock_quantity === null, imageUrl: reward.image_url ?? "", requiresActiveMembership: reward.requires_active_membership, active: reward.active })
  }

  async function saveReward(rewardId: string) {
    setWorking(rewardId); setError(null); setSuccess(null)
    const { error: updateError } = await supabase.rpc("staff_update_reward", {
      p_reward_id: rewardId,
      p_title: editForm.title,
      p_description: editForm.description,
      p_category: editForm.category,
      p_image_url: editForm.imageUrl || null,
      p_points_cost: Number(editForm.pointsCost),
      p_stock_quantity: editForm.unlimited ? null : Number(editForm.stock),
      p_requires_active_membership: editForm.requiresActiveMembership,
      p_active: editForm.active,
    })
    setWorking(null)
    if (updateError) return setError(updateError.message)
    setEditing(null); setSuccess("Reward updated."); await reload()
  }

  async function requestAction(request: StaffRewardRequestItem, action: "approve" | "reject" | "claim") {
    setWorking(request.id); setError(null); setSuccess(null)
    const note = notes[request.id] || null
    const result = action === "approve"
      ? await supabase.rpc("staff_approve_reward_request", { p_request_id: request.id, p_note: note })
      : action === "reject"
        ? await supabase.rpc("staff_reject_reward_request", { p_request_id: request.id, p_note: note })
        : await supabase.rpc("staff_mark_reward_claimed", { p_request_id: request.id })
    setWorking(null)
    if (result.error) return setError(result.error.message)
    setSuccess(action === "approve" ? "Reward approved and Bearforce Points spent." : action === "reject" ? "Reward request rejected and reservations released." : "Reward marked claimed.")
    await reload()
  }

  const catalog = snapshot?.catalog ?? []
  const requests = snapshot?.requests ?? []
  const pending = requests.filter(r => r.status === "pending")
  const approved = requests.filter(r => r.status === "approved")

  return <main className="min-h-screen bg-[#020b1c] p-4 text-white md:p-8"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">BearFit {role}</p><h1 className="text-3xl font-black">Rewards Workspace</h1><p className="mt-1 text-sm text-white/45">Create real BearFit rewards and control every redemption.</p></div><div className="flex flex-wrap gap-2"><Link href="/staff/schedule" className="rounded-full bg-[#25324a] px-4 py-3 text-sm">Schedule</Link><Link href="/staff/packages" className="rounded-full bg-[#25324a] px-4 py-3 text-sm">Packages</Link><Link href="/payments" className="rounded-full bg-[#25324a] px-4 py-3 text-sm">Payments</Link><Link href="/checkin" className="rounded-full bg-[#ff7a1a] px-4 py-3 text-sm font-bold">Check-in</Link></div></header>
    {error && <div className="mb-4 rounded-2xl bg-red-500/10 p-4 text-red-200">{error}</div>}{success && <div className="mb-4 rounded-2xl bg-emerald-500/10 p-4 text-emerald-200">{success}</div>}

    <section className="grid gap-6 xl:grid-cols-[390px_1fr]">
      <form onSubmit={createReward} className="h-fit rounded-[24px] border border-white/10 bg-[#141414] p-5"><div className="flex items-center gap-3"><PackagePlus className="text-[#ff7a1a]"/><div><h2 className="text-xl font-bold">Create reward</h2><p className="text-xs text-white/45">No fake rewards are seeded. Add only real offers.</p></div></div><div className="mt-5 space-y-3"><Field label="Title"><Input value={form.title} set={v=>setForm({...form,title:v})}/></Field><Field label="Description"><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="min-h-24 w-full rounded-xl bg-[#242424] p-3 text-sm"/></Field><Field label="Category"><Input value={form.category} set={v=>setForm({...form,category:v})}/></Field><Field label="Points cost"><Input value={form.pointsCost} set={v=>setForm({...form,pointsCost:v})} type="number"/></Field><Field label="Image URL"><Input value={form.imageUrl} set={v=>setForm({...form,imageUrl:v})} placeholder="Optional https://..."/></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.unlimited} onChange={e=>setForm({...form,unlimited:e.target.checked})}/>Unlimited stock</label>{!form.unlimited && <Field label="Stock"><Input value={form.stock} set={v=>setForm({...form,stock:v})} type="number"/></Field>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requiresActiveMembership} onChange={e=>setForm({...form,requiresActiveMembership:e.target.checked})}/>Active membership required</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>Active</label></div><button disabled={working==="create"} className="mt-5 w-full rounded-xl bg-[#ff7a1a] px-4 py-3 font-bold">Create reward</button></form>

      <div className="space-y-6"><section className="rounded-[24px] border border-white/10 bg-[#141414] p-5"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Catalog manager</h2><p className="text-xs text-white/45">Stock = total; reserved = pending; redeemed = approved/claimed.</p></div><Gift className="text-[#ff7a1a]"/></div><div className="mt-4 grid gap-3 md:grid-cols-2">{catalog.length===0?<p className="text-sm text-white/45">No rewards yet.</p>:catalog.map(reward=><div key={reward.id} className="rounded-2xl bg-white/5 p-4">{editing===reward.id?<EditReward form={editForm} setForm={setEditForm} working={working===reward.id} onSave={()=>void saveReward(reward.id)} onCancel={()=>setEditing(null)}/>:<><div className="flex items-start justify-between gap-3"><div><b>{reward.title}</b><p className="text-xs text-white/45">{reward.category} · {pts(reward.points_cost)} pts</p></div><button onClick={()=>startEdit(reward)} className="rounded-lg bg-white/10 p-2"><Pencil size={15}/></button></div><p className="mt-2 text-sm text-white/50">{reward.description}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/10 px-2.5 py-1">{reward.active?"Active":"Inactive"}</span><span className="rounded-full bg-white/10 px-2.5 py-1">{reward.stock_quantity===null?"Unlimited stock":`${reward.available_stock ?? 0} available`}</span><span className="rounded-full bg-white/10 px-2.5 py-1">{reward.reserved_quantity} reserved</span><span className="rounded-full bg-white/10 px-2.5 py-1">{reward.redeemed_quantity} redeemed</span></div></>}</div>)}</div></section>

      <section className="rounded-[24px] border border-white/10 bg-[#141414] p-5"><h2 className="text-xl font-bold">Pending requests</h2><p className="text-xs text-white/45">Approve spends points; Reject releases points and reserved stock.</p><div className="mt-4 space-y-3">{pending.length===0?<p className="text-sm text-white/45">No pending requests.</p>:pending.map(request=><RequestCard key={request.id} request={request} note={notes[request.id]??""} setNote={v=>setNotes({...notes,[request.id]:v})} working={working===request.id} onApprove={()=>void requestAction(request,"approve")} onReject={()=>void requestAction(request,"reject")}/>)}</div></section>

      <section className="rounded-[24px] border border-white/10 bg-[#141414] p-5"><h2 className="text-xl font-bold">Ready to claim</h2><p className="text-xs text-white/45">Points were already spent when approved.</p><div className="mt-4 space-y-3">{approved.length===0?<p className="text-sm text-white/45">No approved rewards waiting for claim.</p>:approved.map(request=><div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 p-4"><div><b>{request.member_name} · {request.reward_title}</b>{request.member_is_demo && <span className="ml-2 rounded-full bg-violet-500/15 px-2 py-1 text-[10px] font-bold text-violet-200">QA / Demo</span>}<p className="text-xs text-white/45">{request.member_code} · {pts(request.points_cost)} pts</p></div><button disabled={working===request.id} onClick={()=>void requestAction(request,"claim")} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold">Mark claimed</button></div>)}</div></section>

      <section className="rounded-[24px] border border-white/10 bg-[#141414] p-5"><div className="flex items-center gap-2"><Archive className="text-[#ff7a1a]"/><h2 className="text-xl font-bold">Request history</h2></div><div className="mt-4 space-y-2">{requests.length===0?<p className="text-sm text-white/45">No reward requests yet.</p>:requests.map(request=><div key={request.id} className="grid gap-2 rounded-2xl bg-white/[0.04] p-4 md:grid-cols-[1fr_auto] md:items-center"><div><b>{request.member_name}</b>{request.member_is_demo && <span className="ml-2 rounded-full bg-violet-500/15 px-2 py-1 text-[10px] font-bold text-violet-200">QA / Demo</span>}<span className="text-white/45"> · {request.reward_title}</span><p className="mt-1 text-xs text-white/40">{request.member_code} · {request.season_key} · {pts(request.points_cost)} pts · {fmt(request.requested_at)}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold capitalize">{request.status}</span></div>)}</div></section></div>
    </section>
  </div></main>
}

function RequestCard({ request, note, setNote, working, onApprove, onReject }: { request: StaffRewardRequestItem; note: string; setNote:(v:string)=>void; working:boolean; onApprove:()=>void; onReject:()=>void }) { return <div className="rounded-2xl bg-white/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><b>{request.member_name}</b>{request.member_is_demo && <span className="ml-2 rounded-full bg-violet-500/15 px-2 py-1 text-[10px] font-bold text-violet-200">QA / Demo</span>}<p className="text-xs text-white/45">{request.member_code} · {request.reward_title} · {pts(request.points_cost)} pts</p></div><span className="text-xs text-orange-300">{request.season_key}</span></div><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional decision note" className="mt-3 w-full rounded-xl bg-[#242424] p-3 text-sm"/><div className="mt-3 flex gap-2"><button disabled={working} onClick={onApprove} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold"><Check size={15}/>Approve</button><button disabled={working} onClick={onReject} className="flex items-center gap-2 rounded-xl bg-red-500/20 px-4 py-2.5 text-sm"><X size={15}/>Reject</button></div></div> }
function EditReward({ form, setForm, working, onSave, onCancel }: { form:RewardForm; setForm:(v:RewardForm)=>void; working:boolean; onSave:()=>void; onCancel:()=>void }) { return <div className="space-y-2"><Field label="Title"><Input value={form.title} set={v=>setForm({...form,title:v})}/></Field><Field label="Description"><Input value={form.description} set={v=>setForm({...form,description:v})}/></Field><Field label="Category"><Input value={form.category} set={v=>setForm({...form,category:v})}/></Field><Field label="Points cost"><Input value={form.pointsCost} set={v=>setForm({...form,pointsCost:v})} type="number"/></Field><Field label="Image URL"><Input value={form.imageUrl} set={v=>setForm({...form,imageUrl:v})}/></Field><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.unlimited} onChange={e=>setForm({...form,unlimited:e.target.checked})}/>Unlimited stock</label>{!form.unlimited&&<Field label="Stock"><Input value={form.stock} set={v=>setForm({...form,stock:v})} type="number"/></Field>}<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.requiresActiveMembership} onChange={e=>setForm({...form,requiresActiveMembership:e.target.checked})}/>Active membership required</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>Active</label><div className="flex gap-2 pt-2"><button disabled={working} onClick={onSave} className="rounded-lg bg-[#ff7a1a] px-3 py-2 text-xs font-bold">Save</button><button onClick={onCancel} className="rounded-lg bg-white/10 px-3 py-2 text-xs">Cancel</button></div></div> }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block text-xs font-semibold text-white/55"><span className="mb-1.5 block">{label}</span>{children}</label> }
function Input({value,set,type="text",placeholder}:{value:string;set:(v:string)=>void;type?:string;placeholder?:string}) { return <input value={value} onChange={e=>set(e.target.value)} type={type} placeholder={placeholder} className="w-full rounded-xl bg-[#242424] p-3 text-sm"/> }
