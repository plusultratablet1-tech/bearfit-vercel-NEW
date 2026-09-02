"use client"

import {
  Trophy,
  CheckCircle2,
  Target,
  Flame,
} from "lucide-react"
import clsx from "clsx"

type StatusType = "top" | "verified" | "target" | "fire"

const badgeConfig: Record<
  StatusType,
  {
    label: string
    icon: any
    text: string
    bg: string
    ring: string
  }
> = {
  top: {
    label: "Top Member",
    icon: Trophy,
    text: "text-yellow-400",
    bg: "bg-yellow-500/10",
    ring: "ring-yellow-500/20",
  },
  verified: {
    label: "Verified",
    icon: CheckCircle2,
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  target: {
    label: "On Target",
    icon: Target,
    text: "text-sky-400",
    bg: "bg-sky-500/10",
    ring: "ring-sky-500/20",
  },
  fire: {
    label: "On Fire",
    icon: Flame,
    text: "text-orange-400",
    bg: "bg-orange-500/10",
    ring: "ring-orange-500/20",
  },
}

export function StatusBadge({ type }: { type: StatusType }) {
  const cfg = badgeConfig[type]
  const Icon = cfg.icon

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
        "text-xs font-medium",
        "ring-1",
        cfg.text,
        cfg.bg,
        cfg.ring
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{cfg.label}</span>
    </div>
  )
}
