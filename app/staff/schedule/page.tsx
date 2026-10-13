import {getStaffAccess} from "@/lib/staff-access-server"
import StaffSchedulePageClient from "./StaffSchedulePageClient"

export default async function StaffSchedulePage(){
 const {role,user}=await getStaffAccess()
 return <StaffSchedulePageClient role={role} currentUserId={user.id}/>
}
