"use client"

import { useState } from "react"
import Image from "next/image"
import { Settings, Bell, CreditCard, HelpCircle, LogOut, ChevronRight, Award, Target, Flame, Calendar, Edit2, Camera, MapPin, Phone, Mail, Shield, Package, Share2, X, Plus, Trash2, Lock, Smartphone, FileText, ChevronDown, MessageCircle, Globe } from "lucide-react"

// Notifications data
const notificationsData = [
  { id: 1, type: "session", title: "Session Reminder", message: "Weights Session starts in 30 minutes", time: "Just now", unread: true },
  { id: 2, type: "promo", title: "New Year Promo!", message: "Get 20% off on all packages this February", time: "1h ago", unread: true },
  { id: 3, type: "points", title: "Points Earned", message: "You earned 50 Bearforce Points!", time: "2h ago", unread: true },
  { id: 4, type: "payment", title: "Payment Received", message: "Your payment of P2,500 has been confirmed", time: "Yesterday", unread: false },
  { id: 5, type: "session", title: "Session Completed", message: "Great job on your cardio session!", time: "2 days ago", unread: false },
]

// Payment methods data
const paymentMethodsData = [
  { id: 1, type: "gcash", name: "GCash", details: "**** 1234", isDefault: true, icon: "G" },
  { id: 2, type: "maya", name: "Maya", details: "**** 5678", isDefault: false, icon: "M" },
  { id: 3, type: "bank", name: "BDO Account", details: "**** 9012", isDefault: false, icon: "B" },
]

// FAQ data
const faqData = [
  { q: "How do I book a session?", a: "Go to Schedule tab and tap on an available time slot to book your session with your preferred coach." },
  { q: "How do I earn points?", a: "Complete workouts (+50 pts), refer friends (+200 pts), maintain streaks (+100 pts/week), and participate in challenges." },
  { q: "Can I cancel a booking?", a: "Yes, you can cancel up to 2 hours before your scheduled session without penalty." },
  { q: "How do I update my payment method?", a: "Go to Profile > Payment Methods to add, remove, or set default payment options." },
  { q: "What happens when my package expires?", a: "You'll receive reminders before expiry. Unused sessions can be extended for a small fee." },
]

const achievements = [
  { icon: Flame, label: "17 Day Streak", color: "bg-primary", description: "Maintained 17 consecutive workout days" },
  { icon: Target, label: "50 Workouts", color: "bg-green-500", description: "Completed 50 total workout sessions" },
  { icon: Award, label: "Season 2 Elite", color: "bg-red-600", description: "Achieved Elite status in Season 2" },
  { icon: Calendar, label: "6 Month Member", color: "bg-blue-500", description: "Active member for 6+ months" },
]

const personalInfo = {
  name: "Alex Johnson",
  username: "@alexfit_bear",
  email: "alex.johnson@email.com",
  phone: "0917-123-4567",
  memberSince: "August 2025",
  branch: "Malingap Branch",
  membershipId: "M00-1",
  package: "Full 48 Package+",
  sessionsLeft: 40,
  totalSessions: 48,
}

const quickStats = [
  { label: "Workouts", value: "127", color: "text-foreground" },
  { label: "Points", value: "1,540", color: "text-primary" },
  { label: "Day Streak", value: "17", color: "text-foreground" },
]

