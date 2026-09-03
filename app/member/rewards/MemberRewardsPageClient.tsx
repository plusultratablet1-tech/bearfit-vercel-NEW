"use client"

import Link from "next/link"
import { useState } from "react"
import { CalendarDays, Coins, Gift, Home, PackageCheck, UserRound, WalletCards } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { MemberRewardsSnapshot, RewardCatalogItem, RewardRequestItem } from "./page"

const supabase = createClient()

function points(value: number) {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value ?? 0)
}

function dateTime(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value))
}

const statusLabels: Record<RewardRequestItem["status"], string> = { pending: "Pending", approved: "Approved", claimed: "Claimed", rejected: "Rejected", cancelled: "Cancelled" }

function statusStyle(status: RewardRequestItem["status"]) {
  if (status === "claimed") return "bg-emerald-500/15 text-emerald-300"
  if (status === "approved") return "bg-blue-500/15 text-blue-300"
  if (status === "pending") return "bg-amber-500/15 text-amber-300"
  return "bg-white/10 text-white/60"
}

export default function MemberRewardsPageClient({ initialSnapshot, initialError }: { initialSnapshot: MemberRewardsSnapshot | null; initialError: string | null }) {
  const [snapshot, setSnapshot] = useState<MemberRewardsSnapshot | null>(initialSnapshot)
  const [error, setError] = useState<string | null>(initialError)
  const [success, setSuccess] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  async function reload() {
    const { data, error: nextError } = await supabase.rpc("member_rewards_snapshot")
    if (nextError) return setError(nextError.message)
    setSnapshot(data as MemberRewardsSnapshot)
  }

  async function redeem(reward: RewardCatalogItem) {
    setWorking(reward.id); setError(null); setSuccess(null)
    const { error: requestError } = await supabase.rpc("member_request_reward", { p_reward_id: reward.id })
    setWorking(null)
    if (requestError) return setError(requestError.message)
    setSuccess(`${reward.title} request submitted. Your points are reserved until staff reviews it.`)
    await reload()
  }

  async function cancel(request: RewardRequestItem) {
    setWorking(request.id); setError(null); setSuccess(null)
    const { error: cancelError } = await supabase.rpc("member_cancel_reward_request", { p_request_id: request.id })
    setWorking(null)
    if (cancelError) return setError(cancelError.message)
    setSuccess("Reward request cancelled. Reserved points and stock were released.")
    await reload()
  }

  const catalog = snapshot?.catalog ?? []
  const requests = snapshot?.requests ?? []
  const season = snapshot?.summary?.season_key ?? "Current season"
  const seasonBalance = snapshot?.summary?.season_balance ?? 0
  const reserved = snapshot?.reserved_points ?? 0
  const available = snapshot?.available_points ?? 0

  return (
    <main className="min-h-screen bg-[#020b1c] pb-24 text-white lg:pb-8">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.22em] text-[#ff9b54]">Bearforce Rewards</p>
            <h1 className="mt-1 text-3xl font-black">Rewards Catalog</h1>
            <p className="mt-1 text-sm text-white/45">Spend this season&apos;s available Bearforce Points without reducing your lifetime achievement.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/member/dashboard" className="rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold">Dashboard</Link>
            <Link href="/member/schedule" className="rounded-full bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold">Schedule</Link>
          </div>
        </header>

        {error && <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        {success && <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{success}</div>}

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <BalanceCard icon={Coins} label="Season Balance" value={points(seasonBalance)} sublabel={`${season} earned balance`} />
          <BalanceCard icon={PackageCheck} label="Reserved" value={points(reserved)} sublabel="Pending reward requests" />
          <BalanceCard icon={WalletCards} label="Available to Redeem" value={points(available)} sublabel="Spendable right now" highlight />
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-white/35">Catalog</p><h2 className="mt-1 text-2xl font-black">Choose a reward</h2></div><span className="text-xs text-white/35">{catalog.length} available</span></div>
          {catalog.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-[#141414] px-5 py-12 text-center"><Gift className="mx-auto text-[#ff7a1a]"/><h3 className="mt-3 text-xl font-bold">Rewards are being prepared</h3><p className="mt-2 text-sm text-white/45">BearFit staff will publish real rewards here.</p></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{catalog.map(reward => <RewardCard key={reward.id} reward={reward} availablePoints={available} working={working === reward.id} onRedeem={() => void redeem(reward)} />)}</div>
          )}
        </section>

        <section className="mt-9 overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#151515]">
          <div className="border-b border-white/[0.07] p-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-white/35">History</p><h2 className="mt-1 text-2xl font-black">Your reward requests</h2></div>
          <div className="p-4 md:p-5">
            {requests.length === 0 ? <p className="py-8 text-center text-sm text-white/40">You haven&apos;t requested a reward yet.</p> : <div className="space-y-3">{requests.map(request => <div key={request.id} className="grid gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{request.reward_title}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${statusStyle(request.status)}`}>{statusLabels[request.status]}</span></div><p className="mt-1 text-xs text-white/40">{request.reward_category} · {points(request.points_cost)} points · {dateTime(request.requested_at)}</p>{request.decision_note && <p className="mt-2 text-xs text-white/55">{request.decision_note}</p>}</div><div className="flex items-center gap-2">{request.status === "pending" && <button disabled={working === request.id} onClick={() => void cancel(request)} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-semibold text-white/70">Cancel request</button>}</div></div>)}</div>}
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#07101f]/95 px-2 pt-2 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}>
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          <MobileLink href="/member/dashboard" label="Home" icon={Home}/><MobileLink href="/member/schedule" label="Schedule" icon={CalendarDays}/><MobileLink href="/member/rewards" label="Rewards" icon={Gift} active/><MobileLink href="/member/dashboard#payments" label="Payments" icon={WalletCards}/><MobileLink href="/member/profile" label="Profile" icon={UserRound}/>
        </div>
      </nav>
    </main>
  )
}

