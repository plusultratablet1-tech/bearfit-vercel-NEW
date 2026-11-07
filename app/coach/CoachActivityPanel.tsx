"use client"
import {useEffect,useState} from "react"
import {createClient} from "@/lib/supabase/client"
type Session={id:string;member_name:string;member_code:string;trained_at:string;session_label:string;sessions_left_after:number;source:string}
type Payment={id:string;member_name:string;member_code:string;amount:number;package_name:string;paid_at:string}
type Attention={member_name:string;member_code:string;reason:string;payment_status:string}
type Data={sessions:Session[];payments:Payment[];payment_attention:Attention[]}
const db=createClient()
export default function CoachActivityPanel(){
 const [tab,setTab]=useState<"Activity Log"|"Sessions"|"Payments">("Activity Log")
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState("")
 useEffect(()=>{let live=true;void db.rpc("coach_activity_overview").then(({data,error})=>{if(!live)return;if(error)setError(error.message);else setData(data as Data)});return()=>{live=false}},[])
 const sessions=data?.sessions||[],payments=data?.payments||[],attention=data?.payment_attention||[]
 const month=new Intl.DateTimeFormat("en-US",{year:"numeric",month:"2-digit",timeZone:"Asia/Manila"}).formatToParts(new Date())
 const yy=month.find(x=>x.type==="year")?.value,mm=month.find(x=>x.type==="month")?.value
 const monthly=sessions.filter(s=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit"}).format(new Date(s.trained_at)).includes(mm||"")&&s.trained_at.slice(0,4)===yy)
 return <section className="mt-7 overflow-hidden rounded-[24px] border border-white/10 bg-[#171717]"><div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5"><div><h2 className="text-xl font-black">Coaches Activity</h2><p className="mt-1 text-sm text-white/40">Verified records, session counts and payment attention</p></div><span className="rounded-full bg-orange-500/10 px-3 py-1.5 text-xs text-orange-300">Coach-scoped</span></div>
 <div className="mt-4 grid grid-cols-3 border-y border-white/10">{(["Activity Log","Sessions","Payments"] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={"py-3 text-xs font-bold "+(tab===t?"border-b-2 border-orange-500 text-white":"text-white/50")}>{t}</button>)}</div>
 <div className="p-4 md:p-5">{error&&<p role="alert" className="text-sm text-amber-300">{error}</p>}
 {!data&&!error&&<p className="text-sm text-white/50">Loading coach records…</p>}
 {data&&tab==="Activity Log"&&(sessions.length?sessions.slice(0,12).map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3"><div><p className="font-bold">{s.member_name}</p><p className="mt-1 text-xs text-orange-300">{s.member_code} · {s.session_label||"Training session"}</p><p className="mt-1 text-xs text-white/40">{s.source==="owner_historical_reconciliation"?"Historical entry supplied by Admin":"Recorded coach QR session"}</p></div><div className="text-right text-xs text-white/50"><p>{new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium"}).format(new Date(s.trained_at))}</p><p className="mt-1 text-emerald-300">{s.sessions_left_after} left</p></div></div>):<p className="text-sm text-white/50">No linked sessions recorded yet.</p>)}
 {data&&tab==="Sessions"&&<div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#242424] p-5"><p className="text-xs text-white/50">This month · logged</p><p className="mt-2 text-3xl font-black">{monthly.length}</p></div><div className="rounded-2xl bg-[#242424] p-5"><p className="text-xs text-white/50">Recent 120 days · logged</p><p className="mt-2 text-3xl font-black">{sessions.length}</p></div></div><p className="mt-3 text-xs text-white/45">Historical entries are separate from payroll-approved conductions.</p></div>}
 {data&&tab==="Payments"&&<div className="space-y-4"><h3 className="font-bold text-orange-300">Payment attention · Admin verification</h3>{attention.length?attention.map(a=><div key={a.member_code} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3"><p className="font-bold">{a.member_name} · {a.member_code}</p><p className="mt-1 text-xs text-amber-200">{a.reason}</p></div>):<p className="text-sm text-white/50">No outstanding payment-attention flags.</p>}<h3 className="font-bold text-emerald-300">Recorded approved payments</h3>{payments.length?payments.map(p=><div key={p.id} className="flex justify-between gap-2 border-b border-white/10 py-2 text-sm"><span>{p.member_name} · {p.member_code}</span><span>₱{Number(p.amount).toLocaleString("en-PH")}</span></div>):<p className="text-sm text-white/50">No verified payment entries for assigned clients.</p>}</div>}
 </div></section>
}
