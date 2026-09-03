import type { Metadata, Viewport } from "next"
import BearFitPwaBootstrap from "@/components/pwa/BearFitPwaBootstrap"
import "./globals.css"

export const metadata: Metadata = {
  title: "BearFit",
  description: "BearFit member training, scheduling, packages, and progress.",
  applicationName: "BearFit",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/bearfit-orange-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/bearfit-orange-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/bearfit-orange-apple-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "BearFit",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F37020",
  colorScheme: "dark",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <BearFitPwaBootstrap />
      </body>
    </html>
  )
}
