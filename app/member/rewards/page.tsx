import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import MemberRewardsPageClient from "./MemberRewardsPageClient"

export default async function MemberRewardsPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role === "staff" || profile?.role === "admin") redirect("/staff/rewards")

  const { data, error } = await supabase.rpc("member_rewards_snapshot")
  return <MemberRewardsPageClient initialSnapshot={(data ?? null) as MemberRewardsSnapshot | null} initialError={error?.message ?? null} />
}

export type RewardCatalogItem = {
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
  can_afford: boolean
  membership_eligible: boolean
}

export type RewardRequestItem = {
  id: string
  reward_id: string
  reward_title: string
  reward_category: string
  image_url: string | null
  season_key: string
  points_cost: number
  status: "pending" | "approved" | "rejected" | "cancelled" | "claimed"
  requested_at: string
  decided_at: string | null
  claimed_at: string | null
  decision_note: string | null
}

export type MemberRewardsSnapshot = {
  summary: {
    season_key: string
    season_balance: number
    season_earned: number
    season_spent: number
    season_ends_at: string | null
    lifetime_points: number
  }
  reserved_points: number
  available_points: number
  catalog: RewardCatalogItem[]
  requests: RewardRequestItem[]
}
