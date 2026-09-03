"use client"

import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type {
  BookingRow,
  MemberRow,
  PackageAlert,
  PaymentRow,
  ProfileRow,
  SessionLogRow,
} from "@/lib/member-account"
import {
  Activity,
  Bell,
  CalendarDays,
  CreditCard,
  Home,
  LogOut,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  User as UserIcon,
  Wallet,
} from "lucide-react"

const supabase = createClient()

type Props = {
  userEmail: string | null
  userFullName: string | null
  member: MemberRow | null
  profile: ProfileRow | null
  sessionLogs: SessionLogRow[]
  payments: PaymentRow[]
  upcomingBookings: BookingRow[]
  coachNames: Record<string, string>
  packageEligibility: Record<string, unknown>
  packageAlerts: PackageAlert[]
  loadError: string | null
}

const navItems = [
  { label: "Home", icon: Home, href: "/member/dashboard" },
  { label: "Schedule", icon: CalendarDays, href: "/member/schedule" },
  { label: "Payments", icon: CreditCard, href: "#payments" },
  { label: "Profile", icon: UserIcon, href: "/member/profile" },
]

function formatDateTime(iso: string | null) {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "BF"
  )
}

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (["active", "paid", "completed", "approved", "confirmed"].includes(normalized)) {
    return "bg-emerald-500/15 text-emerald-300"
  }
  if (["pending", "processing"].includes(normalized)) {
    return "bg-amber-500/15 text-amber-300"
  }
  return "bg-white/10 text-white/70"
}

function alertPriority(alert: PackageAlert) {
  const copy = `${alert.blockingReason ?? ""} ${alert.message ?? ""}`
  if (/Payment Due|No sessions|expired/i.test(copy)) return 3
  if (/Last Session/i.test(copy)) return 2
  if (/Renewal Soon/i.test(copy)) return 1
  return 0
}

