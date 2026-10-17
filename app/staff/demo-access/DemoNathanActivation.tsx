"use client"

import Link from "next/link"
import { useState } from "react"

type Credentials = { email: string; temporaryPassword: string; role: string; memberId: string; warning?: string }

export default function DemoNathanActivation() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const activate = async () => {
    if (!window.confirm("Create a MEMBER-only demo login for Nathan? This is not an Admin account and grants no purchased sessions.")) return
    setBusy(true)
    setError(null)
    setCredentials(null)
    try {
      const response = await fetch("/api/admin/demo-member/provision", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: "{}",
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to create demo login")
      setCredentials(result as Credentials)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create demo login")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28 text-white md:px-6">
      <Link href="/staff/home" className="text-sm font-semibold text-orange-300">← Admin home</Link>
      <p className="mt-8 text-xs font-bold uppercase tracking-widest text-orange-300">BearFit / Test Accounts</p>
      <h1 className="mt-2 text-3xl font-black">Nathan — Member demo login</h1>
      <p className="mt-3 text-sm leading-6 text-white/60">
        Provision the pre-existing inactive demo member DEMO-NATHAN-001.
        This does not grant Admin access, active membership, paid package credits,
        bookings, payments, guest privileges, or payroll activity.
      </p>
      <section className="mt-6 rounded-2xl border border-white/15 bg-[#101725] p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-white/50">Member</dt><dd className="font-bold">[DEMO] Nathan</dd></div>
          <div><dt className="text-white/50">Role</dt><dd className="font-bold">Member only</dd></div>
          <div><dt className="text-white/50">Branch</dt><dd className="font-bold">Malingap</dd></div>
          <div><dt className="text-white/50">Sample sessions</dt><dd className="font-bold">24 / 24 (not purchased credits)</dd></div>
        </dl>
        <button type="button" onClick={() => void activate()} disabled={busy || credentials !== null}
          className="mt-6 rounded-xl bg-[#ff7a1a] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "Creating secure login…" : credentials ? "Demo login provisioned" : "Activate Nathan Member login"}
        </button>
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      </section>
      {credentials && <section className="mt-5 rounded-2xl border border-amber-400/40 bg-[#392710] p-5">
        <h2 className="text-lg font-bold text-amber-100">Copy credentials — shown only once</h2>
        <p className="mt-2 text-xs text-amber-100/80">
          The password is not stored in GitHub, local storage, or application logs. It disappears on reload.
          Change it after first sign-in and do not share it publicly.
        </p>
        <p className="mt-4 break-all font-mono text-sm">Email: {credentials.email}</p>
        <p className="mt-2 break-all font-mono text-sm">Temporary password: {credentials.temporaryPassword}</p>
        {credentials.warning && <p className="mt-3 text-sm text-amber-200">{credentials.warning}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold"
            onClick={() => void navigator.clipboard.writeText("Email: " + credentials.email + "\nTemporary password: " + credentials.temporaryPassword)}>
            Copy credentials
          </button>
          <button type="button" className="rounded-xl border border-white/25 px-4 py-2.5 text-sm"
            onClick={() => setCredentials(null)}>Clear password from page</button>
          <Link href="/login" className="rounded-xl border border-white/25 px-4 py-2.5 text-sm">Open login</Link>
        </div>
      </section>}
    </main>
  )
}
