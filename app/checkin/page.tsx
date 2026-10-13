import {getStaffAccess} from "@/lib/staff-access-server"
import CheckInPageClient from "./CheckInPageClient"

export default async function CheckInPage(){
 const {role}=await getStaffAccess()
 return <CheckInPageClient role={role}/>
}
