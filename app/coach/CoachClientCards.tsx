"use client"
import {useEffect,useRef,useState} from "react"
import {createClient} from "@/lib/supabase/client"
type Card={member_name:string;member_code:string;package_name:string;total_sessions:number;sessions_used:number;sessions_left:number;last_sessions:string[]}
const supabase=createClient()
export default function CoachClientCards({bookings=[]}:{bookings?:Array<{member_code:string;start_at:string;status:string}>}){
 const [cards,setCards]=useState<Card[]>([]),[loading,setLoading]=useState(true)
 const [filter,setFilter]=useState<"Beta Test"|"Today"|"Upcoming"|"All Clients">("Beta Test")
 const [error,setError]=useState("")
 useEffect(()=>{let live=true;void supabase.rpc("coach_client_cards").then(({data,error})=>{if(!live)return;if(error)setError(error.message);else if(Array.isArray(data))setCards(data as Card[]);setLoading(false)});return()=>{live=false}},[])
 const todayParts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date())
 const day=(v:string)=>{const p=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(v));const get=(t:string)=>p.find(x=>x.type===t)?.value||"";return get("year")+"-"+get("month")+"-"+get("day")}
 const get=(t:string)=>todayParts.find(x=>x.type===t)?.value||""
 const today=get("year")+"-"+get("month")+"-"+get("day")
 const eligible=bookings.filter(b=>b.status==="confirmed")
 const filtered=filter==="Beta Test"||filter==="All Clients"?cards:cards.filter(c=>eligible.some(b=>b.member_code===c.member_code&&(filter==="Today"?day(b.start_at)===today:new Date(b.start_at).getTime()>Date.now())))
 return <section className="mt-6"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-widest text-white/45">Client Sessions</p><p className="mt-1 text-sm text-white/40">Assigned clients · live package balances</p></div><div className="flex flex-wrap gap-2">{(["Beta Test","Today","Upcoming","All Clients"] as const).map(v=><button key={v} type="button" onClick={()=>setFilter(v)} className={"rounded-full px-3 py-2 text-xs font-semibold "+(filter===v?"bg-[#ff7a1a] text-white":"border border-white/15 text-white/55")}>{v}</button>)}</div></div>
 <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0,1,2,3].map(i=>{const c=filtered[i];const bonus=c?.member_code==="M0012"?2:c?.member_code==="M0010"?1:0;return <div key={c?.member_code||i} className="min-w-0 rounded-[20px] bg-[#242424] p-4"><p className="text-xs text-white/50">Client {i+1}</p><h3 className="mt-3 break-words text-lg font-black">{c?.member_name||"Unassigned"}</h3>{c?<><p className="mt-2 text-xs text-orange-300">{c.member_code} · {c.package_name}{bonus?" + "+bonus+" bonus":""}</p><p className="mt-2 text-xs text-white/55">Used: {c.sessions_used} / {c.total_sessions}</p><p className="mt-1 text-sm font-bold text-emerald-300">Remaining: {bonus&&c.sessions_left>=bonus?(c.sessions_left-bonus)+" + "+bonus:c.sessions_left}</p><p className="mt-2 text-xs text-white/50">Latest sessions: {c.last_sessions?.slice(0,3).map(s=>new Date(s+"T12:00:00Z").toLocaleDateString("en-PH",{month:"short",day:"numeric",timeZone:"Asia/Manila"})).join(", ")||"None yet"}</p></>:<p className="mt-2 text-xs text-white/45">{loading?"Loading…":"No assigned member"}</p>}</div>})}</div>
 {error&&<p className="mt-3 text-sm text-amber-300">{error}</p>}
 {filter==="Today"&&<p className="mt-3 text-xs text-white/50">Today's view will show confirmed bookings after the Beta Test stage. No bookings have been entered for this coach today.</p>}
 {filter==="Upcoming"&&<p className="mt-3 text-xs text-white/50">Upcoming clients will appear when confirmed bookings are assigned.</p>}
 </section>
}
