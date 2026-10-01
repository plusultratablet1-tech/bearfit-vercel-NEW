import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Dumbbell,
  Mail,
  MapPin,
  Package,
  Phone,
  Trophy,
  UserRound,
} from "lucide-react"
import StaffAppShell from "@/components/bearfit/StaffAppShell"
import { createClient } from "@/lib/supabase/server"
import { displaySessionLabel } from "@/lib/session-taxonomy"

type Member = {
  id: string
  user_id: string | null
  member_code: string | null
  membership_id: string | null
  name: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  branch: string | null
  coach_name: string | null
  package_name: string | null
  package_type: string | null
  status: string | null
  membership_status: string | null
  total_sessions: number | null
  sessions_used: number | null
  sessions_left: number | null
  payment_status: string | null
  last_paid_at: string | null
  last_paid_amount: number | null
  total_paid: number | null
  join_date: string | null
  is_demo: boolean | null
}

type Profile = {
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  branch: string | null
}

type PackageCycle = {
  id: string
  package_id: string
  status: string
  sessions_total: number
  sessions_used: number
  sessions_left: number
  starts_at: string | null
  expires_at: string | null
  created_at: string
}

type PackageDefinition = {
  id: string
  code: string
  name: string
  service_category: string
  included_sessions: number
  validity_days: number | null
}

type SessionLog = {
  id: string
  trained_at: string
  notes: string | null
  sessions_left_after: number
  booking_id: string | null
  member_package_id: string | null
  session_label: string | null
}

type Booking = {
  id: string
  status: string
  branch: string
  session_type: string
  session_label: string | null
  requested_start_at: string
  start_at: string | null
  end_at: string | null
  assigned_coach_user_id: string | null
  requested_coach_user_id: string | null
  member_package_id: string | null
  no_show_charged: boolean
}

type Payment = {
  id: string
  package_name: string | null
  stage: string | null
  amount: number | null
  status: string | null
  payment_type: string | null
  payment_date: string | null
  created_at: string
  paid_at: string | null
  sessions_purchased: number
  member_package_id: string | null
}

type PointEvent = {
  id: string
  event_type: string
  points: number
  season_key: string
  occurred_at: string
}

function money(value: number | null) {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value)
}

