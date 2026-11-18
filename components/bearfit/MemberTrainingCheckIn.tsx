"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, MapPin, ScanLine } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { BookingRow } from "@/lib/member-account"

const db = createClient()
const zone = "Asia/Manila"

function localDay(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value))
  const piece = (key: string) => parts.find(part => part.type === key)?.value || ""
  return piece("year") + "-" + piece("month") + "-" + piece("day")
}

function time(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: zone, hour: "numeric", minute: "2-digit",
  }).format(new Date(value))
}

/** A single member action; check-in is an arrival event, never a deduction. */
export default function MemberTrainingCheckIn({ bookings }: { bookings: BookingRow[] }) {
  const [now, setNow] = useState(() => Date.now())
  const [arrived, setArrived] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(handle)
  }, [])

  const today = localDay(new Date(now).toISOString())
  const booking = useMemo(() => bookings
    .filter(b => b.status === "confirmed" && b.start_at && b.end_at && localDay(b.start_at) === today)
    .sort((a, b) => Date.parse(a.start_at!) - Date.parse(b.start_at!))[0] ?? null,
    [bookings, today])
  const bookingId = booking?.id ?? null
  const canCheckIn = Boolean(booking && booking.start_at && booking.end_at &&
    now >= Date.parse(booking.start_at) - 90 * 60000 &&
    now <= Date.parse(booking.end_at) + 30 * 60000)

  useEffect(() => {
    let active = true
    setChecking(true)
    setArrived(false)
    setError("")
    if (!bookingId) {
      setChecking(false)
      return () => { active = false }
    }
    void db.from("member_training_arrivals").select("booking_id")
      .eq("booking_id", bookingId).maybeSingle()
      .then(({ data, error: readError }) => {
        if (!active) return
        if (readError) setError("Check-in is temporarily unavailable. Please ask BearFit staff for assistance.")
        else setArrived(Boolean(data))
        setChecking(false)
      })
    return () => { active = false }
  }, [bookingId])

  async function checkIn() {
    if (!bookingId || !canCheckIn || loading || checking || arrived) return
    setLoading(true)
    setError("")
    if (!navigator.geolocation) {
      setError("Location is unavailable on this device. Please ask BearFit staff for attendance assistance.")
      setLoading(false)
      return
    }
    try {
      const location = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 15000, maximumAge: 0,
        }),
      )
      const { error: rpcError } = await db.rpc("member_training_checkin", {
        p_booking_id: bookingId,
        p_latitude: location.coords.latitude,
        p_longitude: location.coords.longitude,
        p_accuracy_m: location.coords.accuracy,
        p_observed_at: new Date(location.timestamp).toISOString(),
      })
      if (rpcError) throw new Error(rpcError.message)
      setArrived(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify your arrival. Ask BearFit staff for assistance.")
    } finally {
      setLoading(false)
    }
  }

  if (!booking) return null

  return (
    <section aria-label="BearFit member check-in" className="mb-5 rounded-[26px] border border-white/10 bg-[#121212] p-4 shadow-xl md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-white/55">BearFit · Member Check-In</p>
          <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">Show Up. Get Stronger.</h2>
        </div>
        <ScanLine size={25} className="text-white/70" aria-hidden="true" />
      </div>
      <div className="mt-5 flex flex-col items-center gap-4 rounded-[24px] bg-[#242424] px-4 py-7 text-center md:px-8">
        {arrived ? <CheckCircle2 size={37} className="text-emerald-400" aria-hidden="true" /> :
          <ScanLine size={37} className="text-white" aria-hidden="true" />}
        <h3 className="text-2xl font-black text-white">{arrived ? "You're Checked In!" : "Ready to train?"}</h3>
        <p className="max-w-lg text-sm text-white/60">
          {arrived ? "You showed up. That's the first win. Your coach can see your arrival." :
            "Check in when you arrive at BearFit. Every session starts with showing up."}
        </p>
        <p className="flex items-center gap-2 text-xs text-white/70">
          <MapPin size={14} aria-hidden="true" />
          {booking.branch} · {time(booking.start_at!)} training
        </p>
        {error && <p role="alert" className="w-full rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {arrived ? (
          <div role="status" className="w-full rounded-full border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 font-bold text-emerald-300">
            Arrival recorded · No session deducted
          </div>
        ) : (
          <button type="button" onClick={() => void checkIn()}
            disabled={!canCheckIn || checking || loading || Boolean(error && error.includes("temporarily unavailable"))}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-4 text-base font-black text-[#202020] disabled:cursor-not-allowed disabled:opacity-40">
            <CheckCircle2 size={20} aria-hidden="true" />
            {loading ? "Verifying arrival…" : checking ? "Loading…" :
              canCheckIn ? "I'm Here — Check In" : "Check-In Not Open Yet"}
          </button>
        )}
        {!arrived && !canCheckIn && (
          <p className="text-xs text-amber-200">Check-in opens 90 minutes before training and closes 30 minutes after it ends.</p>
        )}
        <p className="text-xs text-white/40">GPS verifies your branch when you tap. Exact phone coordinates are not stored. Arrival alone never deducts a training session.</p>
      </div>
    </section>
  )
}
