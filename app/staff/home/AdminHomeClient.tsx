"use client"
import Link from "next/link"
import {useMemo,useState} from "react"
import {Activity,ArrowRight,CalendarCheck2,CheckCircle2,ClipboardList,ClockAlert,CreditCard,HandCoins,MapPin,RefreshCw,ShieldCheck,TicketCheck,UsersRound,Wallet} from "lucide-react"
import {BEARFIT_BRANCHES} from "@/lib/branches"
import {ALL_BRANCHES,statsFor,type DashboardBranch,type HomeData} from "@/lib/admin-home"

const money=(value:number)=>"₱"+value.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})
const attentionItems=[
 {title:"Members nearing renewal",description:"Members marked renewal due or active with 0–3 sessions left",href:"/staff/members",icon:UsersRound,key:"renewals"},
 {title:"Booking requests awaiting a decision",description:"Pending booking requests across all dates",href:"/staff/schedule",icon:CalendarCheck2,key:"pendingBookings"},
 {title:"Payments requiring review",description:"Pending or explicitly flagged payment transactions; not imported member labels",href:"/staff/payments",icon:CreditCard,key:"paymentsPending"},
 {title:"Guest passes requiring approval",description:"Paid-pass verification or promotional approvals",href:"/staff/guests",icon:TicketCheck,key:"guestsPending"},
 {title:"Unconfirmed coach shifts today",description:"Scheduled shifts awaiting a confirmation; not automatically absences",href:"/staff/coaches/attendance",icon:ClockAlert,key:"shiftUnconfirmed"},
] as const
const metricCards=[
 {label:"Active members",key:"active",icon:UsersRound,source:"members"},
 {label:"Bookings scheduled today",key:"bookings",icon:CalendarCheck2,source:"bookings"},
 {label:"Recorded check-ins today",key:"checkins",icon:CheckCircle2,source:"checkins"},
 {label:"Planned coach shifts today",key:"shifts",icon:ClipboardList,source:"shifts"},
] as const
function dataIncomplete(data:HomeData,key:string){
 return data.failed.some(s=>s===key||s===key+"-limit") || (key!=="members" && data.failed.some(s=>s==="members"||s==="members-limit"))
}
export default function AdminHomeClient({data}:{data:HomeData}){
 const [branch,setBranch]=useState<DashboardBranch>(ALL_BRANCHES)
 const selected=useMemo(()=>statsFor(data,branch),[data,branch])
 const statsByBranch=useMemo(()=>BEARFIT_BRANCHES.map(b=>({branch:b,stats:statsFor(data,b.id)})),[data])
 const today=new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",month:"long",day:"numeric",year:"numeric"}).format(new Date(data.todayLabel+"T12:00:00+08:00"))
 const needsBranch=branch===ALL_BRANCHES?"All branches":BEARFIT_BRANCHES.find(b=>b.id===branch)?.name||branch
 return <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 pb-28 md:px-6 lg:px-8 lg:py-7 lg:pb-8">
  <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
   <div>
    <p className="text-xs font-bold uppercase tracking-[.18em] text-orange-300">BearFit / Admin Operations</p>
    <h1 className="mt-2 text-2xl font-black md:text-3xl">Operations Overview</h1>
    <p className="mt-1 text-sm text-white/55">{today} · Philippine time · {needsBranch}</p>
   </div>
   <Link href="/staff/home" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-xs font-semibold text-white/70 hover:bg-white/5"><RefreshCw size={15}/>Refresh data</Link>
  </header>
  {data.failed.length>0&&<div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">Some metrics could not be fully loaded ({data.failed.join(", ")}). Affected figures are shown as unavailable; retry before making decisions.</div>}
  <section aria-label="Select branch" className="flex flex-wrap gap-2">
   <button type="button" aria-pressed={branch===ALL_BRANCHES} onClick={()=>setBranch(ALL_BRANCHES)} className={(branch===ALL_BRANCHES?"border-orange-400 bg-[#ff7a1a] text-white":"border-white/10 bg-[#141414] text-white/65")+" rounded-xl border px-4 py-3 text-xs font-bold"}>All 3 branches</button>
   {BEARFIT_BRANCHES.map(b=><button type="button" key={b.id} aria-pressed={branch===b.id} onClick={()=>setBranch(b.id)} className={(branch===b.id?"border-orange-400 bg-[#ff7a1a] text-white":"border-white/10 bg-[#141414] text-white/65")+" rounded-xl border px-4 py-3 text-xs font-bold"}>{b.name}</button>)}
  </section>
  <section aria-label="Today operations metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
   {metricCards.map(item=><div key={item.key} className="rounded-2xl border border-white/10 bg-[#141414] p-4">
    <item.icon size={19} className="text-orange-300"/>
    <p className="mt-3 text-3xl font-black tabular-nums">{dataIncomplete(data,item.source)?"—":selected[item.key]}</p>
    <p className="mt-1 text-xs text-white/55">{item.label}</p>
   </div>)}
  </section>
  <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_310px]">
   <div className="rounded-3xl border border-white/10 bg-[#141414] p-4 md:p-5">
    <div className="flex items-center justify-between gap-3">
     <div><h2 className="text-lg font-black">Needs your attention</h2><p className="mt-1 text-xs text-white/45">Review queues · select a branch to filter the counts</p></div>
     <ClockAlert size={20} className="text-orange-300"/>
    </div>
    <div className="mt-4 divide-y divide-white/10">
     {attentionItems.map(item=>{
      const trouble=dataIncomplete(data,item.key==="renewals"?"members":item.key==="pendingBookings"?"pendingBookings":item.key==="paymentsPending"?"pendingPayments":item.key==="guestsPending"?"guests":"shifts")
      const count=trouble?"—":selected[item.key]
      return <Link href={item.href} key={item.title} className="flex items-center gap-3 py-4 hover:bg-white/[0.03]">
       <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5"><item.icon size={18} className="text-orange-300"/></span>
       <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{item.title}</span><span className="mt-1 block text-xs text-white/45">{item.description}</span></span>
       <span className="rounded-xl bg-white/10 px-3 py-1.5 text-sm font-black tabular-nums">{count}</span>
       <ArrowRight size={16} className="text-white/40"/>
      </Link>
     })}
    </div>
   </div>
   <div className="space-y-3">
    <div className="rounded-3xl border border-white/10 bg-[#141414] p-5">
     <div className="flex items-center gap-2 text-sm text-white/70"><Wallet size={18} className="text-orange-300"/>Recorded paid transactions today</div>
     <p className="mt-3 text-3xl font-black">{dataIncomplete(data,"paidToday")?"—":money(selected.recordedPaid)}</p>
     <p className="mt-2 text-xs text-white/45">{dataIncomplete(data,"paidToday")?"Payment data unavailable":selected.paidTransactions+" transactions marked PAID. This is not bank or cash reconciliation."}</p>
     <Link href="/staff/payments" className="mt-4 inline-flex gap-2 text-xs font-bold text-orange-300">Review payments <ArrowRight size={14}/></Link>
    </div>
    <div className="rounded-3xl border border-white/10 bg-[#101725] p-5">
     <h2 className="flex items-center gap-2 text-sm font-black"><ShieldCheck size={18} className="text-orange-300"/>Operational notes</h2>
     <p className="mt-2 text-xs leading-5 text-white/55">Member payment labels marked pending are not automatically overdue. Today's check-ins come from recorded session logs; planned shifts do not prove a coach clocked in.</p>
    </div>
   </div>
  </section>
  <section aria-label="Branch comparison" className="space-y-3">
   <div><h2 className="text-lg font-black">Your three branches</h2><p className="mt-1 text-xs text-white/45">Each branch has its own counts. Empty records are displayed as zero, not estimated.</p></div>
   <div className="grid gap-3 md:grid-cols-3">
    {statsByBranch.map(({branch:b,stats})=><button type="button" onClick={()=>setBranch(b.id)} key={b.id} aria-pressed={branch===b.id} className={"rounded-2xl border p-4 text-left transition "+(branch===b.id?"border-orange-400 bg-[#1e2432]":"border-white/10 bg-[#141414] hover:border-white/25")}>
     <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm font-bold"><MapPin size={17} className="text-orange-300"/>{b.name}</span><ArrowRight size={15} className="text-white/40"/></div>
     <div className="mt-3 text-3xl font-black">{dataIncomplete(data,"members")?"—":stats.active} <span className="text-xs font-normal text-white/45">active members</span></div>
     <p className="mt-1 text-xs text-white/55">{dataIncomplete(data,"bookings")?"—":stats.bookings} bookings today · {dataIncomplete(data,"members")?"—":stats.renewals} renewal alerts</p>
     {b.services.length>0&&<div className="mt-3 flex flex-wrap gap-1.5">{b.services.map(service=><span key={service} className="rounded-lg border border-orange-400/20 bg-orange-400/10 px-2.5 py-1 text-[11px] font-bold text-orange-200">{service}</span>)}</div>}
     {b.id==="Primark Cainta"&&!dataIncomplete(data,"members")&&stats.members===0&&<p className="mt-3 text-xs text-white/45">Branch registered · no members assigned yet</p>}
    </button>)}
   </div>
  </section>
  <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/55"><Activity size={18} className="shrink-0 text-orange-300"/><p>Admin Home is read-only. Open the linked workspaces to approve bookings, record payments, edit members, or manage coaches. Counts refresh when you reload the page.</p></div>
 </div>
}
