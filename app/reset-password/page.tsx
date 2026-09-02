"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).catch(() => {
        // ignore
      });
    }
  }, []);

  async function handleSetPassword() {
    setErr(null);
    setMsg(null);

    if (!password || password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    if (password !== password2) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setMsg("Password updated. You can now log in.");
    setLoading(false);

    setTimeout(() => {
      window.location.href = "/login";
    }, 900);
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp .5s ease-out forwards; }
      `}</style>

      <div className="w-full h-full md:max-w-[430px] md:rounded-2xl bg-[#0b0b0b] flex items-center justify-center px-6">
        <div className={`w-full max-w-sm ${mounted ? "fade-up" : "opacity-0"}`}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">Set New Password</h1>
            <p className="text-white/70 text-sm mt-2">
              Create a strong password you’ll remember.
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#F37120]"
            />

            <input
              type="password"
              placeholder="Confirm new password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#F37120]"
            />

            {err && <div className="text-red-400 text-sm text-center">{err}</div>}
            {msg && <div className="text-green-300 text-sm text-center">{msg}</div>}

            <button
              onClick={handleSetPassword}
              disabled={loading}
              className="w-full rounded-full bg-[#F37120] py-3 font-semibold text-black disabled:opacity-60"
            >
              {loading ? "Saving…" : "Update password"}
            </button>

            <a
              href="/login"
              className="block text-center text-sm text-white/70 underline underline-offset-4"
            >
              Back to login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
