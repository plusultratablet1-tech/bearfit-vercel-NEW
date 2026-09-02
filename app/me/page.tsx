"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  role: "staff" | "member";
  member_id: string | null;
};

type MemberRow = {
  id: string;
  member_code: string | null;
  name: string | null;
  package_name: string | null;
  sessions_left: number | null;
};

type SessionLogRow = {
  id: string;
  member_id: string;
  trained_at: string;
  notes: string | null;
  staff_user_id: string | null;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [member, setMember] = useState<MemberRow | null>(null);
  const [logs, setLogs] = useState<SessionLogRow[]>([]);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      setError(authErr.message);
      setLoading(false);
      return;
    }

    if (!authData?.user) {
      setError("Not logged in.");
      setLoading(false);
      return;
    }

    const { data: p, error: pErr } = await supabase
      .from("profiles")
      .select("role, member_id")
      .eq("id", authData.user.id)
      .single();

    if (pErr) {
      setError(pErr.message);
      setLoading(false);
      return;
    }

    const prof = p as ProfileRow;
    setProfile(prof);

    if (prof.role !== "member") {
      setError("This page is for members only. (You are staff.)");
      setLoading(false);
      return;
    }

    if (!prof.member_id) {
      setError("No member_id linked to this account.");
      setLoading(false);
      return;
    }

    const { data: m, error: mErr } = await supabase
      .from("members")
      .select("id, member_code, name, package_name, sessions_left")
      .eq("id", prof.member_id)
      .single();

    if (mErr) {
      setError(mErr.message);
      setLoading(false);
      return;
    }

    setMember(m as MemberRow);

    const { data: s, error: sErr } = await supabase
      .from("session_logs")
      .select("id, member_id, trained_at, notes, staff_user_id")
      .eq("member_id", prof.member_id)
      .order("trained_at", { ascending: false });

    if (sErr) {
      setError(sErr.message);
      setLoading(false);
      return;
    }

    setLogs((s ?? []) as SessionLogRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <div className="text-xl font-extrabold">
          Bear<span className="text-orange-500">Fit</span>PH
        </div>

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
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-10">
        <h1 className="text-2xl font-extrabold">My Account</h1>

        {loading && <div className="mt-4 text-sm">Loading your account…</div>}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && member && (
          <>
            <section className="mt-4 rounded-3xl border-2 border-black p-6">
              <div className="text-xl font-extrabold">{member.name ?? "—"}</div>
              <div className="text-sm text-gray-600">
                Member ID: {member.member_code ?? "—"}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase text-gray-500">
                    Package
                  </div>
                  <div className="mt-1 text-lg font-bold">
                    {member.package_name ?? "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase text-gray-500">
                    Remaining Sessions
                  </div>
                  <div className="mt-1 inline-block rounded-md bg-sky-200 px-3 py-1 text-3xl font-extrabold">
                    {member.sessions_left ?? "—"}
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border-2 border-black p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold">Session Timeline</h2>
                <div className="text-sm text-gray-600">
                  {logs.length} record{logs.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-black">
                <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-bold uppercase">
                  <div className="col-span-4">Date</div>
                  <div className="col-span-8">Notes</div>
                </div>

                {logs.length === 0 ? (
                  <div className="px-4 py-6 text-sm">
                    No session logs yet. (Add a test log in Supabase to confirm it shows.)
                  </div>
                ) : (
                  <div className="divide-y divide-black/10">
                    {logs.map((l) => (
                      <div
                        key={l.id}
                        className="grid grid-cols-12 items-start px-4 py-4 text-sm"
                      >
                        <div className="col-span-4 font-semibold">
                          {formatDateTime(l.trained_at)}
                        </div>
                        <div className="col-span-8 text-gray-800">
                          {l.notes ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 text-xs text-gray-600">
                *Read-only. Staff will create session logs during check-in.
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
