import type { ReactNode } from "react"

// Legacy per-page wrapper; navigation now lives in the persistent /member layout.
export default function MemberAppShell({children}:{activePath:string;children:ReactNode}){
  return <>{children}</>
}
