"use client"

import { useState, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client"
import { LockKeyhole, LogOut, ShieldCheck, UserRound, CalendarDays } from "lucide-react"

type Coach = { id: string; display_name: string; branch: string; username: string | null; is_active: boolean }

export default function CoachHomeClient({ coach }: { coach: Coach | null }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(""); setMessage("")
    if (password.length < 12 || password.length > 128) return setError("Enter a new password of at least 12 characters.")
    if (password !== confirm) return setError("New passwords do not match.")
    setBusy(true)
    const supabase = createClient()
    const { error: changeError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    setPassword(""); setConfirm("")
    if (changeError) setError(changeError.message)
    else setMessage("Password updated successfully. Keep it private.")
  }
  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }
  return <main className="min-h-screen bg-[#020b1c] px-4 py-8 text-white md:py-12">
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">BEARFIT / COACH PORTAL</p>
          <h1 className="mt-2 text-2xl font-black">Welcome{coach ? ", " + coach.display_name : ""}</h1>
          <p className="mt-1 text-sm text-white/55">{coach?.branch || "Account setup needed"}</p>
        </div>
        <button type="button" onClick={() => void signOut()} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10">
          <LogOut size={16} className="mr-2 inline"/>Sign out
        </button>
      </header>
      {coach ? <section className="rounded-[24px] border border-white/10 bg-[#141414] p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#ff7a1a]/15 p-3 text-[#ff9b54]"><UserRound size={22}/></div>
          <div><h2 className="text-lg font-bold">{coach.display_name}</h2><p className="text-xs text-white/55">Username: {coach.username}</p></div>
        </div>
        <p className="mt-4 flex items-start gap-2 text-sm text-white/60">
          <ShieldCheck size={18} className="shrink-0 text-emerald-300"/>
          Coach access is separate from Admin/Staff access. Your future clock-in/out, schedules, and conduction records will appear here once enabled.
        </p>
        {!coach.is_active && <p className="mt-3 text-sm text-amber-200">Your coach record is inactive. Contact Admin.</p>}
      </section> :
      <p role="alert" className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5 text-amber-200">
        Coach login is not yet linked to a coach identity. Ask Admin to check the Coach Directory.
      </p>}
      <section className="rounded-[24px] border border-white/10 bg-[#141414] p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><LockKeyhole size={18} className="text-[#ff7a1a]"/> Change password</h2>
        <p className="mt-2 text-sm text-white/50">When you receive your temporary password from Admin, sign in and replace it with a private password of your own.</p>
        <form onSubmit={(e) => void changePassword(e)} className="mt-4 space-y-3">
          <label className="block space-y-1 text-xs text-white/55">New password
            <input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-xl border border-white/10 bg-[#1b2434] px-4 py-3 text-sm text-white"/>
          </label>
          <label className="block space-y-1 text-xs text-white/55">Confirm new password
            <input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="block w-full rounded-xl border border-white/10 bg-[#1b2434] px-4 py-3 text-sm text-white"/>
          </label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
          <button disabled={busy} className="rounded-xl bg-[#ff7a1a] px-5 py-3 text-sm font-bold disabled:opacity-40">{busy ? "Saving…" : "Update password"}</button>
        </form>
      </section>
      <div className="flex items-center gap-2 text-xs text-white/40">
        <CalendarDays size={14}/> Attendance and payroll tools are not active yet.
      </div>
    </div>
  </main>
}
