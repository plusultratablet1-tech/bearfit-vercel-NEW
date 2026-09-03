import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { loadMemberAccountData } from "@/lib/member-account"
import MemberDashboardPageClient from "./MemberDashboardPageClient"

export default async function MemberDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/welcome")
  }

  const account = await loadMemberAccountData(user.id)
  const userFullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null

  return (
    <MemberDashboardPageClient
      userEmail={user.email ?? null}
      userFullName={userFullName}
      member={account.member}
      profile={account.profile}
      sessionLogs={account.sessionLogs}
      payments={account.payments}
      upcomingBookings={account.upcomingBookings}
      coachNames={account.coachNames}
      packageEligibility={account.packageEligibility}
      packageAlerts={account.packageAlerts}
      bearforceSummary={account.bearforceSummary}
      loadError={account.loadError}
    />
  )
}