function RewardCard({ reward, availablePoints, working, onRedeem }: { reward: RewardCatalogItem; availablePoints: number; working: boolean; onRedeem: () => void }) {
  const outOfStock = reward.available_stock !== null && reward.available_stock <= 0
  const insufficient = availablePoints < reward.points_cost
  const membershipBlocked = !reward.membership_eligible
  const disabled = working || outOfStock || insufficient || membershipBlocked
  const reason = outOfStock ? "Out of stock" : insufficient ? "Not enough points" : membershipBlocked ? "Active membership required" : null
  return <article className="overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#171717]">
    <div className="relative h-40 bg-gradient-to-br from-[#ff7a1a] to-[#5f2706]">{reward.image_url ? <img src={reward.image_url} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center"><Gift size={48} className="text-white/90"/></div>}<div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent"/><span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-[.15em]">{reward.category}</span></div>
    <div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-black">{reward.title}</h3><p className="mt-2 text-sm leading-6 text-white/50">{reward.description || "BearFit member reward"}</p></div><span className="shrink-0 text-lg font-black text-[#ff9b54]">{points(reward.points_cost)} pts</span></div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/45">{reward.stock_quantity === null ? <span>Unlimited availability</span> : <span>{reward.available_stock ?? 0} left</span>}{reward.requires_active_membership && <span>· Active membership</span>}</div>
      <button disabled={disabled} onClick={onRedeem} className="mt-5 min-h-12 w-full rounded-xl bg-[#ff7a1a] px-4 text-sm font-extrabold disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35">{working ? "Submitting…" : reason ?? "Redeem"}</button>
    </div>
  </article>
}

function BalanceCard({ icon: Icon, label, value, sublabel, highlight = false }: { icon: typeof Coins; label: string; value: string; sublabel: string; highlight?: boolean }) {
  return <div className={`rounded-[22px] border p-5 ${highlight ? "border-[#ff7a1a]/30 bg-[#ff7a1a]/10" : "border-white/[0.06] bg-[#171717]"}`}><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.15em] text-white/45">{label}</p><Icon size={18} className="text-[#ff8b38]"/></div><p className="mt-3 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-white/40">{sublabel}</p></div>
}

function MobileLink({ href, label, icon: Icon, active = false }: { href: string; label: string; icon: typeof Home; active?: boolean }) {
  return <Link href={href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[9px] font-semibold ${active ? "bg-[#ff7a1a] text-white" : "text-white/55"}`}><Icon size={17}/><span>{label}</span></Link>
}
