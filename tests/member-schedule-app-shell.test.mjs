import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const shellPath = "components/bearfit/MemberAppShell.tsx"
const schedulePath = "app/member/schedule/MemberSchedulePageClient.tsx"

test("member schedule uses the shared BearFit app shell", () => {
  assert.equal(fs.existsSync(shellPath), true, "MemberAppShell must exist")
  const shell = fs.readFileSync(shellPath, "utf8")
  const schedule = fs.readFileSync(schedulePath, "utf8")

  for (const label of ["Home", "Schedule", "Rewards", "Payments", "Profile"]) {
    assert.match(shell, new RegExp(`label:\\s*\\"${label}\\"`))
  }

  assert.match(shell, /hidden\s+w-\[230px\][\s\S]*lg:flex/i, "desktop sidebar must remain available")
  assert.match(shell, /fixed\s+inset-x-0\s+bottom-0[\s\S]*lg:hidden/i, "mobile bottom app navigation must remain fixed")
  assert.match(shell, /activePath/i, "shell must support active navigation state")

  assert.match(schedule, /<MemberAppShell\s+activePath=\"\/member\/schedule\">/i)
  assert.doesNotMatch(schedule, /href=\"\/member\/dashboard\"[\s\S]{0,200}Dashboard/i, "schedule should not need duplicate dashboard header navigation")
})
