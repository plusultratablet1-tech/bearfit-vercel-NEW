"use client"
import { useMemo } from "react"
import { GUEST_QR_PREFIX,guestQrMatrix,parseGuestCode } from "@/lib/guest-qr"

export default function GuestQRCode({token}:{token:string}){
  const valid=parseGuestCode(token)
  const matrix=useMemo(()=>valid?guestQrMatrix(GUEST_QR_PREFIX+valid):null,[valid])
  if(!matrix)return <p role="alert">Invalid guest pass code.</p>
  const quiet=4
  const dimension=matrix.length+quiet*2
  return <svg role="img" aria-label="One-time BearFit guest entry QR code"
    width={256} height={256} viewBox={"0 0 "+dimension+" "+dimension}
    xmlns="http://www.w3.org/2000/svg" className="mx-auto h-56 w-56 rounded-lg bg-white p-2">
    <rect x="0" y="0" width={dimension} height={dimension} fill="#fff"/>
    {matrix.flatMap((row,y)=>row.map((dark,x)=>dark?
      <rect key={x+"-"+y} x={x+quiet} y={y+quiet} width={1} height={1} fill="#000"/>:null))}
  </svg>
}
