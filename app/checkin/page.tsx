"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CheckInPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<string>("Starting camera...");
  const [notes, setNotes] = useState<string>("Conditioning session");
  const [lastCode, setLastCode] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const lastScanTsRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        setStatus("Not logged in. Go to login page first.");
        return;
      }

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profErr) {
        setStatus("Profile error: " + profErr.message);
        return;
      }

      setRole(profile?.role ?? null);

      if (profile?.role !== "staff") {
        setStatus("Access denied. This page is staff-only.");
        return;
      }

      await startCamera();
    })();

    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    try {
      setStatus("Requesting camera permission...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus("Camera ready. Point at a member QR code.");
      scanLoop();
    } catch (e: any) {
      setStatus("Camera error: " + (e?.message ?? "Unknown"));
    }
  }

  function stopCamera() {
    try {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
      streamRef.current = null;
    } catch {}
  }

  async function scanLoop() {
    const AnyWindow = window as any;

    if (!AnyWindow.BarcodeDetector) {
      setStatus(
        "BarcodeDetector not supported on this browser. Use Chrome on Android, or tell me and I’ll give the library version."
      );
      return;
    }

    const detector = new AnyWindow.BarcodeDetector({
      formats: ["qr_code"],
    });

    const tick = async () => {
      if (!videoRef.current) return;
      if (busy) return requestAnimationFrame(tick);

      const now = Date.now();
      if (now - lastScanTsRef.current < 250) {
        return requestAnimationFrame(tick);
      }
      lastScanTsRef.current = now;

      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes && barcodes.length > 0) {
          const raw = (barcodes[0].rawValue ?? "").trim();
          const code = normalizeMemberCode(raw);

          if (code) {
            setLastCode(code);
            setStatus(`Scanned: ${code} — checking in...`);
            await checkIn(code);
          } else {
            setStatus(`Scanned QR, but could not read a member code: "${raw}"`);
          }
        }
      } catch {}

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  function normalizeMemberCode(raw: string) {
    const s = raw.trim();

    const direct = s.match(/\bM\d{3,}\b/i);
    if (direct?.[0]) return direct[0].toUpperCase();

    try {
      if (s.startsWith("http")) {
        const url = new URL(s);
        const m = url.searchParams.get("member");
        if (m) {
          const mm = m.match(/\bM\d{3,}\b/i);
          if (mm?.[0]) return mm[0].toUpperCase();
        }
      }
    } catch {}

    return "";
  }

  async function checkIn(memberCode: string) {
    if (busy) return;
    setBusy(true);

    try {
      const { data, error } = await supabase.rpc("staff_qr_checkin", {
        p_member_code: memberCode,
        p_notes: notes || null,
      });

      if (error) throw error;

      setStatus(
        `✅ Checked in ${memberCode}. New sessions left: ${data?.new_sessions_left ?? "?"}`
      );

      await new Promise((r) => setTimeout(r, 1200));
      setStatus("Camera ready. Point at a member QR code.");
    } catch (e: any) {
      setStatus("❌ Check-in failed: " + (e?.message ?? "Unknown"));
      await new Promise((r) => setTimeout(r, 1200));
      setStatus("Camera ready. Point at a member QR code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
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

      <main className="mx-auto w-full max-w-5xl px-4 pb-10">
        <h1 className="text-2xl font-extrabold">Staff QR Check-In</h1>
        <p className="mt-1 text-sm text-gray-600">
          Scan a member QR (contains <b>M001</b> etc). This will log the session
          and deduct 1 session.
        </p>

        <div className="mt-4 rounded-3xl border-2 border-black p-4">
          <div className="text-sm font-semibold text-gray-700">Status</div>
          <div className="mt-1 text-sm">{status}</div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase text-gray-600">
                Notes (optional)
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-black px-4 py-2 text-sm"
                placeholder="e.g., Conditioning session"
              />
              <div className="mt-2 text-xs text-gray-600">
                Last scanned: <b>{lastCode || "—"}</b>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Role: <b>{role ?? "—"}</b>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-black bg-black">
              <video
                ref={videoRef}
                className="h-[260px] w-full object-cover"
                playsInline
                muted
              />
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-600">
            ⚠️ Camera works only on <b>HTTPS</b>. Use Chrome on Android for best
            results.
          </div>
        </div>
      </main>
    </div>
  );
}
