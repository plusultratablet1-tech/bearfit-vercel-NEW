"use client"

import { useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import {
  Home,
  Calendar,
  CreditCard,
  User as UserIcon,
  MoreHorizontal,
  LogOut,
} from "lucide-react"

const supabase = createClient()

type Props = {
  user: User
  member: any | null
}

export default function BearfitDashboardClient({ user, member }: Props) {
  const [activeTab, setActiveTab] = useState("home")

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/welcome"
  }

  const memberNavItems = [
    { icon: Home, label: "Home", id: "home" },
    { icon: Calendar, label: "Schedule", id: "schedule" },
    { icon: CreditCard, label: "Payment", id: "payment" },
    { icon: UserIcon, label: "Profile", id: "profile" },
    { icon: MoreHorizontal, label: "More", id: "more" },
  ]

  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Bearfit Dashboard</h1>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>

        {/* USER INFO */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <p className="text-sm text-gray-500">Logged in as</p>
          <p className="font-medium">{user.email}</p>
        </div>

        {/* NAVIGATION */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {memberNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center p-3 rounded-lg text-xs ${
                activeTab === item.id
                  ? "bg-black text-white"
                  : "bg-white border"
              }`}
            >
              <item.icon size={18} />
              <span className="mt-1">{item.label}</span>
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          {activeTab === "home" && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Home</h2>
              <p>Welcome to your dashboard.</p>
            </div>
          )}

          {activeTab === "schedule" && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Schedule</h2>
              <p>Your sessions will appear here.</p>
            </div>
          )}

          {activeTab === "payment" && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Payment</h2>
              <p>Payment details will appear here.</p>
            </div>
          )}

          {activeTab === "profile" && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Profile</h2>
              <pre className="text-xs bg-gray-100 p-3 rounded">
                {JSON.stringify(member, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === "more" && (
            <div>
              <h2 className="text-lg font-semibold mb-2">More</h2>
              <p>More features coming soon.</p>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
