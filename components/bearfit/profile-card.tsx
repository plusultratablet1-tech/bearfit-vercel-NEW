"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import {
  User,
  HelpCircle,
  X,
  SlidersHorizontal,
  Video,
  Trophy,
  BadgeCheck,
  Target,
  Flame,
} from "lucide-react"

// Info explanations for each stat
const statInfos = {
  allStats: {
    title: "Understanding Your Stats",
    description: "",
    details: [
      { title: "Workout Streak", desc: "How many consecutive days you've completed at least one workout. Keep it going to earn bonus points!" },
      { title: "Bearforce Points (MP)", desc: "Earned through workouts, referrals, and challenges. Use them for rewards and discounts!" },
      { title: "Prestige Member", desc: "Our most dedicated athletes who maintain consistent training. Each season lasts 3 months." },
      { title: "Fitness Level", desc: "Based on workout frequency, intensity, and progress. Tier A+ means you're in the top 5%!" },
    ],
  },
  workoutStreak: {
    title: "Workout Streak",
    description:
      "Your workout streak shows how many consecutive days you've completed at least one workout session. Keep it going to earn bonus points and unlock special achievements!",
  },
  bearforcePoints: {
    title: "Bearforce Points (MP)",
    description:
      "Member Points (MP) are earned through workouts, referrals, and challenges. Use them to redeem rewards, get discounts on packages, or unlock exclusive perks!",
  },
  prestigeMember: {
    title: "Prestige Member",
    description:
      "Prestige Members are our most dedicated athletes who have maintained consistent training through multiple seasons. Each season lasts 3 months.",
  },
  fitnessLevel: {
    title: "Fitness Level",
    description:
      "Your fitness tier is calculated based on workout frequency, session intensity, and overall progress. Tier A+ means you're in the top 5% of all members!",
  },
}

