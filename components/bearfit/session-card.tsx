"use client"

import React from "react"

import { useEffect, useState, useRef } from "react"
import { QrCode, X, Camera, Info, Clock, MapPin, User, Dumbbell, CalendarDays } from "lucide-react"

const sessions = [
  {
    title: "Weights Sessions",
    branch: "Malingap Branch",
    time: "6:00 - 7:00pm",
    coach: "Coach Joaquin",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80",
    initialTime: { hours: 0, minutes: 30, seconds: 0 },
    description: "Full body weight training focusing on compound movements",
    equipment: ["Barbells", "Dumbbells", "Bench"],
    intensity: "High",
    calories: "400-500",
  },
  {
    title: "Cardio Blast",
    branch: "E. Rodriguez Branch",
    time: "8:00 - 9:00am",
    coach: "Coach Maria",
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80",
    initialTime: { hours: 1, minutes: 15, seconds: 42 },
    description: "High-intensity cardio session with interval training",
    equipment: ["Treadmill", "Jump Rope", "Bike"],
    intensity: "Very High",
    calories: "500-600",
  },
  {
    title: "Boxing Training",
    branch: "Malingap Branch",
    time: "5:00 - 6:30pm",
    coach: "Coach Miguel",
    image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&q=80",
    initialTime: { hours: 2, minutes: 45, seconds: 10 },
    description: "Boxing fundamentals with pad work and conditioning",
    equipment: ["Boxing Gloves", "Heavy Bag", "Speed Bag"],
    intensity: "High",
    calories: "450-550",
  },
  {
    title: "Muay Thai",
    branch: "Cubao Branch",
    time: "7:00 - 8:30pm",
    coach: "Coach Somchai",
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80",
    initialTime: { hours: 3, minutes: 30, seconds: 55 },
    description: "Traditional Muay Thai training with technique drills",
    equipment: ["Shin Guards", "Thai Pads", "Heavy Bag"],
    intensity: "Very High",
    calories: "600-700",
  },
]

