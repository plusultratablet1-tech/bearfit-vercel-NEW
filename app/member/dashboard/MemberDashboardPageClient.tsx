"use client"

import BearfitDashboardClient from "@/components/bearfit/BearfitDashboardClient"

interface MemberDashboardPageClientProps {
  user: any
  member: any | null
}

export default function MemberDashboardPageClient({
  user,
  member,
}: MemberDashboardPageClientProps) {
  return <BearfitDashboardClient user={user} member={member} />
}
