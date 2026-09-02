"use client"

import { useState, useRef, useEffect } from "react"
import { HelpCircle } from "lucide-react"

export function InfoTooltip({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-white/50 hover:text-white transition"
      >
        <HelpCircle size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-50 w-64 rounded-xl bg-black/90 p-4 text-sm text-white shadow-xl">
          {content}
        </div>
      )}
    </div>
  )
}
