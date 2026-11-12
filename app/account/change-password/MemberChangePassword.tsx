"use client"
import {useState,type FormEvent} from "react"
export default function MemberChangePassword(){
 const [password,setPassword]=useState("")
 const [confirm,setConfirm]=useState("")
 const [error,setError]=useState("")
 const [busy,setBusy]=useState(false)
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError("")
  if(password.length<12||password!==confirm){setError("Use at least 12 characters and ensure both passwords match.");return}
  setBusy(true)
  try{
   const res=await fetch("/api/member/change-password",{
    method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
    body:JSON.stringify({password,confirmPassword:confirm})
   })
   const data=await res.json().catch(()=>({}))
   if(!res.ok)throw new Error(data.error||"Unable to update your password")
   setPassword("");setConfirm("")
   window.location.assign(data.redirectTo||"/login")
  }catch(e){setError(e instanceof Error?e.message:"Password update failed")}
  finally{setBusy(false)}
 }
 return <form onSubmit={e=>void submit(e)} className="mt-5 space-y-4">
  <label className="block text-sm text-white/60">New password
   <input autoComplete="new-password" type="password" required minLength={12} maxLength={128}
    value={password} onChange={e=>setPassword(e.target.value)}
    className="mt-1 w-full rounded-xl border border-white/20 bg-[#242424] p-3 text-white"/>
  </label>
  <label className="block text-sm text-white/60">Confirm new password
   <input autoComplete="new-password" type="password" required minLength={12} maxLength={128}
    value={confirm} onChange={e=>setConfirm(e.target.value)}
    className="mt-1 w-full rounded-xl border border-white/20 bg-[#242424] p-3 text-white"/>
  </label>
  {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
  <button disabled={busy} className="w-full rounded-xl bg-[#ff7a1a] p-3 font-bold disabled:opacity-50">
   {busy?"Saving…":"Save password and continue"}
  </button>
 </form>
}
