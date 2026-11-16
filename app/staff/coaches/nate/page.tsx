import { redirect } from "next/navigation"
import { getStaffAccess } from "@/lib/staff-access-server"
import CoachNateProvisionClient from "./CoachNateProvisionClient"

export const dynamic = "force-dynamic"

export default async function CoachNateSetupPage() {
  const { role } = await getStaffAccess()
  if (role!=="admin") redirect("/staff/schedule")
  return <CoachNateProvisionClient />
}
