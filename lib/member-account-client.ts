import type { Database } from "@/lib/database.types"

export type MemberRow = Database["public"]["Tables"]["members"]["Row"]

export function displayPackageNameForMember(member: MemberRow | null, fallbackName: string) {
  if (
    member?.is_demo &&
    (/^legacy/i.test(fallbackName) ||
      /test 5 sessions/i.test(fallbackName) ||
      fallbackName === "QA Demo Package")
  ) {
    return "QA Demo Package"
  }

  return fallbackName
}
