"use client"

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  PackageCheck,
  ReceiptText,
  WalletCards,
} from "lucide-react"
import MemberAppShell from "@/components/bearfit/MemberAppShell"
import {
  displayPackageNameForMember,
  type MemberPackageEligibilityView,
  type MemberPaymentsData,
  type PaymentRow,
} from "@/lib/member-account"

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function categoryLabel(category: string) {
  if (category === "fitness") return "Fitness"
  if (category === "pilates_group") return "Pilates Group"
  if (category === "pilates_1on1") return "Pilates 1-on-1"
  return category
}

function stageLabel(stage: string | null | undefined) {
  if (!stage) return "Package payment"
  if (stage === "activation") return "Activation payment"
  if (stage === "sessions_left_19") return "19 sessions left installment"
  if (stage === "sessions_left_13") return "13 sessions left installment"
  return stage.replaceAll("_", " ")
}

function nextPartial24Milestone(pkg: MemberPackageEligibilityView) {
  if (pkg.package_code !== "PARTIAL24" || pkg.payment_stage_due || pkg.sessions_left <= 0) return null
  if (pkg.sessions_left > 19) return "Next installment at 19 sessions left"
  if (pkg.sessions_left > 13) return "Next installment at 13 sessions left"
  return "Installments up to date"
}

function packageAttention(pkg: MemberPackageEligibilityView) {
  if (pkg.blocking_reason === "Payment Due" || pkg.payment_stage_due) {
    return { label: "Payment Due", tone: "danger" as const }
  }
  if (/Last Session/i.test(pkg.warning_message ?? "")) {
    return { label: "Last Session — Renew Now", tone: "danger" as const }
  }
  if (/Renewal Soon/i.test(pkg.warning_message ?? "")) {
    return { label: "Renewal Soon", tone: "warning" as const }
  }
  if (pkg.blocking_reason) {
    return { label: pkg.blocking_reason, tone: "warning" as const }
  }
  return { label: "Up to date", tone: "good" as const }
}

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === "paid") return "bg-emerald-500/15 text-emerald-300"
  if (normalized === "pending") return "bg-amber-500/15 text-amber-300"
  return "bg-white/10 text-white/65"
}

function attentionClass(tone: "good" | "warning" | "danger") {
  if (tone === "good") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
  if (tone === "danger") return "border-red-400/25 bg-red-500/10 text-red-200"
  return "border-amber-400/25 bg-amber-500/10 text-amber-200"
}

function pendingPaymentForPackage(payments: PaymentRow[], pkg: MemberPackageEligibilityView) {
  if (!pkg.payment_stage_due || !pkg.member_package_id) return null
  return (
    payments.find(
      (payment) =>
        payment.status.toLowerCase() === "pending" &&
        payment.member_package_id === pkg.member_package_id &&
        payment.stage === pkg.payment_stage_due,
    ) ?? null
  )
}