export function SessionCard() {
  const [times, setTimes] = useState(sessions.map(s => s.initialTime))
  const [mounted, setMounted] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedSession, setSelectedSession] = useState<typeof sessions[0] | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => {
      setTimes((prevTimes) =>
        prevTimes.map((prev) => {
          let { hours, minutes, seconds } = prev
          seconds--
          if (seconds < 0) {
            seconds = 59
            minutes--
            if (minutes < 0) {
              minutes = 59
              hours--
              if (hours < 0) {
                hours = 0
                minutes = 0
                seconds = 0
              }
            }
          }
          return { hours, minutes, seconds }
        })
      )
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const handleScroll = () => {
      const scrollLeft = scrollEl.scrollLeft
      const cardWidth = scrollEl.clientWidth
      const index = Math.round(scrollLeft / cardWidth)
      setActiveIndex(Math.min(index, sessions.length - 1))
    }

    scrollEl.addEventListener("scroll", handleScroll)
    return () => scrollEl.removeEventListener("scroll", handleScroll)
  }, [])

  const formatNumber = (num: number) => num.toString().padStart(2, "0")

  const getTimeDisplay = (time: { hours: number; minutes: number; seconds: number }) => {
    const totalMinutes = time.hours * 60 + time.minutes
    if (totalMinutes < 60) {
      return `${totalMinutes} min left`
    }
    return `${time.hours}h ${time.minutes}m left`
  }

  const handleCheckIn = (session: typeof sessions[0], e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedSession(session)
    setShowCheckIn(true)
  }

  const handleShowDetails = (session: typeof sessions[0], e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedSession(session)
    setShowDetails(true)
  }

  const handleScan = () => {
    setIsScanning(true)
    setTimeout(() => {
      setIsScanning(false)
      setShowCheckIn(false)
      setSelectedSession(null)
      alert("Check-in successful!")
    }, 2000)
  }

  return (
    <>
      <div className="mt-4">
        <div className="px-4 flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Upcoming Sessions</h2>
          <div className="flex gap-1.5">
            {sessions.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIndex ? "w-4 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex overflow-x-auto hide-scrollbar snap-scroll"
        >
          {sessions.map((session, index) => (
            <div
              key={index}
              className="shrink-0 w-full px-4"
            >
              <div className="relative rounded-2xl overflow-hidden h-36 card-press group">
                {/* Background Image */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                  style={{
                    backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.92) 45%, rgba(0,0,0,0.5)), url('${session.image}')`,
                  }}
                />

                {/* Content */}
                <div className="relative z-10 p-3.5 h-full flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="inline-block px-2 py-0.5 bg-primary text-primary-foreground text-[9px] rounded-full font-semibold uppercase tracking-wide">
                        Upcoming
                      </span>
                      <h3 className="text-base font-bold text-white mt-1 truncate">{session.title}</h3>
                      <p className="text-[10px] text-white/60 truncate">{session.branch} - {session.time}</p>
                      <p className="text-[10px] text-primary font-medium">{session.coach}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button 
                        onClick={(e) => handleCheckIn(session, e)}
                        className="px-2.5 py-1.5 bg-primary text-primary-foreground text-[10px] rounded-lg font-semibold touch-active flex items-center gap-1"
                      >
                        <QrCode className="w-3 h-3" />
                        Check In
                      </button>
                      <button 
                        onClick={(e) => handleShowDetails(session, e)}
                        className="px-2.5 py-1.5 bg-white/10 text-white text-[10px] rounded-lg font-medium touch-active flex items-center gap-1"
                      >
                        <Info className="w-3 h-3" />
                        Details
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-xl font-bold text-white font-mono tracking-wider transition-opacity ${mounted ? 'opacity-100' : 'opacity-50'}`}>
                        {formatNumber(times[index].hours)}:{formatNumber(times[index].minutes)}:{formatNumber(times[index].seconds)}
                      </span>
                      <span className="text-[10px] text-primary font-semibold">{getTimeDisplay(times[index])}</span>
                    </div>
                    <div className="flex gap-5 text-[8px] text-white/40 mt-0.5 font-medium uppercase tracking-wider">
                      <span>Hours</span>
                      <span>Minutes</span>
                      <span>Seconds</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Session Details Modal */}
      {showDetails && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#141414] rounded-t-3xl lg:rounded-2xl overflow-hidden border border-border/50 animate-slide-up max-h-[85vh] overflow-y-auto">
            {/* Header Image */}
            <div className="relative h-40">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(to top, #141414 0%, transparent 50%), url('${selectedSession.image}')`,
                }}
              />
              <button 
                onClick={() => setShowDetails(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/50 backdrop-blur-sm touch-active"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 -mt-6 relative">
              <span className="inline-block px-2.5 py-1 bg-primary text-primary-foreground text-[10px] rounded-full font-semibold uppercase tracking-wide">
                Upcoming
              </span>
              <h3 className="text-xl font-bold text-foreground mt-2">{selectedSession.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{selectedSession.description}</p>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="bg-secondary rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">Time</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{selectedSession.time}</p>
                </div>
                <div className="bg-secondary rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">Location</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{selectedSession.branch}</p>
                </div>
                <div className="bg-secondary rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <User className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">Coach</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{selectedSession.coach}</p>
                </div>
                <div className="bg-secondary rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Dumbbell className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">Intensity</span>
                  </div>
                  <p className="text-sm font-semibold text-primary">{selectedSession.intensity}</p>
                </div>
              </div>

              {/* Equipment */}
              <div className="mt-5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Equipment Needed</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedSession.equipment.map((item, i) => (
                    <span key={i} className="px-3 py-1.5 bg-secondary rounded-lg text-xs font-medium text-foreground">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Calories */}
              <div className="mt-5 bg-primary/10 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Estimated Burn</p>
                  <p className="text-lg font-bold text-primary">{selectedSession.calories} cal</p>
                </div>
                <CalendarDays className="w-8 h-8 text-primary/50" />
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-5">
                <button 
                  onClick={() => {
                    setShowDetails(false)
                    setShowCheckIn(true)
                  }}
                  className="flex-1 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold touch-active flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  Check In Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check-In Modal */}
      {showCheckIn && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#141414] rounded-2xl w-full max-w-sm overflow-hidden border border-border/50 animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-foreground">Check In</h3>
              <button 
                onClick={() => setShowCheckIn(false)}
                className="p-1.5 rounded-full bg-secondary touch-active"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="text-center mb-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Checking in to</p>
                <p className="text-base font-bold text-foreground mt-1">{selectedSession.title}</p>
                <p className="text-xs text-muted-foreground">{selectedSession.branch}</p>
              </div>

              {/* QR Scanner Area */}
              <div className="relative bg-black rounded-xl overflow-hidden aspect-square mb-4">
                <div className="absolute inset-0 flex items-center justify-center">
                  {isScanning ? (
                    <div className="text-center">
                      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-primary mt-3 font-medium">Scanning...</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-40 h-40 border-2 border-dashed border-primary/40 rounded-xl flex items-center justify-center">
                        <Camera className="w-10 h-10 text-primary/40" />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-3">Position QR code within frame</p>
                    </div>
                  )}
                </div>
                {/* Scanner corners */}
                <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-primary rounded-tl" />
                <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-primary rounded-tr" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-primary rounded-bl" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-primary rounded-br" />
              </div>

              <button 
                onClick={handleScan}
                disabled={isScanning}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold touch-active disabled:opacity-50"
              >
                {isScanning ? "Scanning..." : "Scan QR Code"}
              </button>

              <p className="text-[9px] text-muted-foreground text-center mt-3">
                Scan the QR code at the gym entrance
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
