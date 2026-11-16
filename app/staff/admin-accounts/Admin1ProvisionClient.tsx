"use client"

import Link from "next/link"
import { useState } from "react"

type Credentials = { username: string; temporaryPassword: string; message: string }

export default function Admin1ProvisionClient() {
  const [loading, setLoading] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  async function createAdmin1() {
    if (loading || credentials) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/admin1/provision", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Admin1 could not be created.")
      if (result.username !== "admin1" || !result.temporaryPassword) {
        throw new Error("Account creation was not confirmed. Check with Admin before retrying.")
      }
      setCredentials(result as Credentials)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin1 could not be created.")
    } finally {
      setLoading(false)
    }
  }

  async function copyCredentials() {
    if (!credentials) return
    try {
      await navigator.clipboard.writeText(
        "Username: " + credentials.username + "\nTemporary password: " + credentials.temporaryPassword
      )
      setCopied(true)
    } catch {
      setError("Copy was unavailable. Select and save the credentials below.")
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-white">
      <Link href="/staff/home" className="text-sm text-orange-300 hover:underline">← Back to Admin Home</Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-orange-400">BearFit · Admin Accounts</p>
        <h1 className="mt-2 text-3xl font-black">Create Admin1 login</h1>
        <p className="mt-2 text-sm text-white/70">
          This creates a separate administrator account named <strong>admin1</strong>.
          The original admin, coaches, member sessions, payments and payroll remain unchanged.
        </p>
      </div>

      <section className="rounded-2xl border border-white/15 bg-[#181818] p-6 space-y-5">
        <div className="space-y-2 text-sm">
          <p><span className="text-white/60">Username:</span> <strong>admin1</strong></p>
          <p><span className="text-white/60">Access:</span> <strong>BearFit Administrator</strong></p>
          <p><span className="text-white/60">Password:</span> Secure temporary password generated at account creation</p>
        </div>
        {!credentials ? (
          <button
            type="button"
            onClick={createAdmin1}
            disabled={loading}
            className="w-full rounded-xl bg-[#F37120] px-5 py-3 font-bold text-black disabled:opacity-60"
          >
            {loading ? "Creating admin account..." : "Create Admin1 account"}
          </button>
        ) : (
          <div role="status" className="space-y-4 rounded-xl border border-green-500/30 p-4">
            <h2 className="text-lg font-bold text-green-300">Admin1 created successfully</h2>
            <p className="text-xs text-amber-200">Save these credentials now. They will not appear again after leaving this page.</p>
            <div>
              <p className="mb-1 text-xs text-white/60">Username</p>
              <code className="select-all break-all text-sm">{credentials.username}</code>
            </div>
            <div>
              <p className="mb-1 text-xs text-white/60">Temporary password</p>
              <code className="select-all break-all text-sm">{credentials.temporaryPassword}</code>
            </div>
            <button type="button" onClick={copyCredentials}
              className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold">
              {copied ? "Copied" : "Copy username and password"}
            </button>
            <div><Link className="text-sm text-orange-300 underline" href="/login">Open BearFit login</Link></div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      </section>
    </main>
  )
}
