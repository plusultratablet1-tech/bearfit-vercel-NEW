import { createClient } from "@/lib/supabase/server"
import type {
  BearforceSummary,
  BookingRow,
  MemberAccountData,
  MemberRow,
  PackageAlert,
  PaymentRow,
  ProfileRow,
  SessionLogRow,
} from "@/lib/member-account"

const SERVICE_CATEGORIES = ["fitness", "pilates_group", "pilates_1on1"] as const

type CoachDirectoryItem = {
  id: string
  full_name: string
  branch: string
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

  const eligibilityPromise = Promise.all(
    SERVICE_CATEGORIES.map((serviceCategory) =>
      supabase.rpc("member_package_eligibility", {
        p_service_category: serviceCategory,
      }),
    ),
  )

  const [
    sessionsResult,
    paymentsResult,
    bookingsResult,
    bearforceResult,
    coachDirectoryResult,
    eligibilityResults,
  ] = await Promise.all([
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
    supabase.rpc("member_coach_directory"),
    eligibilityPromise,
  ])

  if (sessionsResult.error) {
    console.error("Failed to load BearFit session logs", sessionsResult.error)
  }

  if (paymentsResult.error) {
    console.error("Failed to load BearFit payments", paymentsResult.error)
  }

  if (bookingsResult.error) {
    console.error("Failed to load BearFit upcoming bookings", bookingsResult.error)
  }

  if (bearforceResult.error) {
    console.error("Failed to load Bearforce progression", bearforceResult.error)
  }

  if (coachDirectoryResult.error) {
    console.error("Failed to load BearFit coach names", coachDirectoryResult.error)
  }

  const upcomingBookings = (bookingsResult.data ?? []) as BookingRow[]
  const coachIds = new Set(
    upcomingBookings
      .map((booking) => booking.assigned_coach_user_id)
      .filter((id): id is string => Boolean(id)),
  )
  const coachNames: Record<string, string> = {}
  for (const coach of (coachDirectoryResult.data ?? []) as CoachDirectoryItem[]) {
    if (coachIds.has(coach.id)) coachNames[coach.id] = coach.full_name
  }

  const packageEligibility: Record<string, unknown> = {}
  const packageAlerts: PackageAlert[] = []

  eligibilityResults.forEach((result, index) => {
    const serviceCategory = SERVICE_CATEGORIES[index]
    const data = result.data
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
  })

  const hasEligibilityError = eligibilityResults.some((result) => Boolean(result.error))

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
      sessionsResult.error ||
      paymentsResult.error ||
      bookingsResult.error ||
      bearforceResult.error ||
      coachDirectoryResult.error ||
      hasEligibilityError
        ? "Some recent account activity couldn't be loaded."
        : null,
  }
}
