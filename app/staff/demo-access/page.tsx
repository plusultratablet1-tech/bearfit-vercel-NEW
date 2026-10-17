import { redirect } from "next/navigation"
import { getStaffAccess } from "@/lib/staff-access-server"
import DemoNathanActivation from "./DemoNathanActivation"

export default async function DemoNathanAccessPage() {
  const { role } = await getStaffAccess()
  if (role !== "admin") redirect("/staff/schedule")
  return <DemoNathanActivation />
}
