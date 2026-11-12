import {NextResponse} from "next/server"
import {createClient} from "@/lib/supabase/server"
import {createClient as createAdmin} from "@supabase/supabase-js"
export const runtime="nodejs"
const reply=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}})

export async function POST(request:Request){
 const session=await createClient()
 const {data:{user},error:authError}=await session.auth.getUser()
 if(authError||!user)return reply({error:"Sign in to your own member account first"},401)
 const {data:profile,error:roleError}=await session.from("profiles").select("role,member_id").eq("id",user.id).maybeSingle()
 if(roleError||profile?.role!=="member"||!profile.member_id)return reply({error:"Linked member login required"},403)
 const {data:member}=await session.from("members").select("id,user_id").eq("id",profile.member_id).maybeSingle()
 if(member?.user_id!==user.id)return reply({error:"Member identity could not be verified"},403)

 let body:{password?:unknown;confirmPassword?:unknown}
 try{body=await request.json()}catch{return reply({error:"Invalid request"},400)}
 if(typeof body.password!=="string"||body.password.length<12||body.password.length>128)
  return reply({error:"Choose a new password between 12 and 128 characters"},400)
 if(body.confirmPassword!==body.password)return reply({error:"Passwords do not match"},400)
 if(!/[a-z]/i.test(body.password)||!/[0-9]/.test(body.password))
  return reply({error:"Include both letters and numbers in your new password"},400)

 // Supabase's authenticated-user password update enforces any re-auth policy
 // configured on the project. Never store or log the plaintext password.
 const {error:updateError}=await session.auth.updateUser({password:body.password})
 if(updateError)return reply({error:updateError.message},400)

 // The app-metadata gate is admin-controlled and cannot be modified through
 // user metadata. Remove only the forced-change flag after success.
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL
 const keys=[...new Set([process.env.BEARFIT_SUPABASE_SECRET_KEY,process.env.SUPABASE_SECRET_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY].filter((v):v is string=>Boolean(v?.trim())))]
 let cleared=false
 if(url)for(const key of keys){
  const admin=createAdmin(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:check,error:e}=await admin.from("members").select("id,user_id").eq("id",member.id).maybeSingle()
  if(e||check?.user_id!==user.id)continue
  const {data:current,error:userError}=await admin.auth.admin.getUserById(user.id)
  if(userError||!current.user)continue
  const {error:clearError}=await admin.auth.admin.updateUserById(user.id,{
   app_metadata:{...(current.user.app_metadata||{}),bearfit_must_change_password:false}
  })
  if(!clearError)cleared=true
  break
 }
 if(!cleared)return reply({error:"Password changed, but first-login completion could not be confirmed. Contact Admin for help."},503)
 await session.auth.signOut()
 return reply({message:"Password changed successfully. Sign in again using your Member ID and new password.",redirectTo:"/login"})
}
