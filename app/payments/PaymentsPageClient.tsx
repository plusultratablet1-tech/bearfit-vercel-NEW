"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

type MemberOption = { id: string; member_code: string; full_name: string; package_name: string; sessions_left: number; total_sessions: number }
type MemberJoin = { member_code: string | null; name: string | null }
type PackageDefinition = { id: string; code: string; name: string; service_category: string; included_sessions: number; validity_days: number | null; billing_mode: string }
type PackageStage = { id: string; package_id: string; stage_key: string; label: string; stage_order: number }
type PackageCycle = { id: string; member_id: string; package_id: string; status: string; sessions_left: number; sessions_total: number }
type PaymentRow = { id: string; member_id: string; package_name: string | null; stage: string | null; amount: number | null; status: string | null; sessions_purchased: number; created_at: string; paid_at: string | null; credit_applied_at: string | null; member_package_id: string | null; members?: MemberJoin[] | null }

type FormState = { memberId: string; packageCode: string; stageKey: string; memberPackageId: string; amount: string; paymentType: string; status: "pending" | "paid" }
const initialForm: FormState = { memberId: "", packageCode: "", stageKey: "activation", memberPackageId: "", amount: "", paymentType: "GCash", status: "pending" }

function peso(n?: number | null) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n)
}
function isToday(dateIso?: string | null) { return !!dateIso && new Date(dateIso).toDateString() === new Date().toDateString() }

