"use client"

import Image from "next/image"

export function BadgeChip({
  iconSrc,
  label,
  tone = "neutral",
}: {
  iconSrc: string
  label: string
  tone?: "neutral" | "green" | "red" | "orange" | "gold"
}) {
  const toneMap: Record<string, string> = {
    neutral: "bg-white/5 text-white/80 ring-white/10",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    red: "bg-red-500/10 text-red-300 ring-red-500/20",
    orange: "bg-orange-500/10 text-orange-300 ring-orange-500/20",
    gold: "bg-yellow-500/10 text-yellow-200 ring-yellow-500/20",
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${toneMap[tone]}`}
    >
      <span className="relative h-4 w-4">
        <Image src={iconSrc} alt="" fill className="object-contain" sizes="16px" />
      </span>
      {label}
    </span>
  )
}
