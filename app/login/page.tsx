"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/signin"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignup ? { email, password, fullName } : { email, password }
        ),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Something went wrong")

      if (isSignup && result.requiresEmailConfirmation) {
        setMessage(result.message)
        setIsSignup(false)
        return
      }

      router.push(result.redirectTo || "/member/dashboard")
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080808] px-4 py-10 text-white sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(0,0,0,0.82),rgba(0,0,0,0.65)),url('/onboarding/better-form1.jpg')] bg-cover bg-center" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[#F37120]" />
      <div className="relative z-10 w-full max-w-md rounded-[28px] border border-white/15 bg-[#101010]/95 p-6 shadow-2xl backdrop-blur-lg sm:p-8">
        <Link href="/welcome" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-orange-300 hover:text-orange-200">← Back to BearFit Home</Link>
        <div className="mb-5 text-center"><p className="text-2xl font-black tracking-[.24em] text-white">BEAR<span className="text-[#F37120]">FIT</span></p><p className="mt-2 text-xs font-semibold uppercase tracking-[.25em] text-orange-300">Better Form · Better Function · Better Fitness</p></div>
        <h1 className="text-2xl font-bold mb-2">
          {isSignup ? "Create account" : "Sign in"}
        </h1>
        <p className="mb-6 text-sm text-white/60">
          {isSignup ? "Make your BearFit account" : "Access BearFit with email or a coach username"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#F37120] focus:outline-none"
            />
          )}

          <input
            type={isSignup ? "email" : "text"}
            autoComplete="username"
            placeholder={isSignup ? "Email" : "Email or Coach1"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#F37120] px-4 py-3 font-bold text-black hover:bg-[#ff8738] disabled:opacity-60"
          >
            {loading ? "Please wait..." : isSignup ? "Sign up" : "Sign in"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-amber-300">{message}</p>}

        <button
          type="button"
          onClick={() => {
            setIsSignup(!isSignup)
            setMessage("")
          }}
          className="mt-5 text-sm font-semibold text-orange-300 underline underline-offset-4"
        >
          {isSignup ? "Already have an account? Sign in" : "No account yet? Sign up"}
        </button>
      </div>
    </main>
  )
}
