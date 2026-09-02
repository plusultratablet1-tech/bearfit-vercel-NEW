"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MemberJoin = { member_code: string | null; name: string | null };

type PaymentRow = {
  id: string;
  member_id: string;
  package_name: string | null;
  stage: string | null;
  amount: number | null;
  status: string | null;
  created_at: string;
  paid_at: string | null;
  members?: MemberJoin[] | null;
};

function peso(n?: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}

function isToday(dateIso?: string | null) {
  if (!dateIso) return false;
  const d = new Date(dateIso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  async function fetchPayments() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("payments")
      .select(`
        id,
        member_id,
        package_name,
        stage,
        amount,
        status,
        created_at,
        paid_at,
        members:members ( member_code, name )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as PaymentRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchPayments();
  }, []);

  const packages = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.package_name) set.add(r.package_name);
    }
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();

    return rows.filter((r) => {
      const m0 = r.members?.[0];
      const memberCode = (m0?.member_code ?? "").toLowerCase();
      const memberName = (m0?.name ?? "").toLowerCase();
      const pkg = r.package_name ?? "";
      const st = (r.status ?? "").toLowerCase();

      const matchSearch =
        !s ||
        memberCode.includes(s) ||
        memberName.includes(s) ||
        (r.stage ?? "").toLowerCase().includes(s);

      const matchPackage = packageFilter === "ALL" || pkg === packageFilter;
      const matchStatus =
        statusFilter === "ALL" || st === statusFilter.toLowerCase();

      return matchSearch && matchPackage && matchStatus;
    });
  }, [rows, search, packageFilter, statusFilter]);

  const stats = useMemo(() => {
    const pending = rows.filter((r) => (r.status ?? "").toLowerCase() !== "paid");
    const paidToday = rows.filter(
      (r) => (r.status ?? "").toLowerCase() === "paid" && isToday(r.paid_at)
    );
    const overdue = pending.filter((r) => {
      const created = new Date(r.created_at).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      return Date.now() - created > sevenDays;
    });

    return {
      paymentsDue: pending.length,
      paidToday: paidToday.length,
      overdue: overdue.length,
      renewalsSoon: 0,
    };
  }, [rows]);

  async function markAsPaid(payment: PaymentRow) {
    const paymentId = payment.id;
    const memberId = payment.member_id;
    const amount = payment.amount ?? 0;

    try {
      setMarking((m) => ({ ...m, [paymentId]: true }));
      setError(null);

      const nowIso = new Date().toISOString();

      const { error: payErr } = await supabase
        .from("payments")
        .update({ status: "paid", paid_at: nowIso })
        .eq("id", paymentId);

      if (payErr) throw payErr;

      const { error: memErr } = await supabase
        .from("members")
        .update({
          payment_status: "paid",
          last_paid_at: nowIso,
          last_paid_amount: amount,
        })
        .eq("id", memberId);

      if (memErr) throw memErr;

      await fetchPayments();
    } catch (e: any) {
      setError(e?.message ?? "Failed to mark as paid.");
    } finally {
      setMarking((m) => ({ ...m, [paymentId]: false }));
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <div className="text-xl font-extrabold">
          Bear<span className="text-orange-500">Fit</span>PH
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/dashboard"
            className="rounded-full border border-black px-4 py-2 text-sm font-semibold"
          >
            Dashboard
          </a>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard title="Payments Due" value={stats.paymentsDue} />
          <StatCard title="Paid Today" value={stats.paidToday} />
          <StatCard title="Overdue" value={stats.overdue} />
          <StatCard title="Renewals Soon" value={stats.renewalsSoon} />
        </div>

        <section className="mt-6 rounded-3xl border-2 border-black p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-extrabold">Payment Records</h2>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="M002 / name / stage..."
                className="w-full rounded-2xl border border-black px-4 py-2 text-sm md:w-64"
              />

              <select
                value={packageFilter}
                onChange={(e) => setPackageFilter(e.target.value)}
                className="w-full rounded-2xl border border-black px-4 py-2 text-sm md:w-56"
              >
                {packages.map((p) => (
                  <option key={p} value={p}>
                    {p === "ALL" ? "All Packages" : p}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-2xl border border-black px-4 py-2 text-sm md:w-40"
              >
                <option value="ALL">All Status</option>
                <option value="pending">pending</option>
                <option value="paid">paid</option>
              </select>

              <button
                type="button"
                onClick={fetchPayments}
                className="rounded-2xl border border-black px-4 py-2 text-sm font-semibold"
              >
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-2xl border border-black">
            <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-bold uppercase">
              <div className="col-span-3">Member</div>
              <div className="col-span-3">Package</div>
              <div className="col-span-2">Payment Stage</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {loading ? (
              <div className="px-4 py-6 text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm">No payments found.</div>
            ) : (
              <div className="divide-y divide-black/10">
                {filtered.map((r) => {
                  const status = (r.status ?? "pending").toLowerCase();
                  const isPaid = status === "paid";
                  const busy = !!marking[r.id];
                  const m0 = r.members?.[0];

                  return (
                    <div
                      key={r.id}
                      className="grid grid-cols-12 items-center px-4 py-4 text-sm"
                    >
                      <div className="col-span-3">
                        <div className="font-bold">{m0?.name ?? "—"}</div>
                        <div className="text-xs text-gray-600">
                          ID: {m0?.member_code ?? "—"}
                        </div>
                      </div>

                      <div className="col-span-3">{r.package_name ?? "—"}</div>

                      <div className="col-span-2">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">
                          {r.stage ?? "—"}
                        </span>
                      </div>

                      <div className="col-span-2 font-extrabold text-orange-500">
                        {peso(r.amount)}
                      </div>

                      <div className="col-span-1">
                        <span
                          className={
                            "rounded-full px-3 py-1 text-xs font-bold " +
                            (isPaid
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800")
                          }
                        >
                          {isPaid ? "Paid" : "Pending"}
                        </span>
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => markAsPaid(r)}
                          disabled={isPaid || busy}
                          className={
                            "rounded-2xl px-4 py-2 text-xs font-bold text-white " +
                            (isPaid
                              ? "bg-gray-400 cursor-not-allowed"
                              : busy
                              ? "bg-orange-300 cursor-wait"
                              : "bg-orange-500 hover:bg-orange-600 active:scale-[0.99]")
                          }
                        >
                          {isPaid ? "Paid" : busy ? "Saving…" : "Mark as Paid"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-black/20 bg-white p-4">
            <div className="font-bold">Notes</div>
            <div className="text-sm text-gray-700">
              “Mark as Paid” updates:
              <span className="font-semibold"> payments.status + payments.paid_at</span>
              {" "}AND{" "}
              <span className="font-semibold">
                members.payment_status + members.last_paid_at + members.last_paid_amount
              </span>.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-3xl border-2 border-black p-4">
      <div className="text-sm font-semibold text-gray-700">{title}</div>
      <div className="mt-2 text-3xl font-extrabold">{value ?? "—"}</div>
    </div>
  );
}
