"use client"
import {useState} from "react"
type Props={memberId:string;memberCode:string;name:string;hasLogin:boolean}
export default function MemberLoginProvision({memberId,memberCode,name,hasLogin}:Props){
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState("")
 const [credentials,setCredentials]=useState<{memberCode:string;temporaryPassword:string}|null>(null)
 async function perform(action:"create"|"reset"){
  if(!window.confirm((action==="create"?"Create login for ":"Reset temporary login for ")+memberCode+" ("+name+")? Verify the person's identity before sharing credentials."))return
  setBusy(true);setError("");setCredentials(null)
  try{
   const response=await fetch("/api/admin/members/provision",{
    method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
    body:JSON.stringify({memberId,action}),
   })
   const json=await response.json().catch(()=>({}))
   if(!response.ok)throw new Error(json.error||"Provisioning failed")
   if(!json.memberCode||!json.temporaryPassword)throw new Error("Login changed, but password was not returned. Check account before retrying.")
   setCredentials({memberCode:json.memberCode,temporaryPassword:json.temporaryPassword})
  }catch(e){setError(e instanceof Error?e.message:"Unable to create login")}
  finally{setBusy(false)}
 }
 return <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
  <p className="mb-2 text-xs text-white/60">Member ID login · {hasLogin?"Linked account":"Not provisioned"}</p>
  <button type="button" disabled={busy}
   onClick={()=>void perform(hasLogin?"reset":"create")}
   className="rounded-lg bg-[#ff7a1a] px-4 py-2 text-sm font-bold disabled:opacity-50">
   {busy?"Processing…":hasLogin?"Reset member password":"Create member login"}
  </button>
  {error&&<p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
  {credentials&&<div role="dialog" aria-modal="true" aria-label="New member temporary login" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4">
    <div className="w-full max-w-lg rounded-2xl border border-orange-500/30 bg-[#171717] p-5">
     <h2 className="text-lg font-bold">Member temporary login</h2>
     <p className="mt-2 text-sm text-amber-200">Show once. Copy securely and give only to the verified member. The member must change it at first login.</p>
     <p className="mt-4 text-xs text-white/50">Username</p>
     <p className="select-all font-mono text-lg">{credentials.memberCode}</p>
     <p className="mt-3 text-xs text-white/50">Temporary password</p>
     <p className="select-all break-all font-mono text-base">{credentials.temporaryPassword}</p>
     <div className="mt-5 flex gap-3">
      <button type="button" onClick={()=>void navigator.clipboard.writeText("Username: "+credentials.memberCode+"\nTemporary password: "+credentials.temporaryPassword)}
       className="rounded-lg bg-[#ff7a1a] px-4 py-2 text-sm font-bold">Copy privately</button>
      <button type="button" onClick={()=>{setCredentials(null);window.location.reload()}}
       className="rounded-lg border border-white/20 px-4 py-2 text-sm">I've saved it — close</button>
     </div>
    </div>
   </div>}
 </div>
}
