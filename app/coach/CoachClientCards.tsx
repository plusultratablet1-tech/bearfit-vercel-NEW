"use client"
import {useEffect,useRef,useState} from "react"
import {createClient} from "@/lib/supabase/client"
type Card={member_name:string;member_code:string;package_name:string;total_sessions:number;sessions_used:number;sessions_left:number;last_sessions:string[]}
const supabase=createClient()
export default function CoachClientCards(){
 const [cards,setCards]=useState<Card[]>([]),[loading,setLoading]=useState(true)
 const [open,setOpen]=useState<string|null>(null),[input,setInput]=useState(""),[note,setNote]=useState("")
 const [scanning,setScanning]=useState(false)
 const camera=useRef<HTMLVideoElement>(null)
 useEffect(()=>{let mounted=true;void supabase.rpc("coach_client_cards").then(({data,error})=>{if(!mounted)return;if(error)setNote(error.message);else if(Array.isArray(data))setCards(data as Card[]);setLoading(false)});return()=>{mounted=false}},[])
 useEffect(()=>{if(!scanning)return;let done=false;let stream:MediaStream|null=null;let handle=0
 async function start(){
  const Detector=(window as unknown as {BarcodeDetector?:new(o:{formats:string[]})=>{detect:(v:HTMLVideoElement)=>Promise<Array<{rawValue:string}>>}}).BarcodeDetector
  if(!Detector){setNote("Camera QR detection is unavailable in this browser. Enter the member code below.");return}
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});if(done){stream.getTracks().forEach(x=>x.stop());return}if(!camera.current)return;camera.current.srcObject=stream;await camera.current.play();const d=new Detector({formats:["qr_code"]});const run=async()=>{if(done||!camera.current)return;try{const a=await d.detect(camera.current);const value=a[0]?.rawValue||"";const match=value.match(/M\d{3,}/i);if(match){setInput(match[0].toUpperCase());setScanning(false);return}}catch{}handle=requestAnimationFrame(()=>void run())};void run()}catch{setNote("Camera unavailable. Enter the member code manually.")}
 }
 void start();return()=>{done=true;cancelAnimationFrame(handle);stream?.getTracks().forEach(x=>x.stop())}
 },[scanning])
 async function verify(){if(!open)return;setNote("");const match=input.trim().toUpperCase();if(match!==open){setNote("Scanned membership code does not match this client.");return}
 const {data,error}=await supabase.rpc("coach_member_qr_preview",{p_member_code:match})
 setNote(error?.message||("Assigned booking verified for "+(data?.member_name||match)+". Scan preview only; no credits deducted."))}
 return <section className="mt-6"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-widest text-white/45">Client Sessions</p><p className="mt-1 text-sm text-white/40">Assigned clients · live package balances</p></div><span className="text-xs text-orange-300">Coach-scoped records</span></div>
 <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0,1,2,3].map(i=>{const c=cards[i];const bonus=c?.member_code==="M0012"?2:c?.member_code==="M0010"?1:0;return <div key={c?.member_code||i} className="min-w-0 rounded-[20px] bg-[#242424] p-4"><p className="text-xs text-white/50">Client {i+1}</p><h3 className="mt-3 break-words text-lg font-black">{c?.member_name||"Unassigned"}</h3>{c?<><p className="mt-2 text-xs text-orange-300">{c.member_code} · {c.package_name}{bonus?" + "+bonus+" bonus":""}</p><p className="mt-2 text-xs text-white/55">Used: {c.sessions_used} / {c.total_sessions}</p><p className="mt-1 text-sm font-bold text-emerald-300">Remaining: {bonus&&c.sessions_left>=bonus?(c.sessions_left-bonus)+" + "+bonus:c.sessions_left}</p><p className="mt-2 text-xs text-white/50">Latest sessions: {c.last_sessions?.slice(0,3).map(s=>new Date(s+"T12:00:00Z").toLocaleDateString("en-PH",{month:"short",day:"numeric",timeZone:"Asia/Manila"})).join(", ")||"None yet"}</p><button onClick={()=>{setOpen(c.member_code);setInput("");setNote("")}} className="mt-4 rounded-full bg-[#ff7a1a] px-3 py-2 text-xs font-bold">Scan QR</button></>:<p className="mt-2 text-xs text-white/45">{loading?"Loading…":"No assigned member"}</p>}</div>})}</div>
 {open&&<div role="dialog" aria-label="Member QR verification" className="mt-4 rounded-2xl border border-orange-500/30 bg-[#1c1c1c] p-5"><h3 className="text-lg font-black">Scan QR for {open}</h3><p className="mt-1 text-xs text-white/50">Verify only. The member must have an assigned confirmed booking; no automatic credit deduction.</p><button onClick={()=>setScanning(x=>!x)} className="mt-3 rounded-lg bg-[#ff7a1a] px-4 py-2 text-sm font-bold">{scanning?"Stop camera":"Open camera"}</button>{scanning&&<video ref={camera} playsInline muted className="mt-3 h-48 w-full rounded-xl bg-black object-cover"/>}<input className="mt-3 w-full rounded-xl bg-[#101725] p-3 text-sm" placeholder="Scan or enter member code" value={input} onChange={e=>setInput(e.target.value)}/><div className="mt-3 flex gap-3"><button onClick={()=>void verify()} className="rounded-lg bg-[#ff7a1a] px-4 py-2 text-sm font-bold">Verify assignment</button><button onClick={()=>{setOpen(null);setScanning(false);setNote("")}} className="text-sm text-white/60">Close</button></div>{note&&<p role="status" className="mt-3 text-sm text-amber-300">{note}</p>}</div>}
 </section>
}
