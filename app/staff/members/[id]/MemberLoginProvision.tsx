"use client"

import {useState} from "react"
import Link from "next/link"
import {KeyRound,Copy,CheckCircle2} from "lucide-react"

type Credentials={username:string;temporaryPassword:string;message:string}
export default function MemberLoginProvision({
  memberId,memberCode,memberName,hasLogin,isEligible
}:{memberId:string;memberCode:string;memberName:string;hasLogin:boolean;isEligible:boolean}){
  const [working,setWorking]=useState(false)
  const [linked,setLinked]=useState(hasLogin)
  const [credentials,setCredentials]=useState<Credentials|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [copied,setCopied]=useState(false)
  async function provision(action:"create"|"reset"){
    if(working)return
    if(action==="reset"&&!window.confirm("Reset this member's password? The previous password will immediately stop working."))return
    setWorking(true);setError(null);setCredentials(null);setCopied(false)
    try{
      const response=await fetch("/api/admin/members/provision",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({memberId,action}),cache:"no-store"
      })
      const data=await response.json()
      if(!response.ok)throw new Error(data.error||"Unable to provision member.")
      setLinked(true)
      setCredentials(data as Credentials)
    }catch(e){setError(e instanceof Error?e.message:"Member login unavailable")}
    finally{setWorking(false)}
  }
  async function copy(){
    if(!credentials)return
    const text="BearFit Member Portal\n"+ "https://bearfit-ph.vercel.app/login\n"+"Username: "+credentials.username+"\nTemporary password: "+credentials.temporaryPassword
    try{await navigator.clipboard.writeText(text);setCopied(true)}
    catch{setError("Unable to copy. Select the credentials above to copy manually.")}
  }
  if(!isEligible)return null
  return <section className="mb-6 rounded-[24px] border border-orange-400/25 bg-[#141414] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><KeyRound size={18} className="text-orange-300"/><h2 className="text-lg font-bold">Member portal access</h2></div>
        <p className="mt-2 text-sm text-white/60">{memberName} · {memberCode}</p>
        <p className="mt-1 text-xs text-white/45">{linked?"Login account linked":"This existing member does not have a login yet."} The member's packages, sessions and payments stay unchanged.</p>
      </div>
      <span className={"rounded-full px-3 py-1.5 text-xs font-bold "+(linked?"bg-emerald-500/15 text-emerald-300":"bg-amber-500/15 text-amber-200")}>{linked?"Account linked":"No account"}</span>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={working} onClick={()=>void provision(linked?"reset":"create")}
        className="rounded-xl bg-[#ff7a1a] px-4 py-3 text-sm font-bold disabled:opacity-50">
        {working?"Securing account…":linked?"Reset member password":"Create Member Login"}
      </button>
      <Link href="/login" target="_blank" className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold">Open login page</Link>
    </div>
    {error&&<p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {credentials&&<div className="mt-5 space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 size={16}/>Login created and verified</p>
      <p className="text-xs text-white/55">Copy the one-time temporary password now. It will not be displayed again after you leave this page. Share it privately with the member.</p>
      <div><p className="text-xs text-white/50">Username</p><p className="select-all font-mono text-base">{credentials.username}</p></div>
      <div><p className="text-xs text-white/50">Temporary password</p><p className="select-all break-all font-mono text-sm">{credentials.temporaryPassword}</p></div>
      <button type="button" onClick={()=>void copy()} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold"><Copy size={15}/>{copied?"Copied credentials":"Copy login details"}</button>
    </div>}
  </section>
}