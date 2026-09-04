import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/database.types"

export type MemberRow = Database["public"]["Tables"]["members"]["Row"]
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"]
export type SessionLogRow = Database["public"]["Tables"]["session_logs"]["Row"]
export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"]

export type PackageAlert = { serviceCategory: string; warningLevel?: string | null; message?: string | null; blockingReason?: string | null }

export type BearforceProgress = {
  name: string
  next_name: string | null
  next_threshold: number | null
  points_to_next: number
  progress_percent: number
}

export type BearforceSummary = {
  lifetime_points: number
  season_key: string
  season_starts_at: string | null
  season_ends_at: string | null
  season_earned: number
  season_spent: number
  season_balance: number
  weekly_goal: number
  current_week_sessions: number
  weekly_goal_met: boolean
  streak_weeks: number
  grace_week_active: boolean
  fitness_tier: BearforceProgress
  prestige: BearforceProgress
}


export function displayPackageNameForMember(member: MemberRow | null, fallbackName: string) {
  if (member?.is_demo && (/^legacy/i.test(fallbackName) || /test 5 sessions/i.test(fallbackName) || fallbackName === "QA Demo Package")) return "QA Demo Package"
  return fallbackName
}

export type MemberAccountData = {
  member: MemberRow | null
  profile: ProfileRow | null
  payments: PaymentRow[]
  sessionLogs: SessionLogRow[]
  upcomingBookings: BookingRow[]
  coachNames: Record<string, string>
  packageEligibility: Record<string, unknown>
  packageAlerts: PackageAlert[]
  bearforceSummary: BearforceSummary | null
  loadError: string | null
}

export async function loadMemberAccountData(userId: string): Promise<MemberAccountData> {
  const supabase = await createClient()

  const [profileResult, memberResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("members").select("*").eq("user_id", userId).maybeSingle(),
  ])

  if (profileResult.error) {
    console.error("Failed to load BearFit profile", profileResult.error)
  }

  if (memberResult.error) {
    console.error("Failed to load BearFit member", memberResult.error)
  }

  const profile = (profileResult.data ?? null) as ProfileRow | null
  const member = (memberResult.data ?? null) as MemberRow | null

  if (profileResult.error || memberResult.error) {
    return {
      member,
      profile,
      payments: [],
      sessionLogs: [],
      upcomingBookings: [],
      coachNames: {},
      packageEligibility: {},
      packageAlerts: [],
      bearforceSummary: null,
      loadError: "We couldn't load your membership details right now.",
    }
  }

  if (!member) {
    return {
      member: null,
      profile,
      payments: [],
      sessionLogs: [],
      upcomingBookings: [],
      coachNames: {},
      packageEligibility: {},
      packageAlerts: [],
      bearforceSummary: null,
      loadError: null,
    }
  }

  const [sessionsResult, paymentsResult, bookingsResult, bearforceResult] = await Promise.all([
    supabase
      .from("session_logs")
      .select("*")
      .eq("member_id", member.id)
      .order("trained_at", { ascending: false })
      .limit(10),
    supabase
      .from("payments")
      .select("*")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("bookings")
      .select("*")
      .eq("member_id", member.id)
      .eq("status", "confirmed")
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(3),
    supabase.rpc("member_bearforce_summary"),
  ])

  if (sessionsResult.error) {
    console.error("Failed to load BearFit session logs", sessionsResult.error)
  }

  if (paymentsResult.error) {
    console.error("Failed to load BearFit payments", paymentsResult.error)
  }

  if (bearforceResult.error) {
    console.error("Failed to load Bearforce progression", bearforceResult.error)
  }

  const upcomingBookings = (bookingsResult.data ?? []) as BookingRow[]
  const coachIds = new Set(upcomingBookings.map((booking) => booking.assigned_coach_user_id).filter((id): id is string => Boolean(id)))
  const coachNames: Record<string, string> = {}
  if (coachIds.size > 0) {
    const { data: coachDirectory, error: coachError } = await supabase.rpc("member_coach_directory")
    if (coachError) {
      console.error("Failed to load BearFit coach names", coachError)
    } else {
      for (const coach of coachDirectory ?? []) {
        if (coachIds.has(coach.id)) coachNames[coach.id] = coach.full_name
      }
    }
  }

  const packageEligibility: Record<string, unknown> = {}
  const packageAlerts: PackageAlert[] = []
  for (const serviceCategory of ["fitness", "pilates_group", "pilates_1on1"]) {
    const { data } = await supabase.rpc("member_package_eligibility", { p_service_category: serviceCategory })
    if (data && typeof data === "object" && !Array.isArray(data)) {
      packageEligibility[serviceCategory] = data
      const item = data as Record<string, unknown>
      const hasPackage = Boolean(item.member_package_id)
      if (item.warning_message || (hasPackage && item.blocking_reason)) {
        packageAlerts.push({
          serviceCategory,
          warningLevel: item.warning_level as string | null,
          message: item.warning_message as string | null,
          blockingReason: item.blocking_reason as string | null,
        })
      }
    }
  }

  return {
    member,
    profile,
    sessionLogs: (sessionsResult.data ?? []) as SessionLogRow[],
    payments: (paymentsResult.data ?? []) as PaymentRow[],
    upcomingBookings,
    coachNames,
    packageEligibility,
    packageAlerts,
    bearforceSummary: bearforceResult.error ? null : (bearforceResult.data as BearforceSummary | null),
    loadError:
      sessionsResult.error || paymentsResult.error || bearforceResult.error
        ? "Some recent account activity couldn't be loaded."
        : null,
  }
}
