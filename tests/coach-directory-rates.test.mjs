import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const schema = fs.readFileSync("supabase/migrations/20261012093000_coach_directory_rates.sql", "utf8")
const route = fs.readFileSync("app/staff/coaches/directory/page.tsx", "utf8")
const client = fs.readFileSync("app/staff/coaches/directory/CoachDirectoryClient.tsx", "utf8")
const overview = fs.readFileSync("app/staff/coaches/CoachesPageClient.tsx", "utf8")

test("directory is admin-only on the server", () => {
  assert.match(route, /supabase\.auth\.getUser\(\)/)
  assert.match(route, /profile\?\.role !== "admin"/)
  assert.match(route, /redirect\("\/staff\/coaches"\)/)
  assert.match(overview, /role === "admin"/)
  assert.match(overview, /href="\/staff\/coaches\/directory"/)
})

test("coach identities have unique canonical names and no default rate", () => {
  assert.match(schema, /create table if not exists public\.coaches/)
  assert.match(schema, /roster_key text generated always as/)
  assert.match(schema, /on conflict \(roster_key\) do nothing/)
  assert.match(schema, /create table if not exists public\.coach_rate_history/)
  assert.doesNotMatch(schema, /default\s+150|default\s+100|default\s+0[,\s]/i)
})

test("coach rates are confidential, append-only, role-checked, and effective-dated", () => {
  assert.match(schema, /coach_rates_read_by_admin/)
  assert.match(schema, /rate changes must take effect today or later/i)
  assert.match(schema, /constraint coach_rate_one_change_per_day unique/)
  assert.match(schema, /revoke all on table public\.coach_rate_history/)
  assert.match(schema, /grant select on table public\.coach_rate_history/)
  assert.match(schema, /admin_set_coach_rate/)
  assert.match(schema, /role='admin'/)
  assert.doesNotMatch(schema, /grant insert on table public\.coach_rate_history to authenticated/)
  assert.doesNotMatch(schema, /create policy .* for update.*coach_rate_history/i)
})

test("staff logins must be manually linked to real staff profiles", () => {
  assert.match(schema, /admin_link_coach_account/)
  assert.match(schema, /where id=p_user_id and role='staff'/)
  assert.match(client, /window\.confirm/)
  assert.match(client, /No staff login accounts exist yet/)
})

test("phase one does not touch booking, package or payroll deductions", () => {
  assert.doesNotMatch(schema, /update public\.(members|bookings|member_package_cycles|session_logs)/i)
  assert.doesNotMatch(schema, /insert into public\.(session_logs|payments|bookings)/i)
  assert.match(client, /No payroll was generated/)
})
