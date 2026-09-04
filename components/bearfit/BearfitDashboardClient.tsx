"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type {
  BearforceSummary,
  BookingRow,
  MemberRow,
  PackageAlert,
  PaymentRow,
  ProfileRow,
  SessionLogRow,
} from "@/lib/member-account"
import { displayPackageNameForMember } from "@/lib/member-account"
import { displaySessionLabel } from "@/lib/session-taxonomy"
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  CreditCard,
  Dumbbell,
  Flame,
  Gift,
  Home,
  Coins,
  LogOut,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  ReceiptText,
  ShieldCheck,
  Trophy,
  User as UserIcon,
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
  bearforceSummary: BearforceSummary | null
  loadError: string | null
}

const navItems = [
  { label: "Home", icon: Home, href: "/member/dashboard" },
  { label: "Schedule", icon: CalendarDays, href: "/member/schedule" },
  { label: "Rewards", icon: Gift, href: "/member/rewards" },
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

function formatPoints(value: number | null | undefined) {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value ?? 0)
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

function formatSessionTitle(sessionLabel: string | null, sessionType: string) {
  return displaySessionLabel(sessionLabel, sessionType)
}

function sessionVisualForType(sessionLabel: string | null, sessionType: string) {
  const normalized = `${sessionLabel ?? ""} ${sessionType}`.toLowerCase()

  if (normalized.includes("pilates")) {
    return { image: "/onboarding/better-function1.jpg", position: "center 38%" }
  }

  if (normalized.includes("cardio") || normalized.includes("conditioning")) {
    return { image: "/better-form.png", position: "center 32%" }
  }

  if (normalized.includes("boxing")) {
    return { image: "/onboarding/better-function.jpg", position: "center 35%" }
  }

  return { image: "/onboarding/better-fintness1.jpg", position: "center 34%" }
}

function useSessionCountdown(iso: string | null) {
  const [countdown, setCountdown] = useState({
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
    label: "Upcoming",
  })

  useEffect(() => {
    const update = () => {
      if (!iso) {
        setCountdown({ days: "00", hours: "00", minutes: "00", seconds: "00", label: "Time pending" })
        return
      }

      const target = new Date(iso).getTime()
      if (Number.isNaN(target)) {
        setCountdown({ days: "00", hours: "00", minutes: "00", seconds: "00", label: "Time pending" })
        return
      }

      const difference = target - Date.now()
      if (difference <= 0) {
        setCountdown({ days: "00", hours: "00", minutes: "00", seconds: "00", label: "Starting now" })
        return
      }

      const totalSeconds = Math.floor(difference / 1000)
      const days = Math.floor(totalSeconds / 86400)
      const hours = Math.floor((totalSeconds % 86400) / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      const pad = (value: number) => String(value).padStart(2, "0")

      setCountdown({
        days: pad(days),
        hours: pad(hours),
        minutes: pad(minutes),
        seconds: pad(seconds),
        label: "Starts in",
      })
    }

    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [iso])

  return countdown
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
  bearforceSummary,
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
  const latestPaidPackage = payments.find((payment) => payment.status?.toLowerCase() === "paid" && payment.package_name)?.package_name
  const rawDisplayPackageName = /^legacy/i.test(packageName) && latestPaidPackage ? latestPaidPackage : packageName
  const displayPackageName = displayPackageNameForMember(member, rawDisplayPackageName)
  const membershipStatus = member?.membership_status || member?.status || "Not assigned"
  const paymentStatus = member?.payment_status || "Not recorded"
  const sessionsUsed = member?.sessions_used ?? 0
  const sessionsLeft = member?.sessions_left ?? 0
  const totalSessions = member?.total_sessions ?? 0
  const progress = totalSessions > 0 ? Math.min((sessionsUsed / totalSessions) * 100, 100) : 0
  const primaryPackageAlert = [...packageAlerts].sort((a, b) => alertPriority(b) - alertPriority(a))[0] ?? null
  const primaryPackageMessage = primaryPackageAlert?.blockingReason || primaryPackageAlert?.message || null
  const nextBooking = upcomingBookings[0] ?? null
  const nextBookingStart = nextBooking?.start_at || nextBooking?.requested_start_at || null
  const sessionCountdown = useSessionCountdown(nextBookingStart)
  const nextSessionVisual = nextBooking ? sessionVisualForType(nextBooking.session_label, nextBooking.session_type) : null
  const activityItems = [
    ...sessionLogs.map((log) => ({
      id: `session-${log.id}`,
      kind: "session" as const,
      timestamp: log.trained_at,
      title: displaySessionLabel(log.session_label, "unknown"),
      detail: log.notes || branch,
      amount: null as number | null,
      sessionsLeft: log.sessions_left_after,
      status: null as string | null,
    })),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      kind: "payment" as const,
      timestamp: payment.paid_at || payment.payment_date || payment.created_at,
      title: payment.package_name || payment.stage || "Membership payment",
      detail: payment.payment_type || "BearFit payment",
      amount: payment.amount,
      sessionsLeft: null as number | null,
      status: payment.status,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 7)
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
          <div className="mx-auto max-w-[1180px] px-4 py-5 pb-28 md:px-6 lg:px-8 lg:py-7 lg:pb-7">
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
                <button aria-label="Messages coming soon" title="Messages coming soon" className="hidden rounded-2xl bg-[#24314b] p-3 text-white/45 sm:inline-flex">
                  <MessageCircle size={19} />
                </button>
                <button onClick={handleSignOut} aria-label="Sign out" title="Sign out" className="rounded-2xl bg-[#24314b] p-3 text-white/60 lg:hidden">
                  <LogOut size={19} />
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
                  <section className="flex flex-col gap-4 sm:flex-row sm:items-center md:gap-5">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[3px] border-[#ff7a1a] bg-[#25324a] text-xl font-extrabold text-[#ff9b54] md:h-24 md:w-24 md:text-2xl">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt={`${displayName} profile`} className="h-full w-full object-cover" />
                      ) : (
                        initials(displayName)
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-extrabold md:text-3xl">{displayPackageName}</h2>
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
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Your Progression</p>
                        <p className="mt-1 text-sm text-white/35">Built from real BearFit check-ins and payment activity.</p>
                      </div>
                      {bearforceSummary && (
                        <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45 sm:inline-flex">
                          Season {bearforceSummary.season_key}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                      <ProgressionCard
                        icon={Flame}
                        label="Workout Streak"
                        value={bearforceSummary ? `${bearforceSummary.streak_weeks} wk` : "—"}
                        sublabel={bearforceSummary ? `${bearforceSummary.current_week_sessions} / ${bearforceSummary.weekly_goal} this week${bearforceSummary.grace_week_active ? " · Grace active" : ""}` : "Progress unavailable"}
                        progress={bearforceSummary ? Math.min((bearforceSummary.current_week_sessions / Math.max(bearforceSummary.weekly_goal, 1)) * 100, 100) : 0}
                        href="/member/bearforce"
                      />
                      <ProgressionCard
                        icon={Coins}
                        label="Bearforce Points"
                        value={bearforceSummary ? formatPoints(bearforceSummary.lifetime_points) : "—"}
                        sublabel={bearforceSummary ? `${formatPoints(bearforceSummary.season_balance)} Available to spend · Lifetime` : "Progress unavailable"}
                        progress={bearforceSummary?.prestige?.progress_percent ?? 0}
                        href="/member/bearforce"
                      />
                      <ProgressionCard
                        icon={Trophy}
                        label="Prestige / Season"
                        value={bearforceSummary?.prestige?.name ?? "—"}
                        sublabel={bearforceSummary ? `${bearforceSummary.season_key} · ${formatPoints(bearforceSummary.season_earned)} earned` : "Progress unavailable"}
                        progress={bearforceSummary?.prestige?.progress_percent ?? 0}
                        href="/member/bearforce"
                      />
                      <ProgressionCard
                        icon={ShieldCheck}
                        label="Fitness Tier"
                        value={bearforceSummary?.fitness_tier?.name ?? "—"}
                        sublabel={bearforceSummary?.fitness_tier?.next_name ? `${formatPoints(bearforceSummary.fitness_tier.points_to_next)} pts to ${bearforceSummary.fitness_tier.next_name}` : "Top lifetime tier reached"}
                        progress={bearforceSummary?.fitness_tier?.progress_percent ?? 0}
                        href="/member/bearforce"
                      />
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
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ff8b38]">Next Session</p>
                        <h3 className="mt-1 text-xl font-extrabold md:text-2xl">Upcoming Sessions</h3>
                      </div>
                      <Link href="/member/schedule" className="rounded-full bg-[#ff7a1a] px-4 py-2 text-xs font-bold transition hover:bg-[#ff8b38] md:text-sm">
                        Manage Schedule
                      </Link>
                    </div>

                    {!nextBooking || !nextSessionVisual ? (
                      <div className="relative min-h-[260px] overflow-hidden rounded-[24px] border border-white/10 bg-[#191919]">
                        <img src="/better-form.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" style={{ objectPosition: "center 30%" }} />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/45" />
                        <div className="relative flex min-h-[260px] flex-col items-center justify-center px-6 py-8 text-center">
                          <CalendarDays className="text-[#ff7a1a]" size={32} />
                          <h4 className="mt-3 text-xl font-bold">No confirmed sessions yet</h4>
                          <p className="mx-auto mt-2 max-w-lg text-sm text-white/55">Once your next session is confirmed, its session image, coach, branch, date, time, and countdown will appear here.</p>
                          <Link href="/member/schedule" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#202020] transition hover:bg-white/90">
                            Book a Session
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <>
                        <article className="relative min-h-[500px] overflow-hidden rounded-[26px] border border-white/10 bg-black shadow-xl shadow-black/30 md:min-h-[460px] lg:min-h-[430px]">
                          <img
                            src={nextSessionVisual.image}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{ objectPosition: nextSessionVisual.position }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/25 lg:from-black lg:via-black/75 lg:to-black/5" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />

                          <div className="relative flex min-h-[500px] flex-col justify-between p-5 md:min-h-[460px] md:p-7 lg:min-h-[430px] lg:p-8">
                            <div className="flex items-center justify-between gap-3">
                              <span className="inline-flex rounded-full bg-[#ff7a1a] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white">Confirmed</span>
                              <span className="hidden rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[11px] font-semibold text-white/65 backdrop-blur-sm sm:inline-flex">
                                BearFit scheduled session
                              </span>
                            </div>

                            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-8">
                              <div className="max-w-3xl">
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Your next workout</p>
                                <h4 className="mt-2 text-4xl font-black leading-[0.95] sm:text-5xl lg:text-6xl">{formatSessionTitle(nextBooking.session_label, nextBooking.session_type)}</h4>
                                <div className="mt-5 grid gap-2 text-sm text-white/75 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2 md:text-base">
                                  <span className="inline-flex items-center gap-2"><MapPin size={17} className="text-[#ff7a1a]" /> {nextBooking.branch}</span>
                                  <span className="inline-flex items-center gap-2"><Clock3 size={17} className="text-[#ff7a1a]" /> {formatDateTime(nextBookingStart)}</span>
                                </div>
                                <p className="mt-3 text-base font-extrabold text-[#ff9b54]">Coach {nextBooking.assigned_coach_user_id ? coachNames[nextBooking.assigned_coach_user_id] || "Coach assigned" : "Any available coach"}</p>
                              </div>

                              <div className="lg:w-[360px]">
                                <div className="rounded-[22px] border border-white/15 bg-[#111111]/95 p-3 sm:p-4">
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/55">{sessionCountdown.label}</p>
                                    <Clock3 size={15} className="text-[#ff9b54]" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <CountdownCell label="Days" value={sessionCountdown.days} />
                                    <CountdownCell label="Hours" value={sessionCountdown.hours} />
                                    <CountdownCell label="Minutes" value={sessionCountdown.minutes} />
                                    <CountdownCell label="Seconds" value={sessionCountdown.seconds} />
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                                  <Link href="/member/schedule" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-[#202020] transition hover:bg-white/90">
                                    Session details <ChevronRight size={16} />
                                  </Link>
                                  <Link href="/member/schedule" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-black/35 px-5 py-3 text-sm font-bold text-white/80 backdrop-blur-sm transition hover:bg-black/50">
                                    Manage booking
                                  </Link>
                                </div>
                                <p className="mt-2 text-center text-[11px] font-medium text-white/45">Check-in is completed by BearFit staff.</p>
                              </div>
                            </div>
                          </div>
                        </article>

                        {upcomingBookings.length > 1 && (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {upcomingBookings.slice(1).map((booking) => (
                              <Link key={booking.id} href="/member/schedule" className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#1b1b1b] px-4 py-3 transition hover:bg-[#202020]">
                                <div className="min-w-0">
                                  <p className="truncate font-bold">{formatSessionTitle(booking.session_label, booking.session_type)}</p>
                                  <p className="mt-1 truncate text-xs text-white/45">{formatDateTime(booking.start_at || booking.requested_start_at)} · {booking.branch}</p>
                                </div>
                                <ChevronRight className="shrink-0 text-[#ff7a1a]" size={18} />
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>

                  <section id="payments" className="mt-7 overflow-hidden rounded-[24px] border border-white/[0.04] bg-[#171717]">
                    <div className="flex items-center justify-between gap-3 px-4 pt-5 md:px-5">
                      <div>
                        <h3 className="text-xl font-extrabold">Member Activity</h3>
                        <p className="mt-1 text-sm text-white/40">Your real session and payment history</p>
                      </div>
                      <Activity size={22} className="text-[#ff7a1a]" />
                    </div>

                    <div className="mt-4 grid grid-cols-3 border-y border-white/10 px-3 text-center text-xs font-semibold text-white/45 md:px-5">
                      <span className="border-b-2 border-[#ff7a1a] py-3 text-white">Activity Log</span>
                      <span className="py-3">Sessions</span>
                      <span className="py-3">Payments</span>
                    </div>

                    <div className="p-3 md:p-5">
                      {activityItems.length === 0 ? (
                        <EmptyState text="Your completed sessions and payments will appear here." />
                      ) : (
                        <div className="space-y-2 sm:space-y-0 sm:divide-y sm:divide-white/[0.06]">
                          {activityItems.map((item) => (
                            <div key={item.id} className="grid gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.025] px-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0">
                              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.kind === "session" ? "bg-[#ff7a1a] text-white" : "bg-emerald-500/15 text-emerald-300"}`}>
                                {item.kind === "session" ? <Dumbbell size={20} /> : <ReceiptText size={20} />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold">{item.title}</p>
                                <p className={`mt-1 text-xs font-semibold ${item.kind === "session" ? "text-[#ff9b54]" : "text-emerald-400"}`}>
                                  {item.kind === "session" ? "Session used" : "Payment received"}
                                </p>
                                <p className="mt-1 truncate text-xs text-white/35">{item.detail}</p>
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="text-xs text-white/40">{formatDateTime(item.timestamp)}</p>
                                {item.kind === "session" ? (
                                  <p className="mt-1 font-bold text-[#ff9b54]">{item.sessionsLeft} left</p>
                                ) : (
                                  <>
                                    <p className="mt-1 font-bold">{formatMoney(item.amount)}</p>
                                    {item.status && <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusClass(item.status)}`}>{item.status}</span>}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="mt-7">
                    <h3 className="mb-3 text-lg font-extrabold">Updates & Promos</h3>
                    <section className="relative min-h-[250px] overflow-hidden rounded-[24px] border border-orange-300/20">
                      <img src="/onboarding/better-form1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 38%" }} />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#ff6b0a]/95 via-[#ff7316]/90 to-[#ff8a2a]/75" />
                      <div className="relative p-6 md:p-8">
                        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/80">Schedule</p>
                        <h3 className="mt-2 text-2xl font-black md:text-3xl">Book your next session</h3>
                        <p className="mt-2 max-w-2xl text-sm text-white/85 md:text-base">View available BearFit slots, choose your coach, or send a custom session request.</p>
                        <Link href="/member/schedule" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#202020] transition hover:bg-white/90">
                          Open Schedule
                        </Link>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            )}

            <nav
              aria-label="Mobile app navigation"
              className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#07101f]/95 px-2 pt-2 backdrop-blur-xl lg:hidden"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
            >
              <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
                <MobileNavItem href="/member/dashboard" label="Home" icon={Home} active />
                <MobileNavItem href="/member/schedule" label="Schedule" icon={CalendarDays} />
                <MobileNavItem href="/member/rewards" label="Rewards" icon={Gift} />
                <MobileNavItem href="#payments" label="Payments" icon={CreditCard} />
                <MobileNavItem href="/member/profile" label="Profile" icon={UserIcon} />
              </div>
            </nav>
          </div>
        </section>
      </div>
    </main>
  )
}

function CountdownCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-2 py-3 text-center">
      <p className="text-2xl font-black tabular-nums text-white sm:text-3xl lg:text-2xl">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</p>
    </div>
  )
}

function MobileNavItem({
  href,
  label,
  icon: Icon,
  active = false,
}: {
  href: string
  label: string
  icon: typeof Home
  active?: boolean
}) {
  const className = `flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold transition ${
    active ? "bg-[#ff7a1a] text-white" : "text-white/55 active:bg-white/10 active:text-white"
  }`

  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        <Icon size={18} />
        <span>{label}</span>
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  )
}

function ProgressionCard({
  icon: Icon,
  label,
  value,
  sublabel,
  progress,
  href,
}: {
  icon: typeof Home
  label: string
  value: string
  sublabel: string
  progress: number
  href?: string
}) {
  const content = (
    <div className="min-w-0 rounded-[20px] border border-white/[0.05] bg-[#242424] p-4 transition hover:border-[#ff7a1a]/25 hover:bg-[#282828] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-white/55 sm:text-sm">{label}</p>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ff7a1a]/15 text-[#ff8b38]">
          <Icon size={16} />
        </div>
      </div>
      <p className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-2 min-h-8 text-[11px] leading-4 text-white/45 sm:text-xs">{sublabel}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#ff6b0a] to-[#ff9b54]" style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} />
      </div>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-7 text-center text-sm text-white/40">{text}</div>
}
