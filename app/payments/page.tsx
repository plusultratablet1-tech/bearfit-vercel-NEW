import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import PaymentsPageClient, { type PaymentPrefill } from "./PaymentsPageClient"

type PaymentsSearchParams = Promise<Record<string, string | string[] | undefined>>

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined
}

export default async function PaymentsPage({ searchParams }: { searchParams: PaymentsSearchParams }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = profile?.role ?? "member"
  if (role !== "staff" && role !== "admin") {
    redirect("/member/dashboard")
  }

  const params = await searchParams
  const prefill: PaymentPrefill = {
    memberId: stringParam(params.memberId),
    packageCode: stringParam(params.packageCode),
    memberPackageId: stringParam(params.memberPackageId),
    stageKey: stringParam(params.stageKey),
  }

  return <PaymentsPageClient role={role} prefill={prefill} />
}
