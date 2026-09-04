"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { SESSION_TAXONOMY, categoryForSessionLabel, displaySessionLabel, labelForServiceFallback } from "@/lib/session-taxonomy"

const supabase = createClient()

type ConfirmedBooking = {
  id: string
  start_at: string
  end_at: string
  session_type: string
  session_label: string | null
  branch: string
  member_package_id: string | null
}

type PackageOption = {
  id: string
  package_name: string
  package_code: string
  service_category: string
  sessions_left: number
  sessions_total: number
  expires_at: string | null
  eligibility?: {
    warning_message?: string | null
    blocking_reason?: string | null
  }
}

type CheckinContext = {
  member: { id: string; member_code: string; name: string; branch: string }
  confirmed_bookings: ConfirmedBooking[]
  packages: PackageOption[]
}

export default function CheckInPageClient({ role }: { role: "staff" | "admin" }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busyRef = useRef(false)
  const [status, setStatus] = useState("Ready. Scan a QR code or look up a member code first.")
  const [notes, setNotes] = useState("Training session")
  const [manualCode, setManualCode] = useState("")
  const [lastCode, setLastCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [context, setContext] = useState<CheckinContext | null>(null)
  const [selectedBookingId, setSelectedBookingId] = useState("")
  const [selectedPackageId, setSelectedPackageId] = useState("")
  const [selectedSessionLabel, setSelectedSessionLabel] = useState("Strength Training")

  useEffect(() => () => stopCamera(), [])

  function normalizeMemberCode(raw: string) {
    const direct = raw.trim().match(/\bM\d{3,}\b/i)
    if (direct?.[0]) return direct[0].toUpperCase()
    try {
      const url = new URL(raw.trim())
      const member = url.searchParams.get("member") ?? ""
      const match = member.match(/\bM\d{3,}\b/i)
      return match?.[0]?.toUpperCase() ?? ""
    } catch {
      return ""
    }
  }

  function chooseDefaults(next: CheckinContext) {
    const booking = next.confirmed_bookings[0]
    if (booking) {
      setSelectedBookingId(booking.id)
      setSelectedPackageId(booking.member_package_id ?? "")
      setSelectedSessionLabel(booking.session_label ?? labelForServiceFallback(booking.session_type))
      return
    }
    setSelectedBookingId("")
    const onlyPackage = next.packages.length === 1 ? next.packages[0] : null
    setSelectedPackageId(onlyPackage?.id ?? "")
    const matchingLabel = SESSION_TAXONOMY.find((item) => item.category === onlyPackage?.service_category)?.label
    setSelectedSessionLabel(matchingLabel ?? "Strength Training")
  }

  async function lookupMember(rawCode: string) {
    if (busyRef.current) return
    const memberCode = normalizeMemberCode(rawCode)
    if (!memberCode) {
      setStatus("❌ Enter or scan a valid member code such as M0001.")
      return
    }

    busyRef.current = true
    setBusy(true)
    setLastCode(memberCode)
    setContext(null)
    setStatus(`Looking up ${memberCode}…`)

    const { data, error } = await supabase.rpc("staff_checkin_context", {
      p_member_code: memberCode,
    })

    if (error) {
      setStatus(`❌ ${error.message}`)
    } else {
      const next = data as CheckinContext
      setContext(next)
      chooseDefaults(next)
      setStatus(`✅ ${next.member.name} found. Confirm the booking or Package below before Check In.`)
      setManualCode(memberCode)
    }

    setBusy(false)
    busyRef.current = false
  }

  async function commitCheckIn() {
    if (!context || busyRef.current) return
    if (!selectedBookingId && !selectedPackageId) {
      setStatus("❌ Select a confirmed booking or Package before check-in.")
      return
    }

    busyRef.current = true
    setBusy(true)
    setStatus(`Checking in ${context.member.member_code}…`)

    const { data, error } = await supabase.rpc("staff_qr_checkin", {
      p_member_code: context.member.member_code,
      p_notes: notes.trim() || null,
      p_booking_id: selectedBookingId || null,
      p_member_package_id: selectedBookingId ? null : selectedPackageId || null,
      p_session_label: selectedBookingId ? null : selectedSessionLabel,
    })

    if (error) {
      setStatus(`❌ ${error.message}`)
    } else {
      const result = data as { member_name?: string; sessions_left?: number; already_checked_in?: boolean } | null
      const { data: refreshed } = await supabase.rpc("staff_checkin_context", {
        p_member_code: context.member.member_code,
      })
      const next = refreshed as CheckinContext | null
      const selectedPackage = next?.packages.find((item) => item.id === selectedPackageId)
      const warning = selectedPackage?.eligibility?.warning_message || selectedPackage?.eligibility?.blocking_reason
      const suffix = warning ? ` • ${warning}` : ""
      setStatus(
        result?.already_checked_in
          ? `ℹ️ ${context.member.name} was already checked in for this booking.${suffix}`
          : `✅ ${result?.member_name ?? context.member.name} checked in. ${result?.sessions_left ?? "?"} sessions remaining.${suffix}`,
      )
      setContext(next)
      if (next) chooseDefaults(next)
    }

    setBusy(false)
    busyRef.current = false
  }

  async function startCamera() {
    if (cameraOn) return
    try {
      const detectorCtor = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector
      if (!detectorCtor) {
        setStatus("Camera QR scanning is not supported in this browser. Use Manual member code below.")
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      streamRef.current = stream
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraOn(true)
      setStatus("Camera ready. Point it at a BearFit member QR code.")

      const detector = new detectorCtor({ formats: ["qr_code"] })
      const loop = async () => {
        if (!streamRef.current || !videoRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          const raw = codes[0]?.rawValue?.trim()
          if (raw && !busyRef.current) await lookupMember(raw)
        } catch {}
        if (streamRef.current) requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    } catch (error) {
      setStatus(`Camera error: ${error instanceof Error ? error.message : "Unknown error"}. Manual member code is still available.`)
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value))
  }

  return (
    <main className="min-h-screen bg-[#020b1c] px-4 py-6 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-orange-300">BearFit {role}</p>
            <h1 className="text-3xl font-extrabold">Member Check-In</h1>
            <p className="mt-1 text-sm text-white/55">Lookup first, then confirm the booking/package that will consume exactly one session.</p>
          </div>
          <div className="flex gap-2"><Link href="/payments" className="rounded-full bg-[#25324a] px-5 py-3 text-sm font-semibold">Payments</Link><Link href="/staff/schedule" className="rounded-full bg-[#25324a] px-5 py-3 text-sm font-semibold">Schedule</Link><Link href="/member/dashboard" className="rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-semibold">Dashboard</Link></div>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#141414] p-5 md:p-6">
          <div className="rounded-2xl bg-white/5 p-4 text-sm">{status}</div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Manual member code</label>
              <div className="mt-2 flex gap-2">
                <input value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") void lookupMember(manualCode) }} placeholder="M0001" className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-[#202020] px-4 py-3 text-lg font-bold uppercase tracking-widest" />
                <button disabled={busy} onClick={() => void lookupMember(manualCode)} className="rounded-2xl bg-[#25324a] px-5 py-3 font-bold disabled:opacity-50">{busy ? "Working…" : "Lookup"}</button>
              </div>

              {context && (
                <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div><p className="font-bold">{context.member.name}</p><p className="text-sm text-white/55">{context.member.member_code} • {context.member.branch}</p></div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Confirmed booking</label>
                    <select value={selectedBookingId} onChange={(e) => { const id=e.target.value; setSelectedBookingId(id); const booking=context.confirmed_bookings.find((item)=>item.id===id); if (booking) { if (booking.member_package_id) setSelectedPackageId(booking.member_package_id); setSelectedSessionLabel(booking.session_label ?? labelForServiceFallback(booking.session_type)) } else { setSelectedSessionLabel("Strength Training") } }} className="mt-2 w-full rounded-xl bg-[#202020] px-3 py-3">
                      <option value="">Manual package check-in</option>
                      {context.confirmed_bookings.map((booking) => <option key={booking.id} value={booking.id}>{formatDate(booking.start_at)} • {displaySessionLabel(booking.session_label, booking.session_type)} • {booking.branch}</option>)}
                    </select>
                  </div>


                  {!selectedBookingId && <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Manual workout type</label>
                    <select value={selectedSessionLabel} onChange={(e) => { const label=e.target.value; setSelectedSessionLabel(label); const category=categoryForSessionLabel(label); const matching=context.packages.find((pkg)=>pkg.service_category===category); if (matching) setSelectedPackageId(matching.id) }} className="mt-2 w-full rounded-xl bg-[#202020] px-3 py-3">
                      {SESSION_TAXONOMY.map((item)=><option key={item.label} value={item.label}>{item.label}</option>)}
                    </select>
                    <p className="mt-1 text-[11px] text-white/40">Package category: {categoryForSessionLabel(selectedSessionLabel)}</p>
                  </div>}

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Package</label>
                    <select disabled={Boolean(selectedBookingId)} value={selectedPackageId} onChange={(e)=>setSelectedPackageId(e.target.value)} className="mt-2 w-full rounded-xl bg-[#202020] px-3 py-3 disabled:opacity-60">
                      <option value="">Select package</option>
                      {context.packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.package_name} • {pkg.sessions_left}/{pkg.sessions_total} left</option>)}
                    </select>
                  </div>

                  <button disabled={busy || (!selectedBookingId && !selectedPackageId)} onClick={() => void commitCheckIn()} className="w-full rounded-2xl bg-[#ff7a1a] px-5 py-3 font-bold disabled:opacity-40">{busy ? "Checking…" : "Check In"}</button>
                </div>
              )}

              <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-white/55">Session notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Weights session" className="mt-2 w-full rounded-2xl border border-white/15 bg-[#202020] px-4 py-3" />

              <div className="mt-5 rounded-2xl border border-white/10 p-4 text-sm text-white/55">Last member code: <span className="font-bold text-white">{lastCode || "—"}</span></div>
              <button onClick={() => cameraOn ? stopCamera() : void startCamera()} className="mt-4 w-full rounded-2xl bg-[#25324a] px-5 py-3 font-semibold">{cameraOn ? "Stop Camera" : "Start QR Camera"}</button>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black"><video ref={videoRef} className="h-[330px] w-full object-cover" playsInline muted /></div>
          </div>
        </section>
      </div>
    </main>
  )
}
