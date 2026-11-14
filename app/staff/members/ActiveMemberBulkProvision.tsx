"use client"

import {useState} from "react"
import {Download, KeyRound, ShieldCheck} from "lucide-react"

type Candidate={id:string;code:string;name:string}
type Credential=Candidate & {username:string;temporaryPassword:string}
type Failure=Candidate & {message:string}
const LOGIN_URL="https://bearfit-ph.vercel.app/login"

// Excel interprets cells beginning with these characters as formulas.
// Keep exported names as plain text even when a record contains special characters.
function csvCell(value:string){
  const safe=/^[=+\-@\t\r]/.test(value)?"'"+value:value
  return '"'+safe.replaceAll('"','""')+'"'
}
export default function ActiveMemberBulkProvision({members}:{members:Candidate[]}){
  const [working,setWorking]=useState(false)
  const [attempted,setAttempted]=useState(0)
  const [created,setCreated]=useState<Credential[]>([])
  const [failures,setFailures]=useState<Failure[]>([])
  const [stopped,setStopped]=useState<string|null>(null)
  const createdIds=new Set(created.map(item=>item.id))
  const remaining=members.filter(member=>!createdIds.has(member.id))

  async function run(){
    if(working||remaining.length===0)return
    if(!window.confirm(
      "Create "+remaining.length+" real Malingap member logins? This will generate individual, random temporary passwords. Existing accounts, session counts and payments will not be reset. Stay on this page to save the credentials."
    ))return
    setWorking(true)
    setAttempted(0)
    setFailures([])
    setStopped(null)
    let count=0
    for(const member of remaining){
      try{
        const response=await fetch("/api/admin/members/provision",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          credentials:"same-origin",
          cache:"no-store",
          body:JSON.stringify({memberId:member.id,action:"create"})
        })
        const data=await response.json() as {username?:string;temporaryPassword?:string;error?:string}
        if(!response.ok){
          const message=data.error||"Account could not be created"
          setFailures(previous=>[...previous,{...member,message}])
          // Authentication, missing configuration or throttling should not
          // launch dozens of additional failed requests.
          if([401,403,429,503].includes(response.status)){
            setStopped(message)
            break
          }
        }else if(typeof data.username==="string"&&typeof data.temporaryPassword==="string"){
          setCreated(previous=>[...previous,{...member,username:data.username!,temporaryPassword:data.temporaryPassword!}])
        }else{
          setFailures(previous=>[...previous,{...member,message:"Server response omitted credentials; review account before retrying."}])
          setStopped("An account may have been created without displaying its temporary password.")
          break
        }
      }catch{
        setFailures(previous=>[...previous,{...member,message:"Network error; check the member account before retrying."}])
        setStopped("Network connection lost; the last account may have been created.")
        break
      }finally{
        count+=1
        setAttempted(count)
      }
    }
    setWorking(false)
  }
  function download(){
    if(created.length===0)return
    const header=["Member ID","Name","Login email","Temporary password","Login URL"]
    const rows=created.map(item=>[item.code,item.name,item.username.toLowerCase()+"@members.bearfit.ph",item.temporaryPassword,LOGIN_URL])
    const csv="\uFEFF"+[header,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n")
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}))
    const link=document.createElement("a")
    link.href=url
    link.download="bearfit-malingap-member-logins.csv"
    link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  if(members.length===0&&created.length===0)return null
  return <section aria-label="Bulk member portal activation" className="rounded-[24px] border border-orange-400/25 bg-[#141414] p-4 md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold"><KeyRound size={19} className="text-orange-300"/>Activate Malingap member portals</h2>
        <p className="mt-2 max-w-3xl text-sm text-white/60">Create secure logins for existing, active, real Malingap members in one operation. Every client keeps their own membership, bookings, sessions, payments and coach assignments.</p>
        <p className="mt-2 text-xs text-white/45">{members.length} accounts initially eligible · {created.length} created in this session · {remaining.length} remaining</p>
      </div>
      <button type="button" disabled={working||remaining.length===0}
        onClick={()=>void run()} className="rounded-xl bg-[#ff7a1a] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
        {working?"Creating accounts…":remaining.length===0?"All selected accounts created":"Create "+remaining.length+" member logins"}
      </button>
    </div>
    {working&&<p role="status" className="mt-4 text-sm text-orange-200">Processing {attempted} of {remaining.length+created.length} members. Keep this tab open.</p>}
    {stopped&&<p role="alert" className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">Stopped for safety: {stopped}</p>}
    {failures.length>0&&<div className="mt-4 rounded-xl border border-red-400/20 p-3 text-sm text-red-200">
      <p className="font-bold">{failures.length} account(s) need attention. Existing records were not changed.</p>
      <ul className="mt-2 list-inside list-disc space-y-1">{failures.map(f=><li key={f.id}>{f.code} · {f.name}: {f.message}</li>)}</ul>
    </div>}
    {created.length>0&&<div className="mt-4 space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-emerald-200"><ShieldCheck size={16}/> {created.length} member logins created and verified</p>
      <p className="text-xs text-white/65">Temporary passwords appear only in this browser session. Download the CSV before leaving or refreshing, store it securely, and share each password privately. Never send the entire list to members.</p>
      <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-700 px-4 py-3 text-sm font-bold"><Download size={16}/>Download member logins CSV</button>
      <div className="max-h-56 overflow-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[500px] text-left text-xs">
          <thead className="sticky top-0 bg-[#101725] text-white/60"><tr><th className="p-2">Member</th><th className="p-2">Login</th><th className="p-2">Temporary password</th></tr></thead>
          <tbody>{created.map(item=><tr key={item.id} className="border-t border-white/10"><td className="p-2">{item.code} · {item.name}</td><td className="p-2 select-all font-mono">{item.username.toLowerCase()}@members.bearfit.ph</td><td className="p-2 select-all break-all font-mono">{item.temporaryPassword}</td></tr>)}</tbody>
        </table>
      </div>
    </div>}
    <p className="mt-4 text-xs text-white/45">Only active Malingap members are eligible under the current BearFit account policy. Inactive, paused and demo records are not modified. Admin access is required for every creation.</p>
  </section>
}
