"use client"

import Link from "next/link"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

export type StaffPackageItem = {
  id: string
  code: string
  name: string
  service_category: string
  included_sessions: number
  validity_days: number | null
  shareable: boolean
  billing_mode: string
  active: boolean
  standard_price: number | null
}

export type StaffPackageStage = {
  id: string
  package_id: string
  stage_order: number
  stage_key: string
  label: string
  trigger_type: string
  trigger_sessions_left: number | null
  blocks_new_bookings_when_due: boolean
  active: boolean
}

export type StaffPackageSnapshot = {
  packages: StaffPackageItem[]
  stages: StaffPackageStage[]
}

export type StaffPackageAttentionItem = {
  member_id: string
  member_code: string
  member_name: string
  member_package_id: string
  package_code: string
  package_name: string
  service_category: string
  sessions_left: number
  reason: "payment_due" | "last_session" | "renewal_soon" | "expired" | string
  warning_level: string
  expires_at: string | null
}

function peso(value: number | null) {
  return value == null
    ? "Price not configured"
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
      }).format(value)
}

function attentionCopy(reason: string) {
  if (reason === "payment_due") return { title: "Payment Due", tone: "critical" }
  if (reason === "last_session") return { title: "Last Session — Renew Now", tone: "critical" }
  if (reason === "renewal_soon") return { title: "Renewal Soon", tone: "warning" }
  if (reason === "expired") return { title: "Package Expired", tone: "critical" }
  return { title: reason.replaceAll("_", " "), tone: "warning" }
}

function paymentHref(item: StaffPackageAttentionItem) {
  const params = new URLSearchParams({
    memberId: item.member_id,
    packageCode: item.package_code,
  })

  if (item.reason === "payment_due") {
    params.set("memberPackageId", item.member_package_id)
  } else {
    params.set("stageKey", "activation")
  }

  return `/payments?${params.toString()}`
}

