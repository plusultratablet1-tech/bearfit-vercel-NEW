"use client"
import {useEffect,useRef,useState} from "react"
import {createClient} from "@/lib/supabase/client"
const db=createClient()
type Result={member_name:string;member_code:string;remaining:number;total?:number;used?:number;verified:boolean;deducted:boolean}
export default function CoachQrPage(){
 const [code,setCode]=useState(""),[verified,setVerified]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[cameraOn,setCameraOn]=useState(false)
 const video=useRef<HTMLVideoElement>(null)
 useEffect(()=>{if(!cameraOn)return;let closing=false;let stream:MediaStream|null=null;let raf=0
 async function start(){
 const Detector=(window as unknown as {BarcodeDetector?:new(o:{formats:string[]})=>{detect:(v:HTMLVideoElement)=>Promise<Array<{rawValue?:string}>>}}).BarcodeDetector
 if(!Detector){setError("Camera QR detection is unavailable. Enter the member code manually.");setCameraOn(false);return}
 try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});if(closing){stream.getTracks().forEach(t=>t.stop());return}if(!video.current)return;video.current.srcObject=stream;await video.current.play();const d=new Detector({formats:["qr_code"]});const tick=async()=>{if(closing||!video.current)return;try{const codes=await d.detect(video.current);const raw=codes[0]?.rawValue||"";const match=raw.match(/M\d{3,}/i);if(match){setCode(match[0].toUpperCase());setVerified(null);setCameraOn(false);return}}catch{}raf=requestAnimationFrame(()=>void tick())};void tick()}catch{setError("Camera unavailable. Enter the member code manually.");setCameraOn(false)}
 }void start();return()=>{closing=true;cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop())}
 },[cameraOn])
 async function act(confirm:boolean){setBusy(true);setError("");const {data,error:err}=await db.rpc("coach_qr_session",{p_member_code:code.trim(),p_confirm:confirm});setBusy(false);if(err){setError(err.message);setVerified(null)}else{setVerified(data as Result);if(confirm)setCameraOn(false)}}
 return <section className="mx-auto max-w-[1180px] space-y-5 px-4 pb-28 pt-6 md:px-6 lg:px-8 lg:pb-8">
 <header className="rounded-2xl border border-white/10 bg-[#111927] p-6"><p className="text-xs font-bold uppercase tracking-widest text-orange-300">BearFit Coach Operations</p><h1 className="mt-2 text-3xl font-black">Scan QR</h1><p className="mt-2 text-sm text-white/55">Verify your client, then confirm one completed training session.</p></header>
 <div className="rounded-2xl border border-white/10 bg-[#171717] p-5 md:p-7"><button onClick={()=>setCameraOn(v=>!v)} className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold">{cameraOn?"Stop camera":"Open QR camera"}</button>{cameraOn&&<video ref={video} muted playsInline className="mt-4 h-64 w-full rounded-xl bg-black object-cover"/>}<label className="mt-5 block text-sm font-semibold text-white/70">Member QR code / member ID<input value={code} onChange={e=>{setCode(e.target.value);setVerified(null)}} placeholder="M0012" className="mt-2 w-full rounded-xl border border-white/15 bg-[#101725] p-3 text-white"/></label>
 <button disabled={busy||!/^M\d{3,}$/i.test(code.trim())} onClick={()=>void act(false)} className="mt-4 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold disabled:opacity-40">Verify client</button>
 {error&&<p role="alert" className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
 {verified&&<div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">{verified.deducted?"Session recorded":"Verified assigned member"}</p><h2 className="mt-2 text-2xl font-black">{verified.member_name}</h2><p className="mt-2 text-sm text-white/65">{verified.member_code} · {verified.remaining} sessions remaining{verified.deducted?" after deduction":""}</p>{!verified.deducted&&<><p className="mt-4 text-sm text-amber-200">Confirm only after the member is physically present and the training session has been completed. This deducts exactly one session and records the check-in.</p><button disabled={busy} onClick={()=>void act(true)} className="mt-3 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold disabled:opacity-40">Confirm & deduct 1 session</button></>}</div>}
 </div></section>
}