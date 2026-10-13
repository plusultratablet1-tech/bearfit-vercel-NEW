// Content-only skeleton, keeping /staff/layout.tsx navigation mounted.
export default function MembersLoading() {
 return <div role="status" aria-live="polite" className="min-h-[60vh] px-4 py-6 text-white md:px-8">
  <div className="mx-auto max-w-7xl animate-pulse space-y-5">
   <div className="h-4 w-40 rounded bg-orange-400/20"/>
   <div className="h-9 w-80 max-w-full rounded bg-white/15"/>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
    {Array.from({length:5},(_,i)=><div key={i} className="h-28 rounded-2xl border border-white/10 bg-[#141414] p-4"><div className="h-4 w-20 rounded bg-white/10"/><div className="mt-4 h-7 w-12 rounded bg-white/15"/></div>)}
   </div>
   <div className="h-32 rounded-2xl border border-white/10 bg-[#101725]"/>
   <div className="rounded-2xl border border-white/10 bg-[#141414] p-5">
    {Array.from({length:6},(_,i)=><div key={i} className="flex items-center gap-5 border-b border-white/5 py-4 last:border-0"><div className="h-4 w-40 max-w-[40%] rounded bg-white/15"/><div className="h-4 w-24 rounded bg-white/10"/><div className="ml-auto h-4 w-20 rounded bg-white/10"/></div>)}
   </div>
   <p className="text-sm text-white/50">Loading member directory…</p>
  </div>
 </div>
}
