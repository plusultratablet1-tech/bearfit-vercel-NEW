import {redirect} from "next/navigation"
import {getStaffAccess} from "@/lib/staff-access-server"
import VerifyFreezeDatesClient from "./VerifyFreezeDatesClient"

export default async function VerifyFreezeDatesPage(){
  const {supabase,role}=await getStaffAccess()
  if(role!=="admin")redirect("/staff/packages")
  const {data,error}=await supabase.from("member_package_cycles")
    .select("id,status,starts_at,expires_at,package_definitions(name,validity_days),members(member_code,full_name,branch)")
    .eq("status","active").is("expires_at",null).order("created_at",{ascending:false}).limit(200)
  return <VerifyFreezeDatesClient cycles={data??[]} loadError={error?.message??null}/>
}
