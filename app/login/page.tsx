"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

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
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">
          {isSignup ? "Create account" : "Sign in"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {isSignup ? "Make your BearFit account" : "Access your BearFit account"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2"
            />
          )}

          <input
            type="email"
            placeholder="Email"
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
            className="w-full rounded-lg border px-3 py-2"
          >
            {loading ? "Please wait..." : isSignup ? "Sign up" : "Sign in"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm">{message}</p>}

        <button
          type="button"
          onClick={() => {
            setIsSignup(!isSignup)
            setMessage("")
          }}
          className="mt-4 text-sm underline"
        >
          {isSignup ? "Already have an account? Sign in" : "No account yet? Sign up"}
        </button>
      </div>
    </main>
  )
}
