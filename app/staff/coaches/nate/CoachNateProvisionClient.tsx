"use client"

import Link from "next/link"
import { useState } from "react"
import { CheckCircle2, Copy, ShieldCheck, UserRoundPlus } from "lucide-react"

type Created={username:string;temporaryPassword:string;adminLogin:string;branches:string[];message:string}

export default function CoachNateProvisionClient() {
  const [loading,setLoading]=useState(false)
  const [created,setCreated]=useState<Created|null>(null)
  const [error,setError]=useState("")
  const [copied,setCopied]=useState(false)

  async function provision() {
    if(loading||created)return
    setLoading(true);setError("")
    try {
      const res=await fetch("/api/admin/coaches/nate/provision",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"create"}),
      })
      const body=await res.json()
      if(!res.ok)throw new Error(body.error||"Unable to create CoachNate")
      if(body.username!=="CoachNate"||!body.temporaryPassword||body.branches?.length!==3) {
        throw new Error("Creation was not confirmed. Check the coach directory before retrying.")
      }
      setCreated(body as Created)
    } catch(ex) {setError(ex instanceof Error?ex.message:"Setup failed")}
    finally {setLoading(false)}
  }

  async function copy() {
    if(!created)return
    try {
      await navigator.clipboard.writeText(
        "Coach username: "+created.username+"\nTemporary password: "+created.temporaryPassword
      )
      setCopied(true)
    } catch {
      setError("Clipboard access unavailable. Select and save the credentials below.")
    }
  }

  return <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-28 md:px-6 lg:px-8">
    <Link href="/staff/coaches/directory" className="text-sm text-orange-300 hover:underline">← Coach Directory</Link>
    <header>
      <p className="text-xs font-bold uppercase tracking-[.16em] text-orange-300">BearFit · Admin-authorized account</p>
      <h1 className="mt-2 flex items-center gap-2 text-3xl font-black">
        <UserRoundPlus size={28} className="text-orange-400"/> Set up Coach Nate
      </h1>
      <p className="mt-3 text-sm text-white/60">
        Creates one separate Coach portal login with access to exactly three branches.
        The existing Admin account <strong>admin1</strong> remains independent and unchanged.
      </p>
    </header>
    <section className="space-y-4 rounded-3xl border border-white/10 bg-[#141c2b] p-5 md:p-7">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#222e40] p-4">
          <p className="text-xs text-white/50">Coach username</p>
          <p className="mt-2 text-xl font-black">CoachNate</p>
        </div>
        <div className="rounded-xl bg-[#222e40] p-4">
          <p className="text-xs text-white/50">Admin username (preserved)</p>
          <p className="mt-2 text-xl font-black">admin1</p>
        </div>
      </div>
      <p className="text-sm font-semibold">Coach branches</p>
      <ul className="space-y-2 text-sm text-white/80">
        <li>✓ Malingap</li>
        <li>✓ E. Rodriguez</li>
        <li>✓ Primark Cainta</li>
      </ul>
      <p className="text-xs leading-5 text-white/50">
        Malingap is the internal home branch, not a restriction on his assigned work.
        No clients, payments, payroll entries, or session histories are copied or invented.
      </p>
      {!created ? (
        <button type="button" disabled={loading} onClick={provision}
          className="w-full rounded-xl bg-orange-500 px-5 py-3 font-bold text-black disabled:opacity-50">
          {loading?"Creating coach login…":"Create CoachNate login"}
        </button>
      ) : (
        <div role="status" className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-400/5 p-5">
          <p className="flex items-center gap-2 font-bold text-emerald-300">
            <CheckCircle2 size={20}/> CoachNate created
          </p>
          <p className="text-xs text-amber-200">Save the temporary password now. It will not be displayed again after leaving this page.</p>
          <div><p className="mb-1 text-xs text-white/50">Coach username</p>
            <code className="select-all break-all text-base">{created.username}</code></div>
          <div><p className="mb-1 text-xs text-white/50">Temporary password</p>
            <code className="select-all break-all text-base">{created.temporaryPassword}</code></div>
          <button type="button" onClick={copy}
            className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm">
            <Copy size={16}/>{copied?"Copied":"Copy coach credentials"}
          </button>
          <Link href="/login" className="inline-flex text-sm font-bold text-orange-300 underline">Open Coach login</Link>
        </div>
      )}
      {error&&<p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">{error}</p>}
    </section>
    <p className="flex items-center gap-2 text-xs text-white/45">
      <ShieldCheck size={16}/> Only an existing signed-in BearFit Admin can create this account.
    </p>
  </div>
}
