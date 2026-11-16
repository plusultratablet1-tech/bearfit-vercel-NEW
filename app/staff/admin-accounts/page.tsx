import { redirect } from "next/navigation"
import { getStaffAccess } from "@/lib/staff-access-server"
import Admin1ProvisionClient from "./Admin1ProvisionClient"

export const dynamic = "force-dynamic"

export default async function AdminAccountsPage() {
  const { role } = await getStaffAccess()
  if (role !== "admin") redirect("/staff/schedule")
  return <Admin1ProvisionClient />
}
