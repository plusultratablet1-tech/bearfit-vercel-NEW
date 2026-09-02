export default function MemberProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const memberId = params.id;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <a href="/" className="text-xl font-extrabold tracking-tight">
            Bear<span className="text-[#f37120]">Fit</span>PH
          </a>

          <div className="flex items-center gap-2">
            <a
              href="/dashboard"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Dashboard
            </a>
            <a
              href="/login"
              className="rounded-full bg-[#f37120] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Log out
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              Member Profile
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              Member Name (placeholder)
            </h1>
            <p className="mt-2 text-slate-600">
              Member ID: <span className="font-semibold">{memberId}</span>
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Tag>24 Sessions (Staggered)</Tag>
              <Tag>Active</Tag>
              <Tag>Payment: Pending</Tag>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Edit Member
            </button>
            <button className="rounded-xl bg-[#f37120] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Record Check-in
            </button>
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Send Reminder
            </button>
          </div>
        </div>

        {/* Stats */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Sessions Left" value="—" hint="Auto updates after check-in" />
          <StatCard title="Sessions Used" value="—" hint="From check-in logs" />
          <StatCard title="Package Total" value="—" hint="Includes freebies (if any)" />
          <StatCard title="Last Check-in" value="—" hint="Date + time" />
        </section>

        {/* Main grid */}
        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Member details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-bold">Details</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" value="—" />
              <Field label="Email" value="—" />
              <Field label="Phone" value="—" />
              <Field label="Coach" value="—" />
              <Field label="Payment Type" value="Staggered / Full" />
              <Field label="Payment Stage" value="13th–24th (₱5800) / etc." />
              <Field label="Payment Paid" value="—" />
              <Field label="Payment Status" value="OK / Pending" />
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold">Notes</p>
              <p className="mt-1 text-sm text-slate-600">
                Placeholder notes… (injury, goals, reminders, etc.)
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Quick Actions</h2>
            <p className="mt-1 text-sm text-slate-600">
              Fast tools for staff.
            </p>

            <div className="mt-4 space-y-2">
              <button className="w-full rounded-xl bg-[#f37120] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Check-in (Deduct 1 session)
              </button>
              <button className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
                Mark Payment Paid
              </button>
              <button className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
                Change Package
              </button>
              <button className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Generate QR (later)
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Next: connect these buttons to Supabase actions + email reminders.
            </p>
          </div>
        </section>

        {/* History */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Session History</h2>
            <button className="text-sm font-semibold text-[#f37120] hover:opacity-80">
              Export (later)
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Sessions Left After</th>
                  <th className="px-4 py-3 font-semibold">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <HistoryRow date="—" type="Check-in" left="—" staff="—" />
                <HistoryRow date="—" type="Check-in" left="—" staff="—" />
                <HistoryRow date="—" type="Payment" left="—" staff="—" />
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Small components (same file for now) */

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {children}
    </span>
  );
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function HistoryRow({
  date,
  type,
  left,
  staff,
}: {
  date: string;
  type: string;
  left: string;
  staff: string;
}) {
  return (
    <tr className="bg-white">
      <td className="px-4 py-3 text-slate-700">{date}</td>
      <td className="px-4 py-3 font-semibold">{type}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-full bg-[#f37120]/10 px-3 py-1 text-xs font-bold text-[#f37120]">
          {left}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-700">{staff}</td>
    </tr>
  );
}
