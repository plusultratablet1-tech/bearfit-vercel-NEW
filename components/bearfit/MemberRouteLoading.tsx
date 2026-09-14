export default function MemberRouteLoading() {
  return (
    <main aria-label="Loading member page" className="min-h-screen bg-[#020b1c] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-[230px] shrink-0 border-r border-white/10 bg-[#020817] p-5 lg:block">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-xl bg-[#1f2c45]" />
            <div className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
            </div>
          </div>
          <div className="mt-8 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-5 pb-28 md:px-6 lg:px-8 lg:py-8 lg:pb-8">
            <div className="border-b border-white/10 pb-5">
              <div className="h-3 w-32 animate-pulse rounded bg-[#ff7a1a]/20" />
              <div className="mt-3 h-9 w-64 max-w-full animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-4 w-[420px] max-w-full animate-pulse rounded bg-white/[0.06]" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-[22px] border border-white/[0.05] bg-[#171717]" />
              ))}
            </div>

            <div className="mt-7 grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-52 animate-pulse rounded-[24px] border border-white/[0.05] bg-[#141414]" />
              ))}
            </div>
          </div>
        </section>

        <div
          className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#07101f]/95 px-2 pt-2 lg:hidden"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
        >
          <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
