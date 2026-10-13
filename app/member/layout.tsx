import type { ReactNode } from "react"
import MemberPersistentShell from "@/components/bearfit/MemberPersistentShell"

export default function MemberLayout({children}:{children:ReactNode}) {
  // Individual routes already enforce member authentication and authorization.
  // The shared shell remains mounted while only the route content changes.
  return <MemberPersistentShell>{children}</MemberPersistentShell>
}
