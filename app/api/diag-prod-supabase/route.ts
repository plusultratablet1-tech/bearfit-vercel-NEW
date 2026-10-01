import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function legacyKeyRef(key: string) {
  try {
    const payload = key.split(".")[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const decoded = JSON.parse(atob(padded)) as { ref?: unknown }
    return typeof decoded.ref === "string" ? decoded.ref : null
  } catch {
    return null
  }
}

function urlRef(url: string) {
  try {
    return new URL(url).hostname.split(".")[0] || null
  } catch {
    return null
  }
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

  return NextResponse.json({
    configuredProjectRef: urlRef(url),
    legacyAnonKeyProjectRef: legacyKeyRef(anon),
    url,
    publishableKey,
    hasUrl: Boolean(url),
    hasPublishableKey: Boolean(publishableKey),
    hasAnonKey: Boolean(anon),
    environment: process.env.VERCEL_ENV ?? null,
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  })
}
