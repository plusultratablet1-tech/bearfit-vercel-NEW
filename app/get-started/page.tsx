"use client";

import { useRouter } from "next/navigation";

export default function GetStartedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white flex justify-center">
      <div className="w-full max-w-md px-6 py-6">
        {/* ✅ Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm text-white/70 hover:text-white flex items-center gap-2"
        >
          ← Back
        </button>

        {/* Header */}
        <h1 className="text-2xl font-bold mb-2">Free Assessment</h1>
        <p className="text-white/70 mb-6">
          Fill this out and we’ll message you to confirm your appointment.
        </p>

        {/* Form */}
        <form className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Full Name</label>
            <input
              className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none"
              placeholder="Juan Dela Cruz"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Phone</label>
            <input
              className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none"
              placeholder="09xx..."
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Email (Optional)</label>
            <input
              className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none"
              placeholder="you@email.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Goal (Optional)</label>
            <input
              className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none"
              placeholder="Fat loss / Strength / Conditioning"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">
              Preferred Schedule (Optional)
            </label>
            <input
              className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none"
              placeholder="Weeknights / Saturdays"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-6 rounded-full bg-[#F37120] py-3 font-semibold text-black"
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}
