import {getStaffAccess} from "@/lib/staff-access-server"
import StaffPackagesPageClient, {
  type StaffPackageAttentionItem,
  type StaffPackageSnapshot,
} from "./StaffPackagesPageClient"

export default async function StaffPackagesPage() {
  const {supabase,role}=await getStaffAccess()

  const [catalogResult, attentionResult] = await Promise.all([
    supabase.rpc("staff_package_catalog"),
    supabase.rpc("staff_package_attention_queue"),
  ])

  return (
    <StaffPackagesPageClient
      role={role as "staff" | "admin"}
      initialSnapshot={(catalogResult.data ?? { packages: [], stages: [] }) as StaffPackageSnapshot}
      initialAttention={(attentionResult.data ?? []) as StaffPackageAttentionItem[]}
      initialError={catalogResult.error?.message ?? attentionResult.error?.message ?? null}
    />
  )
}
