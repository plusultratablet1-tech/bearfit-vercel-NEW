import type { ReactNode } from "react"

// Legacy per-page wrapper; navigation now lives in the persistent /staff layout.
export default function StaffAppShell({children}:{activePath:string;role:"staff"|"admin";children:ReactNode}){
  return <>{children}</>
}
