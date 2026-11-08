"use client"
import {useEffect,useRef,useState} from "react"
import {createClient} from "@/lib/supabase/client"
const db=createClient()
type Result={member_name:string;member_code:string;remaining:number;total?:number;used?:number;verified:boolean;deducted:boolean}
type Decoder=(data:Uint8ClampedArray,width:number,height:number,options?:{inversionAttempts:string})=>{data:string}|null
declare global {interface Window{jsQR?:Decoder}}
function readMemberCode(raw:string){
 const value=raw.trim()
 if(/^BEARFIT-TAG:1:/i.test(value))throw new Error("This is a permanent BearFit tag (QR 001–006). Client assignment is not connected to the scanner yet. Ask Admin before using it.")
 const match=value.match(/(?:^|[^A-Za-z0-9])(M\d{3,})(?=$|[^A-Za-z0-9])/i)
 if(!match)throw new Error("QR scanned, but it does not contain a BearFit member code (M0001).")
 return match[1].toUpperCase()
}
function decoderReady():Promise<Decoder>{
 if(window.jsQR)return Promise.resolve(window.jsQR)
 return new Promise((resolve,reject)=>{
  const script=document.createElement("script")
  script.src="/vendor/jsQR-1.4.0.js"
  script.async=true
  script.onload=()=>window.jsQR?resolve(window.jsQR):reject(new Error("QR reader could not start."))
  script.onerror=()=>reject(new Error("QR reader unavailable. Refresh and try again."))
  document.head.appendChild(script)
 })
}
export default function CoachQrPage(){
 const [code,setCode]=useState(""),[verified,setVerified]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[cameraOn,setCameraOn]=useState(false),[showManual,setShowManual]=useState(false),[starting,setStarting]=useState(false)
 const video=useRef<HTMLVideoElement>(null)
 const upload=useRef<HTMLInputElement>(null)
 const timer=useRef<number|undefined>(undefined)
 useEffect(()=>{if(!cameraOn)return;let closed=false,stream:MediaStream|null=null,scanning=false
  const canvas=document.createElement("canvas")
  const ctx=canvas.getContext("2d",{willReadFrequently:true})
  async function start(){
   setStarting(true)
   try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera access is unavailable in this browser. Try Safari, or choose a QR photo below.")
    const decoder=await decoderReady()
    if(closed)return
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false})
    if(closed){stream.getTracks().forEach(t=>t.stop());return}
    if(!video.current)throw new Error("Camera preview unavailable.")
    video.current.srcObject=stream
    await video.current.play()
    setStarting(false)
    const tick=()=>{
     if(closed)return
     if(!scanning&&video.current&&ctx&&video.current.readyState>=2){
      scanning=true
      try{
       const w=video.current.videoWidth,h=video.current.videoHeight
       if(w&&h){
        const scale=Math.min(1,850/w),width=Math.round(w*scale),height=Math.round(h*scale)
        canvas.width=width;canvas.height=height
        ctx.drawImage(video.current,0,0,width,height)
        const pixels=ctx.getImageData(0,0,width,height)
        const result=decoder(pixels.data,width,height,{inversionAttempts:"attemptBoth"})
        if(result){
         try{setCode(readMemberCode(result.data));setVerified(null);setCameraOn(false);return}
         catch(e){setError(e instanceof Error?e.message:"Unsupported QR code");setCameraOn(false);return}
        }
       }
      }catch{}finally{scanning=false}
     }
     timer.current=window.setTimeout(tick,125)
    }
    tick()
   }catch(e){
    if(!closed){setError(e instanceof Error?e.message:"Camera permission denied. Check Safari camera access.");setCameraOn(false)}
   }finally{if(!closed)setStarting(false)}
  }
  void start()
  return()=>{closed=true;window.clearTimeout(timer.current);stream?.getTracks().forEach(track=>track.stop());if(video.current)video.current.srcObject=null}
 },[cameraOn])
 useEffect(()=>{if(!code||verified||busy)return;let active=true;const t=window.setTimeout(()=>{if(active)void act(false)},350);return()=>{active=false;window.clearTimeout(t)}},[code,verified,busy])
 async function act(confirm:boolean){setBusy(true);setError("");const {data,error:err}=await db.rpc("coach_qr_session",{p_member_code:code.trim(),p_confirm:confirm});setBusy(false);if(err){setError(err.message);setVerified(null)}else{setVerified(data as Result);if(confirm)setCameraOn(false)}}
 async function fileScan(file:File|undefined){
  if(!file)return
  setError("");setCameraOn(false);setVerified(null);setCode("")
  try{
   const decoder=await decoderReady()
   const bmp=await createImageBitmap(file)
   const canvas=document.createElement("canvas"),size=Math.min(1,1600/bmp.width)
   canvas.width=Math.round(bmp.width*size);canvas.height=Math.round(bmp.height*size)
   const ctx=canvas.getContext("2d")
   if(!ctx)throw new Error("Photo decoding unavailable")
   ctx.drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close()
   const result=decoder(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{inversionAttempts:"attemptBoth"})
   if(!result)throw new Error("QR code not found in the image. Try a sharper, well-lit photo.")
   setCode(readMemberCode(result.data))
  }catch(e){setError(e instanceof Error?e.message:"Unable to scan the selected photo")}
  if(upload.current)upload.current.value=""
 }
 function reset(){setCameraOn(false);setVerified(null);setCode("");setError("");setShowManual(false)}
 return <section className="mx-auto max-w-xl px-4 pb-28 pt-5 text-center md:px-6 lg:pb-8">
  <h1 className="text-2xl font-black">Scan QR</h1>
  <p className="mt-2 text-sm text-white/60">Scan an assigned member QR code. Review their details before recording any session.</p>
  <div className="mt-5 overflow-hidden rounded-[26px] border border-white/10 bg-[#171717] p-4">
   {cameraOn?<div className="relative"><video ref={video} autoPlay muted playsInline className="h-[55vh] max-h-[540px] min-h-[280px] w-full rounded-2xl bg-black object-cover"/>{starting&&<p className="absolute inset-x-3 top-3 rounded-xl bg-black/70 p-3 text-sm">Opening camera…</p>}</div>:
   <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl bg-[#101725] p-5">{verified?<p className="text-emerald-300">Member verified</p>:<p className="text-white/60">Camera paused</p>}</div>}
   {error&&<p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
   {!verified&&<div className="mt-4 flex flex-wrap justify-center gap-3">
    <button type="button" onClick={()=>{setError("");setCode("");setVerified(null);setCameraOn(v=>!v)}} disabled={busy||starting} className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold disabled:opacity-50">{cameraOn?"Stop Camera":"Open Camera"}</button>
    <button type="button" onClick={()=>upload.current?.click()} disabled={busy} className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold">Scan QR Photo</button>
    <input ref={upload} type="file" accept="image/*" className="hidden" aria-label="Select QR photo" onChange={e=>void fileScan(e.target.files?.[0])}/>
    <button type="button" onClick={()=>setShowManual(v=>!v)} className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold">{showManual?"Hide manual entry":"Enter code manually"}</button>
   </div>}
   {showManual&&!verified&&<label className="mt-4 block text-left text-sm text-white/70">Member code<input value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setVerified(null)}} placeholder="M0012" className="mt-2 w-full rounded-xl border border-white/20 bg-[#101725] p-3 text-white"/></label>}
   {busy&&<p role="status" className="mt-3 text-sm text-white/60">Verifying…</p>}
   {verified&&<div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5 text-left">
    <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">{verified.deducted?"Session recorded":"Verified client"}</p>
    <h2 className="mt-2 text-xl font-black">{verified.member_name}</h2>
    <p className="mt-2 text-sm text-white/65">{verified.member_code} · {verified.remaining} remaining sessions</p>
    {!verified.deducted&&<><p className="mt-4 text-sm text-amber-200">Confirm only after a completed training session. This deducts one real session.</p><button disabled={busy} onClick={()=>void act(true)} className="mt-3 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold disabled:opacity-40">Confirm &amp; deduct 1 session</button></>}
    <button type="button" onClick={reset} className="mt-3 ml-3 rounded-xl border border-white/20 px-4 py-3 text-sm">Scan another</button>
   </div>}
  </div>
 </section>
}
