"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ClipboardList, RefreshCw, UsersRound } from "lucide-react"
import StaffAppShell from "@/components/bearfit/StaffAppShell"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()
const TIME_ZONE = "Asia/Manila"
type View = "day" | "week" | "month"
type Profile = { id: string; full_name: string | null; role: string; branch: string | null }
type MemberCoach = { coach_name: string | null; branch: string | null }
type Booking = {
  id: string; status: string; branch: string; session_label: string | null; session_type: string
  slot_id: string | null; start_at: string | null; end_at: string | null
  requested_start_at: string; requested_duration_minutes: number
  assigned_coach_user_id: string | null; requested_coach_user_id: string | null
  members: { full_name: string | null; member_code: string | null } | { full_name: string | null; member_code: string | null }[] | null
}
type Slot = {
  id: string; coach_user_id: string | null; start_at: string; end_at: string
  branch: string; session_label: string | null; session_type: string; status: string
}
type Coach = { key: string; name: string; userId: string | null; branches: string[]; rosterOnly: boolean }
type Row = { day: string; start: string; end: string; title: string; member: string; branch: string; status: string; id: string }
type Period = { first: Date; last: Date; startISO: string; endISO: string; days: string[]; label: string }

function dateOnly(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00"
  return pick("year") + "-" + pick("month") + "-" + pick("day")
}
function asUTC(value: string) { return new Date(value + "T00:00:00.000Z") }
function isoDate(date: Date) { return date.toISOString().slice(0, 10) }
function manilaBoundary(value: string) { return new Date(asUTC(value).getTime() - 8 * 3600000).toISOString() }
function labelDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-PH", { ...options, timeZone: "UTC" }).format(asUTC(date))
}
function time(iso: string) { return new Intl.DateTimeFormat("en-PH", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(iso)) }
function normalName(value: string) { return value.trim().replace(/^coach\s+/i, "").replace(/\s+/g, " ").toLowerCase() }
function memberName(booking: Booking) {
  const m = Array.isArray(booking.members) ? booking.members[0] : booking.members
  return m?.full_name || m?.member_code || "Member"
}
function bookingStart(booking: Booking) { return booking.start_at || booking.requested_start_at }
function bookingEnd(booking: Booking) {
  return booking.end_at || new Date(new Date(bookingStart(booking)).getTime() + (booking.requested_duration_minutes || 60) * 60000).toISOString()
}
function makePeriod(anchor: string, view: View): Period {
  const first = asUTC(anchor)
  if (view === "week") first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7))
  if (view === "month") first.setUTCDate(1)
  const last = new Date(first)
  if (view === "month") last.setUTCMonth(last.getUTCMonth() + 1)
  else last.setUTCDate(last.getUTCDate() + (view === "week" ? 7 : 1))
  const days: string[] = []
  for (let d = new Date(first); d < last; d.setUTCDate(d.getUTCDate() + 1)) days.push(isoDate(d))
  const start = isoDate(first)
  const end = isoDate(new Date(last.getTime() - 86400000))
  const label = view === "month"
    ? labelDate(start, { month: "long", year: "numeric" })
    : view === "day"
      ? labelDate(start, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : labelDate(start, { month: "short", day: "numeric" }) + " – " + labelDate(end, { month: "short", day: "numeric", year: "numeric" })
  return { first, last, startISO: manilaBoundary(start), endISO: manilaBoundary(isoDate(last)), days, label }
}
function stepDate(value: string, view: View, delta: number) {
  const next = asUTC(value)
  if (view === "month") { next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + delta) }
  else next.setUTCDate(next.getUTCDate() + delta * (view === "week" ? 7 : 1))
  return isoDate(next)
}
function conflictCount(bookings: Booking[]) {
  const list = bookings.filter((b) => b.status === "confirmed" || b.status === "completed").sort((a, b) => bookingStart(a).localeCompare(bookingStart(b)))
  let conflicts = 0
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const firstStart = Date.parse(bookingStart(list[i])), firstEnd = Date.parse(bookingEnd(list[i]))
      const nextStart = Date.parse(bookingStart(list[j])), nextEnd = Date.parse(bookingEnd(list[j]))
      if (nextStart >= firstEnd) break
      // Two members in the exact same group-session slot may be intentional.
      if (firstStart !== nextStart || firstEnd !== nextEnd) conflicts++
    }
  }
  return conflicts
}