export default function StaffPackagesPageClient({
  role,
  initialSnapshot,
  initialAttention,
  initialError,
}: {
  role: "staff" | "admin"
  initialSnapshot: StaffPackageSnapshot
  initialAttention: StaffPackageAttentionItem[]
  initialError: string | null
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [error, setError] = useState<string | null>(initialError)
  const [saving, setSaving] = useState<string | null>(null)

  async function save(pkg: StaffPackageItem, price: string, active: boolean) {
    setSaving(pkg.id)
    setError(null)

    const parsed = price.trim() === "" ? null : Number(price)
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setSaving(null)
      setError("Enter a valid non-negative price or leave it blank.")
      return
    }

    const { data, error: saveError } = await supabase.rpc("admin_update_package_settings", {
      p_package_id: pkg.id,
      p_standard_price: parsed,
      p_active: active,
    })

    setSaving(null)
    if (saveError) {
      setError(saveError.message)
      return
    }

    setSnapshot(data as StaffPackageSnapshot)
  }

  return (
    <main className="min-h-screen bg-[#020b1c] px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#ff9b54]">BearFit Staff</p>
            <h1 className="text-3xl font-black">Package Settings</h1>
            <p className="mt-1 text-sm text-white/45">Prices are guidance. Session rules stay protected.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/staff/schedule" className="rounded-full bg-white/10 px-4 py-2 text-sm">
              Schedule
            </Link>
            <Link href="/payments" className="rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-bold">
              Payments
            </Link>
          </div>
        </header>

        {error && <div className="mt-4 rounded-2xl bg-red-500/10 p-4 text-red-200">{error}</div>}

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#101725] p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff9b54]">Action Queue</p>
              <h2 className="mt-1 text-2xl font-black">Member Package Attention</h2>
              <p className="mt-1 text-sm text-white/45">
                Members who need a payment, renewal, or expiry action appear here.
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/65">
              {initialAttention.length} item{initialAttention.length === 1 ? "" : "s"}
            </span>
          </div>

          {initialAttention.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-white/40">
              No members currently need package attention.
            </div>
          ) : (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {initialAttention.map((item) => {
                const copy = attentionCopy(item.reason)
                const critical = copy.tone === "critical"
                return (
                  <article
                    key={`${item.member_package_id}-${item.reason}`}
                    className={`rounded-2xl border p-4 ${
                      critical
                        ? "border-red-400/20 bg-red-400/[0.06]"
                        : "border-amber-300/20 bg-amber-300/[0.06]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[.14em] text-white/40">
                          {item.member_code}
                        </p>
                        <h3 className="mt-1 text-lg font-black">{item.member_name}</h3>
                        <p className="mt-1 text-sm text-white/55">
                          {item.package_name} · {item.service_category.replaceAll("_", " ")}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          critical ? "bg-red-400/15 text-red-200" : "bg-amber-300/15 text-amber-200"
                        }`}
                      >
                        {copy.title}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div>
                        <span className="text-white/40">Sessions left</span>
                        <p className="mt-1 text-2xl font-black">{item.sessions_left}</p>
                      </div>
                      {item.expires_at && (
                        <div className="text-right">
                          <span className="text-white/40">Expiry</span>
                          <p className="mt-1 font-semibold">
                            {new Date(item.expires_at).toLocaleDateString("en-PH")}
                          </p>
                        </div>
                      )}
                    </div>

                    <Link
                      href={paymentHref(item)}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#ff7a1a] px-4 py-3 text-sm font-bold transition hover:bg-[#ff8b38]"
                    >
                      {item.reason === "payment_due" ? "Record Due Payment" : "Start Renewal Payment"}
                    </Link>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {snapshot.packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              stages={snapshot.stages.filter((stage) => stage.package_id === pkg.id)}
              canEdit={role === "admin" && pkg.code !== "LEGACY_FITNESS"}
              saving={saving === pkg.id}
              onSave={save}
            />
          ))}
        </section>
      </div>
    </main>
  )
}

function PackageCard({
  pkg,
  stages,
  canEdit,
  saving,
  onSave,
}: {
  pkg: StaffPackageItem
  stages: StaffPackageStage[]
  canEdit: boolean
  saving: boolean
  onSave: (pkg: StaffPackageItem, price: string, active: boolean) => void
}) {
  const [price, setPrice] = useState(pkg.standard_price?.toString() ?? "")
  const [active, setActive] = useState(pkg.active)

  return (
    <article className="rounded-[24px] border border-white/[.07] bg-[#171717] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-white/35">{pkg.code}</p>
          <h2 className="mt-1 text-xl font-black">{pkg.name}</h2>
          <p className="mt-1 text-sm text-white/45">{pkg.service_category}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/45"
          }`}
        >
          {active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Meta label="Included sessions" value={String(pkg.included_sessions)} />
        <Meta label="Validity" value={pkg.validity_days ? `${pkg.validity_days} days` : "No fixed validity"} />
        <Meta label="Billing mode" value={pkg.billing_mode} />
        <Meta label="Shareable" value={pkg.shareable ? "Yes" : "No"} />
      </div>

      <div className="mt-4 rounded-2xl bg-white/[.04] p-4">
        <p className="text-xs font-bold uppercase tracking-[.13em] text-white/35">Payment stages</p>
        {stages.length ? (
          stages.map((stage) => (
            <p key={stage.id} className="mt-2 text-sm text-white/60">
              {stage.stage_order}. {stage.label}
              {stage.trigger_sessions_left !== null ? ` · ${stage.trigger_sessions_left} left` : ""}
            </p>
          ))
        ) : (
          <p className="mt-2 text-sm text-white/40">No staged payments.</p>
        )}
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-bold uppercase tracking-[.13em] text-white/45">Standard price</span>
        <input
          disabled={!canEdit}
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="Price not configured"
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#222] px-4 py-3 disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-white/35">Current: {peso(pkg.standard_price)}</p>
      </label>

      <label className="mt-4 flex items-center gap-3 text-sm">
        <input
          disabled={!canEdit}
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        Active package
      </label>

      {canEdit ? (
        <button
          disabled={saving}
          onClick={() => onSave(pkg, price, active)}
          className="mt-4 w-full rounded-xl bg-[#ff7a1a] px-4 py-3 font-bold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save package settings"}
        </button>
      ) : (
        <p className="mt-4 text-xs text-white/35">Admin access required to change package settings.</p>
      )}
    </article>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[.04] p-3">
      <p className="text-[10px] uppercase tracking-[.12em] text-white/35">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  )
}
