import {redirect} from "next/navigation"
import {getStaffAccess} from "@/lib/staff-access-server"
import CoachAttendanceAdminClient from "./CoachAttendanceAdminClient"

export default async function AdminCoachAttendancePage(){
 const {role}=await getStaffAccess()
 if(role!=="admin") redirect("/staff/coaches")
 return <CoachAttendanceAdminClient/>
}
