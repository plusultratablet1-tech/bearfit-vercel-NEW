"use client"

import Image from "next/image"
import { Bell, MessageCircle } from "lucide-react"

export type Role = "Member" | "Staff" | "Leads" | "Admin"

type HeaderProps = {
  logoSrc?: string
  logoAlt?: string
  activeRole: Role
  onRoleChange: (role: Role) => void
  onOpenChat?: () => void
  onOpenNotifications?: () => void
}

type RoleTabsProps = {
  activeRole: Role
  onRoleChange: (role: Role) => void
  className?: string
}

function RoleTabs({ activeRole, onRoleChange, className = "" }: RoleTabsProps) {
  const roles: Role[] = ["Member", "Staff", "Leads", "Admin"]

  return (
    <div className={["inline-flex items-center rounded-2xl bg-secondary p-1", className].join(" ")}>
      {roles.map((role) => {
        const isActive = role === activeRole

        return (
          <button
            key={role}
            type="button"
            onClick={() => onRoleChange(role)}
            className={[
              "px-4 py-2 rounded-xl text-sm font-semibold transition",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-background/30",
            ].join(" ")}
          >
            {role}
          </button>
        )
      })}
    </div>
  )
}

function LogoBlock({ logoSrc, logoAlt }: { logoSrc: string; logoAlt: string }) {
  return (
    <div className="h-20 w-20 overflow-hidden rounded-[24px] bg-[#1f2d49] flex items-center justify-center shrink-0">
      <div className="relative h-10 w-10">
        <Image src={logoSrc} alt={logoAlt} fill className="object-contain" priority />
      </div>
    </div>
  )
}

function HeaderActions({
  onOpenNotifications,
  onOpenChat,
}: {
  onOpenNotifications?: () => void
  onOpenChat?: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onOpenNotifications}
        className="h-14 w-14 rounded-2xl bg-[#1f2d49] text-foreground flex items-center justify-center transition hover:bg-[#2a3b5d]"
        aria-label="Open notifications"
      >
        <Bell className="h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={onOpenChat}
        className="h-14 w-14 rounded-2xl bg-[#1f2d49] text-foreground flex items-center justify-center transition hover:bg-[#2a3b5d]"
        aria-label="Open messages"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  )
}

export function Header({
  logoSrc = "/brand/Bearfit-Logo-v2.png",
  logoAlt = "BearFit Logo",
  activeRole,
  onRoleChange,
  onOpenChat,
  onOpenNotifications,
}: HeaderProps) {
  return (
    <header className="border-b border-border/30 px-4 py-4 lg:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <LogoBlock logoSrc={logoSrc} logoAlt={logoAlt} />
        <HeaderActions onOpenNotifications={onOpenNotifications} onOpenChat={onOpenChat} />
      </div>
      <div className="mx-auto mt-4 max-w-5xl overflow-x-auto pb-1">
        <RoleTabs activeRole={activeRole} onRoleChange={onRoleChange} />
      </div>
    </header>
  )
}

export function DesktopHeader({
  logoSrc = "/brand/Bearfit-Logo-v2.png",
  logoAlt = "BearFit Logo",
  activeRole: _activeRole,
  onRoleChange: _onRoleChange,
  onOpenChat,
  onOpenNotifications,
}: HeaderProps) {
  return (
    <header className="hidden border-b border-border/30 lg:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-6">
        <LogoBlock logoSrc={logoSrc} logoAlt={logoAlt} />
        <HeaderActions onOpenNotifications={onOpenNotifications} onOpenChat={onOpenChat} />
      </div>
    </header>
  )
}
