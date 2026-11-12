import {NextResponse} from "next/server"
import {randomBytes} from "node:crypto"
import {createClient as createSupabaseAdminClient} from "@supabase/supabase-js"
import {createClient} from "@/lib/supabase/server"
import {memberAliasEmail} from "@/lib/coach-login"

export const runtime="nodejs"

type Member={id:string;member_code:string;full_name:string;branch:string;user_id:string|null;is_demo:boolean}
const respond=(body:Record<string,unknown>,status=200)=>
 NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}})

export async function POST(request:Request){
 const session=await createClient()
 const {data:{user},error:authError}=await session.auth.getUser()
 if(authError||!user)return respond({error:"Please sign in as BearFit Admin"},401)
 const {data:profile,error:profileError}=await session.from("profiles").select("role").eq("id",user.id).maybeSingle()
 if(profileError||profile?.role!=="admin")return respond({error:"Admin access required"},403)

 let payload:{memberId?:unknown;action?:unknown}
 try{payload=await request.json()}catch{return respond({error:"Invalid request"},400)}
 const {memberId,action}=payload
 if(typeof memberId!=="string"||!/^[0-9a-f-]{36}$/i.test(memberId)||!["create","reset"].includes(String(action)))
  return respond({error:"Invalid member provisioning request"},400)

 // Never accept caller-supplied passwords, emails, roles or member codes.
 const {data:member,error:lookupError}=await session.from("members")
  .select("id,member_code,full_name,branch,user_id,is_demo")
  .eq("id",memberId).maybeSingle<Member>()
 if(lookupError)return respond({error:"Cannot read member; check Admin access"},503)
 if(!member||member.branch!=="Malingap Branch"||member.is_demo)return respond({error:"Eligible Malingap member not found"},404)
 const alias=memberAliasEmail(member.member_code)
 if(!alias)return respond({error:"Member ID is not valid for login"},409)

 const url=process.env.NEXT_PUBLIC_SUPABASE_URL
 const keys=[...new Set([process.env.BEARFIT_SUPABASE_SECRET_KEY,process.env.SUPABASE_SECRET_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY].filter((v):v is string=>Boolean(v?.trim())))]
 if(!url||keys.length===0)return respond({error:"Member provisioning needs a correctly configured server-only Supabase key"},503)
 let admin:ReturnType<typeof createSupabaseAdminClient>|null=null
 for(const key of keys){
  const candidate=createSupabaseAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:check,error}=await candidate.from("members").select("id,member_code").eq("id",member.id).maybeSingle()
  if(!error&&check?.id===member.id&&check.member_code===member.member_code){admin=candidate;break}
 }
 if(!admin)return respond({error:"Provisioning key cannot access the same BearFit member database"},503)

 const temporaryPassword=randomBytes(24).toString("base64url")
 if(action==="reset"){
  if(!member.user_id)return respond({error:"Member account has not been created"},409)
  const [{data:authUser,error:authLookupError},{data:linkedProfile,error:profileLookupError}]=await Promise.all([
   admin.auth.admin.getUserById(member.user_id),
   admin.from("profiles").select("id,role,member_id").eq("id",member.user_id).maybeSingle(),
  ])
  if(authLookupError||profileLookupError||authUser.user?.email?.toLowerCase()!==alias||linkedProfile?.role!=="member"||linkedProfile.member_id!==member.id)
   return respond({error:"Member login identity or profile does not match. No password was changed."},409)
  const {error:resetError}=await admin.auth.admin.updateUserById(member.user_id,{
   password:temporaryPassword,
   app_metadata:{...(authUser.user.app_metadata||{}),bearfit_must_change_password:true},
  })
  if(resetError)return respond({error:"Unable to reset member password"},502)
  return respond({memberCode:member.member_code,temporaryPassword,message:"New temporary password set. Give it privately to the verified member; change on first sign-in."})
 }
 if(member.user_id)return respond({error:"Member already has a login. Use Reset instead."},409)

 // A single-use token is consumed by the Auth INSERT trigger in the same
 // transaction as the existing member linking. No duplicate client is created.
 const {data:token,error:tokenError}=await session.rpc("admin_issue_member_signup_token",{p_member_id:member.id})
 if(tokenError||typeof token!=="string"||token.length!==64)
  return respond({error:"Member signup authorization not configured. Apply the reviewed migration first."},503)
 const {data:created,error:createError}=await admin.auth.admin.createUser({
  email:alias,
  password:temporaryPassword,
  email_confirm:true,
  app_metadata:{bearfit_member_alias:true,bearfit_must_change_password:true},
  user_metadata:{full_name:member.full_name,bearfit_member_signup_token:token},
 })
 if(createError||!created.user)
  return respond({error:"Supabase rejected creation; check reserved alias and Auth logs. No retry without checking existing links."},502)

 // Deleting the Auth user is dangerous: existing members.user_id has ON DELETE
 // CASCADE. Never delete a newly linked Auth account as a rollback.
 const createdId=created.user.id
 const [{data:linked,error:linkedError},{data:role,error:roleError}]=await Promise.all([
  admin.from("members").select("id,user_id,member_code").eq("id",member.id).maybeSingle(),
  admin.from("profiles").select("id,role,member_id").eq("id",createdId).maybeSingle(),
 ])
 if(linkedError||roleError||linked?.user_id!==createdId||role?.member_id!==member.id||role.role!=="member"){
  // No temporary password is disclosed for an unverified link.
  await admin.auth.admin.updateUserById(createdId,{ban_duration:"876000h"})
  return respond({error:"Created Auth account could not be verified and was disabled; admin review required. Client record was not deleted."},503)
 }
 await admin.auth.admin.updateUserById(createdId,{
  user_metadata:{full_name:member.full_name},
 })
 return respond({
  memberCode:member.member_code,temporaryPassword,
  message:"Member ID login created and linked. Share password privately; change required at first login.",
 },201)
}
