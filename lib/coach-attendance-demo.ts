// Presentation-only sample records for the Admin Coach Attendance Monitor.
// No record returned by this module is ever written to Supabase.
// All IDs intentionally use non-UUID "demo-" prefixes so they cannot be
// mistakenly passed to protected database RPCs.
export type DemoCoach = {
  id: string
  display_name: string
  branch: string
  username: string
  user_id: null
  is_active: boolean
}
export type DemoWorkShift = {
  id: string
  coach_id: string
  branch: string
  starts_at: string
  ends_at: string
  response: "pending" | "confirmed" | "unavailable"
  response_at: string | null
  unavailable_reason: string | null
  created_at: string
}
export type DemoTimePunch = {
  id: string
  work_shift_id: string
  coach_id: string
  clock_in_at: string
  clock_out_at: string | null
}
export type AttendanceDemo = {
  coaches: DemoCoach[]
  plans: DemoWorkShift[]
  punches: DemoTimePunch[]
  sampleConductions: Record<string, number>
}

function phDay(when: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(when)
  const part = (field: string) => parts.find((item) => item.type === field)?.value ?? ""
  return part("year") + "-" + part("month") + "-" + part("day")
}

function offsetDay(day: string, difference: number) {
  const noonUtc = new Date(day + "T12:00:00Z")
  noonUtc.setUTCDate(noonUtc.getUTCDate() + difference)
  return noonUtc.toISOString().slice(0, 10)
}
function at(day: string, hour: string) {
  return day + "T" + hour + ":00+08:00"
}

export function buildCoachAttendanceDemo(now: Date): AttendanceDemo {
  const today = phDay(now)
  const yesterday = offsetDay(today, -1)
  const tomorrow = offsetDay(today, 1)
  const beforeYesterday = offsetDay(today, -2)

  const coaches: DemoCoach[] = [
    { id: "demo-coach-1", display_name: "Amiel", branch: "Malingap Branch", username: "coach1", user_id: null, is_active: true },
    { id: "demo-coach-2", display_name: "Joaquin", branch: "Malingap Branch", username: "coach2", user_id: null, is_active: true },
    { id: "demo-coach-3", display_name: "Andrei", branch: "E. Rodriguez Branch", username: "coach3", user_id: null, is_active: true },
    { id: "demo-coach-4", display_name: "Hunejin", branch: "E. Rodriguez Branch", username: "coach4", user_id: null, is_active: true },
  ]

  const plans: DemoWorkShift[] = [
    {
      id: "demo-shift-1", coach_id: "demo-coach-1", branch: "Malingap Branch",
      starts_at: at(today, "08:00"), ends_at: at(today, "17:00"),
      response: "confirmed", response_at: at(yesterday, "19:08"),
      unavailable_reason: null, created_at: at(beforeYesterday, "09:00"),
    },
    {
      id: "demo-shift-2", coach_id: "demo-coach-2", branch: "Malingap Branch",
      starts_at: at(today, "09:00"), ends_at: at(today, "18:00"),
      response: "confirmed", response_at: at(yesterday, "19:22"),
      unavailable_reason: null, created_at: at(beforeYesterday, "09:00"),
    },
    {
      id: "demo-shift-3", coach_id: "demo-coach-3", branch: "E. Rodriguez Branch",
      starts_at: at(today, "08:00"), ends_at: at(today, "17:00"),
      response: "pending", response_at: null,
      unavailable_reason: null, created_at: at(beforeYesterday, "09:00"),
    },
    {
      id: "demo-shift-4", coach_id: "demo-coach-4", branch: "E. Rodriguez Branch",
      starts_at: at(today, "10:00"), ends_at: at(today, "19:00"),
      response: "unavailable", response_at: at(yesterday, "18:40"),
      unavailable_reason: "Personal emergency — unable to report", created_at: at(beforeYesterday, "09:00"),
    },
    {
      id: "demo-shift-5", coach_id: "demo-coach-1", branch: "Malingap Branch",
      starts_at: at(yesterday, "08:00"), ends_at: at(yesterday, "17:00"),
      response: "confirmed", response_at: at(beforeYesterday, "18:30"),
      unavailable_reason: null, created_at: at(beforeYesterday, "09:00"),
    },
    {
      id: "demo-shift-6", coach_id: "demo-coach-3", branch: "E. Rodriguez Branch",
      starts_at: at(tomorrow, "08:00"), ends_at: at(tomorrow, "17:00"),
      response: "pending", response_at: null,
      unavailable_reason: null, created_at: at(today, "09:00"),
    },
  ]

  const punches: DemoTimePunch[] = [
    {
      id: "demo-punch-1", work_shift_id: "demo-shift-1", coach_id: "demo-coach-1",
      clock_in_at: at(today, "07:54"), clock_out_at: null,
    },
    {
      id: "demo-punch-2", work_shift_id: "demo-shift-2", coach_id: "demo-coach-2",
      clock_in_at: at(today, "09:18"), clock_out_at: null,
    },
    {
      id: "demo-punch-5", work_shift_id: "demo-shift-5", coach_id: "demo-coach-1",
      clock_in_at: at(yesterday, "07:55"), clock_out_at: at(yesterday, "17:07"),
    },
  ]

  // Illustrative only; neither member balances nor payroll are calculated.
  const sampleConductions = {
    "demo-coach-1": 6,
    "demo-coach-2": 3,
    "demo-coach-3": 0,
    "demo-coach-4": 0,
  }

  return { coaches, plans, punches, sampleConductions }
}
