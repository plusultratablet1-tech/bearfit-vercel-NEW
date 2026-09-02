"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

export default function CheckInPageClient({ role }: { role: "staff" | "admin" }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busyRef = useRef(false)
  const [status, setStatus] = useState("Ready for manual check-in. Camera can be started below.")
  const [notes, setNotes] = useState("Training session")
  const [manualCode, setManualCode] = useState("")
  const [lastCode, setLastCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)

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

  async function checkIn(rawCode: string) {
    if (busyRef.current) return
    const memberCode = normalizeMemberCode(rawCode)
    if (!memberCode) {
      setStatus("❌ Enter or scan a valid member code such as M0001.")
      return
    }

    busyRef.current = true
    setBusy(true)
    setLastCode(memberCode)
    setStatus(`Checking in ${memberCode}…`)

    const { data, error } = await supabase.rpc("staff_qr_checkin", {
      p_member_code: memberCode,
      p_notes: notes.trim() || null,
    })

    if (error) {
      setStatus(`❌ ${error.message}`)
    } else {
      const result = data as { member_name?: string; new_sessions_left?: number } | null
      setStatus(`✅ ${result?.member_name ?? memberCode} checked in. ${result?.new_sessions_left ?? "?"} sessions remaining.`)
      setManualCode("")
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
          if (raw && !busyRef.current) await checkIn(raw)
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

  return (
    <main className="min-h-screen bg-[#020b1c] px-4 py-6 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-orange-300">BearFit {role}</p>
            <h1 className="text-3xl font-extrabold">Member Check-In</h1>
            <p className="mt-1 text-sm text-white/55">Each successful check-in deducts exactly one available session.</p>
          </div>
          <div className="flex gap-2"><Link href="/payments" className="rounded-full bg-[#25324a] px-5 py-3 text-sm font-semibold">Payments</Link><Link href="/member/dashboard" className="rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-semibold">Dashboard</Link></div>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#141414] p-5 md:p-6">
          <div className="rounded-2xl bg-white/5 p-4 text-sm">{status}</div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-white/55">Manual member code</label>
              <div className="mt-2 flex gap-2">
                <input value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") void checkIn(manualCode) }} placeholder="M0001" className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-[#202020] px-4 py-3 text-lg font-bold uppercase tracking-widest" />
                <button disabled={busy} onClick={() => void checkIn(manualCode)} className="rounded-2xl bg-[#ff7a1a] px-5 py-3 font-bold disabled:opacity-50">{busy ? "Checking…" : "Check In"}</button>
              </div>

              <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-white/55">Session notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Weights session" className="mt-2 w-full rounded-2xl border border-white/15 bg-[#202020] px-4 py-3" />

              <div className="mt-5 rounded-2xl border border-white/10 p-4 text-sm text-white/55">
                Last member code: <span className="font-bold text-white">{lastCode || "—"}</span>
              </div>

              <button onClick={() => cameraOn ? stopCamera() : void startCamera()} className="mt-4 w-full rounded-2xl bg-[#25324a] px-5 py-3 font-semibold">
                {cameraOn ? "Stop Camera" : "Start QR Camera"}
              </button>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black">
              <video ref={videoRef} className="h-[330px] w-full object-cover" playsInline muted />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
