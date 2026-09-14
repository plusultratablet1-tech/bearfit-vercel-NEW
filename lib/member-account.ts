import type { Database } from "@/lib/database.types"

export type MemberRow = Database["public"]["Tables"]["members"]["Row"]
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"]
export type SessionLogRow = Database["public"]["Tables"]["session_logs"]["Row"]
export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"]

export type PackageAlert = {
  serviceCategory: string
  warningLevel?: string | null
  message?: string | null
  blockingReason?: string | null
}

export type MemberPackageEligibilityView = {
  member_package_id?: string | null
  package_id?: string | null
  package_code?: string | null
  package_name?: string | null
  service_category: string
  sessions_left: number
  sessions_total: number
  sessions_used?: number
  blocking_reason?: string | null
  warning_level?: string | null
  warning_message?: string | null
  payment_stage_due?: string | null
  payment_stage_label?: string | null
  expires_at?: string | null
}

export type MemberPaymentsData = {
  member: MemberRow | null
  profile: ProfileRow | null
  payments: PaymentRow[]
  packages: MemberPackageEligibilityView[]
  loadError: string | null
}

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
  if (
    member?.is_demo &&
    (/^legacy/i.test(fallbackName) ||
      /test 5 sessions/i.test(fallbackName) ||
      fallbackName === "QA Demo Package")
  ) {
    return "QA Demo Package"
  }

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
