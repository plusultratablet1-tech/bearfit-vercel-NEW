"use client"

import { useState } from "react"
import { CreditCard, Receipt, Clock, CheckCircle, AlertCircle, ChevronRight, QrCode, Building2, Copy, Check } from "lucide-react"

const paymentHistory = [
  {
    id: 1,
    description: "Monthly Package Renewal",
    amount: "P2,500",
    date: "Feb 1, 2026",
    time: "10:30 AM",
    status: "completed",
    method: "GCash",
    reference: "GC-2026020110301234",
  },
  {
    id: 2,
    description: "Personal Training Session",
    amount: "P1,500",
    date: "Jan 28, 2026",
    time: "2:15 PM",
    status: "completed",
    method: "Bank Transfer",
    reference: "BDO-2026012814150987",
  },
  {
    id: 3,
    description: "Full 48 Package+ Upgrade",
    amount: "P48,600",
    date: "Jan 15, 2026",
    time: "9:00 AM",
    status: "completed",
    method: "Maya",
    reference: "MY-2026011509001234",
  },
  {
    id: 4,
    description: "Pending Renewal",
    amount: "P2,500",
    date: "Feb 28, 2026",
    time: "-",
    status: "pending",
    method: "-",
    reference: "-",
  },
]

const paymentStats = [
  { label: "Total Paid", value: "P52,600", icon: CreditCard, color: "text-green-500" },
  { label: "This Month", value: "P2,500", icon: Receipt, color: "text-primary" },
  { label: "Pending", value: "P2,500", icon: Clock, color: "text-yellow-500" },
]

const bankDetails = {
  bankName: "BDO Unibank",
  accountName: "BearFit Fitness Inc.",
  accountNumber: "0012 3456 7890",
  branch: "Malingap Branch",
}

export function WorkoutPage() {
  const [copied, setCopied] = useState(false)

  const copyAccountNumber = () => {
    navigator.clipboard.writeText(bankDetails.accountNumber.replace(/\s/g, ""))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">Your payment history and transactions</p>
      </div>

      {/* Payment Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {paymentStats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-[#1a1a1a] rounded-2xl p-3 text-center border border-border/50">
              <Icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Payment Methods */}
      <div className="mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Payment Methods</h2>
        
        {/* QR Code Payment */}
        <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Pay via QR Code</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="bg-white p-3 rounded-xl">
              <div className="w-32 h-32 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-28 h-28">
                  <rect x="10" y="10" width="25" height="25" fill="#000"/>
                  <rect x="65" y="10" width="25" height="25" fill="#000"/>
                  <rect x="10" y="65" width="25" height="25" fill="#000"/>
                  <rect x="15" y="15" width="15" height="15" fill="#fff"/>
                  <rect x="70" y="15" width="15" height="15" fill="#fff"/>
                  <rect x="15" y="70" width="15" height="15" fill="#fff"/>
                  <rect x="18" y="18" width="9" height="9" fill="#000"/>
                  <rect x="73" y="18" width="9" height="9" fill="#000"/>
                  <rect x="18" y="73" width="9" height="9" fill="#000"/>
                  <rect x="40" y="10" width="5" height="5" fill="#000"/>
                  <rect x="50" y="10" width="5" height="5" fill="#000"/>
                  <rect x="40" y="20" width="5" height="5" fill="#000"/>
                  <rect x="45" y="25" width="5" height="5" fill="#000"/>
                  <rect x="40" y="40" width="20" height="20" fill="#000"/>
                  <rect x="45" y="45" width="10" height="10" fill="#fff"/>
                  <rect x="48" y="48" width="4" height="4" fill="#000"/>
                  <rect x="65" y="40" width="5" height="5" fill="#000"/>
                  <rect x="75" y="45" width="5" height="5" fill="#000"/>
                  <rect x="85" y="50" width="5" height="5" fill="#000"/>
                  <rect x="40" y="65" width="5" height="5" fill="#000"/>
                  <rect x="50" y="70" width="5" height="5" fill="#000"/>
                  <rect x="65" y="65" width="10" height="10" fill="#000"/>
                  <rect x="80" y="75" width="10" height="10" fill="#000"/>
                </svg>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Scan to pay with GCash or Maya</p>
          </div>
        </div>

        {/* Bank Transfer Details */}
        <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Bank Transfer Details</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">Bank Name</span>
              <span className="text-xs font-medium text-foreground">{bankDetails.bankName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">Account Name</span>
              <span className="text-xs font-medium text-foreground">{bankDetails.accountName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">Account Number</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground font-mono">{bankDetails.accountNumber}</span>
                <button 
                  onClick={copyAccountNumber}
                  className="p-1 rounded bg-primary/10 touch-active"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-primary" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">Branch</span>
              <span className="text-xs font-medium text-foreground">{bankDetails.branch}</span>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground mt-3 text-center">
            Please send proof of payment to the front desk or via chat
          </p>
        </div>
      </div>

      {/* Payment History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Transaction History</h2>
          <button className="text-xs text-primary font-medium">See All</button>
        </div>
        <div className="space-y-3">
          {paymentHistory.map((payment) => (
            <div
              key={payment.id}
              className="bg-[#1a1a1a] rounded-2xl p-4 border border-border/50 touch-active hover:bg-[#1f1f1f] transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    payment.status === "completed" ? "bg-green-500/20" : "bg-yellow-500/20"
                  }`}>
                    {payment.status === "completed" ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{payment.description}</p>
                    <p className="text-[10px] text-muted-foreground">{payment.date} at {payment.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${payment.status === "completed" ? "text-foreground" : "text-yellow-500"}`}>
                    {payment.amount}
                  </p>
                  <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full ${
                    payment.status === "completed" 
                      ? "bg-green-500/20 text-green-500" 
                      : "bg-yellow-500/20 text-yellow-500"
                  }`}>
                    {payment.status === "completed" ? "Completed" : "Pending"}
                  </span>
                </div>
              </div>
              {payment.status === "completed" && (
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[9px] text-muted-foreground">Method</p>
                      <p className="text-[10px] text-foreground font-medium">{payment.method}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">Reference</p>
                      <p className="text-[10px] text-foreground font-mono">{payment.reference}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
