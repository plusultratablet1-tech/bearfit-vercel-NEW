import {NextResponse} from "next/server"
import {randomBytes} from "node:crypto"
import {createClient as createAdminClient} from "@supabase/supabase-js"
import {createClient} from "@/lib/supabase/server"
import {memberAliasEmail} from "@/lib/coach-login"

export const runtime="nodejs"

type MemberRecord={
  id:string;member_code:string;full_name:string;branch:string;
  membership_status:string|null;status:string|null;
  is_demo:boolean;user_id:string|null;
}
function reply(data:Record<string,unknown>,status=200){
  return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store, private"}})
}
export async function POST(request:Request){
  // Require a REAL logged-in BearFit Admin for all account actions.
  const session=await createClient()
  const {data:{user},error:authError}=await session.auth.getUser()
  if(authError||!user)return reply({error:"Admin login required"},401)
  const {data:adminProfile}=await session.from("profiles").select("role").eq("id",user.id).maybeSingle()
  if(adminProfile?.role!=="admin")return reply({error:"Admin access required"},403)

  let body:{memberId?:unknown;action?:unknown}
  try{body=await request.json()}catch{return reply({error:"Invalid request"},400)}
  const {memberId,action}=body
  if(typeof memberId!=="string"||!/^[0-9a-f-]{36}$/i.test(memberId)
    ||(action!=="create"&&action!=="reset"))return reply({error:"Invalid member action"},400)

  const {data:member,error:memberError}=await session.from("members")
    .select("id,member_code,full_name,branch,membership_status,status,is_demo,user_id")
    .eq("id",memberId).maybeSingle<MemberRecord>()
  if(memberError||!member)return reply({error:"Member record not accessible to Admin"},404)
  if(member.is_demo||member.branch!=="Malingap Branch"
    ||member.membership_status?.toLowerCase()!=="active"
    ||member.status?.toLowerCase()!=="active")
    return reply({error:"Only active, real Malingap members are eligible"},409)
  const email=memberAliasEmail(member.member_code)
  if(!email)return reply({error:"Member code is not supported"},400)

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const serverKeys=[...new Set(
    [process.env.BEARFIT_SUPABASE_SECRET_KEY,
     process.env.SUPABASE_SECRET_KEY,
     process.env.SUPABASE_SERVICE_ROLE_KEY].filter((s):s is string=>Boolean(s?.trim()))
  )]
  if(!url||serverKeys.length===0)return reply({error:"Member account service is not configured"},503)
  let privileged=createAdminClient(url,serverKeys[0],{auth:{persistSession:false,autoRefreshToken:false}})
  let privilegedVerified=false
  for(const key of serverKeys){
    const candidate=createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:serverMember,error:readError}=await candidate.from("members")
      .select("id,member_code,user_id").eq("id",member.id).maybeSingle()
    if(!readError&&serverMember?.id===member.id&&serverMember?.member_code===member.member_code){
      privileged=candidate
      privilegedVerified=true
      break
    }
  }
  if(!privilegedVerified)return reply({error:"Member account service cannot access this project. Check the server-only Supabase key."},503)

  const password=randomBytes(24).toString("base64url")
  if(action==="reset"){
    if(!member.user_id)return reply({error:"Member login has not been created yet"},409)
    const {data:profile}=await privileged.from("profiles").select("role,member_id").eq("id",member.user_id).maybeSingle()
    const {data:existing,error:lookupError}=await privileged.auth.admin.getUserById(member.user_id)
    if(profile?.role!=="member"||profile.member_id!==member.id||lookupError
      ||existing.user?.email?.toLowerCase()!==email)
      return reply({error:"Member identity could not be verified; password not changed"},409)
    const {error:resetError}=await privileged.auth.admin.updateUserById(member.user_id,{password})
    if(resetError)return reply({error:"Could not reset member password"},503)
    return reply({username:member.member_code,temporaryPassword:password,
      message:"Password reset. Share the new password privately with this member."})
  }
  if(member.user_id)return reply({error:"Member already has an account. Use Reset Password."},409)

  // The production Auth trigger requires this Admin-issued, one-time token.
  // It links the new login atomically to the PREEXISTING member row.
  const {data:signupToken,error:tokenError}=await session.rpc(
    "admin_issue_member_signup_token",{p_member_id:member.id}
  )
  if(tokenError||typeof signupToken!=="string"||signupToken.length!==64)
    return reply({error:"Member signup authorization is unavailable. Check the database migration."},503)
  const {data:created,error:createError}=await privileged.auth.admin.createUser({
    email,password,email_confirm:true,
    user_metadata:{full_name:member.full_name,bearfit_member_signup_token:signupToken},
    app_metadata:{bearfit_member_login:true}
  })
  if(createError||!created.user)
    return reply({error:"Supabase Auth could not create this member login. No existing member details were replaced."},502)

  const authId=created.user.id
  const [{data:linked}, {data:profile}]=await Promise.all([
    privileged.from("members").select("id,user_id").eq("id",member.id).maybeSingle(),
    privileged.from("profiles").select("id,role,member_id").eq("id",authId).maybeSingle()
  ])
  if(linked?.user_id!==authId||profile?.role!=="member"||profile.member_id!==member.id){
    // NEVER delete an Auth user here: existing members.user_id has ON DELETE CASCADE.
    // An automatic delete could remove a real member record and all related activity.
    return reply({error:"Account creation needs Admin review: linkage verification failed. No automatic deletion was attempted."},503)
  }
  // The token is single use and already consumed; remove it from user metadata.
  await privileged.auth.admin.updateUserById(authId,{user_metadata:{full_name:member.full_name}})
  return reply({username:member.member_code,temporaryPassword:password,
    message:"Existing member login created and verified. Password is shown only now."},201)
}
