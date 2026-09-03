import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/database.types"

export type MemberRow = Database["public"]["Tables"]["members"]["Row"]
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"]
export type SessionLogRow = Database["public"]["Tables"]["session_logs"]["Row"]
export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"]

export type PackageAlert = { serviceCategory: string; warningLevel?: string | null; message?: string | null; blockingReason?: string | null }

export type MemberAccountData = {
  member: MemberRow | null
  profile: ProfileRow | null
  payments: PaymentRow[]
  sessionLogs: SessionLogRow[]
  upcomingBookings: BookingRow[]
  packageEligibility: Record<string, unknown>
  packageAlerts: PackageAlert[]
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
      packageEligibility: {},
      packageAlerts: [],
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
      packageEligibility: {},
      packageAlerts: [],
      loadError: null,
    }
  }

  const [sessionsResult, paymentsResult, bookingsResult] = await Promise.all([
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
  ])

  if (sessionsResult.error) {
    console.error("Failed to load BearFit session logs", sessionsResult.error)
  }

  if (paymentsResult.error) {
    console.error("Failed to load BearFit payments", paymentsResult.error)
  }

  const packageEligibility: Record<string, unknown> = {}
  const packageAlerts: PackageAlert[] = []
  for (const serviceCategory of ["fitness", "pilates_group", "pilates_1on1"]) {
    const { data } = await supabase.rpc("member_package_eligibility", { p_service_category: serviceCategory })
    if (data && typeof data === "object" && !Array.isArray(data)) {
      packageEligibility[serviceCategory] = data
      const item = data as Record<string, unknown>
      if (item.warning_message || item.blocking_reason) packageAlerts.push({ serviceCategory, warningLevel: item.warning_level as string | null, message: item.warning_message as string | null, blockingReason: item.blocking_reason as string | null })
    }
  }

  return {
    member,
    profile,
    sessionLogs: (sessionsResult.data ?? []) as SessionLogRow[],
    payments: (paymentsResult.data ?? []) as PaymentRow[],
    upcomingBookings: (bookingsResult.data ?? []) as BookingRow[],
    packageEligibility,
    packageAlerts,
    loadError:
      sessionsResult.error || paymentsResult.error
        ? "Some recent account activity couldn't be loaded."
        : null,
  }
}
