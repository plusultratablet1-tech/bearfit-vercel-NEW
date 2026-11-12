"use client"
import {useEffect,useState} from "react"
import {createClient} from "@/lib/supabase/client"

type Session={id:string;member_name:string;member_code:string;trained_at:string;session_label:string;sessions_left_after:number;source:string}
type Payment={id:string;member_name:string;member_code:string;amount:number;package_name:string;paid_at:string}
type Attention={member_name:string;member_code:string;reason:string;payment_status:string}
type Data={sessions:Session[];payments:Payment[];payment_attention:Attention[]}
type SheetSession={id:string;client_name:string;member_code:string|null;session_date:string;session_count:number;package_type:string;source_status:string|null;reported_balance:number|null;source_row:number;member_linked:boolean}
type SheetClient={client_name:string;member_code:string|null;package_type:string;package_start_date:string|null;beginning_balance:number|null;plus_sessions:number|null;reported_balance:number|null;source_status:string|null;month_sessions:number;balance_difference:number|null;member_linked:boolean;reconciliation_state:string}
type SheetData={month:string;has_report:boolean;monthly_sessions:number;source_rows:number;sessions:SheetSession[];clients:SheetClient[];daily:{session_date:string;session_count:number}[];payroll_approved:boolean}
const db=createClient()
const MONTH_FORMAT=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit"})
function monthKey(){const p=MONTH_FORMAT.formatToParts(new Date());return (p.find(x=>x.type==="year")?.value||"")+"-"+(p.find(x=>x.type==="month")?.value||"")}
function dateLabel(v:string){return new Intl.DateTimeFormat("en-PH",{month:"short",day:"numeric",year:"numeric",timeZone:"Asia/Manila"}).format(new Date(v.length===10?v+"T12:00:00Z":v))}
function value(v:number|null){return v===null?"Not reported":String(v)}
export default function CoachActivityPanel(){
 const [tab,setTab]=useState<"Activity Log"|"Sessions"|"Payments">("Activity Log")
 const [showTen,setShowTen]=useState(false)
 const [showClients,setShowClients]=useState(false)
 const [data,setData]=useState<Data|null>(null)
 const [sheet,setSheet]=useState<SheetData|null>(null)
 const [error,setError]=useState("")
 const [sheetError,setSheetError]=useState("")
 const month=monthKey()
 useEffect(()=>{
  let live=true
  void Promise.all([
   db.rpc("coach_activity_overview"),
   db.rpc("coach_monthly_sheet_dashboard",{p_month:month+"-01"})
  ]).then(([history,report])=>{
   if(!live)return
   if(history.error)setError(history.error.message)
   else setData(history.data as Data)
   if(report.error)setSheetError(report.error.message)
   else setSheet(report.data as SheetData)
  })
  return()=>{live=false}
 },[month])
 const sessions=data?.sessions||[],payments=data?.payments||[],attention=data?.payment_attention||[]
 const fromWorkbook=Boolean(sheet?.has_report)
 const reportSessions=sheet?.sessions||[]
 const monthly=fromWorkbook?sheet?.monthly_sessions||0:sessions.filter(s=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit"}).format(new Date(s.trained_at)).includes(month.slice(5))&&s.trained_at.slice(0,4)===month.slice(0,4)).length
 const visibleSheet=reportSessions.slice(0,showTen?10:3)
 const visibleExisting=sessions.slice(0,showTen?10:3)
 return <section className="mt-7 overflow-hidden rounded-[24px] border border-white/10 bg-[#171717]">
 <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
  <div><h2 className="text-xl font-black">Coaches Activity</h2><p className="mt-1 text-sm text-white/40">Monthly sessions, client balances and payment attention</p></div>
  <span className="rounded-full bg-orange-500/10 px-3 py-1.5 text-xs text-orange-300">Coach-scoped</span>
 </div>
 <div className="mt-4 grid grid-cols-3 border-y border-white/10">{(["Activity Log","Sessions","Payments"] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={"py-3 text-xs font-bold "+(tab===t?"border-b-2 border-orange-500 text-white":"text-white/50")}>{t}</button>)}</div>
 <div className="p-4 md:p-5">
  {error&&<p role="alert" className="text-sm text-amber-300">Session history: {error}</p>}
  {sheetError&&<p role="alert" className="text-sm text-amber-300">Monthly source report unavailable: {sheetError}</p>}
  {!data&&!sheet&&!error&&!sheetError&&<p className="text-sm text-white/50">Loading coach records…</p>}
  {tab!=="Payments"&&<div className="mb-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
    <p className="text-xs font-semibold uppercase tracking-wider text-orange-200">{month} · Monthly sessions from the 1st</p>
    <p className="mt-2 text-3xl font-black">{monthly}</p>
    <p className="mt-1 text-xs text-white/55">{fromWorkbook?"Owner-reported Malingap attendance · not payroll-approved":"Coach-linked session logs only; source workbook not yet imported"}</p>
   </div>}
  {tab==="Activity Log"&&<div>
   {fromWorkbook? (visibleSheet.length?visibleSheet.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3">
     <div><p className="font-bold">{s.client_name}</p>
       <p className="mt-1 text-xs text-orange-300">{s.member_code||"Workbook-only client"} · {s.package_type}</p>
       <p className="mt-1 text-xs text-white/40">November Malingap workbook · {s.session_count} {s.session_count===1?"session":"sessions"}</p>
     </div>
     <div className="text-right text-xs text-white/50"><p>{dateLabel(s.session_date)}</p>
       <p className="mt-1 text-emerald-300">{s.reported_balance===null?"Balance not supplied":String(s.reported_balance)+" left (sheet)"}</p>
     </div>
    </div>):<p className="text-sm text-white/50">No sessions entered for this month.</p>)
    :visibleExisting.length?visibleExisting.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3">
      <div><p className="font-bold">{s.member_name}</p><p className="mt-1 text-xs text-orange-300">{s.member_code} · {s.session_label||"Training session"}</p>
      <p className="mt-1 text-xs text-white/40">{s.source==="owner_historical_reconciliation"?"Historical entry supplied by Admin":"Recorded coach QR session"}</p></div>
      <div className="text-right text-xs text-white/50"><p>{dateLabel(s.trained_at)}</p><p className="mt-1 text-emerald-300">{s.sessions_left_after} left</p></div>
     </div>):<p className="text-sm text-white/50">No linked sessions recorded yet.</p>}
    {(fromWorkbook?reportSessions.length:sessions.length)>3&&<button type="button" onClick={()=>setShowTen(v=>!v)} aria-expanded={showTen} className="mt-4 w-full rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-300">{showTen?"Show 3 latest sessions":"Show 10 sessions"}</button>}
   </div>}
  {tab==="Sessions"&&<div>
   <div className="grid grid-cols-2 gap-3">
    <div className="rounded-2xl bg-[#242424] p-4"><p className="text-xs text-white/50">This month · {fromWorkbook?"workbook":"logged"}</p><p className="mt-2 text-3xl font-black">{monthly}</p></div>
    <div className="rounded-2xl bg-[#242424] p-4"><p className="text-xs text-white/50">{fromWorkbook?"Client package rows":"Recent 120 days · logged"}</p><p className="mt-2 text-3xl font-black">{fromWorkbook?sheet?.source_rows:sessions.length}</p></div>
   </div>
   {fromWorkbook&&<div className="mt-5">
     <h3 className="font-bold">Daily session totals</h3>
     <div className="mt-2 flex flex-wrap gap-2">{sheet?.daily.map(d=><span key={d.session_date} className="rounded-lg border border-white/10 px-3 py-2 text-xs">{dateLabel(d.session_date)} · <strong>{d.session_count}</strong></span>)}</div>
     <div className="mt-5 flex items-center justify-between gap-2"><h3 className="font-bold">Client balances · November source</h3><button type="button" onClick={()=>setShowClients(v=>!v)} aria-expanded={showClients} className="rounded-lg border border-orange-400/30 px-3 py-2 text-xs text-orange-200">{showClients?"Hide details":"View all clients"}</button></div>
     {showClients&&<div className="mt-3 space-y-2">{sheet?.clients.map((c,i)=><div key={c.client_name+"-"+i} className="rounded-xl border border-white/10 p-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><strong>{c.client_name}</strong><span className="text-orange-300">{c.package_type}</span></div>
        <p className="mt-1 text-xs text-white/55">Beginning: {value(c.beginning_balance)} · Plus: {value(c.plus_sessions)} · November sessions: {c.month_sessions} · Balance: {value(c.reported_balance)}</p>
        <p className="mt-1 text-xs text-white/55">Workbook status: {c.source_status||"Unspecified"}{c.member_code?" · "+c.member_code:" · Member match pending"}</p>
        {c.balance_difference!==null&&c.balance_difference!==0&&<p className="mt-1 text-xs text-amber-300">Balance discrepancy — admin review required</p>}
       </div>)}</div>}
    </div>}
   <p className="mt-4 text-xs text-white/45">Workbook attendance is separate from payroll-approved conductions and verified payments. Member renewals are shown by their latest source balance.</p>
  </div>}
  {tab==="Payments"&&<div className="space-y-4">
    <h3 className="font-bold text-orange-300">Payment attention · Admin verification</h3>
    {attention.length?attention.map(a=><div key={a.member_code} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3"><p className="font-bold">{a.member_name} · {a.member_code}</p><p className="mt-1 text-xs text-amber-200">{a.reason}</p></div>):<p className="text-sm text-white/50">No outstanding payment-attention flags.</p>}
    <h3 className="font-bold text-emerald-300">Recorded approved payments</h3>
    {payments.length?payments.map(p=><div key={p.id} className="flex justify-between gap-2 border-b border-white/10 py-2 text-sm"><span>{p.member_name} · {p.member_code}</span><span>₱{Number(p.amount).toLocaleString("en-PH")}</span></div>):<p className="text-sm text-white/50">No verified payment entries for assigned clients.</p>}
   </div>}
 </div></section>
}
