import {redirect} from "next/navigation"
import {getStaffAccess} from "@/lib/staff-access-server"
import GuestControlClient from "./GuestControlClient"

export default async function AdminGuestPassPage(){
 const {role}=await getStaffAccess()
 if(role!=="admin") redirect("/launch")
 return <GuestControlClient/>
}
