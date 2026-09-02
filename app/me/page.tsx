import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { loadMemberAccountData } from "@/lib/member-account"

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

export default async function MePage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  const { member, profile, sessionLogs, payments, loadError } = await loadMemberAccountData(user.id)

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#171717]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/member/dashboard" className="text-xl font-extrabold">
            Bear<span className="text-orange-500">Fit</span>PH
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/member/dashboard"
              className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold"
            >
              Dashboard
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">Member account</p>
          <h1 className="mt-1 text-3xl font-extrabold">My Account</h1>
          <p className="mt-2 text-sm text-gray-500">Live membership details from BearFit.</p>
        </div>

        {loadError && (
          <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            {loadError}
          </div>
        )}

        {!member ? (
          <section className="mt-6 rounded-3xl border border-black/10 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-extrabold">Membership record not linked yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
              Your BearFit login is active, but this account does not currently have a linked membership record.
              Please ask BearFit staff to verify the account link.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-6 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
              <div className="border-b border-black/10 bg-[#101827] p-6 text-white md:p-8">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-white/55">Member</p>
                    <h2 className="mt-1 text-3xl font-extrabold">{member.full_name || member.name}</h2>
                    <p className="mt-1 text-white/60">{member.email || user.email}</p>
                  </div>

                  <div className="rounded-2xl bg-white/10 px-5 py-4 md:text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Member ID</p>
                    <p className="mt-1 text-2xl font-extrabold">{member.membership_id || member.member_code}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
                <AccountField label="Package" value={member.package_name || member.package_type || "Not assigned"} />
                <AccountField label="Branch" value={member.branch || profile?.branch || "Not assigned"} />
                <AccountField label="Membership Status" value={member.membership_status || member.status || "Not assigned"} />
                <AccountField label="Payment Status" value={member.payment_status || "Not recorded"} />
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Sessions Used" value={String(member.sessions_used)} />
              <StatCard label="Sessions Remaining" value={String(member.sessions_left)} />
              <StatCard label="Total Sessions" value={String(member.total_sessions)} />
              <StatCard label="Total Paid" value={formatMoney(member.total_paid)} />
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-extrabold">Account Details</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Detail label="Full Name" value={member.full_name || member.name} />
                  <Detail label="Email" value={member.email || user.email || "—"} />
                  <Detail label="Phone" value={member.phone || profile?.phone || "Not provided"} />
                  <Detail label="Joined" value={formatDate(member.join_date)} />
                  <Detail label="Last Payment" value={formatDateTime(member.last_paid_at)} />
                  <Detail label="Last Payment Amount" value={member.last_paid_amount == null ? "—" : formatMoney(member.last_paid_amount)} />
                </div>
              </div>

              <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-extrabold">Membership Summary</h2>
                <div className="mt-5 space-y-4">
                  <SummaryRow label="Member code" value={member.member_code} />
                  <SummaryRow label="Membership ID" value={member.membership_id || member.member_code} />
                  <SummaryRow label="Package type" value={member.package_type || "Not assigned"} />
                  <SummaryRow label="Branch" value={member.branch || "Not assigned"} />
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold">Session Timeline</h2>
                  <p className="mt-1 text-sm text-gray-500">Read-only history of staff-recorded check-ins.</p>
                </div>
                <div className="text-sm font-semibold text-gray-500">
                  {sessionLogs.length} record{sessionLogs.length === 1 ? "" : "s"}
                </div>
              </div>

              {sessionLogs.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-gray-500">
                  No session logs have been recorded yet.
                </div>
              ) : (
                <div className="mt-5 overflow-hidden rounded-2xl border border-black/10">
                  <div className="hidden grid-cols-[1fr_2fr_auto] bg-gray-50 px-4 py-3 text-xs font-bold uppercase text-gray-500 md:grid">
                    <div>Date</div>
                    <div>Notes</div>
                    <div>Sessions Left</div>
                  </div>
                  <div className="divide-y divide-black/10">
                    {sessionLogs.map((log) => (
                      <div key={log.id} className="grid gap-2 px-4 py-4 text-sm md:grid-cols-[1fr_2fr_auto] md:items-center">
                        <div className="font-semibold">{formatDateTime(log.trained_at)}</div>
                        <div className="text-gray-600">{log.notes || "No staff notes"}</div>
                        <div className="font-bold text-orange-500">{log.sessions_left_after}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="mt-6 rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold">Payment History</h2>
                  <p className="mt-1 text-sm text-gray-500">Payments linked to your member record.</p>
                </div>
                <div className="text-sm font-semibold text-gray-500">
                  {payments.length} record{payments.length === 1 ? "" : "s"}
                </div>
              </div>

              {payments.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-gray-500">
                  No payment records are available yet.
                </div>
              ) : (
                <div className="mt-5 divide-y divide-black/10 rounded-2xl border border-black/10 px-4">
                  {payments.map((payment) => (
                    <div key={payment.id} className="grid gap-2 py-4 text-sm md:grid-cols-[1.3fr_1fr_1fr_auto] md:items-center">
                      <div>
                        <p className="font-semibold">{payment.package_name || payment.stage || "Membership payment"}</p>
                        <p className="text-gray-500">{payment.payment_type || "Payment method not recorded"}</p>
                      </div>
                      <div className="text-gray-600">{formatDateTime(payment.paid_at || payment.payment_date || payment.created_at)}</div>
                      <div className="font-bold">{formatMoney(payment.amount)}</div>
                      <div className="capitalize text-orange-500">{payment.status}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function AccountField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-black/10 p-5 md:border-b-0 md:border-r last:border-r-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-2 font-bold capitalize">{value}</p>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 break-words text-3xl font-extrabold">{value}</p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-bold">{value}</span>
    </div>
  )
}