export function ProfilePage() {
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPaymentMethods, setShowPaymentMethods] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="pb-8">
      {/* Profile Header with Cover */}
      <div className="relative">
        {/* Cover Image Area */}
        <div className="h-24 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
        
        {/* Profile Picture - Overlapping */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-12">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-background shadow-xl">
              <Image
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80"
                alt="Profile"
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            </div>
            <button className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full border-2 border-background flex items-center justify-center shadow-md">
              <Camera className="w-3.5 h-3.5 text-primary-foreground" />
            </button>
            {/* Season Badge */}
            <div className="absolute -top-1 -right-1 w-7 h-7 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">2</span>
            </div>
          </div>
        </div>

        {/* Settings Button */}
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute top-3 right-3 p-2 bg-secondary/80 backdrop-blur rounded-full touch-active"
        >
          <Settings className="w-4 h-4 text-foreground" />
        </button>

        {/* Share Button */}
        <button className="absolute top-3 left-3 p-2 bg-secondary/80 backdrop-blur rounded-full touch-active">
          <Share2 className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Profile Info */}
      <div className="px-4 pt-14">
        {/* Name and Username */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-foreground">{personalInfo.name}</h1>
          <p className="text-sm text-muted-foreground">{personalInfo.username}</p>
          
          {/* Status Badges */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="px-3 py-1 bg-primary/20 text-primary text-[10px] rounded-full font-medium">
              Prestige Member
            </span>
            <span className="px-3 py-1 bg-green-500/20 text-green-500 text-[10px] rounded-full font-medium">
              Active
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {quickStats.map((stat, index) => (
            <div key={index} className="bg-[#1a1a1a] rounded-xl p-3 text-center border border-border/50">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Membership Card */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-4 border border-border/50 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Membership</span>
            </div>
            <span className="text-[10px] text-muted-foreground">ID: {personalInfo.membershipId}</span>
          </div>
          
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{personalInfo.package}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{personalInfo.branch}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-primary">{personalInfo.sessionsLeft}</p>
              <p className="text-[9px] text-muted-foreground">of {personalInfo.totalSessions} sessions</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-primary to-yellow-500 h-2 rounded-full transition-all" 
              style={{ width: `${(personalInfo.sessionsLeft / personalInfo.totalSessions) * 100}%` }} 
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-border/50 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-foreground">Contact Info</span>
            <button 
              onClick={() => setShowEditProfile(true)}
              className="flex items-center gap-1 text-[10px] text-primary font-medium touch-active"
            >
              <Edit2 className="w-3 h-3" />
              Edit
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-foreground">{personalInfo.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-foreground">{personalInfo.phone}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-foreground">Member since {personalInfo.memberSince}</span>
            </div>
          </div>
        </div>

        {/* Achievements */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Achievements</h2>
            <span className="text-[10px] text-muted-foreground">{achievements.length} earned</span>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {achievements.map((achievement, index) => {
              const Icon = achievement.icon
              return (
                <div
                  key={index}
                  className="flex flex-col items-center min-w-[72px] touch-active"
                >
                  <div className={`w-12 h-12 ${achievement.color} rounded-xl flex items-center justify-center mb-1.5 shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-[9px] text-muted-foreground text-center leading-tight">{achievement.label}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-border/50 mb-4">
          {[
            { icon: Bell, label: "Notifications", badge: "3", action: () => setShowNotifications(true) },
            { icon: CreditCard, label: "Payment Methods", badge: null, action: () => setShowPaymentMethods(true) },
            { icon: Shield, label: "Privacy & Security", badge: null, action: () => setShowPrivacy(true) },
            { icon: HelpCircle, label: "Help & Support", badge: null, action: () => setShowHelp(true) },
          ].map((item, index) => {
            const Icon = item.icon
            return (
              <button
                key={index}
                onClick={item.action}
                className="flex items-center justify-between w-full p-3.5 touch-active hover:bg-white/5 transition-colors border-b border-border/30 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] text-primary-foreground font-bold">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            )
          })}
        </div>

        {/* Logout Button */}
        <button className="flex items-center justify-center gap-2 w-full py-3.5 bg-red-500/10 text-red-500 rounded-xl font-medium touch-active hover:bg-red-500/20 transition-colors">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Notifications Modal */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#141414] rounded-t-3xl lg:rounded-2xl overflow-hidden border border-border/50 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-[#141414] z-10">
              <h3 className="text-base font-semibold text-foreground">Notifications</h3>
              <button onClick={() => setShowNotifications(false)} className="p-1.5 rounded-full bg-secondary touch-active">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {notificationsData.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-3 rounded-xl ${notif.unread ? "bg-primary/10 border border-primary/30" : "bg-secondary"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      notif.type === "session" ? "bg-blue-500/20" :
                      notif.type === "promo" ? "bg-yellow-500/20" :
                      notif.type === "points" ? "bg-green-500/20" :
                      "bg-primary/20"
                    }`}>
                      <Bell className={`w-4 h-4 ${
                        notif.type === "session" ? "text-blue-500" :
                        notif.type === "promo" ? "text-yellow-500" :
                        notif.type === "points" ? "text-green-500" :
                        "text-primary"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">{notif.title}</p>
                        {notif.unread && <span className="w-2 h-2 bg-primary rounded-full shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{notif.message}</p>
                      <p className="text-[9px] text-muted-foreground mt-1">{notif.time}</p>
                    </div>
                  </div>
                </div>
              ))}
              <button className="w-full py-2.5 text-xs text-primary font-medium touch-active">
                Mark all as read
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Methods Modal */}
      {showPaymentMethods && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#141414] rounded-t-3xl lg:rounded-2xl overflow-hidden border border-border/50 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-[#141414] z-10">
              <h3 className="text-base font-semibold text-foreground">Payment Methods</h3>
              <button onClick={() => setShowPaymentMethods(false)} className="p-1.5 rounded-full bg-secondary touch-active">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {paymentMethodsData.map((method) => (
                <div key={method.id} className={`p-3 rounded-xl border ${method.isDefault ? "bg-primary/10 border-primary/30" : "bg-secondary border-border/30"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                        method.type === "gcash" ? "bg-blue-500 text-white" :
                        method.type === "maya" ? "bg-green-500 text-white" :
                        "bg-blue-800 text-white"
                      }`}>
                        {method.icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{method.name}</p>
                        <p className="text-[10px] text-muted-foreground">{method.details}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.isDefault && (
                        <span className="text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">Default</span>
                      )}
                      <button className="p-1.5 rounded-full hover:bg-white/10 touch-active">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-xl text-xs text-muted-foreground touch-active hover:border-primary hover:text-primary transition-colors">
                <Plus className="w-4 h-4" />
                Add Payment Method
              </button>
              <div className="bg-secondary rounded-xl p-3 mt-2">
                <p className="text-[10px] text-muted-foreground text-center">
                  Your payment information is secured with industry-standard encryption. We never store your full card details.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy & Security Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#141414] rounded-t-3xl lg:rounded-2xl overflow-hidden border border-border/50 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-[#141414] z-10">
              <h3 className="text-base font-semibold text-foreground">Privacy & Security</h3>
              <button onClick={() => setShowPrivacy(false)} className="p-1.5 rounded-full bg-secondary touch-active">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-xs font-semibold text-foreground mb-3">Security Settings</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lock className="w-4 h-4 text-primary" />
                      <span className="text-xs text-foreground">Two-Factor Authentication</span>
                    </div>
                    <div className="w-10 h-6 bg-green-500 rounded-full relative cursor-pointer">
                      <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-all" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-primary" />
                      <span className="text-xs text-foreground">Biometric Login</span>
                    </div>
                    <div className="w-10 h-6 bg-green-500 rounded-full relative cursor-pointer">
                      <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-all" />
                    </div>
                  </div>
                  <button className="w-full flex items-center justify-between p-2 touch-active">
                    <div className="flex items-center gap-3">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-foreground">Change Password</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button className="w-full flex items-center justify-between p-2 touch-active">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-foreground">Active Sessions</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">2 devices</span>
                  </button>
                </div>
              </div>
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-xs font-semibold text-foreground mb-3">Data & Privacy</p>
                <div className="space-y-2">
                  <button className="w-full flex items-center justify-between p-2 touch-active">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-foreground">Download My Data</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button className="w-full flex items-center justify-between p-2 touch-active">
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-foreground">Privacy Policy</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button className="w-full flex items-center justify-between p-2 touch-active">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-foreground">Terms of Service</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <button className="w-full py-3 bg-red-500/20 text-red-500 rounded-xl font-semibold touch-active text-sm">
                Delete My Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help & Support Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#141414] rounded-t-3xl lg:rounded-2xl overflow-hidden border border-border/50 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-[#141414] z-10">
              <h3 className="text-base font-semibold text-foreground">Help & Support</h3>
              <button onClick={() => setShowHelp(false)} className="p-1.5 rounded-full bg-secondary touch-active">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-xs font-semibold text-foreground mb-3">Frequently Asked Questions</p>
                <div className="space-y-2">
                  {faqData.map((faq, i) => (
                    <details key={i} className="group bg-[#0d0d0d] rounded-lg">
                      <summary className="p-3 text-xs font-medium text-foreground cursor-pointer flex items-center justify-between">
                        {faq.q}
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="px-3 pb-3 text-[11px] text-muted-foreground leading-relaxed">{faq.a}</p>
                    </details>
                  ))}
                </div>
              </div>
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-xs font-semibold text-foreground mb-3">Contact Us</p>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-3 p-3 bg-[#0d0d0d] rounded-lg touch-active">
                    <Phone className="w-4 h-4 text-primary" />
                    <div className="text-left">
                      <p className="text-xs text-foreground">Call Support</p>
                      <p className="text-[10px] text-muted-foreground">0917-BEARFIT (0917-232-7348)</p>
                    </div>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 bg-[#0d0d0d] rounded-lg touch-active">
                    <Mail className="w-4 h-4 text-primary" />
                    <div className="text-left">
                      <p className="text-xs text-foreground">Email Us</p>
                      <p className="text-[10px] text-muted-foreground">support@bearfit.ph</p>
                    </div>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 bg-[#0d0d0d] rounded-lg touch-active">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    <div className="text-left">
                      <p className="text-xs text-foreground">Live Chat</p>
                      <p className="text-[10px] text-muted-foreground">Available 6AM - 10PM daily</p>
                    </div>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 bg-[#0d0d0d] rounded-lg touch-active">
                    <Globe className="w-4 h-4 text-primary" />
                    <div className="text-left">
                      <p className="text-xs text-foreground">Visit Website</p>
                      <p className="text-[10px] text-muted-foreground">www.bearfit.ph</p>
                    </div>
                  </button>
                </div>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">BearFit App v2.0.1</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
