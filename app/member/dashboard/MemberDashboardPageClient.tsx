"use client"

import BearfitDashboardClient from "@/components/bearfit/BearfitDashboardClient"
import type {
  MemberRow,
  PaymentRow,
  ProfileRow,
  SessionLogRow,
} from "@/lib/member-account"

interface MemberDashboardPageClientProps {
  userEmail: string | null
  userFullName: string | null
  member: MemberRow | null
  profile: ProfileRow | null
  sessionLogs: SessionLogRow[]
  payments: PaymentRow[]
  loadError: string | null
}

export default function MemberDashboardPageClient(props: MemberDashboardPageClientProps) {
  return <BearfitDashboardClient {...props} />
}
