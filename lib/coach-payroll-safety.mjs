// Pure, side-effect-free safety policy for upcoming BearFit coach conductions.
// NOT wired to QR check-in or payroll; the database remains read-only.
const PH_TZ = "Asia/Manila"
export function manilaDay(timestamp) {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid timestamp")
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PH_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date)
  const v = (name) => parts.find((p) => p.type === name)?.value
  return [v("year"),v("month"),v("day")].join("-")
}
export function cutoffFor(timestamp) {
  const day = manilaDay(timestamp)
  const [year, month, date] = day.split("-").map(Number)
  const last = new Date(Date.UTC(year,month,0)).getUTCDate()
  return {
    from: year + "-" + String(month).padStart(2,"0") + "-" + (date <= 15 ? "01" : "16"),
    through: year + "-" + String(month).padStart(2,"0") + "-" + (date <= 15 ? "15" : String(last).padStart(2,"0")),
  }
}
export function checkInDecision(input) {
  if (input.existingSessionLog) return "already_checked_in"
  if (!input.staffAuthenticated) return "blocked_unauthenticated"
  if (!input.validMemberIdentity || !input.qrVerified) return "blocked_identity"
  if (!input.branchAllowed) return "blocked_branch"
  if (!input.packageActive || !Number.isInteger(input.sessionsLeft) || input.sessionsLeft <= 0) return "blocked_package"
  if (input.walkIn) {
    if (!input.uniqueWalkInId || !input.coachId || !input.sessionType) return "blocked_incomplete_walkin"
  } else if (!input.confirmedBooking || !input.withinBookingWindow) return "blocked_booking"
  return "eligible_to_confirm"
}
export function conductionDecision(input) {
  if (!input.sessionLogId || !input.memberId) return "blocked_missing_source"
  if (input.isNoShow || input.isCancelled) return "not_payable"
  if (!input.memberAttended) return "pending_attendance_verification"
  if (!input.coachId || input.coachDisputed || input.coachChangedMidSession) return "pending_coach_verification"
  if (!input.workoutCompleted) return "pending_completion_verification"
  return "eligible_for_admin_approval"
}
export function shiftDecision(input) {
  if (!input.authenticatedCoach) return "blocked_identity"
  if (input.action === "in") {
    if (input.openShift) return "blocked_already_clocked_in"
    if (!input.branchVerified) return "pending_branch_verification"
    return "clock_in_allowed"
  }
  if (input.action === "out") {
    if (!input.openShift) return "blocked_missing_clock_in"
    if (!input.serverTime || new Date(input.serverTime).getTime()<new Date(input.clockInTime).getTime())
      return "blocked_invalid_time"
    return "clock_out_allowed"
  }
  return "blocked_action"
}
export function latestRateOn(rates, coachId, date) {
  const available = rates.filter((r)=>r.coachId===coachId && r.effectiveFrom<=date)
  available.sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))
  return available[0] || null
}
export function payableAmount(items, coachId, rates) {
  let cents=0
  for (const item of items) {
    if (item.coachId!==coachId) throw new Error("Mixed coaches in payroll")
    if (item.status!=="approved") throw new Error("Unapproved conduction in payroll")
    const rate=latestRateOn(rates,coachId,item.sessionDate)
    if (!rate || !Number.isFinite(rate.amount) || rate.amount<=0) throw new Error("Missing effective rate")
    cents+=Math.round(rate.amount*100)
  }
  return cents/100
}
export function payrollDecision(input) {
  if (input.actorRole!=="admin") return "blocked_role"
  if (!input.everyConductionApproved) return "blocked_unapproved"
  if (!input.allRatesAssigned) return "blocked_missing_rate"
  if (input.hasDispute) return "blocked_dispute"
  if (input.cutoffStatus==="locked" || input.cutoffStatus==="paid") return "blocked_locked"
  return "ready_for_admin_approval"
}
const transitions={
  open: ["for_review"], for_review: ["open","approved"],
  approved: ["for_review","locked"], locked: ["paid"], paid: [],
}
export function cutoffTransition(from,to) {
  if (from==="paid" && to==="paid") return "already_paid"
  return (transitions[from] || []).includes(to) ? "allowed" : "blocked"
}
export function adjustmentDecision(input) {
  if (input.cutoffStatus==="locked" || input.cutoffStatus==="paid") return "next_open_cutoff_required"
  if (input.actorRole!=="admin" || !input.auditReason || input.auditReason.trim().length<10) return "blocked_authorization_or_reason"
  if (!Number.isFinite(input.amount) || input.amount===0) return "blocked_amount"
  if (!input.coachMatches) return "blocked_wrong_coach"
  return "allowed"
}
