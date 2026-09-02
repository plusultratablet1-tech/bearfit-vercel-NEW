"use client"

import { useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import {
  Home,
  CalendarDays,
  CreditCard,
  User as UserIcon,
  MoreHorizontal,
  LogOut,
  Bell,
  MessageCircle,
  Trophy,
  ShieldCheck,
  Flame,
  Target,
  Activity,
  Wallet,
  Gift,
  Zap,
} from "lucide-react"

const supabase = createClient()

type Props = {
  user: User
  member: any | null
}

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "more", label: "More", icon: MoreHorizontal },
]

export default function BearfitDashboardClient({ user, member }: Props) {
  const [activeTab, setActiveTab] = useState("home")

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/welcome"
  }

  const displayName =
    member?.full_name ||
    member?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Member"

  const membershipId = member?.membership_id || "M00-1"
  const branch = member?.branch || "Malingap Branch"
  const sessionsUsed = member?.sessions_used ?? 40
  const totalSessions = member?.total_sessions ?? 48
  const progress = Math.min((sessionsUsed / totalSessions) * 100, 100)

  return (
    <main className="min-h-screen bg-[#020b1c] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-[260px] flex-col border-r border-white/10 bg-black/30 lg:flex">
          <div className="border-b border-white/10 p-5">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1d2a44] text-sm font-bold text-[#ff7a1a]">
                BF
              </div>
              <div>
                <p className="text-xl font-extrabold tracking-wide">BEARFIT</p>
                <p className="text-xs text-orange-300">Better fitness.</p>
              </div>
            </div>

            <div className="flex rounded-full bg-[#25324a] p-1 text-xs">
              <button className="rounded-full bg-[#ff7a1a] px-4 py-2 font-semibold text-white">
                Member
              </button>
              <button className="px-4 py-2 text-white/60">Staff</button>
              <button className="px-4 py-2 text-white/60">Leads</button>
              <button className="px-4 py-2 text-white/60">Admin</button>
            </div>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left transition ${
                    isActive
                      ? "bg-[#ff7a1a] text-white"
                      : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="space-y-3 border-t border-white/10 p-4">
            <div className="flex items-center justify-between rounded-2xl px-4 py-3 text-white/80 hover:bg-white/5">
              <div className="flex items-center gap-3">
                <Bell size={18} />
                <span>Notifications</span>
              </div>
              <span className="rounded-full bg-[#ff7a1a] px-2 py-0.5 text-xs text-white">
                3
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl px-4 py-3 text-white/80 hover:bg-white/5">
              <div className="flex items-center gap-3">
                <MessageCircle size={18} />
                <span>Messages</span>
              </div>
              <span className="rounded-full bg-green-500 px-2 py-0.5 text-xs text-white">
                2
              </span>
            </div>

            <button
              onClick={handleSignOut}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white/80 hover:bg-white/5"
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        <section className="flex-1">
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#25324a] text-[#ff7a1a]">
                  BF
                </div>

                <div className="hidden rounded-full bg-[#25324a] p-1 text-sm md:flex">
                  <button className="rounded-full bg-[#ff7a1a] px-6 py-2 font-semibold text-white">
                    Member
                  </button>
                  <button className="px-6 py-2 text-white/60">Staff</button>
                  <button className="px-6 py-2 text-white/60">Leads</button>
                  <button className="px-6 py-2 text-white/60">Admin</button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="rounded-2xl bg-[#25324a] p-4 text-white/80">
                  <Bell size={20} />
                </button>
                <button className="rounded-2xl bg-[#25324a] p-4 text-white/80">
                  <MessageCircle size={20} />
                </button>
              </div>
            </div>

            <div className="mb-6 border-t border-white/10 pt-4">
              <p className="mb-2 text-2xl font-medium text-white/80">
                Welcome , <span className="font-bold text-white">{displayName}</span>
              </p>
              <p className="text-2xl font-medium text-white/80">
                Welcome, <span className="font-bold text-white">{displayName}</span>
              </p>
            </div>

            <div className="rounded-[28px] border border-[#2d3748] bg-[#141414] p-4 shadow-2xl md:p-6">
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center">
                <div className="h-24 w-24 overflow-hidden rounded-3xl border-4 border-[#ff7a1a] bg-zinc-300">
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80"
                    alt="Member"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex-1">
                  <h2 className="text-2xl font-bold">Full 48 Package+</h2>
                  <p className="mb-3 text-green-400">● Active Member</p>

                  <div className="h-2 w-full rounded-full bg-[#243246]">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-green-500 via-lime-400 to-yellow-400"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-2 text-center">
                    <p className="text-lg font-semibold">
                      {sessionsUsed} of {totalSessions} sessions
                    </p>
                    <button
                      onClick={() => setActiveTab("profile")}
                      className="text-[#ff7a1a]"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-6 rounded-[24px] bg-[#1d1d1d] p-6">
                <div className="mb-2 text-center text-sm uppercase tracking-[0.2em] text-green-400">
                  Membership ID
                </div>
                <div className="text-center text-5xl font-extrabold">{membershipId}</div>
                <div className="mb-5 text-center text-2xl text-white/70">{branch}</div>

                <div className="flex flex-wrap justify-center gap-3">
                  <div className="rounded-full bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
                    <span className="flex items-center gap-2">
                      <Trophy size={16} />
                      Top Member
                    </span>
                  </div>
                  <div className="rounded-full bg-green-500/10 px-4 py-2 text-sm text-green-300">
                    <span className="flex items-center gap-2">
                      <ShieldCheck size={16} />
                      Verified
                    </span>
                  </div>
                  <div className="rounded-full bg-sky-500/10 px-4 py-2 text-sm text-sky-300">
                    <span className="flex items-center gap-2">
                      <Target size={16} />
                      On Target
                    </span>
                  </div>
                  <div className="rounded-full bg-orange-500/10 px-4 py-2 text-sm text-orange-300">
                    <span className="flex items-center gap-2">
                      <Flame size={16} />
                      On Fire
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">
                  Your Stats
                </p>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-3xl bg-[#242424] p-5">
                    <p className="text-sm text-white/50">Workout Streak</p>
                    <p className="text-4xl font-extrabold">17</p>
                    <p className="text-white/60">Days</p>
                    <span className="mt-3 inline-block rounded-full bg-[#ff7a1a] px-3 py-1 text-xs">
                      Personal Best
                    </span>
                  </div>

                  <div className="rounded-3xl bg-[#242424] p-5">
                    <p className="text-sm text-white/50">Bearforce Points</p>
                    <p className="text-4xl font-extrabold">1540</p>
                    <p className="text-white/60">MP</p>
                    <p className="mt-3 text-sm text-green-400">+120 this month</p>
                  </div>

                  <div className="rounded-3xl bg-[#8b0000] p-5">
                    <p className="text-sm text-white/70">Prestige Member</p>
                    <p className="text-xl font-semibold">Season</p>
                    <p className="text-4xl font-extrabold">2</p>
                    <p className="mt-3 text-sm text-white/70">Since 2023</p>
                  </div>

                  <div className="rounded-3xl bg-[#006b45] p-5">
                    <p className="text-sm text-white/70">Fitness Level</p>
                    <p className="text-xl font-semibold">Tier</p>
                    <p className="text-4xl font-extrabold">A+</p>
                    <p className="mt-3 text-sm text-white/70">Top 5%</p>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="mb-4 text-2xl font-bold">Upcoming Sessions</h3>

                <div
                  className="overflow-hidden rounded-[28px] border border-white/10 p-5"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <span className="mb-3 inline-block rounded-full bg-[#ff7a1a] px-3 py-1 text-xs font-semibold">
                        UPCOMING
                      </span>
                      <h4 className="text-4xl font-bold">Weights Sessions</h4>
                      <p className="mt-2 text-white/75">
                        Malingap Branch · 6:00 - 7:00pm
                      </p>
                      <p className="text-[#ff7a1a]">coach Joaquin</p>

                      <div className="mt-5 flex items-end gap-3">
                        <div>
                          <p className="text-5xl font-extrabold">00</p>
                          <p className="text-xs text-white/60">HOURS</p>
                        </div>
                        <div>
                          <p className="text-5xl font-extrabold">29</p>
                          <p className="text-xs text-white/60">MINUTES</p>
                        </div>
                        <div>
                          <p className="text-5xl font-extrabold">57</p>
                          <p className="text-xs text-white/60">SECONDS</p>
                        </div>
                        <p className="mb-2 text-[#ff7a1a]">29 min left</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button className="rounded-full bg-[#ff7a1a] px-6 py-3 font-semibold text-white">
                        Check In
                      </button>
                      <button className="rounded-full bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur">
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-8 rounded-[28px] bg-[#171717] p-4 md:p-6">
                <div className="mb-5 grid grid-cols-4 gap-4 border-b border-white/10 pb-4 text-center text-sm text-white/70">
                  <div className="font-semibold text-white">Activity Log</div>
                  <div>Points</div>
                  <div>Payments</div>
                  <div>Rewards</div>
                </div>

                <div className="space-y-4">
                  <div className="grid items-center gap-4 rounded-2xl py-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-[#ff7a1a] p-3">
                        <Activity size={20} />
                      </div>
                      <div>
                        <p className="text-xl font-semibold">Weights Session</p>
                        <p className="text-[#ff7a1a]">1 Session Used</p>
                      </div>
                    </div>
                    <p className="text-white/70">Malingap</p>
                    <p className="text-white/70">6:00 - 7:00pm</p>
                    <p className="text-[#ff7a1a]">20 &gt; 19</p>
                  </div>

                  <div className="grid items-center gap-4 rounded-2xl py-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-pink-500 p-3">
                        <HeartIcon />
                      </div>
                      <div>
                        <p className="text-xl font-semibold">Cardio Session</p>
                        <p className="text-[#ff7a1a]">1 Session Used</p>
                      </div>
                    </div>
                    <p className="text-white/70">E.Rod</p>
                    <p className="text-white/70">1:00 - 3:00pm</p>
                    <p className="text-[#ff7a1a]">48 &gt; 47</p>
                  </div>

                  <div className="grid items-center gap-4 rounded-2xl py-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-yellow-500 p-3">
                        <Wallet size={20} />
                      </div>
                      <div>
                        <p className="text-xl font-semibold">Package Renewal</p>
                        <p className="text-green-400">+3 Session Added</p>
                      </div>
                    </div>
                    <p className="text-white/70">Via Gcash</p>
                    <p className="text-white/70">₱48600</p>
                    <p className="text-green-400">0 + 48</p>
                  </div>

                  <div className="grid items-center gap-4 rounded-2xl py-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-yellow-400 p-3 text-black">
                        <Zap size={20} />
                      </div>
                      <div>
                        <p className="text-xl font-semibold">Cardio Session</p>
                        <p className="text-[#ff7a1a]">1 Free Session Used</p>
                      </div>
                    </div>
                    <p className="text-white/70">E.Rod</p>
                    <p className="text-white/70">1:00 - 3:00pm</p>
                    <p className="text-[#ff7a1a]">48 &gt; 47</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-4 text-xl font-bold">Updates & Promos</h3>

                <div
                  className="rounded-[28px] p-8"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,122,26,.88), rgba(255,122,26,.88)), url('https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <p className="mb-3 text-sm font-semibold tracking-wider text-white/80">
                    PROMO
                  </p>
                  <h4 className="mb-3 text-4xl font-bold">Track Your Daily Activities</h4>
                  <p className="mb-6 max-w-2xl text-white/90">
                    Monitor your workouts, calories burned, and progress towards your
                    fitness goals.
                  </p>
                  <button className="rounded-full bg-white px-6 py-3 font-semibold text-black">
                    Learn More
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function HeartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}