export default function MemberPaymentsPageClient({ data }: { data: MemberPaymentsData }) {
  const member = data.member
  const packages = data.packages
  const payments = data.payments
  const latestPaid = payments.find((payment) => payment.status.toLowerCase() === "paid") ?? null
  const primaryPackage =
    packages.find((pkg) => pkg.blocking_reason === "Payment Due" || Boolean(pkg.payment_stage_due)) ??
    packages.find((pkg) => /Last Session/i.test(pkg.warning_message ?? "")) ??
    packages.find((pkg) => /Renewal Soon/i.test(pkg.warning_message ?? "")) ??
    packages[0] ??
    null
  const overallAttention = primaryPackage
    ? packageAttention(primaryPackage)
    : { label: "No active package", tone: "warning" as const }

  return (
    <MemberAppShell activePath="/member/payments">
      <div className="mx-auto max-w-7xl px-4 py-5 pb-28 md:px-6 lg:px-8 lg:py-8 lg:pb-8">
        <header className="border-b border-white/10 pb-5">
          <p className="text-xs font-extrabold uppercase tracking-[.22em] text-[#ff9b54]">Member Billing</p>
          <h1 className="mt-1 text-3xl font-black">Payments & Package</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            See your package balance, payment status, upcoming installment gates, and BearFit payment history.
          </p>
        </header>

        {data.loadError && (
          <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-200">
            {data.loadError}
          </div>
        )}

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <SummaryCard
            icon={overallAttention.tone === "good" ? CheckCircle2 : AlertTriangle}
            label="Payment Health"
            value={overallAttention.label}
            sublabel={member?.payment_status ? `Account status: ${member.payment_status}` : "Account payment status"}
            tone={overallAttention.tone}
          />
          <SummaryCard
            icon={WalletCards}
            label="Last Payment"
            value={latestPaid ? formatMoney(latestPaid.amount) : "No payment yet"}
            sublabel={latestPaid ? formatDateTime(latestPaid.paid_at ?? latestPaid.payment_date ?? latestPaid.created_at) : "Paid transactions will appear here"}
          />
          <SummaryCard
            icon={CreditCard}
            label="Total Recorded"
            value={formatMoney(member?.total_paid)}
            sublabel={`${payments.length} recent payment record${payments.length === 1 ? "" : "s"}`}
          />
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-white/35">Your Packages</p>
            <h2 className="mt-1 text-2xl font-black">Package & payment status</h2>
          </div>

          {packages.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-[#141414] p-8 text-center">
              <PackageCheck className="mx-auto text-[#ff7a1a]" size={34} />
              <h3 className="mt-3 text-xl font-bold">No package found</h3>
              <p className="mt-2 text-sm text-white/45">Ask BearFit staff/admin to verify your active package and payment record.</p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {packages.map((pkg) => {
                const attention = packageAttention(pkg)
                const pendingPayment = pendingPaymentForPackage(payments, pkg)
                const partialMilestone = nextPartial24Milestone(pkg)
                const packageName = displayPackageNameForMember(member, pkg.package_name ?? member?.package_name ?? "BearFit Package")
                const used = pkg.sessions_used ?? Math.max(pkg.sessions_total - pkg.sessions_left, 0)
                const progress = pkg.sessions_total > 0 ? Math.min((used / pkg.sessions_total) * 100, 100) : 0
                const due = attention.label === "Payment Due"

                return (
                  <article key={`${pkg.service_category}-${pkg.member_package_id}`} className="rounded-[24px] border border-white/[0.07] bg-[#151515] p-5 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[.14em] text-white/35">{categoryLabel(pkg.service_category)}</p>
                        <h3 className="mt-1 text-2xl font-black">{packageName}</h3>
                      </div>
                      <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${attentionClass(attention.tone)}`}>
                        {attention.label}
                      </span>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-4xl font-black">{pkg.sessions_left}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[.14em] text-white/35">Sessions remaining</p>
                      </div>
                      <p className="text-sm text-white/45">{used} of {pkg.sessions_total} used</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#ff6b0a] to-[#ff9b54]" style={{ width: `${progress}%` }} />
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <InfoCell
                        label="Payment stage"
                        value={pkg.payment_stage_label ?? partialMilestone ?? "No payment due right now"}
                        icon={Clock3}
                      />
                      <InfoCell
                        label="Amount due"
                        value={pendingPayment ? formatMoney(pendingPayment.amount) : due ? "To be confirmed by BearFit" : "—"}
                        icon={CreditCard}
                      />
                    </div>

                    {pkg.expires_at && (
                      <p className="mt-4 text-xs text-white/40">Package expiry: {formatDateTime(pkg.expires_at)}</p>
                    )}

                    {pkg.warning_message && !due && (
                      <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                        {pkg.warning_message}
                      </div>
                    )}

                    {due && (
                      <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                        <p className="font-bold text-red-200">{pkg.payment_stage_label ?? "Payment Due"}</p>
                        <p className="mt-1 text-sm text-red-100/75">Contact BearFit staff/admin to settle this payment.</p>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="mt-9 overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#151515]">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-white/35">History</p>
              <h2 className="mt-1 text-2xl font-black">Recent payments</h2>
            </div>
            <ReceiptText className="text-[#ff7a1a]" size={22} />
          </div>

          <div className="p-4 md:p-5">
            {payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">No payment records yet.</p>
            ) : (
              <div className="space-y-2 sm:divide-y sm:divide-white/[0.06] sm:space-y-0">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="grid gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{payment.package_name || "BearFit payment"}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${statusClass(payment.status)}`}>
                          {payment.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/45">
                        {stageLabel(payment.stage)}{payment.payment_type ? ` · ${payment.payment_type}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-white/30">
                        {formatDateTime(payment.paid_at ?? payment.payment_date ?? payment.created_at)}
                      </p>
                    </div>
                    <p className="text-xl font-black sm:text-right">{formatMoney(payment.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </MemberAppShell>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tone = "neutral",
}: {
  icon: typeof CreditCard
  label: string
  value: string
  sublabel: string
  tone?: "neutral" | "good" | "warning" | "danger"
}) {
  const border = tone === "good"
    ? "border-emerald-400/20"
    : tone === "danger"
      ? "border-red-400/20"
      : tone === "warning"
        ? "border-amber-400/20"
        : "border-white/[0.06]"

  return (
    <div className={`rounded-[22px] border bg-[#171717] p-5 ${border}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[.15em] text-white/45">{label}</p>
        <Icon size={18} className="text-[#ff8b38]" />
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-white/40">{sublabel}</p>
    </div>
  )
}

function InfoCell({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CreditCard }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-white/35">
        <Icon size={14} className="text-[#ff8b38]" />
        {label}
      </div>
      <p className="mt-2 font-bold text-white/85">{value}</p>
    </div>
  )
}
