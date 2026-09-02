"use client"

import { useEffect, useMemo, useState, type FormEvent, type HTMLAttributes } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

type MemberOption = {
  id: string
  member_code: string
  full_name: string
  package_name: string
  sessions_left: number
  total_sessions: number
}

type MemberJoin = { member_code: string | null; name: string | null }

type PaymentRow = {
  id: string
  member_id: string
  package_name: string | null
  stage: string | null
  amount: number | null
  status: string | null
  sessions_purchased: number
  created_at: string
  paid_at: string | null
  credit_applied_at: string | null
  members?: MemberJoin[] | null
}

type FormState = {
  memberId: string
  packageName: string
  stage: string
  amount: string
  sessionsPurchased: string
  paymentType: string
  status: "pending" | "paid"
}

const initialForm: FormState = {
  memberId: "",
  packageName: "",
  stage: "Package purchase",
  amount: "",
  sessionsPurchased: "",
  paymentType: "GCash",
  status: "pending",
}

function peso(n?: number | null) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n)
}

function isToday(dateIso?: string | null) {
  if (!dateIso) return false
  const d = new Date(dateIso)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

export default function PaymentsPageClient({ role }: { role: "staff" | "admin" }) {
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(initialForm)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [marking, setMarking] = useState<Record<string, boolean>>({})

  async function fetchData() {
    setLoading(true)
    setError(null)

    const [paymentsResult, membersResult] = await Promise.all([
      supabase
        .from("payments")
        .select(`
          id,
          member_id,
          package_name,
          stage,
          amount,
          status,
          sessions_purchased,
          created_at,
          paid_at,
          credit_applied_at,
          members:members ( member_code, name )
        `)
        .order("created_at", { ascending: false }),
      supabase
        .from("members")
        .select("id, member_code, full_name, package_name, sessions_left, total_sessions")
        .order("full_name", { ascending: true }),
    ])

    if (paymentsResult.error) setError(paymentsResult.error.message)
    if (membersResult.error) setError(membersResult.error.message)

    setRows((paymentsResult.data ?? []) as PaymentRow[])
    setMembers((membersResult.data ?? []) as MemberOption[])
    setLoading(false)
  }

  useEffect(() => {
    void fetchData()
  }, [])

  const selectedMember = members.find((member) => member.id === form.memberId) ?? null

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      const member = row.members?.[0]
      const matchesSearch =
        !needle ||
        (member?.member_code ?? "").toLowerCase().includes(needle) ||
        (member?.name ?? "").toLowerCase().includes(needle) ||
        (row.package_name ?? "").toLowerCase().includes(needle)
      const matchesStatus =
        statusFilter === "ALL" || (row.status ?? "pending").toLowerCase() === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [rows, search, statusFilter])

  const stats = useMemo(() => {
    const pending = rows.filter((row) => (row.status ?? "pending").toLowerCase() !== "paid")
    const paidToday = rows.filter(
      (row) => (row.status ?? "").toLowerCase() === "paid" && isToday(row.paid_at)
    )
    const sessionsSold = rows
      .filter((row) => row.credit_applied_at)
      .reduce((sum, row) => sum + (row.sessions_purchased ?? 0), 0)
    return { pending: pending.length, paidToday: paidToday.length, sessionsSold }
  }, [rows])

  async function recordPayment(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const amount = Number(form.amount)
    const sessions = Number(form.sessionsPurchased)
    if (!form.memberId) return setError("Select a member.")
    if (!form.packageName.trim()) return setError("Enter a package name.")
    if (!Number.isFinite(amount) || amount < 0) return setError("Enter a valid amount.")
    if (!Number.isInteger(sessions) || sessions < 0) return setError("Sessions purchased must be a whole number.")

    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc("staff_record_payment", {
      p_member_id: form.memberId,
      p_package_name: form.packageName.trim(),
      p_stage: form.stage.trim() || "Package purchase",
      p_amount: amount,
      p_sessions_purchased: sessions,
      p_payment_type: form.paymentType.trim() || null,
      p_status: form.status,
    })
    setSaving(false)

    if (rpcError) return setError(rpcError.message)

    const credited = form.status === "paid"
    setSuccess(
      credited
        ? `Payment recorded as PAID. ${sessions} session${sessions === 1 ? "" : "s"} credited immediately.`
        : `Pending payment recorded. ${sessions} session${sessions === 1 ? "" : "s"} will be credited only after Mark as Paid.`
    )
    setForm(initialForm)
    await fetchData()
    return data
  }

  async function markAsPaid(payment: PaymentRow) {
    setError(null)
    setSuccess(null)
    setMarking((current) => ({ ...current, [payment.id]: true }))

    const { error: rpcError } = await supabase.rpc("staff_mark_payment_paid", {
      p_payment_id: payment.id,
    })

    setMarking((current) => ({ ...current, [payment.id]: false }))
    if (rpcError) return setError(rpcError.message)

    setSuccess(
      `Payment marked PAID. ${payment.sessions_purchased} purchased session${payment.sessions_purchased === 1 ? "" : "s"} credited exactly once.`
    )
    await fetchData()
  }

  return (
    <main className="min-h-screen bg-[#020b1c] px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-orange-300">BearFit Staff</p>
            <h1 className="text-3xl font-extrabold">Payments & Packages</h1>
            <p className="mt-1 text-sm text-white/55">Signed in as {role}. Sessions are credited only when payment is PAID.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/checkin" className="rounded-full bg-[#25324a] px-5 py-3 text-sm font-semibold">Check-in</Link>
            <Link href="/member/dashboard" className="rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-semibold">Member Dashboard</Link>
          </div>
        </header>

        {error && <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
        {success && <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{success}</div>}

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard title="Pending Payments" value={stats.pending} />
          <StatCard title="Paid Today" value={stats.paidToday} />
          <StatCard title="Sessions Credited" value={stats.sessionsSold} />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
          <form onSubmit={recordPayment} className="rounded-[28px] border border-white/10 bg-[#141414] p-5">
            <h2 className="text-xl font-bold">Record Payment</h2>
            <p className="mt-1 text-sm text-white/50">Create it as pending, or mark it paid immediately.</p>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-white/55">Member</label>
            <select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className="mt-2 w-full rounded-2xl border border-white/15 bg-[#202020] px-4 py-3">
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.member_code} — {member.full_name}</option>
              ))}
            </select>

            {selectedMember && (
              <div className="mt-3 rounded-2xl bg-white/5 p-3 text-sm text-white/65">
                Current: {selectedMember.package_name} · {selectedMember.sessions_left} remaining / {selectedMember.total_sessions} total
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Field label="Package name" value={form.packageName} onChange={(value) => setForm({ ...form, packageName: value })} placeholder="Full 48 Package+" />
              <Field label="Payment stage" value={form.stage} onChange={(value) => setForm({ ...form, stage: value })} placeholder="Package purchase" />
              <Field label="Amount (PHP)" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} placeholder="48600" inputMode="decimal" />
              <Field label="Sessions purchased" value={form.sessionsPurchased} onChange={(value) => setForm({ ...form, sessionsPurchased: value })} placeholder="48" inputMode="numeric" />
              <Field label="Payment method" value={form.paymentType} onChange={(value) => setForm({ ...form, paymentType: value })} placeholder="GCash" />
            </div>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-white/55">Initial status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "pending" | "paid" })} className="mt-2 w-full rounded-2xl border border-white/15 bg-[#202020] px-4 py-3">
              <option value="pending">Pending — no sessions yet</option>
              <option value="paid">Paid — credit sessions now</option>
            </select>

            <button disabled={saving} className="mt-5 w-full rounded-2xl bg-[#ff7a1a] px-5 py-3 font-bold disabled:opacity-50">
              {saving ? "Saving…" : "Record Payment"}
            </button>
          </form>

          <div className="rounded-[28px] border border-white/10 bg-[#141414] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold">Payment Records</h2>
                <p className="text-sm text-white/50">Marking pending payments as paid applies purchased sessions exactly once.</p>
              </div>
              <div className="flex gap-2">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Member / package" className="rounded-2xl border border-white/15 bg-[#202020] px-4 py-2 text-sm" />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-white/15 bg-[#202020] px-4 py-2 text-sm">
                  <option value="ALL">All</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase text-white/45">
                  <tr><th className="py-3">Member</th><th>Package</th><th>Sessions purchased</th><th>Amount</th><th>Status</th><th className="text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr><td colSpan={6} className="py-8 text-center text-white/50">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-white/50">No payment records yet.</td></tr>
                  ) : filtered.map((row) => {
                    const member = row.members?.[0]
                    const paid = (row.status ?? "pending").toLowerCase() === "paid"
                    return (
                      <tr key={row.id}>
                        <td className="py-4"><div className="font-semibold">{member?.name ?? "—"}</div><div className="text-xs text-white/45">{member?.member_code ?? "—"}</div></td>
                        <td>{row.package_name ?? "—"}</td>
                        <td>{row.sessions_purchased}</td>
                        <td>{peso(row.amount)}</td>
                        <td><span className={`rounded-full px-3 py-1 text-xs font-semibold ${paid ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{paid ? "Paid" : "Pending"}</span></td>
                        <td className="text-right">
                          <button disabled={paid || marking[row.id]} onClick={() => void markAsPaid(row)} className="rounded-xl bg-[#ff7a1a] px-3 py-2 text-xs font-bold disabled:bg-white/10 disabled:text-white/35">
                            {paid ? "Credited" : marking[row.id] ? "Saving…" : "Mark as Paid"}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function Field({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return <label className="block"><span className="text-xs font-semibold uppercase tracking-wider text-white/55">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} className="mt-2 w-full rounded-2xl border border-white/15 bg-[#202020] px-4 py-3" /></label>
}

function StatCard({ title, value }: { title: string; value: number }) {
  return <div className="rounded-3xl border border-white/10 bg-[#141414] p-5"><p className="text-sm text-white/50">{title}</p><p className="mt-2 text-3xl font-extrabold">{value}</p></div>
}
