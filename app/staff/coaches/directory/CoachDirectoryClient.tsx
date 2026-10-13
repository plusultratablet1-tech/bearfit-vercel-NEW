"use client"
import {BRANCH_IDS} from "@/lib/branches"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { ArrowLeft, CheckCircle2, CircleAlert, UserRoundPlus, Wallet, Link2, RefreshCw } from "lucide-react"
import StaffAppShell from "@/components/bearfit/StaffAppShell"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()
type Coach = {
  id: string; display_name: string; branch: string; username: string | null; user_id: string | null; is_active: boolean; is_demo: boolean
}
type Rate = {
  id: string; coach_id: string; per_conduction_rate: number; effective_from: string
}
type StaffProfile = { id: string; full_name: string; branch: string }
const branches = BRANCH_IDS

function manilaDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date())
  const part = (name: string) => parts.find((p) => p.type === name)?.value || ""
  return part("year") + "-" + part("month") + "-" + part("day")
}
function peso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value)
}

export default function CoachDirectoryClient() {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [rates, setRates] = useState<Rate[]>([])
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newBranch, setNewBranch] = useState<string>(branches[0])
  const [rateDraft, setRateDraft] = useState<Record<string, string>>({})
  const [dateDraft, setDateDraft] = useState<Record<string, string>>({})
  const [branchDraft, setBranchDraft] = useState<Record<string, string>>({})
  const [userDraft, setUserDraft] = useState<Record<string, string>>({})
  const [credentials, setCredentials] = useState<{ coach: string; username: string; temporaryPassword: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [c, r, p] = await Promise.all([
      supabase.from("coaches").select("id,display_name,branch,username,user_id,is_active,is_demo").order("display_name"),
      supabase.from("coach_rate_history").select("id,coach_id,per_conduction_rate,effective_from")
        .order("effective_from", { ascending: false }),
      supabase.from("profiles").select("id,full_name,branch").in("role", ["staff", "coach"]).order("full_name"),
    ])
    const failure = [c, r, p].filter((result) => result.error).map((result) => result.error?.message).join(" · ")
    if (failure) setError(failure)
    setCoaches((c.data || []) as Coach[])
    setRates((r.data || []) as Rate[])
    setStaff((p.data || []) as StaffProfile[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])
  const today = manilaDate()
  const summary = useMemo(() => {
    const withRates = new Set(rates.filter((rate) => rate.effective_from <= today).map((rate) => rate.coach_id))
    return {
      total: coaches.length,
      linked: coaches.filter((coach) => coach.user_id).length,
      rated: coaches.filter((coach) => withRates.has(coach.id)).length,
    }
  }, [coaches, rates, today])

  async function addCoach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newName.trim().length < 2 || !newBranch.trim()) return setError("Enter a coach name and branch.")
    setBusy("add"); setNotice(null); setError(null)
    const { error: err } = await supabase.from("coaches")
      .insert({ display_name: newName.trim(), branch: newBranch.trim(), user_id: null })
    setBusy(null)
    if (err) return setError(err.message)
    setNewName("")
    setNotice("Coach created. Rate and account remain unassigned until verified.")
    await load()
  }

  async function saveRate(coach: Coach) {
    if (coach.is_demo) return setError("Demo coaches cannot receive payroll rates.")
    const value = (rateDraft[coach.id] || "").trim()
    const date = dateDraft[coach.id] || today
    const num = Number(value)
    if (!value || !/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(num) || num <= 0 || num > 1000000) {
      return setError("Enter a positive rate (maximum two decimal places).")
    }
    if (date < today) return setError("A new rate cannot be backdated.")
    if (!window.confirm("Add " + peso(num) + " per member conduction for " + coach.display_name + " effective " + date + "? This rate history entry cannot be overwritten.")) return
    setBusy(coach.id + ":rate"); setError(null); setNotice(null)
    const { error: err } = await supabase.rpc("admin_set_coach_rate", {
      p_coach_id: coach.id, p_rate: num, p_effective_from: date,
    })
    setBusy(null)
    if (err) return setError(err.message)
    setRateDraft((old) => ({ ...old, [coach.id]: "" }))
    setNotice("New dated rate saved for " + coach.display_name + ". No payroll was generated.")
    await load()
  }

  async function saveBranch(coach: Coach) {
    const nextBranch = (branchDraft[coach.id] ?? coach.branch).trim()
    if (!nextBranch) return setError("Enter a branch.")
    setBusy(coach.id + ":branch"); setError(null); setNotice(null)
    const { error: err } = await supabase.from("coaches").update({ branch: nextBranch }).eq("id", coach.id)
    setBusy(null)
    if (err) return setError(err.message)
    setNotice("Coach branch updated; member assignments were not changed.")
    await load()
  }

  async function setActive(coach: Coach) {
    if (coach.is_demo) return setError("Demo coaches cannot be activated. Create a verified real coach instead.")
    if (!window.confirm((coach.is_active ? "Mark " + coach.display_name + " inactive?" : "Reactivate " + coach.display_name + "?") + " This will not rewrite past session records.")) return
    setBusy(coach.id + ":active"); setError(null); setNotice(null)
    const { error: err } = await supabase.from("coaches").update({ is_active: !coach.is_active }).eq("id", coach.id)
    setBusy(null)
    if (err) return setError(err.message)
    setNotice("Coach status updated.")
    await load()
  }

  async function linkAccount(coach: Coach) {
    if (coach.is_demo) return setError("Demo coaches cannot be linked to real accounts.")
    const selected = userDraft[coach.id] ?? coach.user_id ?? ""
    const account = staff.find((person) => person.id === selected)
    if (!window.confirm(selected
      ? "Link " + coach.display_name + " to the verified staff account of " + (account?.full_name || selected) + "?"
      : "Unlink the staff account from " + coach.display_name + "?")) return
    setBusy(coach.id + ":link"); setError(null); setNotice(null)
    const { error: err } = await supabase.rpc("admin_link_coach_account", {
      p_coach_id: coach.id, p_user_id: selected || null,
    })
    setBusy(null)
    if (err) return setError(err.message)
    setNotice("Account link updated after admin confirmation.")
    await load()
  }

  async function provisionLogin(coach: Coach, action: "create" | "reset") {
    if (!coach.username) return setError("Coach username must be assigned first.")
    const label = action === "create" ? "Create" : "Reset password for"
    if (!window.confirm(label + " " + coach.username + " (" + coach.display_name + ")? A new secure temporary password will be shown only once.")) return
    setError(null); setNotice(null); setCredentials(null); setBusy(coach.id + ":login")
    try {
      const response = await fetch("/api/admin/coaches/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ coachId: coach.id, action }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to provision coach login")
      setCredentials({
        coach: coach.display_name,
        username: result.username,
        temporaryPassword: result.temporaryPassword,
      })
      setNotice("Coach login updated. Copy and privately share the temporary password before closing this message.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to provision coach login")
    } finally {
      setBusy(null)
    }
  }

  return <StaffAppShell activePath="/staff/coaches" role="admin">
    <div className="mx-auto max-w-7xl px-4 py-6 pb-28 md:px-6 lg:px-8 lg:pb-8">
      <Link href="/staff/coaches" className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white">
        <ArrowLeft size={16} /> Coaches overview
      </Link>
      <header className="mt-4 border-b border-white/10 pb-5">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">Admin / Coach setup</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black md:text-3xl">Coach Directory &amp; Rates</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/50">
              Maintain coach identities, branches, verified staff account links and individual per-member-conduction rates.
            </p>
          </div>
          <button onClick={() => void load()} type="button" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/5"><RefreshCw size={16} /> Refresh</button>
        </div>
      </header>
      <p className="mt-4 rounded-2xl border border-orange-400/20 bg-orange-400/5 p-4 text-sm text-orange-200">
        Phase 1 setup only: rate entries are effective-dated but do not create payable sessions or payroll. An unlinked coach account cannot be used for automatic conduction attribution.
      </p>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200"><CheckCircle2 size={18}/>{notice}</p>}
      {credentials && (
        <section className="mt-4 rounded-2xl border border-amber-400/40 bg-[#392710] p-4">
          <h2 className="font-bold text-amber-100">New coach login — copy now</h2>
          <p className="mt-1 text-xs text-amber-100/80">This temporary password will disappear when this message closes or the page reloads. Share it privately, not in a public chat or screenshot.</p>
          <p className="mt-3 text-sm text-white/70">{credentials.coach}</p>
          <p className="mt-1 text-sm"><strong>Username:</strong> <span className="select-all font-mono">{credentials.username}</span></p>
          <p className="mt-1 break-all text-sm"><strong>Temporary password:</strong> <span className="select-all font-mono">{credentials.temporaryPassword}</span></p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void navigator.clipboard.writeText("Username: " + credentials.username + "\nTemporary password: " + credentials.temporaryPassword)}
              className="rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold">Copy credentials</button>
            <button type="button" onClick={() => setCredentials(null)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold">Close and clear</button>
          </div>
        </section>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Coach identities" value={summary.total} />
        <Stat label="Linked accounts" value={summary.linked} />
        <Stat label="Rates effective today" value={summary.rated} />
      </div>

      <section className="mt-6 rounded-[24px] border border-white/10 bg-[#101725] p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><UserRoundPlus size={18} className="text-orange-400" /> Add a coach</h2>
        <form onSubmit={(e) => void addCoach(e)} className="mt-4 grid gap-3 md:grid-cols-[2fr_1.5fr_auto]">
          <label className="space-y-1"><span className="text-xs text-white/55">Coach name</span><input required minLength={2} maxLength={120} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Coach full name" className="w-full rounded-xl border border-white/10 bg-[#1b2434] px-4 py-3 text-sm"/></label>
          <label className="space-y-1"><span className="text-xs text-white/55">Branch</span><select value={newBranch} onChange={(e) => setNewBranch(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#1b2434] px-4 py-3 text-sm">{branches.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
          <button disabled={busy !== null} className="self-end rounded-xl bg-[#ff7a1a] px-5 py-3 text-sm font-bold disabled:opacity-40">Add coach</button>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="mb-4 text-lg font-bold">Coach records</h2>
        {loading ? <p className="rounded-xl bg-white/5 p-6 text-white/50">Loading coach records…</p> :
        coaches.length === 0 ? <p className="rounded-xl bg-white/5 p-6 text-white/50">No coaches yet. Add your first coach above.</p> :
        <div className="grid gap-4">
          {coaches.map((coach) => {
            const history = rates.filter((r) => r.coach_id === coach.id)
            const current = history.find((r) => r.effective_from <= today)
            const upcoming = history.filter((r) => r.effective_from > today).sort((a,b) => a.effective_from.localeCompare(b.effective_from))
            const linked = staff.find((p) => p.id === coach.user_id)
            const usableStaff = staff.filter((p) => !coaches.some((c) => c.id !== coach.id && c.user_id === p.id))
            return <article key={coach.id} className="rounded-[24px] border border-white/10 bg-[#141414] p-4 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">{coach.display_name} {coach.is_demo && <span className="ml-2 rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-300">Demo coach</span>}</h3>
                  <p className="mt-1 text-sm text-white/45">{coach.branch} · Username: {coach.username || "Not assigned"} · {coach.user_id ? "Login active" : "Login not provisioned"}</p>
                </div>
                <button type="button" disabled={busy !== null} onClick={() => void setActive(coach)}
                  className={coach.is_active ? "rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300" : "rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/60"}>
                  {coach.is_active ? "Active · change" : "Inactive · change"}
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-[#ff7a1a]/25 bg-[#ff7a1a]/5 p-4">
                <p className="text-sm font-bold">Simple coach login</p>
                <p className="mt-1 text-sm text-white/65">Username: <strong className="text-[#ff9b54]">{coach.username || "Not assigned"}</strong></p>
                <p className="mt-1 text-xs text-white/50">A unique temporary password is generated on the server. No predictable or shared passwords.</p>
                {coach.username && <button type="button" disabled={busy !== null} onClick={() => void provisionLogin(coach,coach.user_id ? "reset" : "create")}
                  className="mt-3 rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold disabled:opacity-40">
                  {busy === coach.id + ":login" ? "Working…" : coach.user_id ? "Reset coach password" : "Create coach login"}
                </button>}
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#101725] p-4">
                  <p className="flex items-center gap-2 text-sm font-bold"><Wallet size={16} className="text-[#ff7a1a]"/> Individual rate</p>
                  <p className="mt-3 text-2xl font-black">{current ? peso(Number(current.per_conduction_rate)) : "Not set"}</p>
                  <p className="mt-1 text-xs text-white/45">{current ? "Current rate since " + current.effective_from : "No rate effective today"}</p>
                  {upcoming.length > 0 && <p className="mt-2 text-xs text-orange-300">{upcoming.length} future rate change(s) scheduled</p>}
                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <label className="space-y-1"><span className="text-xs text-white/55">New rate ₱</span><input aria-label={"New rate for " + coach.display_name} type="number" min="0.01" max="1000000" step=".01" placeholder="Not set" value={rateDraft[coach.id] ?? ""} onChange={(e) => setRateDraft((old) => ({ ...old, [coach.id]: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#1b2434] px-3 py-2.5 text-sm"/></label>
                    <label className="space-y-1"><span className="text-xs text-white/55">Effective on</span><input aria-label={"Rate start date for " + coach.display_name} type="date" min={today} value={dateDraft[coach.id] ?? today} onChange={(e) => setDateDraft((old) => ({ ...old, [coach.id]: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#1b2434] px-3 py-2.5 text-sm"/></label>
                    <button type="button" disabled={busy !== null} onClick={() => void saveRate(coach)} className="self-end rounded-xl bg-[#ff7a1a] px-3 py-2.5 text-xs font-bold disabled:opacity-40">Save rate</button>
                  </div>
                  {history.length > 0 && <div className="mt-4 border-t border-white/10 pt-3 text-xs text-white/50">
                    <p className="font-bold text-white/65">Rate history (append-only)</p>
                    {history.slice(0, 5).map((r) => <p key={r.id} className="mt-1">{r.effective_from} · {peso(Number(r.per_conduction_rate))}</p>)}
                  </div>}
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-[#101725] p-4">
                    <p className="text-sm font-bold">Assigned branch</p>
                    <div className="mt-3 flex gap-2">
                      <select aria-label={"Branch for " + coach.display_name} value={branchDraft[coach.id] ?? coach.branch}
                        onChange={(e) => setBranchDraft((old) => ({ ...old, [coach.id]: e.target.value }))}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1b2434] px-3 py-2.5 text-sm">
                        {[...new Set([...branches, coach.branch])].map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <button type="button" disabled={busy !== null || (branchDraft[coach.id] ?? coach.branch) === coach.branch} onClick={() => void saveBranch(coach)}
                        className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold disabled:opacity-30">Save</button>
                    </div>
                    <p className="mt-2 text-xs text-white/45">Changing the coach branch does not move member records or bookings.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#101725] p-4">
                    <p className="flex items-center gap-2 text-sm font-bold"><Link2 size={16} className="text-[#ff7a1a]"/> Linked coach/staff account</p>
                    <p className="mt-1 text-xs text-white/50">{coach.user_id ? linked?.full_name || "Linked ID (profile unavailable)" : "No login linked"}</p>
                    <div className="mt-3 flex gap-2">
                      <select aria-label={"Staff account for " + coach.display_name} value={userDraft[coach.id] ?? coach.user_id ?? ""}
                        onChange={(e) => setUserDraft((old) => ({ ...old, [coach.id]: e.target.value }))}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1b2434] px-3 py-2.5 text-sm">
                        <option value="">No linked account</option>
                        {usableStaff.map((person) => <option key={person.id} value={person.id}>{person.full_name} · {person.branch}</option>)}
                      </select>
                      <button type="button" disabled={busy !== null || (userDraft[coach.id] ?? coach.user_id ?? "") === (coach.user_id ?? "")}
                        onClick={() => void linkAccount(coach)} className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold disabled:opacity-30">Link</button>
                    </div>
                    {staff.length === 0 && <p className="mt-2 flex items-center gap-2 text-xs text-amber-200"><CircleAlert size={14}/> No accounts available yet. Provision a coach username above.</p>}
                  </div>
                </div>
              </div>
            </article>
          })}
        </div>}
      </section>
    </div>
  </StaffAppShell>
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
    <p className="text-xs font-semibold text-white/50">{label}</p>
    <p className="mt-2 text-2xl font-black">{value}</p>
  </div>
}
