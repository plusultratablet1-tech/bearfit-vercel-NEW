"use client"
import {useEffect,useRef,useState} from "react"
import {createClient} from "@/lib/supabase/client"
const db=createClient()
type Result={member_name:string;member_code:string;remaining:number;total?:number;used?:number;verified:boolean;deducted:boolean}
export default function CoachQrPage(){
 const [code,setCode]=useState(""),[verified,setVerified]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[cameraOn,setCameraOn]=useState(true),[showManual,setShowManual]=useState(false)
 const video=useRef<HTMLVideoElement>(null)
 useEffect(()=>{if(!cameraOn)return;let closing=false;let stream:MediaStream|null=null;let raf=0
 async function start(){
 const Detector=(window as unknown as {BarcodeDetector?:new(o:{formats:string[]})=>{detect:(v:HTMLVideoElement)=>Promise<Array<{rawValue?:string}>>}}).BarcodeDetector
 if(!Detector){setError("Automatic QR scanning is not supported in this browser.");setShowManual(true);setCameraOn(false);return}
 try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});if(closing){stream.getTracks().forEach(t=>t.stop());return}if(!video.current)return;video.current.srcObject=stream;await video.current.play();const d=new Detector({formats:["qr_code"]});const tick=async()=>{if(closing||!video.current)return;try{const codes=await d.detect(video.current);const raw=codes[0]?.rawValue||"";const match=raw.match(/M\d{3,}/i);if(match){setCode(match[0].toUpperCase());setVerified(null);setCameraOn(false);return}}catch{}raf=requestAnimationFrame(()=>void tick())};void tick()}catch{setError("Camera permission was denied or the camera is unavailable.");setShowManual(true);setCameraOn(false)}
 }void start();return()=>{closing=true;cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop())}
 },[cameraOn])
 useEffect(()=>{if(!code||verified||busy)return;let alive=true;const id=setTimeout(()=>{if(alive)void act(false)},100);return()=>{alive=false;clearTimeout(id)}},[code])
 async function act(confirm:boolean){setBusy(true);setError("");const {data,error:err}=await db.rpc("coach_qr_session",{p_member_code:code.trim(),p_confirm:confirm});setBusy(false);if(err){setError(err.message);setVerified(null)}else{setVerified(data as Result);if(confirm)setCameraOn(false)}}
 return <section className="mx-auto max-w-xl px-4 pb-28 pt-5 text-center md:px-6 lg:pb-8">
  <h1 className="text-2xl font-black">Scan QR</h1>
  <div className="mt-5 overflow-hidden rounded-[26px] border border-white/10 bg-[#171717] p-4">
   {cameraOn?<video ref={video} autoPlay muted playsInline className="h-[55vh] max-h-[540px] min-h-[280px] w-full rounded-2xl bg-black object-cover"/>:<div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl bg-[#101725] p-5">{verified?<p className="text-emerald-300">Member verified</p>:<p className="text-white/60">Camera paused</p>}</div>}
   {error&&<p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
   {!verified&&<div className="mt-4 flex flex-wrap justify-center gap-3"><button type="button" onClick={()=>{setError("");setCode("");setVerified(null);setCameraOn(true)}} className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold">{cameraOn?"Restart camera":"Open camera"}</button><button type="button" onClick={()=>setShowManual(v=>!v)} className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold">{showManual?"Hide manual entry":"Enter code manually"}</button></div>}
   {showManual&&!verified&&<label className="mt-4 block text-left text-sm text-white/70">Member code<input value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setVerified(null)}} placeholder="M0012" className="mt-2 w-full rounded-xl border border-white/20 bg-[#101725] p-3 text-white"/></label>}
   {busy&&<p role="status" className="mt-3 text-sm text-white/60">Verifying…</p>}
   {verified&&<div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5 text-left"><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">{verified.deducted?"Session recorded":"Verified client"}</p><h2 className="mt-2 text-xl font-black">{verified.member_name}</h2><p className="mt-2 text-sm text-white/65">{verified.member_code} · {verified.remaining} remaining sessions</p>{!verified.deducted&&<><p className="mt-4 text-sm text-amber-200">Confirm only after the completed training session. This deducts one real session.</p><button disabled={busy} onClick={()=>void act(true)} className="mt-3 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold disabled:opacity-40">Confirm & deduct 1 session</button></>}<button type="button" onClick={()=>{setVerified(null);setCode("");setError("");setShowManual(false);setCameraOn(true)}} className="mt-3 ml-3 rounded-xl border border-white/20 px-4 py-3 text-sm">Scan another</button></div>}
  </div>
 </section>
}