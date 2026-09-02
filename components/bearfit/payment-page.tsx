"use client"

import { useState } from "react"
import { CheckCircle, AlertCircle, Receipt, Clock, CreditCard, X, ChevronLeft, ChevronRight, Filter } from "lucide-react"

const paymentHistory = [
  {
    id: 1,
    description: "Monthly Package Renewal",
    amount: "P2,500",
    date: "Feb 3, 2026",
    time: "10:30 AM",
    status: "completed",
    method: "GCash",
    reference: "GC-2026020310301234",
  },
  {
    id: 2,
    description: "Personal Training Session",
    amount: "P1,500",
    date: "Feb 1, 2026",
    time: "2:15 PM",
    status: "completed",
    method: "Bank Transfer",
    reference: "BDO-2026020114150987",
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
  {
    id: 5,
    description: "Personal Training Session",
    amount: "P1,500",
    date: "Jan 10, 2026",
    time: "3:00 PM",
    status: "completed",
    method: "GCash",
    reference: "GC-2026011015000123",
  },
  {
    id: 6,
    description: "Monthly Package",
    amount: "P2,500",
    date: "Jan 1, 2026",
    time: "9:00 AM",
    status: "completed",
    method: "Maya",
    reference: "MY-2026010109001234",
  },
  {
    id: 7,
    description: "Recovery Massage",
    amount: "P800",
    date: "Dec 28, 2025",
    time: "4:30 PM",
    status: "completed",
    method: "Cash",
    reference: "CASH-2025122816300987",
  },
  {
    id: 8,
    description: "Monthly Package",
    amount: "P2,500",
    date: "Dec 1, 2025",
    time: "10:00 AM",
    status: "completed",
    method: "Bank Transfer",
    reference: "BDO-2025120110000456",
  },
]

const paymentStats = [
  { label: "Total Paid", value: "P59,900", icon: CreditCard, color: "text-green-500" },
  { label: "This Month", value: "P4,000", icon: Receipt, color: "text-primary" },
  { label: "Pending", value: "P2,500", icon: Clock, color: "text-yellow-500" },
]

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

export function PaymentPage() {
  const [selectedTransaction, setSelectedTransaction] = useState<typeof paymentHistory[0] | null>(null)
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending">("all")
  const [currentMonth, setCurrentMonth] = useState(1) // February
  const [currentYear, setCurrentYear] = useState(2026)

  const filteredPayments = paymentHistory.filter(payment => {
    if (filterStatus === "all") return true
    return payment.status === filterStatus
  })

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  return (
    <div className="px-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-foreground">Payments History</h1>
        <div className="flex items-center gap-1.5">
          <button className="p-1.5 bg-secondary rounded-lg touch-active" onClick={handlePrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold px-2 min-w-[100px] text-center">{monthNames[currentMonth]} {currentYear}</span>
          <button className="p-1.5 bg-secondary rounded-lg touch-active" onClick={handleNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Payment Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {paymentStats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-[#141414] rounded-xl p-2.5 text-center border border-border/30">
              <Icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
              <p className="text-sm font-bold text-foreground">{stat.value}</p>
              <p className="text-[9px] text-muted-foreground">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "completed", "pending"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium touch-active transition-all ${
              filterStatus === status
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {status === "all" && <Filter className="w-3 h-3" />}
            {status === "completed" && <CheckCircle className="w-3 h-3" />}
            {status === "pending" && <Clock className="w-3 h-3" />}
            <span className="capitalize">{status}</span>
          </button>
        ))}
      </div>

      {/* Transaction History */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Transaction History</h2>
        <span className="text-[10px] text-muted-foreground">{filteredPayments.length} transactions</span>
      </div>
      <div className="space-y-2">
        {filteredPayments.map((payment) => (
          <button
            key={payment.id}
            onClick={() => setSelectedTransaction(payment)}
            className="w-full bg-[#141414] rounded-xl p-3 border border-border/30 touch-active card-press text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  payment.status === "completed" ? "bg-green-500/20" : "bg-yellow-500/20"
                }`}>
                  {payment.status === "completed" ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{payment.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[9px] text-muted-foreground">{payment.date}</p>
                    <span className="text-[9px] text-muted-foreground">-</span>
                    <p className="text-[9px] text-muted-foreground">{payment.method}</p>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${payment.status === "completed" ? "text-green-500" : "text-yellow-500"}`}>
                  {payment.amount}
                </p>
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                  payment.status === "completed" 
                    ? "bg-green-500/20 text-green-500" 
                    : "bg-yellow-500/20 text-yellow-500"
                }`}>
                  {payment.status === "completed" ? "Paid" : "Pending"}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#141414] rounded-t-3xl lg:rounded-2xl p-5 border border-border/50 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-foreground">Transaction Details</h3>
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="p-1.5 rounded-full bg-secondary touch-active"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="text-center py-3">
                <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
                  selectedTransaction.status === "completed" ? "bg-green-500/20" : "bg-yellow-500/20"
                }`}>
                  {selectedTransaction.status === "completed" ? (
                    <CheckCircle className="w-7 h-7 text-green-500" />
                  ) : (
                    <AlertCircle className="w-7 h-7 text-yellow-500" />
                  )}
                </div>
                <p className="text-2xl font-bold text-foreground mt-3">{selectedTransaction.amount}</p>
                <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full mt-1.5 font-medium ${
                  selectedTransaction.status === "completed" 
                    ? "bg-green-500/20 text-green-500" 
                    : "bg-yellow-500/20 text-yellow-500"
                }`}>
                  {selectedTransaction.status === "completed" ? "Completed" : "Pending"}
                </span>
              </div>
              <div className="bg-secondary rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted-foreground">Description</span>
                  <span className="text-xs text-foreground">{selectedTransaction.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted-foreground">Date</span>
                  <span className="text-xs text-foreground">{selectedTransaction.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted-foreground">Time</span>
                  <span className="text-xs text-foreground">{selectedTransaction.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted-foreground">Method</span>
                  <span className="text-xs text-foreground">{selectedTransaction.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted-foreground">Reference</span>
                  <span className="text-[10px] text-foreground font-mono">{selectedTransaction.reference}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
