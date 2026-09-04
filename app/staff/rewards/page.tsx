import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import StaffRewardsPageClient from "./StaffRewardsPageClient"

export default async function StaffRewardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = profile?.role ?? "member"
  if (role !== "staff" && role !== "admin") redirect("/member/dashboard")
  const { data, error } = await supabase.rpc("staff_reward_snapshot")
  return <StaffRewardsPageClient role={role} initialSnapshot={(data ?? null) as StaffRewardSnapshot | null} initialError={error?.message ?? null} />
}

export type StaffRewardCatalogItem = {
  id: string
  title: string
  description: string
  category: string
  image_url: string | null
  points_cost: number
  stock_quantity: number | null
  reserved_quantity: number
  redeemed_quantity: number
  available_stock: number | null
  requires_active_membership: boolean
  active: boolean
  created_at: string
  updated_at: string
}

export type StaffRewardRequestItem = {
  id: string
  member_id: string
  member_code: string
  member_name: string
  member_is_demo: boolean
  reward_id: string
  reward_title: string
  reward_category: string
  season_key: string
  points_cost: number
  status: "pending" | "approved" | "rejected" | "cancelled" | "claimed"
  requested_at: string
  decided_at: string | null
  claimed_at: string | null
  decision_note: string | null
  bearforce_redemption_id: string | null
}

export type StaffRewardSnapshot = {
  catalog: StaffRewardCatalogItem[]
  requests: StaffRewardRequestItem[]
}
