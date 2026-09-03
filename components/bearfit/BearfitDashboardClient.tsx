"use client"

import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type {
  MemberRow,
  PaymentRow,
  ProfileRow,
  SessionLogRow,
  BookingRow,
  PackageAlert,
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
  packageEligibility: Record<string, unknown>
  packageAlerts: PackageAlert[]
  loadError: string | null
}

const navItems = [
  { label: "Home", icon: Home, href: "/member/dashboard" },
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
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BF"
}

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (["active", "paid", "completed", "approved"].includes(normalized)) {
    return "bg-emerald-500/15 text-emerald-300"
  }
  if (["pending", "processing"].includes(normalized)) {
    return "bg-amber-500/15 text-amber-300"
  }
  return "bg-white/10 text-white/70"
}

export default function BearfitDashboardClient({
  userEmail,
  userFullName,
  member,
  profile,
  sessionLogs,
  payments,
  upcomingBookings,
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
  const alertPriority = (alert: PackageAlert) => {
    const copy = `${alert.blockingReason ?? ""} ${alert.message ?? ""}`
    if (/Payment Due|No sessions|expired/i.test(copy)) return 3
    if (/Last Session/i.test(copy)) return 2
    if (/Renewal Soon/i.test(copy)) return 1
    return 0
  }
  const primaryPackageAlert = [...packageAlerts].sort((a, b) => alertPriority(b) - alertPriority(a))[0] ?? null
  const primaryPackageMessage = primaryPackageAlert?.blockingReason || primaryPackageAlert?.message || null
  void packageEligibility

  return (
    <main className="min-h-screen bg-[#020b1c] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-[260px] flex-col border-r border-white/10 bg-black/30 lg:flex">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1d2a44] text-sm font-bold text-[#ff7a1a]">
                BF
              </div>
              <div>
                <p className="text-xl font-extrabold tracking-wide">BEARFIT</p>
                <p className="text-xs text-orange-300">Better fitness.</p>
              </div>
            </div>

            <div className="mt-5 inline-flex rounded-full bg-[#ff7a1a]/15 px-4 py-2 text-xs font-semibold capitalize text-[#ff9b54]">
              {profile?.role || "member"} account
            </div>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 transition ${
                    item.href === "/member/dashboard"
                      ? "bg-[#ff7a1a] text-white"
                      : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}

            <Link href="/member/schedule" className="flex items-center gap-3 rounded-2xl px-4 py-4 text-white/80 hover:bg-white/5">
              <CalendarDays size={18} />
              <span className="font-medium">Schedule</span>
            </Link>
            <a
              href="#payments"
              className="flex items-center gap-3 rounded-2xl px-4 py-4 text-white/80 hover:bg-white/5"
            >
              <CreditCard size={18} />
              <span className="font-medium">Payments</span>
            </a>
          </nav>

          <div className="border-t border-white/10 p-4">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white/80 hover:bg-white/5"
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#25324a] font-bold text-[#ff7a1a] md:h-20 md:w-20">
                  BF
                </div>
                <div>
                  <p className="text-sm text-white/55">Member Dashboard</p>
                  <p className="text-lg font-semibold text-white">{branch}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  aria-label="Notifications coming soon"
                  title="Notifications coming soon"
                  className="rounded-2xl bg-[#25324a] p-3 text-white/45 md:p-4"
                >
                  <Bell size={20} />
                </button>
                <button
                  aria-label="Messages coming soon"
                  title="Messages coming soon"
                  className="rounded-2xl bg-[#25324a] p-3 text-white/45 md:p-4"
                >
                  <MessageCircle size={20} />
                </button>
              </div>
            </div>

            <div className="mb-6 border-t border-white/10 pt-5">
              <p className="text-2xl font-medium text-white/80">
                Welcome, <span className="font-bold text-white">{displayName}</span>
              </p>
              <p className="mt-1 text-sm text-white/45">{userEmail || "Signed-in BearFit member"}</p>
            </div>

            {loadError && (
              <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {loadError}
              </div>
            )}

            {!member ? (
              <div className="rounded-[28px] border border-white/10 bg-[#141414] p-8 text-center shadow-2xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ff7a1a]/15 text-[#ff7a1a]">
                  <UserIcon size={28} />
                </div>
                <h2 className="text-2xl font-bold">Membership record not linked yet</h2>
                <p className="mx-auto mt-3 max-w-xl text-white/60">
                  Your login is working, but we could not find a BearFit membership record for this account.
                  Please ask BearFit staff to verify the account link before sessions or payments are added.
                </p>
              </div>
            ) : (
              <div className="rounded-[28px] border border-[#2d3748] bg-[#141414] p-4 shadow-2xl md:p-6">
                <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-center">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-[#ff7a1a] bg-[#25324a] text-2xl font-extrabold text-[#ff9b54]">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={`${displayName} profile`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials(displayName)
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold">{packageName}</h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(membershipStatus)}`}>
                        {membershipStatus}
                      </span>
                    </div>

                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#243246]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-500 via-lime-400 to-yellow-400"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm text-white/65">
                      <span>
                        {sessionsUsed} used · {sessionsLeft} remaining · {totalSessions} total
                      </span>
                      <Link href="/member/profile" className="font-medium text-[#ff7a1a] hover:text-[#ff9b54]">
                        View Profile
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="mb-6 rounded-[24px] bg-[#1d1d1d] p-6">
                  <div className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-green-400">
                    Membership ID
                  </div>
                  <div className="mt-1 break-words text-center text-4xl font-extrabold md:text-5xl">
                    {membershipId}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 text-center text-lg text-white/65 md:text-2xl">
                    <MapPin size={18} className="text-[#ff7a1a]" />
                    {branch}
                  </div>

                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <span className={`rounded-full px-4 py-2 text-sm capitalize ${statusClass(membershipStatus)}`}>
                      Membership: {membershipStatus}
                    </span>
                    <span className={`rounded-full px-4 py-2 text-sm capitalize ${statusClass(paymentStatus)}`}>
                      Payment: {paymentStatus}
                    </span>
                  </div>
                </div>

                <section className="mb-8">
                  <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">
                    Your Stats
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Sessions Used" value={String(sessionsUsed)} sublabel="Completed sessions" />
                    <MetricCard label="Sessions Remaining" value={String(sessionsLeft)} sublabel="Available sessions" />
                    <MetricCard label="Total Sessions" value={String(totalSessions)} sublabel={packageName} />
                    <MetricCard label="Total Paid" value={formatMoney(member.total_paid)} sublabel={`Status: ${paymentStatus}`} />
                  </div>
                </section>

                <section className="mb-8">
                  {primaryPackageMessage && (
                    <div className={`mb-4 rounded-2xl border px-5 py-4 ${alertPriority(primaryPackageAlert!) >= 2 ? "border-orange-400/35 bg-orange-400/10 text-orange-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">Package notice</p>
                      <p className="mt-1 font-semibold">{primaryPackageMessage}</p>
                      <p className="mt-1 text-xs opacity-70">Payment Due, Renewal Soon, and Last Session notices are calculated from your current package status.</p>
                    </div>
                  )}

                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-2xl font-bold">Upcoming Sessions</h3>
                    <Link href="/member/schedule" className="rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-semibold">Manage Schedule</Link>
                  </div>

                  {upcomingBookings.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-white/15 bg-[#191919] p-7 text-center">
                      <CalendarDays className="mx-auto text-[#ff7a1a]" size={30} />
                      <h4 className="mt-3 text-lg font-semibold">No confirmed sessions yet</h4>
                      <p className="mx-auto mt-2 max-w-lg text-sm text-white/50">Choose an available slot or send a custom request from Schedule.</p>
                      <Link href="/member/schedule" className="mt-4 inline-flex rounded-full bg-white/10 px-5 py-2 text-sm font-semibold">Book a Session</Link>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {upcomingBookings.map((booking) => (
                        <div key={booking.id} className="rounded-[28px] border border-white/10 bg-gradient-to-r from-[#191919] to-[#232323] p-5 md:p-6">
                          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                            <div>
                              <span className="rounded-full bg-[#ff7a1a]/15 px-3 py-1 text-xs font-bold uppercase text-[#ff9b54]">{booking.status}</span>
                              <h4 className="mt-3 text-xl font-bold capitalize">{booking.session_type.replaceAll("_", " ")} Session</h4>
                              <p className="mt-1 text-sm text-white/60">{booking.assigned_coach_user_id ? "Coach assigned" : "Any available coach"} • {booking.branch}</p>
                              <p className="mt-1 text-sm text-white/75">{formatDateTime(booking.start_at || booking.requested_start_at)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300">Confirmed</span>
                              <Link href="/member/schedule" className="rounded-full bg-[#25324a] px-4 py-2 text-sm font-semibold">Manage</Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="mb-8 rounded-[28px] bg-[#171717] p-4 md:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-xl font-bold">Recent Session Activity</h3>
                      <p className="text-sm text-white/45">Latest check-ins recorded by BearFit staff</p>
                    </div>
                    <Activity size={22} className="text-[#ff7a1a]" />
                  </div>

                  {sessionLogs.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 px-4 py-8 text-center text-sm text-white/50">
                      No completed sessions have been recorded yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {sessionLogs.map((log) => (
                        <div key={log.id} className="grid gap-3 py-4 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
                          <div>
                            <p className="font-semibold">Training session</p>
                            <p className="mt-1 text-sm text-white/50">{log.notes || "No staff notes"}</p>
                          </div>
                          <p className="text-sm text-white/65">{formatDateTime(log.trained_at)}</p>
                          <span className="text-sm font-semibold text-[#ff9b54]">
                            {log.sessions_left_after} left
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section id="payments" className="rounded-[28px] bg-[#171717] p-4 md:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-xl font-bold">Recent Payments</h3>
                      <p className="text-sm text-white/45">Payment records linked to your membership</p>
                    </div>
                    <Wallet size={22} className="text-[#ff7a1a]" />
                  </div>

                  {payments.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 px-4 py-8 text-center text-sm text-white/50">
                      No payment records are available yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {payments.map((payment) => (
                        <div key={payment.id} className="grid gap-3 py-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
                          <div>
                            <p className="font-semibold">{payment.package_name || payment.stage || "Membership payment"}</p>
                            <p className="mt-1 text-sm text-white/50">{payment.payment_type || "Payment method not recorded"}</p>
                          </div>
                          <p className="text-sm text-white/65">{formatDateTime(payment.paid_at || payment.payment_date || payment.created_at)}</p>
                          <p className="font-semibold">{formatMoney(payment.amount)}</p>
                          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(payment.status)}`}>
                            {payment.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            <div className="mt-5 flex justify-center gap-3 lg:hidden">
              <Link href="/member/profile" className="rounded-full bg-[#25324a] px-5 py-3 text-sm font-semibold text-white">Profile</Link>
              <Link href="/member/schedule" className="rounded-full bg-[#25324a] px-5 py-3 text-sm font-semibold text-white">Schedule</Link>
              <button onClick={handleSignOut} className="rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-semibold text-white">
                Sign out
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function MetricCard({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="rounded-3xl bg-[#242424] p-5">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-1 break-words text-3xl font-extrabold">{value}</p>
      <p className="mt-2 text-sm text-white/55">{sublabel}</p>
    </div>
  )
}
