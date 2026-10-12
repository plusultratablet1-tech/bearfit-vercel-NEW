// Pure read-only presentation rules for the BearFit coach attendance dashboard.
// All timestamps are interpreted in Asia/Manila; no device clock is trusted for punches.
export type CoachShiftRow = {
  starts_at: string
  ends_at: string
  response: "pending" | "confirmed" | "unavailable"
  response_at: string | null
}
export type CoachPunchRow = { clock_in_at: string; clock_out_at: string | null }
export type Attention = "ok" | "attention" | "neutral"
export type ShiftEvaluation = {
  confirmation: string
  confirmationTone: Attention
  attendance: string
  attendanceTone: Attention
  needsAttention: boolean
  lateResponse: boolean
  lateArrival: boolean
}

export function manilaDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date)
  const part = (field: string) => parts.find((p) => p.type === field)?.value ?? ""
  return [part("year"), part("month"), part("day")].join("-")
}
export function addDay(day: string, delta: number): string {
  const date = new Date(day + "T12:00:00Z")
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid day")
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}
export function manilaWeek(day: string): string[] {
  const weekday = new Date(day + "T12:00:00Z").getUTCDay()
  const monday = addDay(day, -((weekday + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDay(monday, i))
}
export function shiftDay(shift: CoachShiftRow): string {
  return manilaDay(new Date(shift.starts_at))
}
export function confirmationDeadline(shift: CoachShiftRow): number {
  return Date.parse(addDay(shiftDay(shift), -1) + "T20:00:00+08:00")
}
export function evaluateShift(
  shift: CoachShiftRow,
  punch: CoachPunchRow | undefined,
  now: number,
): ShiftEvaluation {
  const start = Date.parse(shift.starts_at)
  const end = Date.parse(shift.ends_at)
  const deadline = confirmationDeadline(shift)
  const lateResponse = Boolean(shift.response_at && Date.parse(shift.response_at) > deadline)
  const lateArrival = Boolean(punch?.clock_in_at && Date.parse(punch.clock_in_at) > start + 15 * 60_000)
  let confirmation = "Awaiting response"
  let confirmationTone: Attention = "neutral"
  if (shift.response === "unavailable") {
    confirmation = "Can't report"
    confirmationTone = "attention"
  } else if (shift.response === "confirmed") {
    confirmation = lateResponse ? "Confirmed · late reply" : "Confirmed"
    confirmationTone = lateResponse ? "attention" : "ok"
  } else if (now >= deadline) {
    confirmation = "Unconfirmed — 8PM passed"
    confirmationTone = "attention"
  }

  let attendance = "Not yet due"
  let attendanceTone: Attention = "neutral"
  if (punch?.clock_in_at) {
    if (punch.clock_out_at) {
      attendance = lateArrival ? "Completed · late arrival" : "Completed shift"
      attendanceTone = lateArrival ? "attention" : "ok"
    } else if (now > end + 30 * 60_000) {
      attendance = "Missing clock-out"
      attendanceTone = "attention"
    } else {
      attendance = lateArrival ? "Late arrival · on duty" : "On duty"
      attendanceTone = lateArrival ? "attention" : "ok"
    }
  } else if (shift.response === "unavailable") {
    attendance = "No time-in · reported unavailable"
  } else if (now >= start && now <= start + 15 * 60_000) {
    attendance = "Awaiting time-in"
  } else if (now > end) {
    attendance = "Missing time-in (verify)"
    attendanceTone = "attention"
  } else if (now > start + 15 * 60_000) {
    attendance = "No verified arrival"
    attendanceTone = "attention"
  }

  return {
    confirmation, confirmationTone, attendance, attendanceTone,
    lateResponse, lateArrival,
    needsAttention: confirmationTone === "attention" || attendanceTone === "attention",
  }
}
export function csvEscape(value: unknown): string {
  const text = String(value ?? "")
  return '"' + text.replace(/"/g, '""') + '"'
}
