import {getStaffAccess} from "@/lib/staff-access-server"
import PaymentsPageClient, { type PaymentPrefill } from "./PaymentsPageClient"

type PaymentsSearchParams = Promise<Record<string, string | string[] | undefined>>

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined
}

export default async function PaymentsPage({ searchParams }: { searchParams: PaymentsSearchParams }) {
  const {role}=await getStaffAccess()

  const params = await searchParams
  const prefill: PaymentPrefill = {
    memberId: stringParam(params.memberId),
    packageCode: stringParam(params.packageCode),
    memberPackageId: stringParam(params.memberPackageId),
    stageKey: stringParam(params.stageKey),
  }

  return <PaymentsPageClient role={role} prefill={prefill} />
}
