import {getStaffAccess} from "@/lib/staff-access-server"
import CoachesPageClient from "./CoachesPageClient"

export default async function CoachesPage(){
 const {role}=await getStaffAccess()
 return <CoachesPageClient role={role}/>
}
