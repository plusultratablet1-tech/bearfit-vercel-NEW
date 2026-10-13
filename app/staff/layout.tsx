import type {ReactNode} from "react"
import {getStaffAccess} from "@/lib/staff-access-server"
import StaffPersistentShell from "@/components/bearfit/StaffPersistentShell"

export default async function StaffLayout({children}:{children:ReactNode}){
 const {role}=await getStaffAccess()
 return <StaffPersistentShell role={role}>{children}</StaffPersistentShell>
}
