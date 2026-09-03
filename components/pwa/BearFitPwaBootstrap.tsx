"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

type InstallChoice = {
  outcome: "accepted" | "dismissed"
  platform: string
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean
}

export default function BearFitPwaBootstrap() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches
    const iosStandalone = (window.navigator as NavigatorWithStandalone).standalone === true
    setIsStandalone(displayModeStandalone || iosStandalone)

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const registerWorker = () => {
        navigator.serviceWorker.register("/sw.js").catch((error) => {
          console.error("BearFit service worker registration failed", error)
        })
      }

      if (document.readyState === "complete") {
        registerWorker()
      } else {
        window.addEventListener("load", registerWorker, { once: true })
      }
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      setInstallPrompt(null)
      setIsStandalone(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

  const installBearFit = async () => {
    if (!installPrompt) return

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice

    if (choice.outcome === "accepted") {
      setIsStandalone(true)
    }

    setInstallPrompt(null)
  }

  if (isStandalone || dismissed || !installPrompt) {
    return null
  }

  return (
    <aside
      className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-[90] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border border-white/10 bg-[#101722]/95 p-2 pl-3 text-white shadow-2xl backdrop-blur md:bottom-6 md:right-6"
      aria-label="Install BearFit app"
    >
      <button
        type="button"
        onClick={installBearFit}
        className="flex min-h-11 items-center gap-2 rounded-xl bg-[#F37120] px-4 text-sm font-bold transition hover:bg-[#ff8438]"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Install BearFit
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="grid h-11 w-11 place-items-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"
        aria-label="Dismiss install prompt"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  )
}
