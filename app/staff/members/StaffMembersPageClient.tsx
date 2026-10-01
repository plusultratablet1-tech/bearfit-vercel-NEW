"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronRight,
  CircleDollarSign,
  Dumbbell,
  MapPin,
  Package,
  Search,
  UsersRound,
} from "lucide-react"
import StaffAppShell from "@/components/bearfit/StaffAppShell"

export type MemberDirectoryItem = {
  id: string
  member_code: string | null
  membership_id: string | null
  name: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  branch: string | null
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

type GroupBy = "none" | "branch" | "package" | "sessions"

function displayName(member: MemberDirectoryItem) {
  return member.full_name || member.name || member.email || member.member_code || "Member"
}

function packageName(member: MemberDirectoryItem) {
  return member.package_name || member.package_type || "No package"
}

function memberStatus(member: MemberDirectoryItem) {
  return member.membership_status || member.status || "unknown"
}

function sessionBucket(member: MemberDirectoryItem) {
  const left = member.sessions_left ?? 0
  if (left <= 0) return "No sessions"
  if (left <= 3) return "1–3 sessions left"
  return "4+ sessions left"
}

function statusTone(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === "active" || normalized === "paid") return "bg-emerald-500/15 text-emerald-300"
  if (normalized === "pending") return "bg-amber-500/15 text-amber-300"
  if (normalized === "inactive" || normalized === "expired") return "bg-red-500/15 text-red-300"
  return "bg-white/10 text-white/60"
}

function pct(used: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (used / total) * 100))
}

