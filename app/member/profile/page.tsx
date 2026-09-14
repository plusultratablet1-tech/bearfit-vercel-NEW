import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { MapPin } from "lucide-react"
import MemberAppShell from "@/components/bearfit/MemberAppShell"
import { createClient } from "@/lib/supabase/server"
import { loadMemberAccountData } from "@/lib/member-account-server"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
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
  if (["active", "paid", "completed", "approved"].includes(normalized)) {
    return "bg-emerald-500/15 text-emerald-300"
  }
  if (["pending", "processing"].includes(normalized)) {
    return "bg-amber-500/15 text-amber-300"
  }
  return "bg-white/10 text-white/70"
}

export default async function MemberProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  const { member, profile, loadError } = await loadMemberAccountData(user.id)
  const displayName =
    member?.full_name ||
    member?.name ||
    profile?.full_name ||
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ||
    user.email?.split("@")[0] ||
    "Member"

  return (
    <MemberAppShell activePath="/member/profile">
      <div className="mx-auto max-w-6xl p-4 pb-28 md:p-6 md:pb-28 lg:p-8 lg:pb-8">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff9b54]">Member Profile</p>
          <h1 className="mt-1 text-3xl font-extrabold">Your BearFit profile</h1>
        </div>

        {loadError && (
          <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {loadError}
          </div>
        )}

        {!member ? (
          <div className="rounded-[28px] border border-white/10 bg-[#141414] p-8 text-center">
            <h2 className="text-2xl font-bold">Membership record not linked yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/55">
              Your login is active, but BearFit could not find a linked member record for this account.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-[28px] border border-white/10 bg-[#141414] p-5 md:p-7">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
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
                  <div>
                    <h2 className="text-2xl font-extrabold">{displayName}</h2>
                    <p className="mt-1 text-white/55">{member.email || user.email || "Email not available"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(member.membership_status || member.status)}`}>
                        {member.membership_status || member.status}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(member.payment_status)}`}>
                        Payment: {member.payment_status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#1d1d1d] px-5 py-4 md:text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-400">Member ID</p>
                  <p className="mt-1 text-3xl font-extrabold">{member.membership_id || member.member_code}</p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ProfileStat label="Package" value={member.package_name || member.package_type || "Not assigned"} />
              <ProfileStat label="Sessions Left" value={String(member.sessions_left)} />
              <ProfileStat label="Sessions Used" value={String(member.sessions_used)} />
              <ProfileStat label="Total Paid" value={formatMoney(member.total_paid)} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[28px] bg-[#141414] p-5 md:p-6">
                <h3 className="text-xl font-bold">Personal details</h3>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <ProfileDetail label="Full name" value={member.full_name || member.name} />
                  <ProfileDetail label="Phone" value={member.phone || profile?.phone || "Not provided"} />
                  <ProfileDetail label="Email" value={member.email || user.email || "—"} />
                  <ProfileDetail label="Joined" value={formatDate(member.join_date)} />
                </div>
              </div>

              <div className="rounded-[28px] bg-[#141414] p-5 md:p-6">
                <h3 className="text-xl font-bold">Membership details</h3>
                <div className="mt-5 space-y-4">
                  <ProfileRow label="Member code" value={member.member_code} />
                  <ProfileRow label="Membership ID" value={member.membership_id || member.member_code} />
                  <ProfileRow label="Branch" value={member.branch || profile?.branch || "Not assigned"} icon={<MapPin size={16} />} />
                  <ProfileRow label="Package" value={member.package_name || member.package_type || "Not assigned"} />
                  <ProfileRow label="Total sessions" value={String(member.total_sessions)} />
                  <ProfileRow label="Payment status" value={member.payment_status || "Not recorded"} />
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </MemberAppShell>
  )
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-[#242424] p-5">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 break-words text-2xl font-extrabold">{value}</p>
    </div>
  )
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-white/35">{label}</p>
      <p className="mt-1 font-semibold text-white/90">{value}</p>
    </div>
  )
}

function ProfileRow({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-white/45">{label}</span>
      <span className="flex items-center gap-2 text-right text-sm font-bold text-white/90">
        {icon}
        {value}
      </span>
    </div>
  )
}
