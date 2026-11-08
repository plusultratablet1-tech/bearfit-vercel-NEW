"use client"
import {useEffect,useState} from "react"
import {createClient} from "@/lib/supabase/client"

type Card={
 member_name:string;member_code:string;package_name:string
 total_sessions:number;sessions_used:number;sessions_left:number
 last_sessions:string[];membership_status?:string;balance_verified?:boolean;assignment_source?:string
}
type Booking={member_code:string;start_at:string;status:string}
type Filter="This Week"|"Today"|"Upcoming"|"All Clients"
const FILTERS:Filter[]=["This Week","Today","Upcoming","All Clients"]
const INITIAL_VISIBLE=3
const supabase=createClient()
function manilaDay(value:string|Date){
 const date=value instanceof Date?value:new Date(value)
 if(Number.isNaN(date.getTime()))return ""
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date)
 const get=(type:string)=>parts.find(part=>part.type===type)?.value||""
 return get("year")+"-"+get("month")+"-"+get("day")
}
function weekBounds(today:string){
 const date=new Date(today+"T12:00:00Z")
 const offset=(date.getUTCDay()+6)%7
 date.setUTCDate(date.getUTCDate()-offset)
 const monday=date.toISOString().slice(0,10)
 date.setUTCDate(date.getUTCDate()+6)
 return {start:monday,end:date.toISOString().slice(0,10)}
}
function sessionLabel(value:string){
 const date=new Date(value+"T12:00:00Z")
 return Number.isNaN(date.getTime())?value:
   new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",month:"short",day:"numeric"}).format(date)
}

export default function CoachClientCards({bookings=[]}:{bookings?:Booking[]}){
 const [cards,setCards]=useState<Card[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 // All coach portals start with a three-client preview, never the full roster.
 const [filter,setFilter]=useState<Filter>("All Clients")
 const [expanded,setExpanded]=useState(false)

 useEffect(()=>{
   let mounted=true
   void supabase.rpc("coach_client_cards").then(({data,error})=>{
     if(!mounted)return
     if(error)setError(error.message)
     else if(Array.isArray(data))setCards(data as Card[])
     setLoading(false)
   })
   return()=>{mounted=false}
 },[])

 const today=manilaDay(new Date())
 const {start:weekStart,end:weekEnd}=weekBounds(today)
 const now=Date.now()
 const booked=new Set(
   bookings.filter(b=>{
     if(!b.start_at)return false
     const date=manilaDay(b.start_at)
     if(!date)return false
     if(filter==="Today")return date===today&&["confirmed","completed","no_show"].includes(b.status)
     if(filter==="This Week")return date>=weekStart&&date<=weekEnd&&["confirmed","completed","no_show"].includes(b.status)
     if(filter==="Upcoming")return b.status==="confirmed"&&Date.parse(b.start_at)>now
     return false
   }).map(b=>b.member_code)
 )
 const filtered=filter==="All Clients"?cards:cards.filter(c=>booked.has(c.member_code))
 const visible=expanded?filtered:filtered.slice(0,INITIAL_VISIBLE)
 const more=filtered.length>INITIAL_VISIBLE

 function selectFilter(next:Filter){
   setFilter(next)
   setExpanded(false)
 }

 return <section className="mt-6">
   <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
     <div>
       <p className="text-xs font-bold uppercase tracking-widest text-white/45">Client Sessions</p>
       <p className="mt-1 text-sm text-white/50">Assigned clients · recorded package balances</p>
     </div>
     <div role="group" aria-label="Client session period" className="flex flex-wrap gap-2">
       {FILTERS.map(option=><button key={option} type="button"
         aria-pressed={filter===option} onClick={()=>selectFilter(option)}
         className={"rounded-full px-3 py-2 text-xs font-semibold transition-colors "+(filter===option?"bg-[#ff7a1a] text-white":"border border-white/15 text-white/65 hover:border-orange-400/40")}>
          {option}
       </button>)}
     </div>
   </div>
   {loading?<div className="rounded-2xl bg-[#242424] p-5 text-sm text-white/60">Loading assigned clients…</div>
   :<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
     {visible.map((client,index)=>{
       const bonus=client.member_code==="M0012"?2:client.member_code==="M0010"?1:0
       const remaining=bonus&&client.sessions_left>=bonus?(client.sessions_left-bonus)+" + "+bonus:client.sessions_left
       return <article key={client.member_code} className="min-w-0 rounded-[20px] bg-[#242424] p-5">
         <p className="text-xs text-white/50">Client {index+1}</p>
         <h3 className="mt-3 break-words text-lg font-black">{client.member_name}</h3>
         <p className="mt-2 text-xs text-orange-300">{client.member_code} · {client.package_name}{bonus?" + "+bonus+" bonus":""}</p>
         <p className="mt-2 text-xs text-white/60">Used: {client.sessions_used} / {client.total_sessions}</p>
         <p className="mt-1 text-sm font-bold text-emerald-300">Remaining: {remaining}</p>
         <p className="mt-2 text-xs text-white/55">Latest sessions: {client.last_sessions?.length?
          client.last_sessions.slice(0,3).map(sessionLabel).join(", "):"None recorded"}</p>
         {client.balance_verified===false&&<p className="mt-2 text-xs text-amber-300">Legacy balance — package cycle not verified</p>}
         {client.membership_status&&<p className="mt-2 text-xs text-white/50">Membership: {client.membership_status.replaceAll("_"," ")}</p>}
       </article>
     })}
   </div>}
   {!loading&&filtered.length===0&&
     <p className="mt-3 rounded-2xl border border-white/10 bg-[#242424] p-5 text-sm text-white/60">
       {filter==="All Clients"?"No real clients assigned to this coach yet. Admin can assign clients to this branch and coach.":
        filter==="This Week"?"No assigned client sessions recorded for this week.":
        filter==="Today"?"No assigned client sessions recorded for today.":
        "No upcoming confirmed client bookings."}
     </p>}
   {!loading&&filtered.length>0&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
     <span className="text-xs text-white/50">
       Showing {visible.length} of {filtered.length} {filtered.length===1?"client":"clients"}
     </span>
     {more&&<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}
       className="rounded-xl border border-orange-500/35 bg-orange-500/10 px-5 py-2.5 text-sm font-bold text-orange-300 hover:bg-orange-500/20">
         {expanded?"Show Less":"See All ("+filtered.length+")"} <span aria-hidden="true">{expanded?"▴":"▾"}</span>
       </button>}
   </div>}
   {error&&<p role="alert" className="mt-3 text-sm text-amber-300">{error}</p>}
 </section>
}
