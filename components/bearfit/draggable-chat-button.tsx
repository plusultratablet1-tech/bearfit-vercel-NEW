"use client"

import React, { useState, useRef, useEffect } from "react"
import { MessageCircle } from "lucide-react"

interface DraggableChatButtonProps {
  onClick: () => void
  /** Backward-compatible: old prop name */
  unreadCount?: number
  /** New prop name used in app/page.tsx */
  messageCount?: number
}

export function DraggableChatButton({
  onClick,
  unreadCount,
  messageCount,
}: DraggableChatButtonProps) {
  // Prefer messageCount if provided; fallback to unreadCount; default 0
  const count = messageCount ?? unreadCount ?? 0

  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [hasMoved, setHasMoved] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const initialPosRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    // Initialize position to bottom-right
    if (typeof window !== "undefined") {
      setPosition({
        x: window.innerWidth - 60,
        y: window.innerHeight - 140,
      })
    }
  }, [])

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true)
    setHasMoved(false)
    dragStartRef.current = { x: clientX, y: clientY }
    initialPosRef.current = { ...position }
  }

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return

    const deltaX = clientX - dragStartRef.current.x
    const deltaY = clientY - dragStartRef.current.y

    // Check if we've moved enough to consider it a drag
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setHasMoved(true)
    }

    const newX = Math.min(Math.max(10, initialPosRef.current.x + deltaX), window.innerWidth - 56)
    const newY = Math.min(Math.max(80, initialPosRef.current.y + deltaY), window.innerHeight - 140)

    setPosition({ x: newX, y: newY })
  }

  const handleEnd = () => {
    setIsDragging(false)

    // If we didn't move much, trigger click
    if (!hasMoved) {
      onClick()
    }
  }

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX, e.clientY)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY)
    }

    const handleMouseUp = () => {
      handleEnd()
    }

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, hasMoved]) // position refs are used, ok

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleMove(touch.clientX, touch.clientY)
  }

  const handleTouchEnd = () => {
    handleEnd()
  }

  return (
    <button
      ref={buttonRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -50%)",
        touchAction: "none",
        cursor: isDragging ? "grabbing" : "grab",
      }}
      className={`w-12 h-12 bg-primary rounded-full shadow-lg flex items-center justify-center z-40 transition-transform ${
        isDragging ? "scale-110" : "active:scale-95"
      }`}
    >
      <MessageCircle className="w-5 h-5 text-primary-foreground" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  )
}
