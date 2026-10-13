// Content-only fallback: navigation persists in /member/layout.tsx.
export default function MemberRouteLoading() {
 return <div aria-label="Loading member page" role="status" aria-live="polite" className="min-h-[60vh] text-white">
  <div className="mx-auto max-w-7xl animate-pulse px-4 py-5 pb-28 md:px-6 lg:px-8 lg:py-8 lg:pb-8">
   <div className="border-b border-white/10 pb-5">
    <div className="h-3 w-32 rounded bg-[#ff7a1a]/20"/>
    <div className="mt-3 h-9 w-64 max-w-full rounded bg-white/10"/>
    <div className="mt-3 h-4 w-96 max-w-full rounded bg-white/[0.06]"/>
   </div>
   <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({length:3},(_,i)=><div key={i} className="h-32 rounded-[22px] border border-white/5 bg-[#171717]"/>)}
   </div>
   <div className="mt-7 grid gap-4 lg:grid-cols-2">
    {Array.from({length:4},(_,i)=><div key={i} className="h-52 rounded-[24px] border border-white/5 bg-[#141414]"/>)}
   </div>
  </div>
 </div>
}
