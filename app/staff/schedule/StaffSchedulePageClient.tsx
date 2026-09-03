"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()
type Profile = { id: string; full_name: string; role: string; branch: string }
type Member = { id: string; member_code: string; full_name: string; branch: string }
type Slot = { id: string; coach_user_id: string | null; branch: string; session_type: string; start_at: string; end_at: string; capacity: number; status: string }
type MemberJoin = { member_code: string; full_name: string }
type Booking = { id: string; member_id: string; slot_id: string | null; request_kind: string; status: string; branch: string; session_type: string; requested_start_at: string; start_at: string | null; assigned_coach_user_id: string | null; requested_coach_user_id?: string | null; member_package_id: string | null; members?: MemberJoin | MemberJoin[] | null }
type Attention = { member_id: string; member_code: string; member_name: string; package_name: string; service_category: string; sessions_left: number; reason: string; warning_level: string }

const labels: Record<string, string> = { fitness: "Fitness", pilates_group: "Pilates Group", pilates_1on1: "Pilates 1-on-1" }
function fmt(iso: string | null) { if (!iso) return "—"; return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) }
function bookingMember(booking: Booking): MemberJoin | null {
  if (!booking.members) return null
  return Array.isArray(booking.members) ? booking.members[0] ?? null : booking.members
}

