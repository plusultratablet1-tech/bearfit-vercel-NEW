"use client"
import Link from "next/link"
import {useMemo,useState} from "react"
import {useRouter} from "next/navigation"
import {ArrowRight,CalendarDays,CheckCheck,ClipboardCheck,ClockAlert,CreditCard,Download,FileWarning,RefreshCw,ShieldCheck,TicketCheck,UsersRound,Wallet} from "lucide-react"
import {BEARFIT_BRANCHES} from "@/lib/branches"
import {ALL_BRANCHES,dataComplete,reconciliationStats,selectedDay,type ReconciliationData,type Scope,type ReconciliationStats} from "@/lib/daily-reconciliation"

const php=(n:number)=>"₱"+n.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})
type MetricKey=keyof ReconciliationStats
const metrics:{label:string;key:MetricKey;needs:string[];icon:typeof Wallet;description:string}[]=[
 {label:"Payments marked PAID",key:"recordedPaid",icon:Wallet,needs:["members","paid"],description:"Recorded transactions only; not bank or cash verified"},
 {label:"Member session logs",key:"memberVisits",icon:UsersRound,needs:["members","attendance","bookings","linkedBookings"],description:"Booked visits use the booking's recorded branch, not a member's current branch"},
 {label:"Approved coach conductions",key:"conductionsApproved",icon:CheckCheck,needs:["members","coaches","conductions"],description:"Approved sessions; not confirmed payroll disbursement"},
 {label:"Guest entries",key:"guestEntries",icon:TicketCheck,needs:["members","guests"],description:"Passes with recorded entry timestamps"},
]
const exceptions:{title:string;subtitle:string;key:MetricKey;needs:string[];href:string}[]=[
 {title:"Payment records requiring review",subtitle:"Pending, failed, or overdue records created on this day",key:"flaggedCount",needs:["members","flagged"],href:"/staff/payments"},
 {title:"PAID records missing their payment timestamp",subtitle:"Marked paid and created on this day, but no paid_at date",key:"paidNoTimestamp",needs:["members","missingPaidDate"],href:"/staff/payments"},
 {title:"Planned coach shifts not confirmed",subtitle:"Responses still awaiting review; not automatic absences",key:"unconfirmedPlans",needs:["coaches","plans"],href:"/staff/coaches/attendance"},
 {title:"Coach clock-ins without clock-out",subtitle:"Open time records started on this day",key:"openClockins",needs:["coaches","clockins"],href:"/staff/coaches/attendance"},
 {title:"Coach conductions pending review",subtitle:"Not yet approved, rejected, void or cancelled",key:"conductionsForReview",needs:["coaches","members","conductions"],href:"/staff/coaches/attendance"},
 {title:"Guest invitations awaiting a decision",subtitle:"Pending payment or approval for this visit date",key:"guestPending",needs:["members","guests"],href:"/staff/guests"},
 {title:"Scheduled bookings without linked session logs",subtitle:"Ended confirmed bookings to investigate; not proven no-shows",key:"possibleMissingCheckins",needs:["members","attendance","bookings","linkedBookings"],href:"/staff/schedule"},
 {title:"Booked check-ins without a matching member-owned booking",subtitle:"No verified booking link; excluded from branch visit totals",key:"unattributedBookedVisits",needs:["members","attendance","bookings","linkedBookings"],href:"/staff/schedule"},
 {title:"Booking branch differs from current member branch",subtitle:"Possible branch transfer; booking history takes precedence",key:"bookingBranchMismatches",needs:["members","attendance","bookings","linkedBookings"],href:"/staff/members"},
 {title:"Unassigned or demo-linked payment records",subtitle:"Excluded from branch financial totals; investigate the member link",key:"unassignedPayments",needs:["members","paid","flagged","missingPaidDate"],href:"/staff/payments"},
]
function rowsToCsv(rows:string[][]){
 const csv=rows.map(row=>row.map(value=>'"'+value.replace(/"/g,'""')+'"').join(",")).join("\r\n")
 const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"})
 const url=URL.createObjectURL(blob)
 const a=document.createElement("a")
 a.href=url;a.download="bearfit-daily-reconciliation.csv";document.body.appendChild(a);a.click();a.remove()
 URL.revokeObjectURL(url)
}
export default function ReconciliationClient({data}:{data:ReconciliationData}){
 const router=useRouter()
 const [scope,setScope]=useState<Scope>(ALL_BRANCHES)
 const [pickerDate,setPickerDate]=useState(data.date)
 const stats=useMemo(()=>reconciliationStats(data,scope),[data,scope])
 const complete=data.failed.length===0
 const valuesByBranch=useMemo(()=>BEARFIT_BRANCHES.map(b=>({branch:b,stats:reconciliationStats(data,b.id)})),[data])
 const dateLabel=new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",month:"long",day:"numeric",year:"numeric"}).format(new Date(data.date+"T12:00:00+08:00"))
 const name=scope==="ALL"?"All three branches":BEARFIT_BRANCHES.find(b=>b.id===scope)?.name||scope
 const available=(needs:string[])=>dataComplete(data,...needs)
 const amountOkay=available(["members","paid"])
 const exceptionOkay=exceptions.every(item=>available(item.needs))
 const exceptionTotal=exceptionOkay?exceptions.reduce((sum,item)=>sum+Number(stats[item.key]),0):null
 function changeDate(value:string){
  setPickerDate(value)
  if(value&&selectedDay(value)===value)router.push("/staff/reconciliation?date="+encodeURIComponent(value))
 }
 function downloadReport(){
  if(!complete)return
  const rows=[["BearFit Daily Reconciliation","READ-ONLY / NOT AUDITED OR BANK-VERIFIED"],
   ["Date (Asia/Manila)",data.date],["Branch",name],[],
   ["Metric","Recorded value"],...metrics.map(m=>[m.label,m.key==="recordedPaid"?php(Number(stats[m.key])):String(stats[m.key])]),
   ["Recorded guest verification amounts (separate from payments)",php(stats.guestRecordedAmount)],
   ["Planned shifts",String(stats.plannedShifts)],["Actual coach clock-ins",String(stats.coachClockins)],
   ["Manual/unlinked member check-ins",String(stats.memberWalkins)],
   ["Booked check-ins with different member branch",String(stats.bookingBranchMismatches)],
   ["Booked check-ins with unresolved booking",String(stats.unattributedBookedVisits)],[],
   ["Review queue","Count"],...exceptions.map(e=>[e.title,String(stats[e.key])]),[],
   ["Important","Payments use today's member branch and lack historical branch snapshots; past transfers may shift historical reports."],
   ["Important","These are database records; cash/bank receipts and physical presence are not independently verified."],
   ["Important","No close, approval, payment, payroll or session-balance action is performed."]
  ]
  rowsToCsv(rows)
 }
 return <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 pb-28 text-white md:px-6 lg:px-8 lg:py-7 lg:pb-8">
  <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
   <div>
    <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">BearFit / Phase 2</p>
    <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Daily Reconciliation</h1>
    <p className="mt-2 max-w-3xl text-sm text-white/55">Read-only records across all branches. Compare payments, attendance, coaching and guest visits before daily closing.</p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={()=>router.refresh()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-xs font-bold text-white/75 hover:bg-white/10"><RefreshCw size={16}/>Refresh</button>
    <button type="button" disabled={!complete} title={!complete?"Unavailable while data is incomplete":undefined} onClick={downloadReport} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Download size={16}/>Export CSV</button>
   </div>
  </header>
  <div className="flex flex-wrap items-end gap-3">
   <label className="space-y-1 text-xs font-semibold text-white/60"><span className="block">Report date · Philippine time</span>
    <input type="date" min="2025-01-01" max={selectedDay(undefined)} value={pickerDate} onChange={e=>changeDate(e.target.value)} className="rounded-xl border border-white/20 bg-[#141c2d] px-4 py-3 text-sm text-white [color-scheme:dark]"/>
   </label>
   <div className="min-w-0 flex-1"><p className="mb-1 text-xs text-white/50">Branch</p>
    <div className="flex flex-wrap gap-2">
     <button type="button" onClick={()=>setScope(ALL_BRANCHES)} aria-pressed={scope==="ALL"} className={(scope==="ALL"?"border-orange-400 bg-orange-500 text-white":"border-white/15 bg-[#141414] text-white/70")+" rounded-xl border px-3 py-3 text-xs font-bold"}>All branches</button>
     {BEARFIT_BRANCHES.map(b=><button key={b.id} type="button" onClick={()=>setScope(b.id)} aria-pressed={scope===b.id} className={(scope===b.id?"border-orange-400 bg-orange-500 text-white":"border-white/15 bg-[#141414] text-white/70")+" rounded-xl border px-3 py-3 text-xs font-bold"}>{b.name}</button>)}
    </div>
   </div>
  </div>
  <p className="text-xs text-white/45">{dateLabel} · {name} · This view does not certify receipt reconciliation or close the day.</p>
  {!complete&&<div role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"><FileWarning size={18} className="mr-2 inline-block"/>Some data could not be fully loaded ({data.failed.join(", ")}). Affected values are shown as unavailable, and CSV export is disabled.</div>}
  <section aria-label="Daily verification metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
   {metrics.map(m=><div key={m.key} className="rounded-2xl border border-white/10 bg-[#141414] p-4">
    <m.icon size={19} className="text-orange-300"/>
    <p className="mt-3 text-2xl font-black tabular-nums md:text-3xl">{available(m.needs)?m.key==="recordedPaid"?php(Number(stats[m.key])):stats[m.key]:"—"}</p>
    <p className="mt-2 text-sm font-bold">{m.label}</p>
    <p className="mt-1 text-[11px] leading-4 text-white/45">{m.description}</p>
   </div>)}
  </section>
  <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
   <div className="rounded-3xl border border-white/10 bg-[#141414] p-4 md:p-5">
    <div className="flex items-start justify-between gap-2">
     <div><h2 className="text-lg font-black">Review queue</h2><p className="mt-1 text-xs text-white/50">Potential exceptions, not automatic violations or payable events</p></div>
     <span className="flex items-center gap-2 rounded-xl bg-orange-500/10 px-3 py-2 text-xs font-bold text-orange-200"><ClockAlert size={16}/>{exceptionTotal===null?"—":exceptionTotal} items</span>
    </div>
    <div className="mt-3 divide-y divide-white/10">
     {exceptions.map(item=><Link key={item.title} href={item.href} className="flex items-center gap-3 py-3.5 hover:bg-white/[0.04]">
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{item.title}</span><span className="mt-1 block text-xs text-white/45">{item.subtitle}</span></span>
      <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-black">{available(item.needs)?stats[item.key]:"—"}</span>
      <ArrowRight size={16} className="shrink-0 text-white/45"/>
     </Link>)}
    </div>
   </div>
   <div className="space-y-3">
    <div className="rounded-3xl border border-white/10 bg-[#141414] p-5">
     <h2 className="flex items-center gap-2 text-base font-black"><CreditCard size={19} className="text-orange-300"/>Financial review</h2>
     <p className="mt-3 text-2xl font-black">{amountOkay?php(stats.recordedPaid):"—"}</p>
     <p className="mt-2 text-xs leading-5 text-white/50">Total marked <strong>PAID</strong> on {dateLabel}. This does not verify bank settlements, cash on hand, or receipts. Imported member payment labels are excluded. Payments use the member's present branch; historical payment branch snapshots are not available.</p>
     <p className="mt-3 text-xs text-white/60">{available(["members","paid"])?stats.paidCount:"—"} payment transactions · {available(["members","flagged"])?stats.flaggedCount:"—"} flagged on this date</p>
     <Link href="/staff/payments" className="mt-4 inline-flex gap-2 text-xs font-bold text-orange-300">Open Payments <ArrowRight size={14}/></Link>
    </div>
    <div className="rounded-3xl border border-white/10 bg-[#141414] p-5">
     <h2 className="flex items-center gap-2 text-base font-black"><ClipboardCheck size={19} className="text-orange-300"/>Attendance & coaching</h2>
     <div className="mt-3 space-y-2 text-xs text-white/70">
      <p className="flex justify-between gap-3"><span>Manual/unlinked check-ins</span><strong>{available(["members","attendance","bookings","linkedBookings"])?stats.memberWalkins:"—"}</strong></p>
      <p className="flex justify-between gap-3"><span>Scheduled bookings</span><strong>{available(["members","bookings"])?stats.bookingsScheduled:"—"}</strong></p>
      <p className="flex justify-between gap-3"><span>Planned coach shifts</span><strong>{available(["coaches","plans"])?stats.plannedShifts:"—"}</strong></p>
      <p className="flex justify-between gap-3"><span>Coach clock-ins</span><strong>{available(["coaches","clockins"])?stats.coachClockins:"—"}</strong></p>
      <p className="flex justify-between gap-3"><span>Conductions awaiting review</span><strong>{available(["coaches","members","conductions"])?stats.conductionsForReview:"—"}</strong></p>
     </div>
     <Link href="/staff/coaches/attendance" className="mt-4 inline-flex gap-2 text-xs font-bold text-orange-300">Open Coach Attendance <ArrowRight size={14}/></Link>
    </div>
    <div className="rounded-3xl border border-white/10 bg-[#101725] p-5">
     <h2 className="flex items-center gap-2 text-sm font-black"><ShieldCheck size={17} className="text-orange-300"/>Scope and safeguards</h2>
     <p className="mt-2 text-xs leading-5 text-white/60">All demo members and coaches are excluded. Guest verification amounts are shown separately and never added to payment totals. Booked visits use the booking branch and unresolved links are excluded. A check-in is not proof of physical presence; a coach clock-in is not a payable conduction.</p>
     <p className="mt-2 text-xs leading-5 text-white/50">Recorded guest verification amounts: <strong className="text-white">{available(["members","guests"])?php(stats.guestRecordedAmount):"—"}</strong></p>
    </div>
   </div>
  </section>
  <section className="space-y-3">
   <div><h2 className="text-lg font-black">Branch comparison</h2><p className="mt-1 text-xs text-white/45">Date: {dateLabel} · Amounts are recorded entries, not independently reconciled cash or bank deposits.</p></div>
   <div className="grid gap-3 md:grid-cols-3">
    {valuesByBranch.map(({branch:b,stats:s})=><button type="button" key={b.id} onClick={()=>setScope(b.id)} className={"rounded-2xl border p-4 text-left "+(scope===b.id?"border-orange-400 bg-[#1d2536]":"border-white/10 bg-[#141414] hover:border-white/25")}>
     <h3 className="text-sm font-black">{b.name}</h3>
     <p className="mt-3 text-2xl font-black">{amountOkay?php(s.recordedPaid):"—"}</p>
     <p className="mt-1 text-xs text-white/50">Recorded as PAID</p>
     <p className="mt-3 text-xs text-white/65">Session logs: {available(["members","attendance","bookings","linkedBookings"])?s.memberVisits:"—"} · Coach approvals: {available(["members","coaches","conductions"])?s.conductionsApproved:"—"} · Guest entries: {available(["members","guests"])?s.guestEntries:"—"}</p>
    </button>)}
   </div>
  </section>
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-xs leading-5 text-white/55"><CalendarDays size={17} className="mr-2 inline-block text-orange-300"/>The CSV is a downloadable investigation snapshot, <strong>not</strong> a signed daily closing report. Official daily close, receipt matching, and correction approvals will be separate audited workflows. <Link href="/staff/home" className="font-bold text-orange-300 underline">Back to Admin Home</Link></div>
 </div>
}
