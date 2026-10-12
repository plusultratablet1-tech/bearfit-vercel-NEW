import {redirect} from "next/navigation"
import {createClient} from "@/lib/supabase/server"
import GuestControlClient from "./GuestControlClient"

export default async function AdminGuestPassPage(){
 const supabase=await createClient()
 const {data:{user}}=await supabase.auth.getUser()
 if(!user)redirect("/login")
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle()
 if(profile?.role!=="admin")redirect("/launch")
 return <GuestControlClient/>
}