export default function BearfitDashboardClient({
  userEmail,
  userFullName,
  member,
  profile,
  sessionLogs,
  payments,
  upcomingBookings,
  coachNames,
  packageEligibility,
  packageAlerts,
  loadError,
}: Props) {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/welcome"
  }

  const displayName =
    member?.full_name ||
    member?.name ||
    profile?.full_name ||
    userFullName ||
    userEmail?.split("@")[0] ||
    "Member"

  const membershipId = member?.membership_id || member?.member_code || "Not assigned"
  const branch = member?.branch || profile?.branch || "Not assigned"
  const packageName = member?.package_name || member?.package_type || "No package assigned"
  const membershipStatus = member?.membership_status || member?.status || "Not assigned"
  const paymentStatus = member?.payment_status || "Not recorded"
  const sessionsUsed = member?.sessions_used ?? 0
  const sessionsLeft = member?.sessions_left ?? 0
  const totalSessions = member?.total_sessions ?? 0
  const progress = totalSessions > 0 ? Math.min((sessionsUsed / totalSessions) * 100, 100) : 0
  const primaryPackageAlert = [...packageAlerts].sort((a, b) => alertPriority(b) - alertPriority(a))[0] ?? null
  const primaryPackageMessage = primaryPackageAlert?.blockingReason || primaryPackageAlert?.message || null
  void packageEligibility

  return (
    <main className="min-h-screen bg-[#020b1c] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-[230px] shrink-0 flex-col border-r border-white/10 bg-[#020817] lg:flex">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1f2c45] text-xs font-extrabold text-[#ff7a1a]">
                BF
              </div>
              <div>
                <p className="text-lg font-extrabold tracking-wide">BEARFIT</p>
                <p className="text-[11px] font-medium text-orange-300">Better fitness.</p>
              </div>
            </div>
            <div className="mt-5 inline-flex items-center rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/15 px-3 py-1.5 text-xs font-semibold text-[#ff9b54]">
              Member
            </div>
          </div>

          <nav className="flex-1 space-y-2 border-t border-white/10 px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = item.href === "/member/dashboard"
              const content = (
                <>
                  <Icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </>
              )

              if (item.href.startsWith("#")) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm text-white/75 transition hover:bg-white/5 hover:text-white"
                  >
                    {content}
                  </a>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm transition ${
                    active ? "bg-[#ff7a1a] font-semibold text-white shadow-lg shadow-orange-950/30" : "text-white/75 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {content}
                </Link>
              )
            })}

            <button
              type="button"
              title="More features coming later"
              className="flex w-full cursor-default items-center gap-3 rounded-xl px-4 py-3.5 text-sm text-white/35"
            >
              <MoreHorizontal size={18} />
              <span>More</span>
            </button>
          </nav>

          <div className="space-y-1 border-t border-white/10 p-3">
            <button type="button" title="Notifications coming soon" className="flex w-full cursor-default items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/45">
              <Bell size={17} /> Notifications
            </button>
            <button type="button" title="Messages coming soon" className="flex w-full cursor-default items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/45">
              <MessageCircle size={17} /> Messages
            </button>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white/75 transition hover:bg-white/5"
            >
              <LogOut size={17} /> Sign out
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1180px] px-4 py-5 md:px-6 lg:px-8 lg:py-7">
            <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#24314b] text-sm font-extrabold text-[#ff7a1a] md:h-16 md:w-16">
                  BF
                </div>
                <div className="min-w-0">
                  <div className="inline-flex rounded-full border border-white/10 bg-[#1f2c45] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff9b54]">
                    Member Portal
                  </div>
                  <p className="mt-2 truncate text-sm text-white/50">{branch}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button aria-label="Notifications coming soon" title="Notifications coming soon" className="rounded-2xl bg-[#24314b] p-3 text-white/45">
                  <Bell size={19} />
                </button>
                <button aria-label="Messages coming soon" title="Messages coming soon" className="rounded-2xl bg-[#24314b] p-3 text-white/45">
                  <MessageCircle size={19} />
                </button>
              </div>
            </header>

            <div className="py-5">
              <h1 className="text-2xl font-medium text-white/75 md:text-3xl">
                Welcome, <span className="font-extrabold text-white">{displayName}</span>
              </h1>
              <p className="mt-1 text-sm text-white/40">{userEmail || "Signed-in BearFit member"}</p>
            </div>

            {loadError && (
              <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {loadError}
              </div>
            )}

            {!member ? (
              <div className="rounded-[26px] border border-white/10 bg-[#151515] p-8 text-center shadow-2xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ff7a1a]/15 text-[#ff7a1a]">
                  <UserIcon size={28} />
                </div>
                <h2 className="text-2xl font-bold">Membership record not linked yet</h2>
                <p className="mx-auto mt-3 max-w-xl text-white/60">
                  Your login is working, but we could not find a BearFit membership record for this account. Please ask BearFit staff to verify the account link before sessions or payments are added.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[26px] border border-[#30394a] bg-[#121212] shadow-2xl shadow-black/30">
                <div className="p-4 md:p-6">
                  <section className="flex flex-col gap-5 md:flex-row md:items-center">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[3px] border-[#ff7a1a] bg-[#25324a] text-2xl font-extrabold text-[#ff9b54]">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt={`${displayName} profile`} className="h-full w-full object-cover" />
                      ) : (
                        initials(displayName)
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-extrabold md:text-3xl">{packageName}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(membershipStatus)}`}>
                          {membershipStatus}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
                        <span>Package Progress</span>
                        <span>{sessionsUsed} of {totalSessions} sessions used</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#243246]">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-amber-400" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm text-white/55">
                        <span>{sessionsLeft} sessions remaining</span>
                        <Link href="/member/profile" className="font-semibold text-[#ff7a1a] transition hover:text-[#ff9b54]">
                          View Profile
                        </Link>
                      </div>
                    </div>
                  </section>

                  <section className="mt-6 rounded-[22px] border border-white/[0.04] bg-[#1c1c1c] px-5 py-6 text-center md:px-8">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-400">Membership ID</p>
                    <p className="mt-1 break-words text-4xl font-black tracking-tight md:text-5xl">{membershipId}</p>
                    <p className="mt-2 flex items-center justify-center gap-2 text-lg text-white/55 md:text-xl">
                      <MapPin size={18} className="text-[#ff7a1a]" /> {branch}
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                      <span className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${statusClass(membershipStatus)}`}>
                        Membership: {membershipStatus}
                      </span>
                      <span className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${statusClass(paymentStatus)}`}>
                        Payment: {paymentStatus}
                      </span>
                    </div>
                  </section>

                  <section className="mt-6">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/45">Your Stats</p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricCard label="Sessions Used" value={String(sessionsUsed)} sublabel="Completed sessions" />
                      <MetricCard label="Sessions Remaining" value={String(sessionsLeft)} sublabel="Available sessions" />
                      <MetricCard label="Total Sessions" value={String(totalSessions)} sublabel={packageName} />
                      <MetricCard label="Total Paid" value={formatMoney(member.total_paid)} sublabel={`Status: ${paymentStatus}`} />
                    </div>
                  </section>

                  {primaryPackageMessage && (
                    <section className={`mt-6 rounded-2xl border px-5 py-4 ${alertPriority(primaryPackageAlert!) >= 2 ? "border-orange-400/35 bg-orange-400/10 text-orange-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">Package notice</p>
                      <p className="mt-1 font-semibold">{primaryPackageMessage}</p>
                      <p className="mt-1 text-xs opacity-70">Payment Due, Renewal Soon, and Last Session notices are calculated from your current package status.</p>
                    </section>
                  )}

                  <section className="mt-7">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-xl font-extrabold md:text-2xl">Upcoming Sessions</h3>
                      <Link href="/member/schedule" className="rounded-full bg-[#ff7a1a] px-4 py-2 text-xs font-bold transition hover:bg-[#ff8b38] md:text-sm">
                        Manage Schedule
                      </Link>
                    </div>

                    {upcomingBookings.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-white/15 bg-[#191919] p-7 text-center">
                        <CalendarDays className="mx-auto text-[#ff7a1a]" size={30} />
                        <h4 className="mt-3 text-lg font-semibold">No confirmed sessions yet</h4>
                        <p className="mx-auto mt-2 max-w-lg text-sm text-white/50">Choose an available slot or send a custom request from Schedule.</p>
                        <Link href="/member/schedule" className="mt-4 inline-flex rounded-full bg-white/10 px-5 py-2 text-sm font-semibold hover:bg-white/15">
                          Book a Session
                        </Link>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {upcomingBookings.map((booking) => {
                          const coachName = booking.assigned_coach_user_id
                            ? coachNames[booking.assigned_coach_user_id] || "Coach assigned"
                            : "Any available coach"

                          return (
                            <div key={booking.id} className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#101920] p-5 md:p-6">
                              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,122,26,0.24),transparent_34%),linear-gradient(115deg,rgba(5,16,28,0.95),rgba(18,18,18,0.76))]" />
                              <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
                                <div>
                                  <span className="rounded-full bg-[#ff7a1a] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">Upcoming</span>
                                  <h4 className="mt-3 text-2xl font-black capitalize md:text-3xl">{booking.session_type.replaceAll("_", " ")} Session</h4>
                                  <p className="mt-2 text-sm text-white/60">{booking.branch} • {formatDateTime(booking.start_at || booking.requested_start_at)}</p>
                                  <p className="mt-1 text-sm font-semibold text-[#ff9b54]">Coach {coachName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300">Confirmed</span>
                                  <Link href="/member/schedule" className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15">Details</Link>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  <section className="mt-7 rounded-[24px] bg-[#171717] p-4 md:p-5">
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <div>
                        <h3 className="text-xl font-extrabold">Member Activity</h3>
                        <p className="mt-1 text-sm text-white/40">Your real session and payment history</p>
                      </div>
                      <Activity size={22} className="text-[#ff7a1a]" />
                    </div>

                    <div className="grid gap-5 pt-5 xl:grid-cols-2">
                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="font-bold">Recent Session Activity</h4>
                          <Activity size={17} className="text-white/35" />
                        </div>
                        {sessionLogs.length === 0 ? (
                          <EmptyState text="No completed sessions have been recorded yet." />
                        ) : (
                          <div className="space-y-2">
                            {sessionLogs.slice(0, 5).map((log) => (
                              <div key={log.id} className="grid gap-2 rounded-2xl bg-white/[0.035] px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                                <div>
                                  <p className="font-semibold">Training session</p>
                                  <p className="mt-1 text-xs text-white/45">{log.notes || formatDateTime(log.trained_at)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-white/45">{formatDateTime(log.trained_at)}</p>
                                  <p className="mt-1 text-sm font-bold text-[#ff9b54]">{log.sessions_left_after} left</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div id="payments">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="font-bold">Recent Payments</h4>
                          <Wallet size={17} className="text-white/35" />
                        </div>
                        {payments.length === 0 ? (
                          <EmptyState text="No payment records are available yet." />
                        ) : (
                          <div className="space-y-2">
                            {payments.slice(0, 5).map((payment) => (
                              <div key={payment.id} className="grid gap-2 rounded-2xl bg-white/[0.035] px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                                <div>
                                  <p className="font-semibold">{payment.package_name || payment.stage || "Membership payment"}</p>
                                  <p className="mt-1 text-xs text-white/45">{payment.payment_type || formatDateTime(payment.paid_at || payment.payment_date || payment.created_at)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold">{formatMoney(payment.amount)}</p>
                                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${statusClass(payment.status)}`}>
                                    {payment.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="mt-7 overflow-hidden rounded-[24px] border border-orange-300/20 bg-[radial-gradient(circle_at_75%_35%,rgba(255,255,255,0.16),transparent_20%),linear-gradient(110deg,#ff6b0a,#ff8a2a)] p-6 md:p-8">
                    <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/75">Schedule</p>
                    <h3 className="mt-2 text-2xl font-black md:text-3xl">Book your next session</h3>
                    <p className="mt-2 max-w-2xl text-sm text-white/80 md:text-base">View available BearFit slots, choose your coach, or send a custom session request.</p>
                    <Link href="/member/schedule" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#202020] transition hover:bg-white/90">
                      Open Schedule
                    </Link>
                  </section>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-center gap-2 lg:hidden">
              <Link href="/member/dashboard" className="rounded-full bg-[#ff7a1a] px-4 py-2.5 text-sm font-semibold">Home</Link>
              <Link href="/member/schedule" className="rounded-full bg-[#25324a] px-4 py-2.5 text-sm font-semibold">Schedule</Link>
              <Link href="/member/profile" className="rounded-full bg-[#25324a] px-4 py-2.5 text-sm font-semibold">Profile</Link>
              <button onClick={handleSignOut} className="rounded-full bg-[#25324a] px-4 py-2.5 text-sm font-semibold">Sign out</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function MetricCard({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="rounded-[20px] border border-white/[0.04] bg-[#242424] p-5">
      <p className="text-sm text-white/45">{label}</p>
      <p className="mt-1 break-words text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-white/45">{sublabel}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-7 text-center text-sm text-white/40">{text}</div>
}