export default function PaymentsPageClient({ role }: { role: "staff" | "admin" }) {
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [packages, setPackages] = useState<PackageDefinition[]>([])
  const [stages, setStages] = useState<PackageStage[]>([])
  const [cycles, setCycles] = useState<PackageCycle[]>([])
  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [marking, setMarking] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  async function fetchData() {
    setLoading(true); setError(null)
    const [paymentsResult, membersResult, packagesResult, stagesResult, cyclesResult] = await Promise.all([
      supabase.from("payments").select(`id,member_id,package_name,stage,amount,status,sessions_purchased,created_at,paid_at,credit_applied_at,member_package_id,members:members(member_code,name)`).order("created_at", { ascending: false }),
      supabase.from("members").select("id,member_code,full_name,package_name,sessions_left,total_sessions").order("full_name"),
      supabase.from("package_definitions").select("id,code,name,service_category,included_sessions,validity_days,billing_mode").eq("active", true).order("name"),
      supabase.from("package_payment_stages").select("id,package_id,stage_key,label,stage_order").eq("active", true).order("stage_order"),
      supabase.from("member_package_cycles").select("id,member_id,package_id,status,sessions_left,sessions_total").order("created_at", { ascending: false }),
    ])
    for (const result of [paymentsResult, membersResult, packagesResult, stagesResult, cyclesResult]) if (result.error) setError(result.error.message)
    setRows((paymentsResult.data ?? []) as PaymentRow[])
    setMembers((membersResult.data ?? []) as MemberOption[])
    setPackages((packagesResult.data ?? []) as PackageDefinition[])
    setStages((stagesResult.data ?? []) as PackageStage[])
    setCycles((cyclesResult.data ?? []) as PackageCycle[])
    setLoading(false)
  }
  useEffect(() => { void fetchData() }, [])

  const selectedPackage = packages.find((p) => p.code === form.packageCode) ?? null
  const packageStages = selectedPackage ? stages.filter((s) => s.package_id === selectedPackage.id) : []
  const selectedMember = members.find((m) => m.id === form.memberId) ?? null
  const matchingCycles = selectedPackage ? cycles.filter((c) => c.member_id === form.memberId && c.package_id === selectedPackage.id) : []
  const selectedStage = packageStages.find((s) => s.stage_key === form.stageKey) ?? null
  const isActivation = (selectedStage?.stage_key ?? "activation") === "activation"

  const filtered = useMemo(() => rows.filter((row) => {
    const member = row.members?.[0]
    const needle = search.trim().toLowerCase()
    return (!needle || (member?.member_code ?? "").toLowerCase().includes(needle) || (member?.name ?? "").toLowerCase().includes(needle) || (row.package_name ?? "").toLowerCase().includes(needle)) && (statusFilter === "ALL" || (row.status ?? "pending").toLowerCase() === statusFilter)
  }), [rows, search, statusFilter])

  const stats = useMemo(() => ({
    pending: rows.filter((r) => (r.status ?? "pending") !== "paid").length,
    paidToday: rows.filter((r) => r.status === "paid" && isToday(r.paid_at)).length,
    sessionsSold: rows.filter((r) => r.credit_applied_at && r.sessions_purchased > 0).reduce((n, r) => n + r.sessions_purchased, 0),
  }), [rows])

  function choosePackage(code: string) {
    const pkg = packages.find((p) => p.code === code)
    const firstStage = pkg ? stages.filter((s) => s.package_id === pkg.id).sort((a,b) => a.stage_order-b.stage_order)[0] : null
    setForm((f) => ({ ...f, packageCode: code, stageKey: firstStage?.stage_key ?? "activation", memberPackageId: "" }))
  }

  async function recordPayment(event: FormEvent) {
    event.preventDefault(); setError(null); setSuccess(null)
    const amount = Number(form.amount)
    if (!form.memberId) return setError("Select a member.")
    if (!selectedPackage) return setError("Select a package.")
    if (!selectedStage) return setError("Select a payment stage.")
    if (!isActivation && !form.memberPackageId) return setError("Select the existing package cycle for this installment.")
    if (!Number.isFinite(amount) || amount < 0) return setError("Enter a valid amount.")
    setSaving(true)
    const { error: rpcError } = await supabase.rpc("staff_record_package_payment", {
      p_member_id: form.memberId,
      p_package_code: form.packageCode,
      p_stage_key: form.stageKey,
      p_amount: amount,
      p_payment_type: form.paymentType.trim() || null,
      p_status: form.status,
      p_member_package_id: form.memberPackageId || null,
    })
    setSaving(false)
    if (rpcError) return setError(rpcError.message)
    setSuccess(form.status === "paid" ? `${selectedPackage.name} payment recorded as PAID.` : `${selectedPackage.name} payment recorded as PENDING. No package sessions are usable until it is paid.`)
    setForm(initialForm); await fetchData()
  }

  async function markAsPaid(payment: PaymentRow) {
    setError(null); setSuccess(null); setMarking((m) => ({ ...m, [payment.id]: true }))
    const { error: rpcError } = payment.member_package_id
      ? await supabase.rpc("staff_mark_package_payment_paid", { p_payment_id: payment.id })
      : await supabase.rpc("staff_mark_payment_paid", { p_payment_id: payment.id })
    setMarking((m) => ({ ...m, [payment.id]: false }))
    if (rpcError) return setError(rpcError.message)
    setSuccess("Payment marked PAID. Package/stage effects were applied exactly once."); await fetchData()
  }

  return <main className="min-h-screen bg-[#020b1c] px-4 py-6 text-white"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm uppercase tracking-[0.2em] text-orange-300">BearFit Staff</p><h1 className="text-3xl font-extrabold">Payments & Packages</h1><p className="mt-1 text-sm text-white/55">Signed in as {role}. Package rules now control session credits.</p></div><div className="flex gap-2"><Link href="/checkin" className="rounded-full bg-[#25324a] px-5 py-3 text-sm font-semibold">Check-in</Link><Link href="/member/dashboard" className="rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-semibold">Member Dashboard</Link></div></header>
    {error && <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}{success && <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{success}</div>}
    <section className="grid gap-4 md:grid-cols-3"><StatCard title="Pending Payments" value={stats.pending}/><StatCard title="Paid Today" value={stats.paidToday}/><StatCard title="Activation Sessions" value={stats.sessionsSold}/></section>
    <section className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
      <form onSubmit={recordPayment} className="rounded-[28px] border border-white/10 bg-[#141414] p-5"><h2 className="text-xl font-bold">Record Package Payment</h2><p className="mt-1 text-sm text-white/50">Choose the catalog package and payment stage. Session counts are never typed manually.</p>
        <Select label="Member" value={form.memberId} onChange={(value) => setForm({ ...form, memberId:value, memberPackageId:"" })}><option value="">Select member</option>{members.map((m) => <option key={m.id} value={m.id}>{m.member_code} — {m.full_name}</option>)}</Select>
        {selectedMember && <div className="mt-3 rounded-2xl bg-white/5 p-3 text-sm text-white/65">Current: {selectedMember.package_name} · {selectedMember.sessions_left} remaining / {selectedMember.total_sessions} total</div>}
        <Select label="Package" value={form.packageCode} onChange={choosePackage}><option value="">Select package</option>{packages.map((p) => <option key={p.id} value={p.code}>{p.name} — {p.included_sessions} session{p.included_sessions===1?"":"s"}{p.validity_days ? ` / ${p.validity_days} days` : ""}</option>)}</Select>
        <Select label="Payment stage" value={form.stageKey} onChange={(value) => setForm({ ...form, stageKey:value, memberPackageId:"" })}>{packageStages.map((s) => <option key={s.id} value={s.stage_key}>{s.label}</option>)}</Select>
        {!isActivation && <Select label="Existing package cycle" value={form.memberPackageId} onChange={(value) => setForm({ ...form, memberPackageId:value })}><option value="">Select package cycle</option>{matchingCycles.map((c) => <option key={c.id} value={c.id}>{c.status} · {c.sessions_left}/{c.sessions_total} remaining</option>)}</Select>}
        <Field label="Amount (PHP)" value={form.amount} onChange={(value) => setForm({ ...form, amount:value })} placeholder="0" />
        <Field label="Payment method" value={form.paymentType} onChange={(value) => setForm({ ...form, paymentType:value })} placeholder="GCash" />
        <Select label="Initial status" value={form.status} onChange={(value) => setForm({ ...form, status:value as "pending"|"paid" })}><option value="pending">Pending — package/stage not active yet</option><option value="paid">Paid — apply package/stage now</option></Select>
        <button disabled={saving} className="mt-5 w-full rounded-2xl bg-[#ff7a1a] px-5 py-3 font-bold disabled:opacity-50">{saving?"Saving…":"Record Payment"}</button>
      </form>
      <div className="rounded-[28px] border border-white/10 bg-[#141414] p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold">Payment Records</h2><p className="text-sm text-white/50">Activation credits sessions once; installments clear their package gate.</p></div><div className="flex gap-2"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Member / package" className="rounded-2xl border border-white/15 bg-[#202020] px-4 py-2 text-sm"/><select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="rounded-2xl border border-white/15 bg-[#202020] px-4 py-2 text-sm"><option value="ALL">All</option><option value="pending">Pending</option><option value="paid">Paid</option></select></div></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase text-white/45"><tr><th className="py-3">Member</th><th>Package</th><th>Stage</th><th>Amount</th><th>Status</th><th className="text-right">Action</th></tr></thead><tbody className="divide-y divide-white/10">{loading?<tr><td colSpan={6} className="py-8 text-center text-white/50">Loading…</td></tr>:filtered.length===0?<tr><td colSpan={6} className="py-8 text-center text-white/50">No payment records yet.</td></tr>:filtered.map((row)=>{const member=row.members?.[0];const paid=(row.status??"pending")==="paid";return <tr key={row.id}><td className="py-4"><div className="font-semibold">{member?.name??"—"}</div><div className="text-xs text-white/45">{member?.member_code??"—"}</div></td><td>{row.package_name??"—"}</td><td>{row.stage??"—"}</td><td>{peso(row.amount)}</td><td>{paid?"Paid":"Pending"}</td><td className="text-right"><button disabled={paid||marking[row.id]} onClick={()=>void markAsPaid(row)} className="rounded-xl bg-[#ff7a1a] px-3 py-2 text-xs font-bold disabled:bg-white/10 disabled:text-white/35">{paid?"Applied":marking[row.id]?"Saving…":"Mark as Paid"}</button></td></tr>})}</tbody></table></div>
      </div>
    </section>
  </div></main>
}

function Field({label,value,onChange,placeholder}:{label:string;value:string;onChange:(value:string)=>void;placeholder:string}) { return <label className="mt-4 block"><span className="text-xs font-semibold uppercase tracking-wider text-white/55">{label}</span><input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-white/15 bg-[#202020] px-4 py-3"/></label> }
function Select({label,value,onChange,children}:{label:string;value:string;onChange:(value:string)=>void;children:React.ReactNode}) { return <label className="mt-4 block"><span className="text-xs font-semibold uppercase tracking-wider text-white/55">{label}</span><select value={value} onChange={(e)=>onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/15 bg-[#202020] px-4 py-3">{children}</select></label> }
function StatCard({title,value}:{title:string;value:number}) { return <div className="rounded-3xl border border-white/10 bg-[#141414] p-5"><p className="text-sm text-white/50">{title}</p><p className="mt-2 text-3xl font-extrabold">{value}</p></div> }
