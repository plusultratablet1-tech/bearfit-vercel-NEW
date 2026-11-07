"use client"
import {useEffect,useState} from "react"
import {createClient} from "@/lib/supabase/client"
import {BRANCH_IDS} from "@/lib/branches"
const db=createClient()
type BranchConfig={branch:string;latitude:number;longitude:number;radius_m:number;enabled:boolean}
export default function CoachGpsAdminSettings(){
 const [configs,setConfigs]=useState<BranchConfig[]>([]),[branch,setBranch]=useState<string>(BRANCH_IDS[0]),[lat,setLat]=useState(""),[lng,setLng]=useState(""),[radius,setRadius]=useState("200"),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("")
 async function load(){const r=await db.rpc("admin_coach_gps_settings");if(r.error)setMessage(r.error.message);else setConfigs((r.data||[]) as BranchConfig[])}
 useEffect(()=>{void load()},[])
 function select(value:string){setBranch(value);const c=configs.find(x=>x.branch===value);setLat(c?String(c.latitude):"");setLng(c?String(c.longitude):"");setRadius(c?String(c.radius_m):"200");setEnabled(Boolean(c?.enabled))}
 useEffect(()=>{const c=configs.find(x=>x.branch===branch);if(c){setLat(String(c.latitude));setLng(String(c.longitude));setRadius(String(c.radius_m));setEnabled(c.enabled)}},[configs,branch])
 async function locate(){setMessage("");if(!navigator.geolocation){setMessage("Location unavailable in this browser.");return}setBusy(true);navigator.geolocation.getCurrentPosition(p=>{setLat(String(p.coords.latitude));setLng(String(p.coords.longitude));setEnabled(false);setBusy(false);setMessage("Device location captured. Verify that you are physically inside the selected gym and check the map before enabling.")},e=>{setBusy(false);setMessage(e.message)},{enableHighAccuracy:true,timeout:15000,maximumAge:0})}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");const r=await db.rpc("admin_update_coach_gps_settings",{p_branch:branch,p_latitude:Number(lat),p_longitude:Number(lng),p_radius_m:Number(radius),p_enabled:enabled});setBusy(false);if(r.error)setMessage(r.error.message);else{setMessage("Branch GPS settings saved. Coaches can clock in only if enabled and assigned a shift.");await load()}}
 return <section className="mt-6 rounded-[24px] border border-orange-500/20 bg-[#141414] p-5">
 <h2 className="text-xl font-black">GPS Attendance — Branch Setup</h2><p className="mt-2 text-sm text-white/55">Reception-free check-in. Configure each gym's exact location; GPS attendance stays disabled until you enable it. No location is guessed.</p>
 <form onSubmit={e=>void save(e)} className="mt-4 grid gap-3 md:grid-cols-2">
 <label className="text-xs text-white/60">Branch<select value={branch} onChange={e=>select(e.target.value)} className="mt-2 w-full rounded-xl bg-[#242424] p-3">{BRANCH_IDS.map(v=><option key={v}>{v}</option>)}</select></label>
 <label className="text-xs text-white/60">Radius (metres)<input type="number" min="100" max="500" required value={radius} onChange={e=>setRadius(e.target.value)} className="mt-2 w-full rounded-xl bg-[#242424] p-3"/></label>
 <label className="text-xs text-white/60">Latitude<input type="number" step="any" min="-90" max="90" required value={lat} onChange={e=>setLat(e.target.value)} className="mt-2 w-full rounded-xl bg-[#242424] p-3"/></label>
 <label className="text-xs text-white/60">Longitude<input type="number" step="any" min="-180" max="180" required value={lng} onChange={e=>setLng(e.target.value)} className="mt-2 w-full rounded-xl bg-[#242424] p-3"/></label>
 <button type="button" disabled={busy} onClick={()=>void locate()} className="rounded-xl border border-white/15 px-4 py-3 text-sm">Use my location (only when at this gym)</button>
 <label className="flex items-center gap-3 rounded-xl bg-[#242424] p-3 text-sm"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enable GPS attendance for this branch</label>
 <button disabled={busy||!lat||!lng} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold md:col-span-2">Save GPS Settings</button></form>
 {lat&&lng&&<a className="mt-3 inline-block text-sm text-orange-300 underline" target="_blank" rel="noopener noreferrer" href={"https://www.openstreetmap.org/?mlat="+encodeURIComponent(lat)+"&mlon="+encodeURIComponent(lng)+"#map=18/"+encodeURIComponent(lat)+"/"+encodeURIComponent(lng)}>Review chosen point on map ↗</a>}
 {message&&<p role="status" className="mt-3 text-sm text-amber-200">{message}</p>}
 </section>
}
