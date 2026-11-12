import {redirect} from "next/navigation"
import {createClient} from "@/lib/supabase/server"
import MemberChangePassword from "./MemberChangePassword"

export default async function ChangePasswordPage(){
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)redirect("/login")
 const {data:profile}=await db.from("profiles").select("role,member_id").eq("id",user.id).maybeSingle()
 if(profile?.role!=="member"||!profile.member_id)redirect("/launch")
 return <main className="flex min-h-screen items-center justify-center bg-[#090c12] p-4 text-white">
  <section className="w-full max-w-md rounded-3xl border border-orange-500/25 bg-[#161616] p-6">
   <h1 className="text-2xl font-black">Secure your BearFit login</h1>
   <p className="mt-3 text-sm text-white/55">Change your temporary password before accessing your personal membership information. Use 12 or more characters including letters and numbers.</p>
   <MemberChangePassword/>
  </section>
 </main>
}
