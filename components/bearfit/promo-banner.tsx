"use client"

import { useState, useRef, useEffect } from "react"
import { Bell, Gift, Trophy, TrendingUp } from "lucide-react"

const promoCards = [
  {
    id: 1,
    title: "Track Your Daily Activities",
    description: "Monitor your workouts, calories burned, and progress towards your fitness goals.",
    gradient: "from-primary/95 to-primary/70",
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80",
    icon: TrendingUp,
  },
  {
    id: 2,
    title: "New Year Promo!",
    description: "Get 20% off on all packages when you sign up this February. Limited slots only!",
    gradient: "from-green-600/95 to-green-500/70",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80",
    icon: Gift,
  },
  {
    id: 3,
    title: "February Challenge",
    description: "Complete 20 workouts this month and earn 500 bonus Bearforce Points!",
    gradient: "from-blue-600/95 to-blue-500/70",
    image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80",
    icon: Trophy,
  },
  {
    id: 4,
    title: "Branch Announcement",
    description: "Malingap Branch will have extended hours starting Feb 15. Open until 11PM!",
    gradient: "from-yellow-600/95 to-yellow-500/70",
    image: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&q=80",
    icon: Bell,
  },
]

export function PromoBanner() {
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const handleScroll = () => {
      const scrollLeft = scrollEl.scrollLeft
      const cardWidth = scrollEl.clientWidth - 32
      const index = Math.round(scrollLeft / cardWidth)
      setActiveIndex(Math.min(index, promoCards.length - 1))
    }

    scrollEl.addEventListener("scroll", handleScroll)
    return () => scrollEl.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="mt-4 pb-4">
      <div className="px-4 flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-foreground">Updates & Promos</h3>
        <div className="flex gap-1">
          {promoCards.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === activeIndex ? "w-3 bg-primary" : "w-1 bg-border"
              }`}
            />
          ))}
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory scroll-smooth"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {promoCards.map((card) => {
          const Icon = card.icon
          return (
            <div 
              key={card.id}
              className="shrink-0 w-full snap-center px-4"
            >
              <div className="relative rounded-2xl overflow-hidden h-40 touch-active group">
                {/* Background */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                  style={{
                    backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0.3)), url('${card.image}')`,
                  }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${card.gradient} opacity-80`} />
                </div>

                {/* Content */}
                <div className="relative z-10 p-4 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[10px] text-white/70 uppercase tracking-wider font-medium">Promo</span>
                    </div>
                    <h4 className="text-lg font-bold text-white leading-tight">{card.title}</h4>
                    <p className="text-[11px] text-white/80 mt-1.5 leading-relaxed line-clamp-2 max-w-[240px]">
                      {card.description}
                    </p>
                  </div>
                  <button className="self-start px-4 py-2 bg-white text-black text-[11px] rounded-full font-semibold touch-active active:scale-95 transition-all shadow-lg">
                    Learn More
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
