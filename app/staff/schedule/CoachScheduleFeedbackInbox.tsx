"use client"
import {useEffect,useState} from "react"
import {createClient} from "@/lib/supabase/client"
type Feedback={id:string;member_name:string;member_code:string;coach_name:string;response:string;reason:string|null;booking_status:string;session_at:string|null;branch:string;updated_at:string}
const db=createClient()
export default function CoachScheduleFeedbackInbox(){
 const [items,setItems]=useState<Feedback[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true)
 async function refresh(){const r=await db.rpc("staff_coach_schedule_feedback");if(r.error)setError(r.error.message);else{setError("");setItems((r.data||[]) as Feedback[])}setLoading(false)}
 useEffect(()=>{void refresh()},[])
 return <section className="mt-6 rounded-[24px] border border-white/10 bg-[#141414] p-5">
 <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">Coach Availability &amp; Cancellation Requests</h2><p className="mt-1 text-sm text-white/50">Advisory coach responses from Schedule · official bookings still require Admin action.</p></div><button onClick={()=>void refresh()} className="rounded-xl border border-white/20 px-4 py-2 text-sm">Refresh</button></div>
 {loading&&<p className="mt-4 text-sm text-white/50">Loading coach responses…</p>}
 {error&&<p className="mt-4 text-sm text-amber-300">{error}</p>}
 {!loading&&!error&&items.length===0&&<p className="mt-4 text-sm text-white/50">No coach responses during the last 30 days.</p>}
 <div className="mt-4 space-y-2">{items.map(x=><div key={x.id} className="rounded-xl border border-white/10 bg-[#202020] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{x.coach_name} · {x.member_name} ({x.member_code})</p><span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold capitalize text-orange-300">{x.response.replaceAll("_"," ")}</span></div><p className="mt-1 text-xs text-white/50">{x.branch} · {x.session_at?new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(new Date(x.session_at)):"Unscheduled"} · Booking: {x.booking_status}</p>{x.reason&&<p className="mt-2 text-sm text-white/70">Reason: {x.reason}</p>}</div>)}</div>
 </section>
}
