export default function MemberProfileLoading() {
 return <main role="status" aria-live="polite" className="min-h-screen bg-[#020b1c] px-4 py-6 text-white md:px-8">
  <div className="mx-auto max-w-6xl animate-pulse space-y-5">
   <div className="h-4 w-32 rounded bg-orange-400/20"/>
   <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#141414] p-5">
    <div className="h-20 w-20 shrink-0 rounded-2xl bg-white/15"/>
    <div className="space-y-3"><div className="h-7 w-44 rounded bg-white/15"/><div className="h-4 w-32 rounded bg-white/10"/></div>
   </div>
   <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({length:4},(_,i)=><div key={i} className="h-24 rounded-2xl border border-white/10 bg-[#141414]"/>)}</div>
   <div className="h-64 rounded-2xl border border-white/10 bg-[#141414]"/>
   <p className="text-sm text-white/50">Loading profile and activity…</p>
  </div>
 </main>
}
