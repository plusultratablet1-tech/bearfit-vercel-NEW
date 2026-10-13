"use client"

import Link from "next/link"
import {useMemo,useState} from "react"
import {UsersRound,AlertTriangle,CheckCircle2,Clock3,Search,ChevronRight,ChevronLeft,Grid2X2,LayoutList,RefreshCw,Wallet,AlertCircle} from "lucide-react"
import StaffAppShell from "@/components/bearfit/StaffAppShell"
import {
  compareMembers, hasLowSessions, isActiveMember, matchesMemberView,
  memberAction, memberDisplayName, memberPackage, memberStats, membershipState,
  paymentLabel, remainingSessions, sessionGroup,
  type MemberDirectoryRecord,type MemberQuickView,type MemberSort
} from "@/lib/member-control-center"

export type MemberDirectoryItem=MemberDirectoryRecord & {
 last_paid_at:string|null;last_paid_amount:number|null;total_paid:number|null
}
type GroupBy="none"|"branch"|"coach"|"package"|"sessions"
type Layout="table"|"cards"
const PER_PAGE=25
const inputStyle="min-w-0 rounded-xl border border-white/10 bg-[#1b2434] px-3 py-2.5 text-sm text-white/80 outline-none focus:border-orange-400/50"
const quickViews:{id:MemberQuickView;title:string}[]=[
 {id:"all",title:"All Members"},{id:"attention",title:"Needs Attention"},
 {id:"renewals",title:"Renewals"},{id:"active",title:"Active"},
]
function groupLabel(member:MemberDirectoryItem,group:GroupBy):string{
 if(group==="branch")return member.branch||"No branch"
 if(group==="coach")return member.coach_name||"No coach assigned"
 if(group==="package")return memberPackage(member)
 if(group==="sessions")return sessionGroup(member)
 return "All Members"
}
function groupMembers(members:MemberDirectoryItem[],group:GroupBy){
 const map=new Map<string,MemberDirectoryItem[]>()
 for(const member of members){
  const key=groupLabel(member,group)
  map.set(key,[...(map.get(key)||[]),member])
 }
 return [...map.entries()]
}
function memberTone(member:MemberDirectoryItem):string{
 const status=membershipState(member)
 return status==="active"?"bg-emerald-500/10 text-emerald-300"
  :status==="renewal_due"||status==="expired"?"bg-amber-500/10 text-amber-200"
  :"bg-white/5 text-white/55"
}
function actionTone(tone:"neutral"|"good"|"attention"){
 return tone==="good"?"text-emerald-300":tone==="attention"?"text-amber-200":"text-white/55"
}
function Overview({icon:Icon,title,count,note}:{icon:typeof UsersRound;title:string;count:number;note?:string}){
 return <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
  <Icon size={18} className="text-[#ff7a1a]"/>
  <p className="mt-2 text-xs text-white/55">{title}</p>
  <p className="mt-1 text-2xl font-black tabular-nums">{count}</p>
  {note&&<p className="mt-1 text-[11px] text-white/40">{note}</p>}
 </div>
}
function MemberCard({member:m}:{member:MemberDirectoryItem}){
 const next=memberAction(m)
 return <Link href={"/staff/members/"+m.id} className="block rounded-2xl border border-white/10 bg-[#141414] p-4 transition hover:border-orange-400/35">
  <div className="flex items-start justify-between gap-2">
   <div className="min-w-0">
    <p className="text-xs text-white/40">{m.member_code||m.membership_id||"No member ID"}</p>
    <h3 className="mt-1 truncate text-base font-bold">{memberDisplayName(m)}</h3>
    <p className="mt-1 text-xs text-white/50">{m.branch||"No branch"} · {m.coach_name||"No coach assigned"}</p>
   </div>
   <span className={"rounded-lg px-2 py-1.5 text-xs font-semibold capitalize "+memberTone(m)}>{membershipState(m).replaceAll("_"," ")}</span>
  </div>
  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
   <div><p className="text-[11px] text-white/40">Package</p><p className="mt-1 truncate text-sm">{memberPackage(m)}</p></div>
   <div><p className="text-[11px] text-white/40">Remaining sessions</p>
    <p className={"mt-1 font-bold "+(hasLowSessions(m)?"text-amber-200":"text-white")}>
     {remainingSessions(m)??"—"} <span className="text-xs font-normal text-white/45">/ {m.total_sessions??"—"}</span>
    </p>
   </div>
   <div><p className="text-[11px] text-white/40">Payment</p><p className="mt-1 text-xs text-white/65">{paymentLabel(m).label}</p></div>
   <div><p className="text-[11px] text-white/40">Next step</p><p className={"mt-1 text-xs font-semibold "+actionTone(next.tone)}>{next.label}</p></div>
  </div>
  <p className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-orange-300">View member profile <ChevronRight size={14}/></p>
 </Link>
}
function Filter({title,value,options,onChange}:{title:string;value:string;options:string[];onChange:(v:string)=>void}){
 return <select aria-label={title} value={value} onChange={e=>onChange(e.target.value)} className={inputStyle}>
  <option value="ALL">{title}</option>
  {options.map(o=><option key={o} value={o}>{o.replaceAll("_"," ")}</option>)}
 </select>
}
function MemberTable({members}:{members:MemberDirectoryItem[]}){
 return <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-[#141414] lg:block">
  <table className="w-full min-w-[940px] text-left text-sm">
   <thead className="bg-[#101725] text-[11px] uppercase tracking-wider text-white/45">
    <tr className="border-b border-white/10">
     {["Member","Branch / Coach","Package","Remaining","Membership","Payment","Next step"].map(title=>
      <th key={title} scope="col" className="px-3 py-3 font-semibold">{title}</th>)}
    </tr>
   </thead>
   <tbody>{members.map(m=>{
    const next=memberAction(m)
    return <tr key={m.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.04]">
     <td className="px-3 py-3">
      <Link href={"/staff/members/"+m.id} className="font-semibold text-white hover:text-orange-300">{memberDisplayName(m)}</Link>
      <p className="mt-1 text-xs text-white/40">{m.member_code||m.membership_id||"No ID"}{m.is_demo?" · Demo":""}</p>
     </td>
     <td className="px-3 py-3"><p className="text-xs">{m.branch||"No branch"}</p><p className="mt-1 max-w-40 truncate text-xs text-white/45">{m.coach_name||"No coach"}</p></td>
     <td className="max-w-44 px-3 py-3 text-xs text-white/75"><span className="block truncate" title={memberPackage(m)}>{memberPackage(m)}</span></td>
     <td className={"whitespace-nowrap px-3 py-3 font-bold "+(hasLowSessions(m)?"text-amber-200":"text-white")}>
      {remainingSessions(m)??"—"} <span className="text-xs font-normal text-white/40">/ {m.total_sessions??"—"}</span>
     </td>
     <td className="px-3 py-3"><span className={"inline-block rounded-lg px-2.5 py-1 text-xs font-medium capitalize "+memberTone(m)}>{membershipState(m).replaceAll("_"," ")}</span></td>
     <td className="px-3 py-3 text-xs text-white/60">{paymentLabel(m).label}</td>
     <td className="px-3 py-3"><Link href={"/staff/members/"+m.id} className={"flex items-center gap-1 whitespace-nowrap text-xs font-semibold "+actionTone(next.tone)}>{next.label}<ChevronRight size={13}/></Link></td>
    </tr>
   })}</tbody>
  </table>
 </div>
}

export default function StaffMembersPageClient({
 role,initialMembers,loadError,
}:{role:"staff"|"admin";initialMembers:MemberDirectoryItem[];loadError:string|null}){
 const [quickView,setQuickView]=useState<MemberQuickView>("all")
 const [layout,setLayout]=useState<Layout>("table")
 const [search,setSearch]=useState("")
 const [branchFilter,setBranchFilter]=useState("ALL")
 const [coachFilter,setCoachFilter]=useState("ALL")
 const [packageFilter,setPackageFilter]=useState("ALL")
 const [statusFilter,setStatusFilter]=useState("ALL")
 const [groupBy,setGroupBy]=useState<GroupBy>("none")
 const [sortBy,setSortBy]=useState<MemberSort>("priority")
 const [page,setPage]=useState(1)

 const branches=useMemo(()=>[...new Set(initialMembers.map(m=>m.branch).filter((v):v is string=>Boolean(v)))].sort(),[initialMembers])
 const coaches=useMemo(()=>[...new Set(initialMembers.map(m=>m.coach_name).filter((v):v is string=>Boolean(v)))].sort(),[initialMembers])
 const packages=useMemo(()=>[...new Set(initialMembers.map(memberPackage))].sort(),[initialMembers])
 const statuses=useMemo(()=>[...new Set(initialMembers.map(m=>membershipState(m)))].sort(),[initialMembers])
 const stats=useMemo(()=>memberStats(initialMembers),[initialMembers])
 const filtered=useMemo(()=>{
  const needle=search.trim().toLowerCase()
  return initialMembers.filter(m=>{
   const match=[m.member_code,m.membership_id,memberDisplayName(m),m.email,m.phone,m.branch,m.coach_name,memberPackage(m)]
    .filter(Boolean).join(" ").toLowerCase()
   return matchesMemberView(m,quickView)&&(!needle||match.includes(needle))
    &&(branchFilter==="ALL"||m.branch===branchFilter)
    &&(coachFilter==="ALL"||m.coach_name===coachFilter)
    &&(packageFilter==="ALL"||memberPackage(m)===packageFilter)
    &&(statusFilter==="ALL"||membershipState(m)===statusFilter)
  })
 },[initialMembers,quickView,search,branchFilter,coachFilter,packageFilter,statusFilter])

 const ordered=useMemo(()=>{
  const sorted=[...filtered].sort((a,b)=>compareMembers(a,b,sortBy))
  if(groupBy==="none")return sorted
  return groupMembers(sorted,groupBy).sort(([a],[b])=>a.localeCompare(b)).flatMap(([,members])=>members)
 },[filtered,groupBy,sortBy])
 const pages=Math.max(1,Math.ceil(ordered.length/PER_PAGE))
 const shownPage=Math.min(page,pages)
 const displayed=ordered.slice((shownPage-1)*PER_PAGE,shownPage*PER_PAGE)
 const groups=groupMembers(displayed,groupBy)
 function resetPage(){setPage(1)}
 function resetAll(){setQuickView("all");setSearch("");setBranchFilter("ALL");setCoachFilter("ALL");setPackageFilter("ALL");setStatusFilter("ALL");setGroupBy("none");setSortBy("priority");resetPage()}

 return <StaffAppShell activePath="/staff/members" role={role}>
  <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-28 md:px-6 lg:px-8 lg:py-7 lg:pb-8">
   <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-5">
    <div>
     <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">People / Operations</p>
     <h1 className="mt-1 text-2xl font-black md:text-3xl">Members Control Center</h1>
     <p className="mt-1 text-sm text-white/50">Find members, spot upcoming renewals, and open complete member profiles.</p>
    </div>
    <Link href="/staff/members" className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-xs text-white/70 hover:bg-white/5">
     <RefreshCw size={15}/> Refresh data
    </Link>
   </header>

   {loadError&&<p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
    Unable to load member data completely: {loadError}. Dashboard totals may be incomplete.
   </p>}

   <section aria-label="Members summary" className="grid grid-cols-2 gap-3 xl:grid-cols-5">
    <Overview icon={UsersRound} title="Members" count={stats.total}/>
    <Overview icon={CheckCircle2} title="Active" count={stats.active}/>
    <Overview icon={AlertTriangle} title="Renewal pipeline" count={stats.renewals} note={String(stats.explicitRenewalDue)+" marked renewal due"}/>
    <Overview icon={Clock3} title="Active · 0–3 sessions" count={stats.lowSessions} note={String(stats.zeroSessions)+" with zero sessions"}/>
    <Overview icon={Wallet} title="Payment pending / unverified" count={stats.paymentUnverified} note="Not automatically overdue"/>
   </section>

   <section aria-label="Member search and filters" className="rounded-[24px] border border-white/10 bg-[#101725] p-4 md:p-5">
    <div role="group" aria-label="Quick views" className="flex flex-wrap gap-2">
     {quickViews.map(q=><button type="button" key={q.id} aria-pressed={quickView===q.id}
      onClick={()=>{setQuickView(q.id);resetPage()}}
      className={quickView===q.id?"rounded-xl bg-[#ff7a1a] px-3.5 py-2.5 text-xs font-bold":"rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white/60"}>
      {q.title} <span className="ml-1 opacity-80">{q.id==="all"?stats.total:q.id==="attention"?stats.attention:q.id==="renewals"?stats.renewals:stats.active}</span>
     </button>)}
    </div>

    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(130px,155px))]">
     <label className="relative">
      <span className="sr-only">Search members</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={17}/>
      <input type="search" autoComplete="off" placeholder="Search name, ID, phone, coach…" value={search}
       onChange={e=>{setSearch(e.target.value);resetPage()}} className={inputStyle+" w-full py-3 pl-10"}/>
     </label>
     <Filter title="All branches" options={branches} value={branchFilter} onChange={v=>{setBranchFilter(v);resetPage()}}/>
     <Filter title="All coaches" options={coaches} value={coachFilter} onChange={v=>{setCoachFilter(v);resetPage()}}/>
     <Filter title="All packages" options={packages} value={packageFilter} onChange={v=>{setPackageFilter(v);resetPage()}}/>
     <Filter title="All statuses" options={statuses} value={statusFilter} onChange={v=>{setStatusFilter(v);resetPage()}}/>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
     <label className="flex items-center gap-2 text-xs text-white/55">Sort
      <select aria-label="Sort members" value={sortBy} onChange={e=>{setSortBy(e.target.value as MemberSort);resetPage()}} className={inputStyle}>
       <option value="priority">Needs attention first</option><option value="name">Name A–Z</option>
       <option value="sessions_asc">Sessions low to high</option><option value="sessions_desc">Sessions high to low</option>
       <option value="joined_desc">Recently joined</option>
      </select>
     </label>
     <label className="flex items-center gap-2 text-xs text-white/55">Group
      <select aria-label="Group members" value={groupBy} onChange={e=>{setGroupBy(e.target.value as GroupBy);resetPage()}} className={inputStyle}>
       <option value="none">No grouping</option><option value="branch">Branch</option>
       <option value="coach">Coach</option><option value="package">Package</option>
       <option value="sessions">Sessions remaining</option>
      </select>
     </label>
     <div className="ml-auto hidden items-center rounded-xl border border-white/10 p-1 lg:flex" role="group" aria-label="Layout">
      <button aria-label="Compact table view" aria-pressed={layout==="table"} type="button" onClick={()=>setLayout("table")} className={(layout==="table"?"bg-[#ff7a1a]":"text-white/50")+" rounded-lg p-2.5"}><LayoutList size={18}/></button>
      <button aria-label="Member card view" aria-pressed={layout==="cards"} type="button" onClick={()=>setLayout("cards")} className={(layout==="cards"?"bg-[#ff7a1a]":"text-white/50")+" rounded-lg p-2.5"}><Grid2X2 size={18}/></button>
     </div>
     <button type="button" onClick={resetAll} className="text-xs font-semibold text-orange-300 underline underline-offset-4">Clear filters</button>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-white/45">
     <p role="status">Showing {displayed.length?(shownPage-1)*PER_PAGE+1:0}–{Math.min(shownPage*PER_PAGE,ordered.length)} of {ordered.length} matching members</p>
     <p>Pending is unverified, not an overdue balance.</p>
    </div>
   </section>

   <section aria-label="Member results" className="space-y-5">
    {displayed.length===0&&<div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
     <p className="text-sm text-white/55">No members match these filters.</p>
     <button type="button" onClick={resetAll} className="mt-3 text-sm font-semibold text-orange-300 underline">Show all members</button>
    </div>}
    {groups.map(([label,members])=><div key={label} className="space-y-3">
     {groupBy!=="none"&&<h2 className="flex items-center gap-2 text-sm font-bold">{label}<span className="text-xs font-normal text-white/45">{members.length} on this page</span></h2>}
     <div className="grid gap-3 lg:hidden">{members.map(m=><MemberCard member={m} key={m.id}/>)}</div>
     {layout==="cards"&&<div className="hidden gap-3 lg:grid lg:grid-cols-2">{members.map(m=><MemberCard member={m} key={m.id}/>)}</div>}
     {layout==="table"&&<MemberTable members={members}/>}
    </div>)}
   </section>

   {ordered.length>PER_PAGE&&<nav aria-label="Member result pages" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#141414] p-3">
    <p className="text-sm text-white/60">Page {shownPage} of {pages} · {PER_PAGE} per page</p>
    <div className="flex gap-2">
     <button type="button" disabled={shownPage===1} onClick={()=>setPage(Math.max(1,shownPage-1))} className="flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-sm disabled:opacity-35"><ChevronLeft size={15}/> Previous</button>
     <button type="button" disabled={shownPage===pages} onClick={()=>setPage(Math.min(pages,shownPage+1))} className="flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-sm disabled:opacity-35">Next <ChevronRight size={15}/></button>
    </div>
   </nav>}
   <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/55">
    <AlertCircle size={18} className="shrink-0 text-orange-300"/>
    <p><strong className="text-white/75">Understanding these alerts:</strong> Renewals include members explicitly marked renewal due and active members with 0–3 sessions left. A pending payment label is not proof of unpaid or late fees. Verify transactions in the individual member profile before collecting. This directory is read-only.</p>
   </div>
  </div>
 </StaffAppShell>
}