export default function CoachesPageClient({ role }: { role: "admin" | "staff" }) {
  const [view, setView] = useState<View>("day")
  const [anchor, setAnchor] = useState(() => dateOnly(new Date()))
  const [branch, setBranch] = useState("ALL")
  const [coachFilter, setCoachFilter] = useState("ALL")
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [roster, setRoster] = useState<MemberCoach[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limited, setLimited] = useState(false)
  const [refreshId, setRefreshId] = useState(0)
  const period = useMemo(() => makePeriod(anchor, view), [anchor, view])

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError(null)
      const [p, m, b, s] = await Promise.all([
        supabase.from("profiles").select("id,full_name,role,branch").limit(1000),
        supabase.from("members").select("coach_name,branch").not("coach_name", "is", null).limit(1000),
        supabase.from("bookings")
          .select("id,status,branch,session_label,session_type,slot_id,start_at,end_at,requested_start_at,requested_duration_minutes,assigned_coach_user_id,requested_coach_user_id,members:members(full_name,member_code)")
          .in("status", ["confirmed", "completed", "no_show"])
          .gte("start_at", period.startISO).lt("start_at", period.endISO).order("start_at").limit(1000),
        supabase.from("schedule_slots")
          .select("id,coach_user_id,start_at,end_at,branch,session_label,session_type,status")
          .gte("start_at", period.startISO).lt("start_at", period.endISO).order("start_at").limit(1000),
      ])
      if (!alive) return
      const failure = [p, m, b, s].filter((res) => res.error).map((res) => res.error?.message).join(" · ")
      if (failure) setError(failure)
      setProfiles((p.data ?? []) as Profile[])
      setRoster((m.data ?? []) as MemberCoach[])
      setBookings((b.data ?? []) as unknown as Booking[])
      setSlots((s.data ?? []) as Slot[])
      setLimited([p, m, b, s].some((res) => (res.data?.length ?? 0) >= 1000))
      setLoading(false)
    }
    void load()
    return () => { alive = false }
  }, [period.startISO, period.endISO, refreshId])

  const coaches = useMemo(() => {
    const map = new Map<string, Coach>()
    for (const person of roster) {
      const name = person.coach_name?.trim()
      if (!name) continue
      const key = normalName(name)
      const prev = map.get(key)
      if (prev) {
        if (person.branch && !prev.branches.includes(person.branch)) prev.branches.push(person.branch)
      } else map.set(key, { key, name, userId: null, branches: person.branch ? [person.branch] : [], rosterOnly: true })
    }
    const assigned = new Set<string>()
    bookings.forEach((b) => { if (b.assigned_coach_user_id) assigned.add(b.assigned_coach_user_id); else if (b.requested_coach_user_id) assigned.add(b.requested_coach_user_id) })
    slots.forEach((s) => { if (s.coach_user_id) assigned.add(s.coach_user_id) })
    profiles.forEach((p) => {
      const key = normalName(p.full_name || p.id)
      const prior = map.get(key)
      if (p.role !== "staff" && !assigned.has(p.id) && !prior) return
      const name = p.full_name || "Coach account"
      if (prior) {
        prior.userId = p.id
        prior.rosterOnly = false
        if (p.branch && !prior.branches.includes(p.branch)) prior.branches.push(p.branch)
      } else map.set(key, { key, name, userId: p.id, branches: p.branch ? [p.branch] : [], rosterOnly: false })
    })
    const knownIds = new Set([...map.values()].map((coach) => coach.userId).filter(Boolean))
    assigned.forEach((id) => {
      if (!knownIds.has(id)) {
        const key = "unlinked:" + id
        map.set(key, { key, name: "Unlinked coach account", userId: id, branches: [], rosterOnly: false })
      }
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [roster, profiles, bookings, slots])

  const slotById = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots])
  const coachBookings = useCallback((coach: Coach) => {
    if (!coach.userId) return [] as Booking[]
    return bookings.filter((b) => {
      const id = b.assigned_coach_user_id || (b.slot_id ? slotById.get(b.slot_id)?.coach_user_id : null) || b.requested_coach_user_id
      return id === coach.userId && (branch === "ALL" || b.branch === branch)
    })
  }, [bookings, branch, slotById])
  const coachSlots = useCallback((coach: Coach) => {
    if (!coach.userId) return [] as Slot[]
    return slots.filter((s) => s.coach_user_id === coach.userId && s.status !== "cancelled" && (branch === "ALL" || s.branch === branch))
  }, [slots, branch])

  const branches = useMemo(() => {
    return [...new Set([...coaches.flatMap((c) => c.branches), ...bookings.map((b) => b.branch), ...slots.map((s) => s.branch)].filter(Boolean))].sort()
  }, [coaches, bookings, slots])
  const visible = coaches.filter((c) => (coachFilter === "ALL" || c.key === coachFilter) &&
    (branch === "ALL" || c.branches.includes(branch) || coachBookings(c).length > 0 || coachSlots(c).length > 0))
  const allBookings = visible.flatMap(coachBookings)
  const completed = allBookings.filter((b) => b.status === "completed").length
  const scheduled = allBookings.filter((b) => b.status === "confirmed").length
  const noShows = allBookings.filter((b) => b.status === "no_show").length
  const now = Date.now()
  const overdue = allBookings.filter((b) => b.status === "confirmed" && new Date(bookingEnd(b)).getTime() < now).length
  const conflictTotal = visible.reduce((count, c) => count + conflictCount(coachBookings(c)), 0)
  const scheduleDays = new Set(allBookings.map((b) => dateOnly(new Date(bookingStart(b))))).size

  return (
    <StaffAppShell activePath="/staff/coaches" role={role}>
      <div className="mx-auto max-w-7xl px-4 py-5 pb-28 md:px-6 lg:px-8 lg:py-7 lg:pb-7">
        <header className="border-b border-white/10 pb-5">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#ff9b54]">Team operations</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black md:text-3xl">Coaches</h1>
              <p className="mt-1 max-w-3xl text-sm text-white/50">Review coach schedules, recorded sessions, availability and gaps by day, week or month.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {role === "admin" && (
                <Link href="/staff/coaches/directory" className="inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#ff8b37]">
                  Coach Directory &amp; Rates
                </Link>
              )}
              <button onClick={() => setRefreshId((v) => v + 1)} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/5" type="button">
              <RefreshCw size={16} /> Refresh
            </button>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-[24px] border border-white/10 bg-[#101725] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-white/5 p-1">
              {(["day", "week", "month"] as View[]).map((item) => (
                <button key={item} onClick={() => setView(item)} className={item === view ? "rounded-lg bg-[#ff7a1a] px-4 py-2 text-sm font-bold capitalize text-white" : "rounded-lg px-4 py-2 text-sm font-semibold capitalize text-white/55 hover:text-white"} type="button">{item}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button aria-label="Previous period" type="button" onClick={() => setAnchor(stepDate(anchor, view, -1))} className="rounded-xl border border-white/10 p-2.5 hover:bg-white/10"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => setAnchor(dateOnly(new Date()))} className="rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold hover:bg-white/10">Today</button>
              <button aria-label="Next period" type="button" onClick={() => setAnchor(stepDate(anchor, view, 1))} className="rounded-xl border border-white/10 p-2.5 hover:bg-white/10"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-lg font-black"><CalendarDays size={19} className="text-[#ff7a1a]" />{period.label}</div>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Filter by branch" value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded-xl border border-white/10 bg-[#1b2434] px-3 py-2 text-sm text-white">
                <option value="ALL">All branches</option>{branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select aria-label="Filter by coach" value={coachFilter} onChange={(e) => setCoachFilter(e.target.value)} className="max-w-52 rounded-xl border border-white/10 bg-[#1b2434] px-3 py-2 text-sm text-white">
                <option value="ALL">All coaches</option>{coaches.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
              <input aria-label="Jump to date" type="date" value={anchor} onChange={(e) => { if (e.target.value) setAnchor(e.target.value) }} className="rounded-xl border border-white/10 bg-[#1b2434] px-3 py-2 text-sm text-white" />
            </div>
          </div>
        </section>

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">Unable to load all coach data: {error}</p>}
        {limited && <p role="status" className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">This period has reached a data retrieval limit. Narrow the date range before relying on totals.</p>}
        <p className="mt-4 text-xs leading-relaxed text-white/45">
          This is a schedule and completed-session overview, not an employee time clock. <strong className="text-white/65">No recorded schedule</strong> does not mean the coach was absent or off duty. A completed member booking does not confirm a coach clock-in.
        </p>

        <section aria-label="Coach schedule summary" className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Summary icon={UsersRound} title="Coaches listed" value={visible.length} />
          <Summary icon={CalendarDays} title="Scheduled bookings" value={scheduled} />
          <Summary icon={CheckCircle2} title="Completed bookings" value={completed} />
          <Summary icon={Clock3} title="Days with bookings" value={scheduleDays} />
          <Summary icon={AlertTriangle} title="Past-due check" value={overdue} />
          <Summary icon={ClipboardList} title="Possible overlaps" value={conflictTotal} />
        </section>

        {loading ? (
          <div role="status" className="mt-5 rounded-[24px] border border-white/10 bg-[#141414] p-8 text-center text-white/50">Loading coach schedules…</div>
        ) : (
          <div className="mt-5 space-y-4">
            {visible.length === 0 && <div className="rounded-[24px] border border-dashed border-white/15 p-8 text-center text-white/55">No coaches match these filters. Coach records are loaded from member assignments and staff accounts.</div>}
            {visible.map((coach) => {
              const assigned = coachBookings(coach)
              const available = coachSlots(coach)
              const complete = assigned.filter((b) => b.status === "completed").length
              const confirmed = assigned.filter((b) => b.status === "confirmed").length
              const issues = conflictCount(assigned)
              const bookedDays = new Set(assigned.map((b) => dateOnly(new Date(bookingStart(b)))))
              const dayRows: Row[] = assigned.map((b) => ({
                id: b.id, day: dateOnly(new Date(bookingStart(b))), start: bookingStart(b), end: bookingEnd(b),
                title: b.session_label || b.session_type.replaceAll("_", " "), member: memberName(b), branch: b.branch, status: b.status,
              })).sort((a, b) => a.start.localeCompare(b.start))
              const coveredSlots = new Set(assigned.map((b) => b.slot_id))
              const openAvailability = available.filter((s) => !coveredSlots.has(s.id))
              return (
                <section key={coach.key} className="rounded-[24px] border border-white/10 bg-[#141414] p-4 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25324a] font-black text-[#ff9b54]">{coach.name.slice(0, 2).toUpperCase()}</div>
                      <div><h2 className="text-lg font-black">{coach.name}</h2><p className="text-xs text-white/45">{coach.branches.join(" · ") || "Branch not assigned"} · {coach.rosterOnly ? "Member-roster name; account not linked" : "Linked account"}</p></div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-[#25324a] px-3 py-1.5">{confirmed} booked</span>
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-300">{complete} completed</span>
                      <span className="rounded-full bg-white/10 px-3 py-1.5">{bookedDays.size} scheduled days</span>
                      {issues > 0 && <span className="rounded-full bg-amber-500/15 px-3 py-1.5 text-amber-200">{issues} overlap checks</span>}
                    </div>
                  </div>

                  {coach.rosterOnly && <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">This coach appears in member assignments but is not matched to a staff login. Their work schedule cannot be reliably linked until a coach account is assigned.</p>}

                  <div className="mt-4 grid grid-cols-7 gap-1.5 md:gap-2">
                    {period.days.map((day) => {
                      const dayBookings = assigned.filter((b) => dateOnly(new Date(bookingStart(b))) === day)
                      const daySlots = available.filter((s) => dateOnly(new Date(s.start_at)) === day)
                      const done = dayBookings.filter((b) => b.status === "completed").length
                      const pending = dayBookings.filter((b) => b.status === "confirmed").length
                      const open = daySlots.filter((s) => !coveredSlots.has(s.id)).length
                      return (
                        <button key={day} type="button" onClick={() => { setAnchor(day); setView("day") }}
                          title={labelDate(day, { weekday: "long", month: "short", day: "numeric" })}
                          className={dayBookings.length ? "min-h-20 rounded-xl border border-[#ff7a1a]/40 bg-[#ff7a1a]/15 p-1.5 text-left hover:bg-[#ff7a1a]/25" : open ? "min-h-20 rounded-xl border border-blue-400/20 bg-blue-400/10 p-1.5 text-left hover:bg-blue-400/15" : "min-h-20 rounded-xl border border-white/10 bg-white/[.025] p-1.5 text-left hover:bg-white/10"}>
                          <span className="block text-[10px] text-white/50">{labelDate(day, { weekday: "short" })}</span>
                          <span className="block text-sm font-black">{asUTC(day).getUTCDate()}</span>
                          <span className="mt-1 block text-[10px] leading-tight text-white/65">{dayBookings.length ? String(pending) + " booked · " + String(done) + " done" : open ? String(open) + " open slots" : "—"}</span>
                        </button>
                      )
                    })}
                  </div>
                  {view === "day" && (
                    <div className="mt-5">
                      <h3 className="mb-3 text-sm font-bold text-white/80">Daily activity</h3>
                      {dayRows.length === 0 && <p className="rounded-xl bg-white/5 p-4 text-sm text-white/50">{openAvailability.length ? "Open availability recorded, but no confirmed member sessions." : "No scheduled member sessions recorded for this coach."}</p>}
                      <div className="space-y-2">
                        {dayRows.map((item) => {
                          const late = item.status === "confirmed" && Date.parse(item.end) < now
                          const ongoing = item.status === "confirmed" && Date.parse(item.start) <= now && Date.parse(item.end) >= now
                          const status = item.status === "completed" ? "Completed" : item.status === "no_show" ? "Member no-show" : late ? "Past-due · verify" : ongoing ? "In scheduled time" : "Scheduled"
                          return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#101725] p-3.5">
                            <div><p className="font-semibold">{time(item.start)} – {time(item.end)} · {item.title}</p><p className="mt-1 text-xs text-white/50">{item.member} · {item.branch}</p></div>
                            <span className={late ? "rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200" : item.status === "completed" ? "rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300" : "rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/70"}>{status}</span>
                          </div>
                        })}
                      </div>
                      {openAvailability.length > 0 && <p className="mt-3 text-xs text-blue-200/70">{openAvailability.length} open availability slots; these are not confirmed work sessions.</p>}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#101725] p-4">
          <p className="text-sm text-white/55">{noShows} member no-show records in this period. To create or change coach slots, use the Schedule Workspace.</p>
          <Link href="/staff/schedule" className="rounded-xl bg-[#ff7a1a] px-4 py-3 text-sm font-bold">Manage schedule</Link>
        </div>
      </div>
    </StaffAppShell>
  )
}

function Summary({ icon: Icon, title, value }: { icon: typeof UsersRound; title: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
    <div className="flex items-center gap-2 text-white/45"><Icon size={15} /><span className="text-xs font-semibold">{title}</span></div>
    <p className="mt-2 text-2xl font-black">{value}</p>
  </div>
}
