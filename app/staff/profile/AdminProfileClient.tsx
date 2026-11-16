"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { createClient as createTemporaryAuthClient } from "@supabase/supabase-js"
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck, UserRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Props = {
  expectedUserId: string
  authEmail: string
  loginHandle: string
  fullName: string
  branch: string
  usesUsername: boolean
}

export default function AdminProfileClient({
  expectedUserId, authEmail, loginHandle, fullName, branch, usesUsername,
}: Props) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [changed, setChanged] = useState(false)
  const [error, setError] = useState("")

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || changed) return
    setError("")

    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("Your new password must be 12–128 characters long.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.")
      return
    }
    if (newPassword === currentPassword) {
      setError("Choose a new password that differs from your current password.")
      return
    }

    setLoading(true)
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!url || !publicKey || !authEmail) throw new Error("Password security service is unavailable.")

      // Verify the current password using a separate non-persistent session.
      // Never call signInWithPassword on the portal's existing session:
      // that could replace the current logged-in account.
      const verification = createTemporaryAuthClient(url, publicKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
      const { data: reauthenticated, error: verifyError } = await verification.auth.signInWithPassword({
        email: authEmail,
        password: currentPassword,
      })
      if (verifyError || !reauthenticated.user || !reauthenticated.session ||
          reauthenticated.user.id !== expectedUserId) {
        throw new Error("Current password could not be verified.")
      }

      // The newly authenticated short-lived session is used to update ONLY
      // this account's password in Supabase Auth (never the profiles table).
      const { error: changeError } = await verification.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      })
      if (changeError) throw new Error(changeError.message)

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setChanged(true)

      // End the prior portal session on this device after an admin password
      // rotation. Other administrators and all gym records are unaffected.
      const portal = createClient()
      await portal.auth.signOut({ scope: "local" })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change password.")
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "mt-1.5 w-full rounded-xl border border-white/15 bg-[#202a3b] px-4 py-3 text-sm text-white outline-none transition focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]"

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-28 md:px-6 lg:px-8 lg:py-8 lg:pb-10">
      <header className="border-b border-white/10 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">BearFit · Admin Operations</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">My Profile</h1>
        <p className="mt-2 text-sm text-white/55">View your administrator account and manage your sign-in password.</p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-[#141c2b] p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-400/30 bg-[#27354a] text-orange-300">
            <UserRound size={30} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-xl font-black">{fullName}</h2>
            <p className="mt-1 break-all text-sm text-white/60">{loginHandle}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-bold text-orange-200">
            <ShieldCheck size={15} /> Administrator
          </span>
        </div>
        <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
          <div><p className="text-xs text-white/45">Display name</p><p className="mt-1 break-words text-sm font-semibold">{fullName}</p></div>
          <div><p className="text-xs text-white/45">Login {usesUsername ? "username" : "email"}</p><p className="mt-1 break-all text-sm font-semibold">{loginHandle}</p></div>
          <div><p className="text-xs text-white/45">Branch</p><p className="mt-1 text-sm font-semibold">{branch}</p></div>
        </div>
        {usesUsername && <p className="mt-4 text-xs text-white/45">This username uses an internal login alias; it is not a receiving email inbox.</p>}
      </section>

      <section className="max-w-3xl rounded-3xl border border-white/10 bg-[#141c2b] p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-lg font-black"><KeyRound size={21} className="text-[#ff7a1a]" /> Change Password</h2>
        <p className="mt-2 text-sm leading-6 text-white/55">For security, enter your current password before choosing a new one. Only your own administrator login will be changed.</p>
        {changed ? (
          <div role="status" className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="flex items-center gap-2 font-bold text-emerald-200"><CheckCircle2 size={19} /> Password changed</p>
            <p className="mt-2 text-sm text-white/75">Your new password is saved. Sign in again to continue using BearFit Admin.</p>
            <Link href="/login" className="mt-4 inline-flex rounded-xl bg-[#ff7a1a] px-5 py-3 text-sm font-black text-black">Go to sign in</Link>
          </div>
        ) : (
          <form onSubmit={changePassword} className="mt-5 space-y-4">
            <label className="block text-xs font-semibold text-white/70">
              Current password
              <input type={showPasswords ? "text" : "password"} name="currentPassword" autoComplete="current-password"
                minLength={1} required disabled={loading} value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}
                className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-white/70">
              New password
              <input type={showPasswords ? "text" : "password"} name="newPassword" autoComplete="new-password"
                minLength={12} maxLength={128} required disabled={loading} value={newPassword} onChange={event=>setNewPassword(event.target.value)}
                className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-white/70">
              Confirm new password
              <input type={showPasswords ? "text" : "password"} name="confirmPassword" autoComplete="new-password"
                minLength={12} maxLength={128} required disabled={loading} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)}
                className={inputClass} />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/65">
              <input type="checkbox" checked={showPasswords} onChange={event=>setShowPasswords(event.target.checked)} disabled={loading} className="accent-[#ff7a1a]" />
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </label>
            <p className="text-xs text-white/45">Use at least 12 characters. A unique password generated by a password manager is recommended.</p>
            {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-[#ff7a1a] px-5 py-3 font-bold text-black transition hover:bg-[#ff9345] disabled:cursor-wait disabled:opacity-60 sm:w-auto">
              {loading ? "Verifying and saving..." : "Save new password"}
            </button>
          </form>
        )}
      </section>
      <p className="flex items-center gap-2 text-xs text-white/40"><ShieldCheck size={15} /> Password changes never affect client packages, coach data, payments, or payroll.</p>
    </div>
  )
}
