"use client"

import Link from "next/link"
import { CalendarDays, ChevronRight, Coins, Flame, Gift, Home, ShieldCheck, Trophy, UserRound, WalletCards } from "lucide-react"
import type { MemberBearforceData } from "@/lib/bearforce"

const TIER_NAMES = ["Bear Cub", "Grizzly", "Kodiak", "Titan Bear", "Apex Bear"] as const
const TIER_THRESHOLDS = [0, 1000, 5000, 10000, 25000] as const

function points(value: number | null | undefined) {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value ?? 0)
}

function dateTime(value: string | null | undefined) {
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

function dateOnly(value: string | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null
  const diff = new Date(value).getTime() - Date.now()
  if (Number.isNaN(diff)) return null
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

export default function MemberBearforcePageClient({ initialData }: { initialData: MemberBearforceData }) {
  const { summary, history, seasons, error } = initialData
  const seasonDays = daysUntil(summary?.season_ends_at)
  const weeklyProgress = summary ? Math.min(100, Math.round((summary.current_week_sessions / Math.max(summary.weekly_goal, 1)) * 100)) : 0
  const currentTierIndex = Math.max(0, TIER_NAMES.findIndex((name) => name === summary?.fitness_tier?.name))

  return (
    <main className="min-h-screen bg-[#020b1c] pb-24 text-white lg:pb-10">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.22em] text-[#ff9b54]">Bearforce Progress</p>
            <h1 className="mt-1 text-3xl font-black md:text-4xl">Your Bearforce Journey</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/45">Lifetime achievement, current-season progress, workout consistency, and every Bearforce transaction in one place.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/member/dashboard" className="rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold">Dashboard</Link>
            <Link href="/member/rewards" className="rounded-full bg-[#ff7a1a] px-4 py-2.5 text-sm font-extrabold">Rewards</Link>
          </div>
        </header>

        {error && <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">{error}</div>}

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <SummaryCard icon={Coins} label="Lifetime Bearforce" value={points(summary?.lifetime_points)} helper="Permanent achievement total" />
          <SummaryCard icon={Trophy} label="Season Earned" value={points(summary?.season_earned)} helper={summary?.season_key ?? "Current season"} />
          <SummaryCard icon={Gift} label="Available to Spend" value={points(summary?.season_balance)} helper={`${points(summary?.season_spent)} spent this season`} highlight />
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-2">
          <article className="rounded-[24px] border border-white/[0.06] bg-[#171717] p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[.18em] text-white/35">Workout Streak</p><h2 className="mt-1 text-2xl font-black">{summary?.streak_weeks ?? 0} successful weeks</h2></div>
              <Flame className="text-[#ff7a1a]" />
            </div>
            <p className="mt-5 text-4xl font-black">{summary?.current_week_sessions ?? 0} / {summary?.weekly_goal ?? 3}</p>
            <p className="mt-1 text-sm text-white/45">{summary?.weekly_goal_met ? "Weekly goal complete" : "workouts this week · Monday–Sunday"}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#ff6b0a] to-[#ff9b54]" style={{ width: `${weeklyProgress}%` }} /></div>
            {summary?.grace_week_active && <span className="mt-4 inline-flex rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-200">Grace Week active</span>}
          </article>

          <article className="rounded-[24px] border border-white/[0.06] bg-[#171717] p-5 md:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-white/35">Prestige</p><h2 className="mt-1 text-2xl font-black">{summary?.prestige?.name ?? "Rookie"}</h2></div><Trophy className="text-[#ff7a1a]" /></div>
            <p className="mt-4 text-sm text-white/50">{summary?.season_key ?? "Current season"} · {dateOnly(summary?.season_starts_at)} – {dateOnly(summary?.season_ends_at)}</p>
            {seasonDays !== null && <p className="mt-1 text-xs text-[#ff9b54]">{seasonDays} days until season end</p>}
            <div className="mt-5 grid grid-cols-3 gap-2 text-center"><MiniStat label="Earned" value={points(summary?.season_earned)} /><MiniStat label="Spent" value={points(summary?.season_spent)} /><MiniStat label="Balance" value={points(summary?.season_balance)} /></div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#ff6b0a] to-[#ff9b54]" style={{ width: `${summary?.prestige?.progress_percent ?? 0}%` }} /></div>
            <p className="mt-2 text-xs text-white/40">{summary?.prestige?.next_name ? `${points(summary.prestige.points_to_next)} points to ${summary.prestige.next_name}` : "Top seasonal prestige reached"}</p>
          </article>
        </section>

        <section className="mt-7 rounded-[24px] border border-white/[0.06] bg-[#171717] p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-white/35">BearFit Tier</p><h2 className="mt-1 text-2xl font-black">{summary?.fitness_tier?.name ?? "Bear Cub"}</h2><p className="mt-1 text-sm text-white/45">Based on Lifetime Bearforce Points.</p></div><ShieldCheck className="text-[#ff7a1a]" size={28}/></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            {TIER_NAMES.map((name, index) => {
              const current = index === currentTierIndex
              const achieved = index <= currentTierIndex
              return <div key={name} className={`rounded-2xl border p-4 ${current ? "border-[#ff7a1a]/50 bg-[#ff7a1a]/12" : achieved ? "border-emerald-400/20 bg-emerald-400/5" : "border-white/[0.06] bg-white/[0.025]"}`}><p className="text-sm font-black">{name}</p><p className="mt-1 text-xs text-white/40">{points(TIER_THRESHOLDS[index])}+ Lifetime</p></div>
            })}
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#ff6b0a] to-[#ff9b54]" style={{ width: `${summary?.fitness_tier?.progress_percent ?? 0}%` }} /></div>
          <p className="mt-2 text-xs text-white/45">{summary?.fitness_tier?.next_name ? `${points(summary.fitness_tier.points_to_next)} Lifetime Points to ${summary.fitness_tier.next_name}` : "Apex Bear achieved"}</p>
        </section>

        <section className="mt-7 grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
          <article className="overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#151515]">
            <div className="border-b border-white/[0.07] p-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-white/35">Transaction History</p><h2 className="mt-1 text-2xl font-black">Bearforce Points History</h2></div>
            <div className="p-4 md:p-5">{history.length === 0 ? <Empty text="No Bearforce transactions yet." /> : <div className="space-y-2">{history.map(item => <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4"><div><p className="font-bold">{item.label}</p><p className="mt-1 text-xs text-white/40">{dateTime(item.occurred_at)} · {item.status}</p></div><p className={`shrink-0 text-lg font-black ${item.points_delta >= 0 ? "text-emerald-300" : "text-[#ff9b54]"}`}>{item.points_delta >= 0 ? "+" : ""}{points(item.points_delta)}</p></div>)}</div>}</div>
          </article>

          <article className="overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#151515]">
            <div className="border-b border-white/[0.07] p-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-white/35">Previous Seasons</p><h2 className="mt-1 text-2xl font-black">Season History</h2></div>
            <div className="p-4 md:p-5">{seasons.length === 0 ? <Empty text="No previous season activity yet." /> : <div className="space-y-3">{seasons.map(season => <div key={season.season_key} className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-black">{season.season_key}</p><p className="text-xs text-white/40">{season.prestige.name} rank</p></div><ChevronRight size={16} className="text-white/30"/></div><div className="mt-3 grid grid-cols-3 gap-2"><MiniStat label="Earned" value={points(season.earned)} /><MiniStat label="Spent" value={points(season.spent)} /><MiniStat label="Balance" value={points(season.balance)} /></div></div>)}</div>}</div>
          </article>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#07101f]/95 px-2 pt-2 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}>
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1"><MobileLink href="/member/dashboard" label="Home" icon={Home}/><MobileLink href="/member/schedule" label="Schedule" icon={CalendarDays}/><MobileLink href="/member/rewards" label="Rewards" icon={Gift}/><MobileLink href="/member/dashboard#payments" label="Payments" icon={WalletCards}/><MobileLink href="/member/profile" label="Profile" icon={UserRound}/></div>
      </nav>
    </main>
  )
}

function SummaryCard({ icon: Icon, label, value, helper, highlight = false }: { icon: typeof Coins; label: string; value: string; helper: string; highlight?: boolean }) {
  return <div className={`rounded-[22px] border p-5 ${highlight ? "border-[#ff7a1a]/30 bg-[#ff7a1a]/10" : "border-white/[0.06] bg-[#171717]"}`}><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.14em] text-white/45">{label}</p><Icon size={18} className="text-[#ff8b38]"/></div><p className="mt-3 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-white/40">{helper}</p></div>
}
function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-[10px] uppercase tracking-[.14em] text-white/35">{label}</p><p className="mt-1 font-black">{value}</p></div> }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">{text}</div> }
function MobileLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) { return <Link href={href} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[9px] font-semibold text-white/55"><Icon size={17}/><span>{label}</span></Link> }
