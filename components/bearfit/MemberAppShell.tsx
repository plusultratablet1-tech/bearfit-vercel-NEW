"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import {
  Bell,
  CalendarDays,
  CreditCard,
  Gift,
  Home,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  User as UserIcon,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

const navItems = [
  { label: "Home", icon: Home, href: "/member/dashboard", activePath: "/member/dashboard" },
  { label: "Schedule", icon: CalendarDays, href: "/member/schedule", activePath: "/member/schedule" },
  { label: "Rewards", icon: Gift, href: "/member/rewards", activePath: "/member/rewards" },
  { label: "Payments", icon: CreditCard, href: "/member/payments", activePath: "/member/payments" },
  { label: "Profile", icon: UserIcon, href: "/member/profile", activePath: "/member/profile" },
]

type Props = {
  activePath: string
  children: ReactNode
}

export default function MemberAppShell({ activePath, children }: Props) {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/welcome"
  }

  return (
    <main className="min-h-screen bg-[#020b1c] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-[230px] shrink-0 flex-col border-r border-white/10 bg-[#020817] lg:flex">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1f2c45] text-xs font-extrabold text-[#ff7a1a]">
                BF
              </div>
              <div>
                <p className="text-lg font-extrabold tracking-wide">BEARFIT</p>
                <p className="text-[11px] font-medium text-orange-300">Better fitness.</p>
              </div>
            </div>
            <div className="mt-5 inline-flex items-center rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/15 px-3 py-1.5 text-xs font-semibold text-[#ff9b54]">
              Member
            </div>
          </div>

          <nav className="flex-1 space-y-2 border-t border-white/10 px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = item.activePath === activePath

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm transition ${
                    active
                      ? "bg-[#ff7a1a] font-semibold text-white shadow-lg shadow-orange-950/30"
                      : "text-white/75 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}

            <button
              type="button"
              title="More features coming later"
              className="flex w-full cursor-default items-center gap-3 rounded-xl px-4 py-3.5 text-sm text-white/35"
            >
              <MoreHorizontal size={18} />
              <span>More</span>
            </button>
          </nav>

          <div className="space-y-1 border-t border-white/10 p-3">
            <button type="button" title="Notifications coming soon" className="flex w-full cursor-default items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/45">
              <Bell size={17} /> Notifications
            </button>
            <button type="button" title="Messages coming soon" className="flex w-full cursor-default items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/45">
              <MessageCircle size={17} /> Messages
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white/75 transition hover:bg-white/5"
            >
              <LogOut size={17} /> Sign out
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>

        <nav
          aria-label="Mobile app navigation"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#07101f]/95 px-2 pt-2 backdrop-blur-xl lg:hidden"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
        >
          <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = item.activePath === activePath
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold transition ${
                    active ? "bg-[#ff7a1a] text-white" : "text-white/55 active:bg-white/10 active:text-white"
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </main>
  )
}
