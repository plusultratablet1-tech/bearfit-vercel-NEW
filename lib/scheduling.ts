import { createClient } from "@/lib/supabase/server"
import type { Database, Json } from "@/lib/database.types"

export type PackageDefinitionRow = Database["public"]["Tables"]["package_definitions"]["Row"]
export type MemberPackageCycleRow = Database["public"]["Tables"]["member_package_cycles"]["Row"]
export type ScheduleSlotRow = Database["public"]["Tables"]["schedule_slots"]["Row"]
export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"]
export type MemberRow = Database["public"]["Tables"]["members"]["Row"]

export type PackageEligibility = {
  member_package_id?: string | null
  package_code?: string | null
  package_name?: string | null
  service_category: string
  sessions_left: number
  sessions_total: number
  can_request_booking: boolean
  can_confirm_booking: boolean
  can_check_in: boolean
  blocking_reason?: string | null
  warning_level?: string | null
  warning_message?: string | null
  payment_stage_due?: string | null
  expires_at?: string | null
}

export type PackageCycleWithDefinition = MemberPackageCycleRow & { package_definitions?: PackageDefinitionRow | PackageDefinitionRow[] | null }
export type CoachDirectoryItem = { id: string; full_name: string; branch: string }
export type MemberScheduleData = {
  member: MemberRow | null
  coaches: CoachDirectoryItem[]
  slots: ScheduleSlotRow[]
  bookings: BookingRow[]
  packageCycles: PackageCycleWithDefinition[]
  eligibility: Record<string, PackageEligibility>
  loadError: string | null
}

function asEligibility(value: Json | null): PackageEligibility | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null
  return value as unknown as PackageEligibility
}

export async function loadMemberScheduleData(userId: string): Promise<MemberScheduleData> {
  const supabase = await createClient()
  const memberResult = await supabase.from("members").select("*").eq("user_id", userId).maybeSingle()
  const member = (memberResult.data ?? null) as MemberRow | null
  if (memberResult.error || !member) return { member, coaches: [], slots: [], bookings: [], packageCycles: [], eligibility: {}, loadError: memberResult.error ? "Unable to load schedule." : null }

  const now = new Date().toISOString()
  const [coachesResult, slotsResult, bookingsResult, cyclesResult] = await Promise.all([
    supabase.rpc("member_coach_directory"),
    supabase.from("schedule_slots").select("*").eq("branch", member.branch).eq("status", "open").gte("start_at", now).order("start_at").limit(100),
    supabase.from("bookings").select("*").eq("member_id", member.id).in("status", ["pending", "confirmed"]).gte("requested_start_at", now).order("requested_start_at").limit(50),
    supabase.from("member_package_cycles").select("*,package_definitions(*)").eq("member_id", member.id).in("status", ["active", "depleted", "expired"]).order("created_at", { ascending: false }),
  ])

  const packageCycles = (cyclesResult.data ?? []) as unknown as PackageCycleWithDefinition[]
  const categories = new Set<string>()
  for (const cycle of packageCycles) {
    const def = Array.isArray(cycle.package_definitions) ? cycle.package_definitions[0] : cycle.package_definitions
    if (def?.service_category) categories.add(def.service_category)
  }
  for (const slot of (slotsResult.data ?? []) as ScheduleSlotRow[]) categories.add(slot.session_type)

  const eligibility: Record<string, PackageEligibility> = {}
  await Promise.all([...categories].map(async (category) => {
    const { data } = await supabase.rpc("member_package_eligibility", { p_service_category: category })
    const parsed = asEligibility(data as Json | null)
    if (parsed) eligibility[category] = parsed
  }))

  return {
    member,
    coaches: (coachesResult.data ?? []) as CoachDirectoryItem[],
    slots: (slotsResult.data ?? []) as ScheduleSlotRow[],
    bookings: (bookingsResult.data ?? []) as BookingRow[],
    packageCycles,
    eligibility,
    loadError: coachesResult.error || slotsResult.error || bookingsResult.error || cyclesResult.error ? "Some schedule data could not be loaded." : null,
  }
}
