import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const shell = fs.readFileSync("components/bearfit/StaffAppShell.tsx", "utf8")
const page = fs.readFileSync("app/staff/coaches/page.tsx", "utf8")
const client = fs.readFileSync("app/staff/coaches/CoachesPageClient.tsx", "utf8")

test("Coaches is in shared desktop and mobile navigation", () => {
  assert.match(shell, /label: "Coaches", icon: ClipboardList, href: "\/staff\/coaches"/)
  assert.match(shell, /navItems\.map/)
  assert.match(shell, /overflow-x-auto/)
})

test("Coaches page is restricted to staff and admin", () => {
  assert.match(page, /supabase\.auth\.getUser\(\)/)
  assert.match(page, /if \(!user\) redirect\("\/login"\)/)
  assert.match(page, /role !== "staff" && profile\?\.role !== "admin"/)
})

test("Coaches use existing booking and slot data read-only", () => {
  assert.match(client, /from\("bookings"\)/)
  assert.match(client, /from\("schedule_slots"\)/)
  assert.match(client, /from\("profiles"\)/)
  assert.match(client, /from\("members"\)/)
  assert.doesNotMatch(client, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/)
})

test("Calendar offers day/week/month, Manila boundaries, and cautious tracking labels", () => {
  assert.match(client, /type View = "day" \| "week" \| "month"/)
  assert.match(client, /TIME_ZONE = "Asia\/Manila"/)
  assert.match(client, /Booking/)
  assert.match(client, /No recorded schedule/)
  assert.match(client, /not an employee time clock/)
  assert.match(client, /overlap/)
})
