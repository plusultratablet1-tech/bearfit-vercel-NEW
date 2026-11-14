import {redirect} from "next/navigation"
import {getStaffAccess} from "@/lib/staff-access-server"
import AdminFreezesClient from "./AdminFreezesClient"

export default async function AdminFreezesPage(){
  const {supabase,role}=await getStaffAccess()
  if(role!=="admin") redirect("/staff/packages")
  const {data,error}=await supabase.from("package_freeze_requests")
    .select("*,members(member_code,full_name),member_package_cycles(starts_at,expires_at)")
    .order("requested_at",{ascending:false}).limit(100)
  return <AdminFreezesClient initialRequests={data??[]} loadError={error?.message??null}/>
}