function dateTime(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function shortDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function tone(status: string | null) {
  const normalized = (status ?? "").toLowerCase()
  if (["active", "paid", "completed", "confirmed"].includes(normalized)) return "bg-emerald-500/15 text-emerald-300"
  if (["pending"].includes(normalized)) return "bg-amber-500/15 text-amber-300"
  if (["inactive", "expired", "cancelled", "rejected", "no_show"].includes(normalized)) return "bg-red-500/15 text-red-300"
  return "bg-white/10 text-white/60"
}

export default async function StaffMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: memberId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = staffProfile?.role ?? "member"
  if (role !== "staff" && role !== "admin") redirect("/member/dashboard")

  const [memberResult, profileResult, cyclesResult, definitionsResult, sessionsResult, bookingsResult, paymentsResult, pointsResult] =
    await Promise.all([
      supabase.from("members").select("*").eq("id", memberId).maybeSingle(),
      supabase.from("profiles").select("full_name,phone,avatar_url,branch").eq("member_id", memberId).maybeSingle(),
      supabase.from("member_package_cycles").select("*").eq("member_id", memberId).order("created_at", { ascending: false }),
      supabase.from("package_definitions").select("id,code,name,service_category,included_sessions,validity_days"),
      supabase.from("session_logs").select("id,trained_at,notes,sessions_left_after,booking_id,member_package_id,session_label").eq("member_id", memberId).order("trained_at", { ascending: false }).limit(50),
      supabase.from("bookings").select("id,status,branch,session_type,session_label,requested_start_at,start_at,end_at,assigned_coach_user_id,requested_coach_user_id,member_package_id,no_show_charged").eq("member_id", memberId).order("requested_start_at", { ascending: false }).limit(50),
      supabase.from("payments").select("id,package_name,stage,amount,status,payment_type,payment_date,created_at,paid_at,sessions_purchased,member_package_id").eq("member_id", memberId).order("created_at", { ascending: false }).limit(50),
      supabase.from("bearforce_point_events").select("id,event_type,points,season_key,occurred_at").eq("member_id", memberId).order("occurred_at", { ascending: false }).limit(100),
    ])

  const member = memberResult.data as Member | null
  if (!member) notFound()

  const profile = profileResult.data as Profile | null
  const cycles = (cyclesResult.data ?? []) as PackageCycle[]
  const definitions = (definitionsResult.data ?? []) as PackageDefinition[]
  const sessionLogs = (sessionsResult.data ?? []) as SessionLog[]
  const bookings = (bookingsResult.data ?? []) as Booking[]
  const payments = (paymentsResult.data ?? []) as Payment[]
  const pointEvents = (pointsResult.data ?? []) as PointEvent[]

  const coachIds = [...new Set(bookings.flatMap((booking) => [booking.assigned_coach_user_id, booking.requested_coach_user_id]).filter((id): id is string => Boolean(id)))]
  const { data: coaches } = coachIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", coachIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> }

  const coachNames = Object.fromEntries((coaches ?? []).map((coach) => [coach.id, coach.full_name || "Coach"]))
  const packageMap = new Map(definitions.map((definition) => [definition.id, definition]))
  const activeCycle = cycles.find((cycle) => cycle.status === "active") ?? cycles[0] ?? null
  const activeDefinition = activeCycle ? packageMap.get(activeCycle.package_id) : null
  const displayName = member.full_name || member.name || profile?.full_name || member.email || "Member"
  const packageDisplay = activeDefinition?.name || member.package_name || member.package_type || "No package assigned"
  const branch = member.branch || profile?.branch || "No branch assigned"
  const membershipStatus = member.membership_status || member.status || "unknown"
  const totalSessions = activeCycle?.sessions_total ?? member.total_sessions ?? 0
  const sessionsUsed = activeCycle?.sessions_used ?? member.sessions_used ?? 0
  const sessionsLeft = activeCycle?.sessions_left ?? member.sessions_left ?? 0
  const pointBalance = pointEvents.reduce((total, event) => total + event.points, 0)
  const paidTotal = payments.filter((payment) => payment.status === "paid").reduce((total, payment) => total + (payment.amount ?? 0), 0)
  const upcoming = bookings.filter((booking) => {
    const time = booking.start_at || booking.requested_start_at
    return new Date(time).getTime() >= Date.now() && ["pending", "confirmed"].includes(booking.status)
  })

  const loadErrors = [
    memberResult.error,
    profileResult.error,
    cyclesResult.error,
    definitionsResult.error,
    sessionsResult.error,
    bookingsResult.error,
    paymentsResult.error,
    pointsResult.error,
  ]
    .filter(Boolean)
    .map((error) => error?.message)
    .filter(Boolean)

  return (
    <StaffAppShell activePath="/staff/members" role={role}>
      <div className="mx-auto max-w-7xl px-4 py-5 pb-28 md:px-6 lg:px-8 lg:py-7 lg:pb-7">
        <Link href="/staff/members" className="inline-flex items-center gap-2 text-sm font-semibold text-white/50 hover:text-white">
          <ArrowLeft size={16} /> Members
        </Link>

        <header className="mt-4 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border-2 border-[#ff7a1a] bg-[#25324a] text-xl font-black text-[#ff9b54]">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                displayName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("") || "BF"
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#ff9b54]">
                {member.member_code || member.membership_id || "Member"}
              </p>
              <h1 className="mt-1 truncate text-2xl font-black md:text-4xl">{displayName}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${tone(membershipStatus)}`}>
                  {membershipStatus}
                </span>
                {member.is_demo && <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-300">Demo member</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/payments?memberId=${member.id}`} className="rounded-xl bg-[#25324a] px-4 py-3 text-sm font-bold">
              Record Payment
            </Link>
            <Link href="/checkin" className="rounded-xl bg-[#ff7a1a] px-4 py-3 text-sm font-bold">
              Check In
            </Link>
          </div>
        </header>

        {loadErrors.length > 0 && (
          <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
            Some member details could not be loaded: {loadErrors.join(" · ")}
          </div>
        )}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Summary icon={Dumbbell} label="Sessions left" value={String(sessionsLeft)} />
          <Summary icon={Dumbbell} label="Sessions used" value={String(sessionsUsed)} />
          <Summary icon={CalendarDays} label="Upcoming" value={String(upcoming.length)} />
          <Summary icon={CircleDollarSign} label="Paid total" value={money(paidTotal)} />
          <Summary icon={Trophy} label="Points events" value={String(pointBalance)} />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_1.95fr]">
          <div className="space-y-5">
            <Card title="Member details" icon={UserRound}>
              <Detail icon={MapPin} label="Branch" value={branch} />
              <Detail icon={UserRound} label="Coach" value={member.coach_name || "Not assigned"} />
              <Detail icon={Package} label="Current package" value={packageDisplay} />
              <Detail icon={Mail} label="Email" value={member.email || "—"} />
              <Detail icon={Phone} label="Phone" value={member.phone || profile?.phone || "—"} />
              <Detail icon={CalendarDays} label="Joined" value={shortDate(member.join_date)} />
              <Detail icon={CircleDollarSign} label="Payment status" value={member.payment_status || "Not recorded"} />
            </Card>

            <Card title="Current package" icon={Package}>
              {activeCycle ? (
                <>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-xs font-bold uppercase tracking-[.14em] text-white/35">
                      {activeDefinition?.code || "Package"}
                    </p>
                    <h3 className="mt-1 text-xl font-black">{packageDisplay}</h3>
                    <p className="mt-1 text-sm text-white/50">
                      {activeDefinition?.service_category?.replaceAll("_", " ") || "Service category not recorded"}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Mini label="Total" value={activeCycle.sessions_total} />
                    <Mini label="Used" value={activeCycle.sessions_used} />
                    <Mini label="Left" value={activeCycle.sessions_left} />
                  </div>
                  <p className="mt-3 text-xs text-white/40">
                    Started {shortDate(activeCycle.starts_at)} · Expires {shortDate(activeCycle.expires_at)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-white/45">No package cycle recorded.</p>
              )}
            </Card>

            <Card title="Package history" icon={Package}>
              <div className="space-y-3">
                {cycles.length === 0 ? (
                  <p className="text-sm text-white/45">No package history.</p>
                ) : (
                  cycles.map((cycle) => {
                    const definition = packageMap.get(cycle.package_id)
                    return (
                      <div key={cycle.id} className="rounded-2xl bg-white/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{definition?.name || "Package"}</p>
                            <p className="text-xs text-white/40">{definition?.code || cycle.package_id}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${tone(cycle.status)}`}>
                            {cycle.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-white/55">
                          {cycle.sessions_left} left · {cycle.sessions_used} used · {cycle.sessions_total} total
                        </p>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card title="Session history" icon={Dumbbell}>
              <div className="space-y-3">
                {sessionLogs.length === 0 ? (
                  <p className="text-sm text-white/45">No completed sessions yet.</p>
                ) : (
                  sessionLogs.map((session) => (
                    <div key={session.id} className="flex flex-col gap-2 rounded-2xl bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold">{session.session_label || "Training session"}</p>
                        <p className="mt-1 text-xs text-white/45">{dateTime(session.trained_at)}</p>
                        {session.notes && <p className="mt-2 text-sm text-white/55">{session.notes}</p>}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xs uppercase tracking-[.12em] text-white/35">Sessions left after</p>
                        <p className="mt-1 text-2xl font-black text-[#ff9b54]">{session.sessions_left_after}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Bookings & schedule" icon={CalendarDays}>
              <div className="space-y-3">
                {bookings.length === 0 ? (
                  <p className="text-sm text-white/45">No bookings recorded.</p>
                ) : (
                  bookings.map((booking) => {
                    const coachId = booking.assigned_coach_user_id || booking.requested_coach_user_id
                    return (
                      <div key={booking.id} className="rounded-2xl bg-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{displaySessionLabel(booking.session_label, booking.session_type)}</p>
                            <p className="mt-1 text-xs text-white/45">
                              {dateTime(booking.start_at || booking.requested_start_at)}
                            </p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${tone(booking.status)}`}>
                            {booking.status.replaceAll("_", " ")}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-white/50 sm:grid-cols-2">
                          <p>{booking.branch}</p>
                          <p>{coachId ? coachNames[coachId] || "Coach" : "Any available coach"}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>

            <Card title="Payments" icon={CircleDollarSign}>
              <div className="space-y-3">
                {payments.length === 0 ? (
                  <p className="text-sm text-white/45">No payments recorded.</p>
                ) : (
                  payments.map((payment) => (
                    <div key={payment.id} className="rounded-2xl bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{payment.package_name || "Membership payment"}</p>
                          <p className="mt-1 text-xs text-white/45">
                            {payment.stage || "Payment"} · {payment.payment_type || "Method not recorded"}
                          </p>
                        </div>
                        <p className="font-black">{money(payment.amount)}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-white/40">{dateTime(payment.paid_at || payment.payment_date || payment.created_at)}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${tone(payment.status)}`}>
                          {payment.status || "pending"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Bearforce activity" icon={Trophy}>
              <div className="space-y-3">
                {pointEvents.length === 0 ? (
                  <p className="text-sm text-white/45">No Bearforce point events recorded.</p>
                ) : (
                  pointEvents.slice(0, 12).map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-4">
                      <div>
                        <p className="font-bold">{event.event_type.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-xs text-white/40">{dateTime(event.occurred_at)} · {event.season_key}</p>
                      </div>
                      <p className={`text-lg font-black ${event.points >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {event.points >= 0 ? "+" : ""}{event.points}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </section>
      </div>
    </StaffAppShell>
  )
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Dumbbell
  label: string
  value: string
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#141414] p-4">
      <div className="flex items-center gap-2 text-white/40">
        <Icon size={16} />
        <p className="text-xs font-bold uppercase tracking-[.13em]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  )
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof UserRound
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-[#141414] p-5">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-[#ff7a1a]" />
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin
  label: string
  value: string
}) {
  return (
    <div className="flex gap-3 border-b border-white/[.06] py-3 last:border-0">
      <Icon size={17} className="mt-0.5 shrink-0 text-[#ff7a1a]" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-white/35">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-white/75">{value}</p>
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-white/35">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  )
}
