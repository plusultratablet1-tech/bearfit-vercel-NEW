// The persistent member navigation is kept in app/member/layout.tsx.
export default function MemberLoading() {
 return <div role="status" aria-live="polite" className="min-h-[60vh] px-4 py-7 md:px-6">
  <div className="mx-auto max-w-6xl animate-pulse space-y-5">
   <div className="h-4 w-24 rounded bg-orange-400/20"/>
   <div className="h-8 w-64 max-w-full rounded bg-white/15"/>
   <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({length:4},(_,i)=><div key={i} className="h-24 rounded-xl bg-white/10"/>)}</div>
   <div className="h-60 rounded-2xl border border-white/10 bg-[#141414]"/>
   <p className="text-xs text-white/45">Loading section…</p>
  </div>
 </div>
}