function BadgePill({
  icon,
  label,
  className,
}: {
  icon: React.ReactNode
  label: string
  className: string
}) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/5 ${className}`}>
      <span className="shrink-0">{icon}</span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </div>
  )
}

export function ProfileCard() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [showInfo, setShowInfo] = useState<keyof typeof statInfos | null>(null)
  const totalCards = 4

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const handleScroll = () => {
      const scrollLeft = scrollEl.scrollLeft
      const cardWidth = 112 + 8
      const index = Math.round(scrollLeft / cardWidth)
      setActiveIndex(Math.min(index, totalCards - 1))
    }

    scrollEl.addEventListener("scroll", handleScroll)
    return () => scrollEl.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="px-4">
      {/* Welcome */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-muted-foreground" />
          <span className="text-base">
            <span className="text-muted-foreground">Welcome,</span>{" "}
            <span className="font-semibold text-foreground">Alex</span>
          </span>
        </div>
      </div>

      {/* Profile Section */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-2xl p-3 border border-border">
        {/* Top section: Profile + Package Info */}
        <div className="flex gap-3">
          {/* Rounded Rectangle Profile */}
          <div className="shrink-0">
            <div
              className="relative w-20 h-24 rounded-xl overflow-hidden border-[3px] border-transparent"
              style={{
                background:
                  "linear-gradient(#1a1a1a, #1a1a1a) padding-box, linear-gradient(135deg, #f97316, #eab308) border-box",
              }}
            >
              <Image
                src="/avatars/default.jpg"
                alt="Profile"
                width={80}
                height={96}
                className="w-full h-full object-cover object-[center_15%]"
                priority
              />
            </div>
          </div>

          {/* Package Info */}
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <span className="text-sm font-medium text-foreground">Full 48 Package+</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-500 font-medium">Active Member</span>
            </div>

            <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
              <div className="bg-gradient-to-r from-green-500 to-yellow-500 h-1.5 rounded-full" style={{ width: "83%" }} />
            </div>

            <div className="flex flex-col items-center mt-2">
              <span className="text-xs text-foreground font-medium">40 of 48 sessions</span>
              <button className="text-xs text-primary font-medium touch-active mt-1">View Profile</button>
            </div>
          </div>
        </div>

        {/* Member Info - KEEP THIS POSITION (Membership ID stays here) */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="relative bg-gradient-to-br from-[#252525] to-[#1a1a1a] rounded-xl p-4 border border-border/30 overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative flex flex-col items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-green-500 font-medium uppercase tracking-wider">Membership ID</span>
              </div>

              <span className="text-2xl font-bold text-foreground mt-1 tracking-tight">M00-1</span>
              <span className="text-sm text-muted-foreground font-medium">Malingap Branch</span>

              {/* Badges — updated icons + text color to match your Image 2 */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <BadgePill
                  label="Top Member"
                  className="bg-yellow-500/10 text-yellow-300"
                  icon={<Trophy className="w-4 h-4 text-yellow-300" />}
                />
                <BadgePill
                  label="Verified"
                  className="bg-emerald-500/10 text-emerald-300"
                  icon={<BadgeCheck className="w-4 h-4 text-emerald-300" />}
                />
                <BadgePill
                  label="On Target"
                  className="bg-sky-500/10 text-sky-300"
                  icon={<Target className="w-4 h-4 text-sky-300" />}
                />
                <BadgePill
                  label="On Fire"
                  className="bg-orange-500/10 text-orange-300"
                  icon={<Flame className="w-4 h-4 text-orange-300" />}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mt-3 -mx-3 px-3">
          {/* Stats Header with Help Button */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Your Stats</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowInfo("allStats")}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 snap-x snap-mandatory scroll-smooth">
            {/* Workout Streak */}
            <div className="shrink-0 w-24 bg-[#252525] border border-border/60 rounded-xl p-2 text-center touch-active snap-start relative">
              <span className="text-[9px] text-muted-foreground block leading-tight">Workout Streak</span>
              <span className="text-2xl font-bold text-foreground leading-tight">17</span>
              <span className="text-[10px] text-foreground block">Days</span>
              <span className="inline-block mt-1 px-2 py-0.5 bg-primary text-primary-foreground text-[8px] font-medium rounded-full">
                Personal Best
              </span>
            </div>

            {/* Bearforce Points */}
            <div className="shrink-0 w-24 bg-[#252525] border border-border/60 rounded-xl p-2 text-center touch-active snap-start relative">
              <span className="text-[9px] text-muted-foreground block leading-tight">Bearforce Points</span>
              <span className="text-2xl font-bold text-foreground leading-tight">1540</span>
              <span className="text-[10px] text-foreground block">MP</span>
              <span className="text-[8px] text-green-500 block mt-1">+120 this month</span>
            </div>

            {/* Prestige Member */}
            <div className="shrink-0 w-24 bg-gradient-to-b from-[#8b0000] to-[#5c0000] border border-red-900/60 rounded-xl p-2 text-center touch-active snap-start relative">
              <span className="text-[9px] text-red-200 block leading-tight">Prestige Member</span>
              <span className="text-[10px] font-bold text-white block">Season</span>
              <span className="text-2xl font-bold text-white block leading-tight">2</span>
              <span className="text-[8px] text-red-200 block mt-1">Since 2023</span>
            </div>

            {/* Fitness Level */}
            <div className="shrink-0 w-24 bg-gradient-to-b from-[#0d4f3c] to-[#052e23] border border-emerald-900/60 rounded-xl p-2 text-center touch-active snap-start relative">
              <span className="text-[9px] text-emerald-200 block leading-tight">Fitness Level</span>
              <span className="text-[10px] font-bold text-white block">Tier</span>
              <span className="text-2xl font-bold text-white block leading-tight">A+</span>
              <span className="text-[8px] text-emerald-200 block mt-1">Top 5%</span>
            </div>
          </div>

          {/* Scroll Indicators */}
          <div className="flex justify-center gap-1.5 mt-2">
            {Array.from({ length: totalCards }).map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === activeIndex ? "w-4 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4">
          <div className="w-full max-w-sm bg-[#141414] rounded-2xl p-5 border border-border/50 animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{statInfos[showInfo].title}</span>
              </div>
              <button
                onClick={() => setShowInfo(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {"details" in statInfos[showInfo] ? (
              <div className="space-y-3">
                {statInfos.allStats.details.map((d, i) => (
                  <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-sm font-semibold text-foreground">{d.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{d.desc}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground leading-relaxed">
                {(statInfos[showInfo] as any).description}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowInfo(null)}
                className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
