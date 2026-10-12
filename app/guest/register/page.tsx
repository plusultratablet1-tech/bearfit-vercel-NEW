import GuestRegistrationClient from "./GuestRegistrationClient"

export default async function GuestRegistrationPage({searchParams}:{searchParams:Promise<{invite?:string}>}){
 const params=await searchParams
 return <GuestRegistrationClient token={params.invite||""}/>
}
