"use client"
import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import StaffPersistentShell from "@/components/bearfit/StaffPersistentShell"

// Legacy wrapper remains compatible with the original /payments and /checkin URLs.
// Staff routes have a single shared shell via /staff/layout.tsx.
export default function StaffAppShell({role,children}:{activePath:string;role:"staff"|"admin";children:ReactNode}){
  const pathname=usePathname()
  if(pathname.startsWith("/staff/")||pathname==="/staff")return <>{children}</>
  return <StaffPersistentShell role={role}>{children}</StaffPersistentShell>
}