export default function StaffSchedulePageClient({ role, currentUserId }: { role: "staff" | "admin"; currentUserId: string }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [attention, setAttention] = useState<Attention[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [bookingCoach, setBookingCoach] = useState<Record<string, string>>({})
  const [chargeNoShow, setChargeNoShow] = useState<Record<string, boolean>>({})
  const [recurring, setRecurring] = useState({ coach: currentUserId, branch: "Malingap Branch", sessionType: "fitness", weekday: "1", start: "09:00", end: "12:00", duration: "60", capacity: "1", validFrom: new Date().toISOString().slice(0, 10), validUntil: "" })
  const [oneOff, setOneOff] = useState({ coach: currentUserId, branch: "Malingap Branch", sessionType: "fitness", start: "", duration: "60", capacity: "1" })
  const [assignment, setAssignment] = useState({ memberId: "", slotId: "" })

  async function load() {
    const [p, m, s, b, a] = await Promise.all([
      supabase.from("profiles").select("id,full_name,role,branch").in("role", ["staff", "admin"]),
      supabase.from("members").select("id,member_code,full_name,branch").order("full_name").limit(200),
      supabase.from("schedule_slots").select("*").gte("start_at", new Date().toISOString()).order("start_at").limit(100),
      supabase.from("bookings").select("*,members:members(member_code,full_name)").in("status", ["pending", "confirmed"]).order("requested_start_at").limit(100),
      supabase.rpc("staff_package_attention_queue"),
    ])
    for (const r of [p, m, s, b, a]) if (r.error) setError(r.error.message)
    setProfiles((p.data ?? []) as Profile[])
    setMembers((m.data ?? []) as Member[])
    setSlots((s.data ?? []) as Slot[])
    setBookings((b.data ?? []) as Booking[])
    setAttention((a.data ?? []) as Attention[])
  }

  useEffect(() => { void load() }, [])

  async function createRecurring(e: FormEvent) {
    e.preventDefault(); setWorking("recurring"); setError(null)
    const { data: ruleId, error: err } = await supabase.rpc("staff_create_availability_rule", { p_coach_user_id: recurring.coach, p_branch: recurring.branch, p_session_type: recurring.sessionType, p_weekday: Number(recurring.weekday), p_local_start_time: recurring.start, p_local_end_time: recurring.end, p_slot_duration_minutes: Number(recurring.duration), p_capacity: Number(recurring.capacity), p_valid_from: recurring.validFrom, p_valid_until: recurring.validUntil || null })
    if (err) { setWorking(null); return setError(err.message) }
    const through = new Date(); through.setDate(through.getDate() + 56)
    const { error: gerr } = await supabase.rpc("staff_generate_slots", { p_rule_id: ruleId as string, p_through: through.toISOString().slice(0, 10) })
    setWorking(null); if (gerr) return setError(gerr.message)
    setSuccess("Recurring availability saved and 8 weeks of slots generated."); await load()
  }

  async function createOneOff(e: FormEvent) {
    e.preventDefault(); setWorking("oneoff"); setError(null)
    const { error: err } = await supabase.rpc("staff_create_one_off_slot", { p_coach_user_id: oneOff.coach || null, p_branch: oneOff.branch, p_session_type: oneOff.sessionType, p_start_at: new Date(oneOff.start).toISOString(), p_duration_minutes: Number(oneOff.duration), p_capacity: Number(oneOff.capacity) })
    setWorking(null); if (err) return setError(err.message)
    setSuccess("One-off slot created."); await load()
  }

  async function createAssignment(e: FormEvent) {
    e.preventDefault(); if (!assignment.memberId || !assignment.slotId) return
    setWorking("assignment"); setError(null)
    const { error: err } = await supabase.rpc("staff_create_assignment", { p_member_id: assignment.memberId, p_slot_id: assignment.slotId, p_member_package_id: null })
    setWorking(null); if (err) return setError(err.message)
    setSuccess("Member assigned and confirmed."); setAssignment({ memberId: "", slotId: "" }); await load()
  }

  async function act(booking: Booking, action: "confirm" | "reject" | "cancel" | "noshow") {
    setWorking(booking.id); setError(null)
    const coachId = bookingCoach[booking.id] || booking.assigned_coach_user_id || booking.requested_coach_user_id || slots.find(s => s.id === booking.slot_id)?.coach_user_id || null
    let result
    if (action === "confirm") result = await supabase.rpc("staff_confirm_booking", { p_booking_id: booking.id, p_slot_id: booking.slot_id || null, p_assigned_coach_user_id: coachId })
    else if (action === "reject") result = await supabase.rpc("staff_reject_booking", { p_booking_id: booking.id, p_reason: "Declined by staff" })
    else if (action === "cancel") result = await supabase.rpc("staff_cancel_booking", { p_booking_id: booking.id, p_reason: "Cancelled by staff" })
    else result = await supabase.rpc("staff_mark_no_show", { p_booking_id: booking.id, p_charge_session: !!chargeNoShow[booking.id], p_notes: "Staff no-show action" })
    setWorking(null); if (result.error) return setError(result.error.message)
    setSuccess(`Booking ${action} action completed.`); await load()
  }

  async function reassignCoach(booking: Booking) {
    const coachId = bookingCoach[booking.id]
    if (!coachId) return setError("Choose a coach before reassigning.")
    setWorking(booking.id); setError(null)
    const { error: err } = await supabase.rpc("staff_reassign_booking", { p_booking_id: booking.id, p_slot_id: booking.slot_id || null, p_assigned_coach_user_id: coachId })
    setWorking(null); if (err) return setError(err.message)
    setSuccess("Coach reassigned."); await load()
  }

  const openSlots = slots.filter(s => s.status === "open")
  return <main className="min-h-screen bg-[#020b1c] p-4 text-white md:p-8"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">BearFit {role}</p><h1 className="text-3xl font-extrabold">Schedule Workspace</h1></div><div className="flex gap-2"><Link href="/payments" className="rounded-full bg-[#25324a] px-4 py-3 text-sm">Payments</Link><Link href="/checkin" className="rounded-full bg-[#ff7a1a] px-4 py-3 text-sm font-bold">Check-in</Link></div></header>
    {error && <div className="mb-4 rounded-2xl bg-red-500/10 p-4 text-red-200">{error}</div>}{success && <div className="mb-4 rounded-2xl bg-emerald-500/10 p-4 text-emerald-200">{success}</div>}

    <section className="mb-6 grid gap-4 lg:grid-cols-2">
      <form onSubmit={createRecurring} className="rounded-[24px] border border-white/10 bg-[#141414] p-5"><h2 className="text-xl font-bold">Recurring availability</h2><p className="text-xs text-white/45">Creates slots for the next 8 weeks.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Sel v={recurring.coach} set={v => setRecurring({ ...recurring, coach: v })}>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</Sel><Inp v={recurring.branch} set={v => setRecurring({ ...recurring, branch: v })} ph="Branch"/><Sel v={recurring.sessionType} set={v => setRecurring({ ...recurring, sessionType: v })}><option value="fitness">Fitness</option><option value="pilates_group">Pilates Group</option><option value="pilates_1on1">Pilates 1-on-1</option></Sel><Sel v={recurring.weekday} set={v => setRecurring({ ...recurring, weekday: v })}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <option key={d} value={i}>{d}</option>)}</Sel><Inp v={recurring.start} set={v => setRecurring({ ...recurring, start: v })} type="time"/><Inp v={recurring.end} set={v => setRecurring({ ...recurring, end: v })} type="time"/><Inp v={recurring.duration} set={v => setRecurring({ ...recurring, duration: v })} ph="Duration minutes"/><Inp v={recurring.capacity} set={v => setRecurring({ ...recurring, capacity: v })} ph="Capacity"/><Inp v={recurring.validFrom} set={v => setRecurring({ ...recurring, validFrom: v })} type="date"/><Inp v={recurring.validUntil} set={v => setRecurring({ ...recurring, validUntil: v })} type="date"/></div><button disabled={working === "recurring"} className="mt-4 rounded-xl bg-[#ff7a1a] px-4 py-3 font-bold">Save recurring rule</button></form>
      <form onSubmit={createOneOff} className="rounded-[24px] border border-white/10 bg-[#141414] p-5"><h2 className="text-xl font-bold">One-off slot</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Sel v={oneOff.coach} set={v => setOneOff({ ...oneOff, coach: v })}><option value="">Any available coach</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</Sel><Inp v={oneOff.branch} set={v => setOneOff({ ...oneOff, branch: v })} ph="Branch"/><Sel v={oneOff.sessionType} set={v => setOneOff({ ...oneOff, sessionType: v })}><option value="fitness">Fitness</option><option value="pilates_group">Pilates Group</option><option value="pilates_1on1">Pilates 1-on-1</option></Sel><Inp v={oneOff.start} set={v => setOneOff({ ...oneOff, start: v })} type="datetime-local"/><Inp v={oneOff.duration} set={v => setOneOff({ ...oneOff, duration: v })} ph="Duration minutes"/><Inp v={oneOff.capacity} set={v => setOneOff({ ...oneOff, capacity: v })} ph="Capacity"/></div><button disabled={working === "oneoff"} className="mt-4 rounded-xl bg-[#ff7a1a] px-4 py-3 font-bold">Create one-off slot</button></form>
    </section>

    <form onSubmit={createAssignment} className="mb-6 rounded-[24px] border border-white/10 bg-[#141414] p-5"><h2 className="text-xl font-bold">Assign member directly</h2><p className="text-xs text-white/45">Staff assignments confirm immediately, but package and capacity checks still apply.</p><div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]"><Sel v={assignment.memberId} set={v => setAssignment({ ...assignment, memberId: v })}><option value="">Select member</option>{members.map(m => <option key={m.id} value={m.id}>{m.member_code} · {m.full_name}</option>)}</Sel><Sel v={assignment.slotId} set={v => setAssignment({ ...assignment, slotId: v })}><option value="">Select open slot</option>{openSlots.map(s => <option key={s.id} value={s.id}>{fmt(s.start_at)} · {labels[s.session_type]} · {s.branch}</option>)}</Sel><button disabled={working === "assignment" || !assignment.memberId || !assignment.slotId} className="rounded-xl bg-[#ff7a1a] px-5 py-3 font-bold">Assign member</button></div></form>

    <section className="mb-6 rounded-[24px] border border-white/10 bg-[#141414] p-5"><h2 className="text-xl font-bold">Package attention</h2><p className="text-xs text-white/45">Payment Due · Renewal Soon · Last Session · Expired</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{attention.length === 0 ? <p className="text-sm text-white/45">No package alerts.</p> : attention.map((a, i) => <div key={`${a.member_id}-${a.reason}-${i}`} className="rounded-2xl bg-white/5 p-4"><b>{a.member_name}</b><div className="text-xs text-white/50">{a.member_code} · {a.package_name}</div><div className="mt-2 text-sm text-orange-300">{a.reason.replaceAll("_", " ")}</div><div className="text-xs text-white/45">{a.sessions_left} sessions left</div></div>)}</div></section>

    <section className="grid gap-6 xl:grid-cols-[1fr_340px]"><div className="rounded-[24px] border border-white/10 bg-[#141414] p-5"><h2 className="text-xl font-bold">Booking requests</h2><div className="mt-4 space-y-3">{bookings.length === 0 ? <p className="text-sm text-white/45">No pending or confirmed bookings.</p> : bookings.map(b => { const m = bookingMember(b); return <div key={b.id} className="rounded-2xl bg-white/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><b>{m?.full_name ?? "Member"}</b><div className="text-xs text-white/45">{m?.member_code} · {labels[b.session_type]} · {fmt(b.start_at ?? b.requested_start_at)}</div><div className="mt-1 text-xs text-white/35">{b.request_kind === "custom" ? "Custom request" : b.request_kind === "staff_assignment" ? "Staff assignment" : "Available slot request"}</div></div><span className="text-xs uppercase text-orange-300">{b.status}</span></div>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]"><Sel v={bookingCoach[b.id] ?? b.assigned_coach_user_id ?? b.requested_coach_user_id ?? ""} set={v => setBookingCoach({ ...bookingCoach, [b.id]: v })}><option value="">Choose coach / Any available coach</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</Sel>{b.status === "confirmed" && <button disabled={working === b.id || !bookingCoach[b.id]} onClick={() => void reassignCoach(b)} className="rounded-lg bg-blue-500/20 px-3 py-2 text-xs">Reassign coach</button>}</div>
      {b.status === "pending" ? <div className="mt-3 flex gap-2"><button disabled={working === b.id} onClick={() => void act(b, "confirm")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold">Confirm</button><button onClick={() => void act(b, "reject")} className="rounded-lg bg-red-500/20 px-3 py-2 text-xs">Reject</button></div> : <div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={() => void act(b, "cancel")} className="rounded-lg bg-red-500/20 px-3 py-2 text-xs">Cancel</button><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!chargeNoShow[b.id]} onChange={e => setChargeNoShow({ ...chargeNoShow, [b.id]: e.target.checked })}/>Charge 1 session</label><button onClick={() => void act(b, "noshow")} className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs">Mark no-show</button></div>}
    </div> })}</div></div>
      <aside className="rounded-[24px] border border-white/10 bg-[#141414] p-5"><h2 className="text-xl font-bold">Upcoming slots</h2><div className="mt-4 space-y-3">{slots.slice(0, 12).map(s => <div key={s.id} className="rounded-2xl bg-white/5 p-4"><b>{labels[s.session_type]}</b><div className="text-xs text-white/50">{fmt(s.start_at)}</div><div className="text-xs text-white/45">{s.branch} · capacity {s.capacity}</div></div>)}</div></aside>
    </section>
  </div></main>
}
function Inp({ v, set, ph, type = "text" }: { v: string; set: (v: string) => void; ph?: string; type?: string }) { return <input value={v} onChange={e => set(e.target.value)} placeholder={ph} type={type} className="rounded-xl bg-[#242424] p-3 text-sm"/> }
function Sel({ v, set, children }: { v: string; set: (v: string) => void; children: React.ReactNode }) { return <select value={v} onChange={e => set(e.target.value)} className="rounded-xl bg-[#242424] p-3 text-sm">{children}</select> }
