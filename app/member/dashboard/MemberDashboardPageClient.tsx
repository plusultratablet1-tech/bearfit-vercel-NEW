"use client"

import BearfitDashboardClient from "@/components/bearfit/BearfitDashboardClient"
import type {
  MemberRow,
  PaymentRow,
  ProfileRow,
  SessionLogRow,
  BookingRow,
  PackageAlert,
} from "@/lib/member-account"

interface MemberDashboardPageClientProps {
  userEmail: string | null
  userFullName: string | null
  member: MemberRow | null
  profile: ProfileRow | null
  sessionLogs: SessionLogRow[]
  payments: PaymentRow[]
  upcomingBookings: BookingRow[]
  coachNames: Record<string, string>
  packageEligibility: Record<string, unknown>
  packageAlerts: PackageAlert[]
  loadError: string | null
}

export default function MemberDashboardPageClient(props: MemberDashboardPageClientProps) {
  return <BearfitDashboardClient {...props} />
}
