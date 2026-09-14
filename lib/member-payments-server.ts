import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/database.types"
import type {
  MemberPackageEligibilityView,
  MemberPaymentsData,
  MemberRow,
  PaymentRow,
  ProfileRow,
} from "@/lib/member-account"

const SERVICE_CATEGORIES = ["fitness", "pilates_group", "pilates_1on1"] as const

function asEligibility(value: Json | null): MemberPackageEligibilityView | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null
  return value as unknown as MemberPackageEligibilityView
}

export async function loadMemberPaymentsData(userId: string): Promise<MemberPaymentsData> {
  const supabase = await createClient()

  const [profileResult, memberResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("members").select("*").eq("user_id", userId).maybeSingle(),
  ])

  const profile = (profileResult.data ?? null) as ProfileRow | null
  const member = (memberResult.data ?? null) as MemberRow | null

  if (profileResult.error || memberResult.error) {
    return {
      member,
      profile,
      payments: [],
      packages: [],
      loadError: "We couldn't load your payment details right now.",
    }
  }

  if (!member) {
    return {
      member: null,
      profile,
      payments: [],
      packages: [],
      loadError: null,
    }
  }

  const paymentsPromise = supabase
    .from("payments")
    .select("*")
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .limit(20)

  const eligibilityPromise = Promise.all(
    SERVICE_CATEGORIES.map((serviceCategory) =>
      supabase.rpc("member_package_eligibility", { p_service_category: serviceCategory }),
    ),
  )

  const [paymentsResult, eligibilityResults] = await Promise.all([
    paymentsPromise,
    eligibilityPromise,
  ])

  const packages = eligibilityResults
    .map((result) => asEligibility(result.data as Json | null))
    .filter((item): item is MemberPackageEligibilityView => Boolean(item?.member_package_id))

  return {
    member,
    profile,
    payments: (paymentsResult.data ?? []) as PaymentRow[],
    packages,
    loadError:
      paymentsResult.error || eligibilityResults.some((result) => result.error)
        ? "Some package or payment details couldn't be loaded."
        : null,
  }
}
