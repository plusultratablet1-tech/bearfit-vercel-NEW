// Pure, presentation-only member classification. No writes or payment calculations.
// Imported "pending" payment statuses are NOT evidence of a late payment.
export type MemberDirectoryRecord = {
  id: string
  member_code: string | null
  membership_id: string | null
  name: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  branch: string | null
  coach_name: string | null
  package_name: string | null
  package_type: string | null
  status: string | null
  membership_status: string | null
  total_sessions: number | null
  sessions_used: number | null
  sessions_left: number | null
  payment_status: string | null
  join_date: string | null
  is_demo: boolean | null
}
export type MemberQuickView = "all" | "attention" | "renewals" | "active"
export type MemberSort = "priority" | "name" | "sessions_asc" | "sessions_desc" | "joined_desc"
const paymentProblem = new Set(["overdue","failed","rejected","unpaid","past_due","delinquent"])
const attentionStatuses = new Set(["renewal_due","expired"])
const clean = (value: string | null | undefined) => (value ?? "").trim().toLowerCase()

export function memberDisplayName(member: MemberDirectoryRecord): string {
  return member.full_name || member.name || member.email || member.member_code || "Member"
}
export function memberPackage(member: MemberDirectoryRecord): string {
  return member.package_name || member.package_type || "No package recorded"
}
export function membershipState(member: MemberDirectoryRecord): string {
  return clean(member.membership_status || member.status || "unknown")
}
export function isActiveMember(member: MemberDirectoryRecord): boolean {
  return membershipState(member) === "active"
}
export function remainingSessions(member: MemberDirectoryRecord): number | null {
  return member.sessions_left != null && Number.isFinite(member.sessions_left) ? member.sessions_left : null
}
export function hasLowSessions(member: MemberDirectoryRecord): boolean {
  const remaining = remainingSessions(member)
  return isActiveMember(member) && remaining !== null && remaining >= 0 && remaining <= 3
}
export function hasPaymentException(member: MemberDirectoryRecord): boolean {
  return paymentProblem.has(clean(member.payment_status))
}
export function paymentLabel(member: MemberDirectoryRecord): { label: string; tone: "neutral" | "good" | "attention" } {
  const raw = clean(member.payment_status)
  if (raw === "paid") return {label:"Paid (recorded)",tone:"good"}
  if (paymentProblem.has(raw)) return {label:"Payment review: "+raw.replaceAll("_"," "),tone:"attention"}
  if (raw === "pending") return {label:"Pending / unverified",tone:"neutral"}
  if (!raw || raw === "unknown" || raw === "not_recorded")
    return {label:"Not verified",tone:"neutral"}
  return {label:"Status: "+raw.replaceAll("_"," "),tone:"neutral"}
}
export function needsMemberAttention(member: MemberDirectoryRecord): boolean {
  return attentionStatuses.has(membershipState(member)) || hasLowSessions(member) || hasPaymentException(member)
}
export function isRenewalCandidate(member: MemberDirectoryRecord): boolean {
  return membershipState(member) === "renewal_due" || hasLowSessions(member)
}
export function memberAction(member: MemberDirectoryRecord): {label:string;tone:"good"|"attention"|"neutral"} {
  const status=membershipState(member)
  const left=remainingSessions(member)
  if (status === "renewal_due") return {label:"Renewal due",tone:"attention"}
  if (isActiveMember(member) && left === 0) return {label:"No sessions left",tone:"attention"}
  if (isActiveMember(member) && left !== null && left >= 1 && left <= 3) return {label:"Renewal soon",tone:"attention"}
  if (attentionStatuses.has(status)) return {label:"Membership review",tone:"attention"}
  if (hasPaymentException(member)) return {label:"Review payment",tone:"attention"}
  if (status === "active") return {label:"On track",tone:"good"}
  return {label:"No urgent alert",tone:"neutral"}
}
export function urgencyRank(member: MemberDirectoryRecord): number {
  const status=membershipState(member)
  const left=remainingSessions(member)
  if(status === "renewal_due") return 0
  if(isActiveMember(member) && left === 0) return 1
  if(isActiveMember(member) && left !== null && left >= 1 && left <= 3) return 2
  if(attentionStatuses.has(status)) return 3
  if(hasPaymentException(member)) return 4
  if(isActiveMember(member)) return 5
  return 6
}
export function matchesMemberView(member:MemberDirectoryRecord,view:MemberQuickView):boolean {
  if(view==="attention")return needsMemberAttention(member)
  if(view==="renewals")return isRenewalCandidate(member)
  if(view==="active")return isActiveMember(member)
  return true
}
export function compareMembers(a:MemberDirectoryRecord,b:MemberDirectoryRecord,sort:MemberSort):number {
  const name=memberDisplayName(a).localeCompare(memberDisplayName(b),undefined,{sensitivity:"base"})
  if(sort==="name") return name
  if(sort==="priority") return urgencyRank(a)-urgencyRank(b)||name
  if(sort==="joined_desc"){
    const aDay=a.join_date&&Number.isFinite(Date.parse(a.join_date))?Date.parse(a.join_date):0
    const bDay=b.join_date&&Number.isFinite(Date.parse(b.join_date))?Date.parse(b.join_date):0
    return bDay-aDay||name
  }
  const leftA=remainingSessions(a),leftB=remainingSessions(b)
  if(leftA===null && leftB===null)return name
  if(leftA===null)return 1
  if(leftB===null)return -1
  return (sort==="sessions_asc"?leftA-leftB:leftB-leftA)||name
}
export function memberStats(members:MemberDirectoryRecord[]) {
  return {
    total:members.length,
    active:members.filter(isActiveMember).length,
    lowSessions:members.filter(hasLowSessions).length,
    zeroSessions:members.filter(m=>isActiveMember(m)&&remainingSessions(m)===0).length,
    renewals:members.filter(isRenewalCandidate).length,
    explicitRenewalDue:members.filter(m=>membershipState(m)==="renewal_due").length,
    attention:members.filter(needsMemberAttention).length,
    paymentUnverified:members.filter(m=>{
      const status=clean(m.payment_status)
      return !status||status==="pending"||status==="unknown"||status==="not_recorded"
    }).length,
    paymentExceptions:members.filter(hasPaymentException).length,
  }
}
export function sessionGroup(member:MemberDirectoryRecord):string {
  const left=remainingSessions(member)
  if(left===null)return "Sessions unknown"
  if(left<=0)return "No sessions"
  if(left<=3)return "1–3 sessions left"
  return "4+ sessions left"
}
