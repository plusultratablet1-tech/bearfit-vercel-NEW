import { createClient } from "@/lib/supabase/server"
import type { BearforceSummary } from "@/lib/member-account"

export type BearforceHistoryItem = {
  id: string
  kind: "earned" | "redeemed"
  label: string
  points_delta: number
  occurred_at: string
  event_type: string
  status: string
  source_type: string
  source_id: string
  metadata?: Record<string, unknown>
}

export type BearforceSeasonItem = {
  season_key: string
  earned: number
  spent: number
  balance: number
  prestige: {
    name: string
    next_name: string | null
    next_threshold: number | null
    points_to_next: number
    progress_percent: number
  }
}

export type MemberBearforceData = {
  summary: BearforceSummary | null
  history: BearforceHistoryItem[]
  seasons: BearforceSeasonItem[]
  error: string | null
}

export async function loadMemberBearforceData(): Promise<MemberBearforceData> {
  const supabase = await createClient()
  const [summaryResult, historyResult, seasonsResult] = await Promise.all([
    supabase.rpc("member_bearforce_summary"),
    supabase.rpc("member_bearforce_history", { p_limit: 100 }),
    supabase.rpc("member_bearforce_seasons"),
  ])

  if (summaryResult.error) console.error("Failed to load Bearforce summary", summaryResult.error)
  if (historyResult.error) console.error("Failed to load Bearforce history", historyResult.error)
  if (seasonsResult.error) console.error("Failed to load Bearforce seasons", seasonsResult.error)

  return {
    summary: summaryResult.error ? null : (summaryResult.data as BearforceSummary | null),
    history: historyResult.error ? [] : ((historyResult.data ?? []) as unknown as BearforceHistoryItem[]),
    seasons: seasonsResult.error ? [] : ((seasonsResult.data ?? []) as unknown as BearforceSeasonItem[]),
    error: summaryResult.error || historyResult.error || seasonsResult.error ? "Some Bearforce progress could not be loaded." : null,
  }
}
