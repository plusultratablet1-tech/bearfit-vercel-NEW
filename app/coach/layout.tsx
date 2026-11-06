import type { ReactNode } from "react"
import CoachPersistentShell from "@/components/bearfit/CoachPersistentShell"

export default function CoachLayout({children}:{children:ReactNode}) {
  // The same persistent responsive shell used by the Member Portal.
  // Each coach page checks authentication and linked coach role server-side.
  return <CoachPersistentShell>{children}</CoachPersistentShell>
}