export default function StaffMembersPageClient({
  role,
  initialMembers,
  loadError,
}: {
  role: "staff" | "admin"
  initialMembers: MemberDirectoryItem[]
  loadError: string | null
}) {
  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("ALL")
  const [packageFilter, setPackageFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [groupBy, setGroupBy] = useState<GroupBy>("none")

  const branches = useMemo(
    () => [...new Set(initialMembers.map((m) => m.branch).filter((v): v is string => Boolean(v)))].sort(),
    [initialMembers],
  )
  const packages = useMemo(
    () => [...new Set(initialMembers.map(packageName).filter(Boolean))].sort(),
    [initialMembers],
  )
  const statuses = useMemo(
    () => [...new Set(initialMembers.map(memberStatus).filter(Boolean))].sort(),
    [initialMembers],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return initialMembers.filter((member) => {
      const haystack = [
        member.member_code,
        member.membership_id,
        displayName(member),
        member.email,
        member.phone,
        member.branch,
        packageName(member),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return (
        (!needle || haystack.includes(needle)) &&
        (branchFilter === "ALL" || member.branch === branchFilter) &&
        (packageFilter === "ALL" || packageName(member) === packageFilter) &&
        (statusFilter === "ALL" || memberStatus(member) === statusFilter)
      )
    })
  }, [initialMembers, search, branchFilter, packageFilter, statusFilter])

  const groups = useMemo(() => {
    if (groupBy === "none") return [["All Members", filtered] as const]

    const map = new Map<string, MemberDirectoryItem[]>()
    for (const member of filtered) {
      const key =
        groupBy === "branch"
          ? member.branch || "No branch"
          : groupBy === "package"
            ? packageName(member)
            : sessionBucket(member)
      map.set(key, [...(map.get(key) ?? []), member])
    }

    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, groupBy])

  const stats = useMemo(() => {
    const active = initialMembers.filter((m) => memberStatus(m).toLowerCase() === "active").length
    const lowSessions = initialMembers.filter((m) => {
      const left = m.sessions_left ?? 0
      return left >= 0 && left <= 3
    }).length
    const paymentAttention = initialMembers.filter(
      (m) => (m.payment_status ?? "").toLowerCase() !== "paid",
    ).length
    return {
      total: initialMembers.length,
      active,
      branches: branches.length,
      lowSessions,
      paymentAttention,
    }
  }, [initialMembers, branches])

  return (
    <StaffAppShell activePath="/staff/members" role={role}>
      <div className="mx-auto max-w-7xl px-4 py-5 pb-28 md:px-6 lg:px-8 lg:py-7 lg:pb-7">
        <header className="border-b border-white/10 pb-5">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#ff9b54]">People</p>
          <h1 className="mt-1 text-2xl font-black md:text-3xl">Members</h1>
          <p className="mt-1 text-sm text-white/45">
            Browse individuals or group members by branch, package, and sessions remaining.
          </p>
        </header>

        {loadError && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            {loadError}
          </div>
        )}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat icon={UsersRound} label="Members" value={stats.total} />
          <Stat icon={UsersRound} label="Active" value={stats.active} />
          <Stat icon={MapPin} label="Branches" value={stats.branches} />
          <Stat icon={Dumbbell} label="0–3 Sessions" value={stats.lowSessions} />
          <Stat icon={AlertTriangle} label="Payment Attention" value={stats.paymentAttention} />
        </section>

        <section className="mt-5 rounded-[26px] border border-white/10 bg-[#101725] p-4 md:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_repeat(3,190px)]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member name, ID, email, branch…"
                className="w-full rounded-2xl border border-white/10 bg-[#1b2434] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/30 focus:border-[#ff7a1a]/50"
              />
            </label>
            <Filter value={branchFilter} setValue={setBranchFilter} label="All branches" options={branches} />
            <Filter value={packageFilter} setValue={setPackageFilter} label="All packages" options={packages} />
            <Filter value={statusFilter} setValue={setStatusFilter} label="All statuses" options={statuses} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-bold uppercase tracking-[.15em] text-white/35">Group by</span>
            {([
              ["none", "None"],
              ["branch", "Branch"],
              ["package", "Package"],
              ["sessions", "Sessions"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setGroupBy(value)}
                className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                  groupBy === value ? "bg-[#ff7a1a] text-white" : "bg-white/5 text-white/55 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto text-xs text-white/35">
              Showing {filtered.length} of {initialMembers.length}
            </span>
          </div>
        </section>

        <div className="mt-5 space-y-6">
          {groups.map(([label, members]) => (
            <section key={label}>
              {groupBy !== "none" && (
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-lg font-black">{label}</h2>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white/55">
                    {members.length}
                  </span>
                </div>
              )}

              {members.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/40">
                  No members match these filters.
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {members.map((member) => (
                    <MemberCard key={member.id} member={member} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </StaffAppShell>
  )
}

function MemberCard({ member }: { member: MemberDirectoryItem }) {
  const name = displayName(member)
  const pkg = packageName(member)
  const status = memberStatus(member)
  const total = member.total_sessions ?? 0
  const used = member.sessions_used ?? 0
  const left = member.sessions_left ?? 0
  const payment = member.payment_status || "Not recorded"

  return (
    <Link
      href={`/staff/members/${member.id}`}
      className="group rounded-[24px] border border-white/10 bg-[#141414] p-4 transition hover:border-[#ff7a1a]/35 hover:bg-[#171717]"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#25324a] text-sm font-black text-[#ff9b54]">
          {name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("") || "BF"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-white/35">
                {member.member_code || member.membership_id || "No member ID"}
              </p>
              <h3 className="mt-1 truncate text-lg font-black">{name}</h3>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusTone(status)}`}>
              {status}
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Info icon={MapPin} value={member.branch || "No branch"} />
            <Info icon={Package} value={pkg} />
            <Info icon={Dumbbell} value={`${left} / ${total} sessions left`} />
            <Info icon={CircleDollarSign} value={`Payment: ${payment}`} />
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[.12em] text-white/35">
              <span>Package usage</span>
              <span>{used} used</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#25324a]">
              <div className="h-full rounded-full bg-[#ff7a1a]" style={{ width: `${pct(used, total)}%` }} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-1 text-xs font-bold text-[#ff9b54]">
            View member <ChevronRight size={15} className="transition group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </Link>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersRound
  label: string
  value: number
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#141414] p-4">
      <div className="flex items-center gap-2 text-white/40">
        <Icon size={16} />
        <p className="text-xs font-bold uppercase tracking-[.13em]">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  )
}

function Info({ icon: Icon, value }: { icon: typeof MapPin; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-white/55">
      <Icon size={15} className="shrink-0 text-[#ff7a1a]" />
      <span className="truncate">{value}</span>
    </div>
  )
}

function Filter({
  value,
  setValue,
  label,
  options,
}: {
  value: string
  setValue: (value: string) => void
  label: string
  options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(event) => setValue(event.target.value)}
      className="rounded-2xl border border-white/10 bg-[#1b2434] px-4 py-3 text-sm text-white/75 outline-none focus:border-[#ff7a1a]/50"
    >
      <option value="ALL">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
