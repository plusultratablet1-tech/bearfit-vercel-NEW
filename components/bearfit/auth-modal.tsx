"use client";

import { useState } from "react";
import { X, Mail, Lock, User } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (userId: string) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFullName("");
    setPhone("");
    setError("");
    setSuccess("");
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      setSuccess("Login successful! Redirecting...");

      setTimeout(() => {
        onSuccess?.(data.user.id);
        onClose();
        window.location.href = data.redirectTo || "/member/dashboard";
      }, 1000);
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          phone: phone || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Sign up failed");
        setLoading(false);
        return;
      }

      if (data.requiresEmailConfirmation) {
        setSuccess(data.message || "Account created. Check your email to confirm before signing in.");
        setLoading(false);
        return;
      }

      setSuccess("Account created successfully! Redirecting...");

      setTimeout(() => {
        onSuccess?.(data.user?.id || "");
        onClose();
        window.location.href = data.redirectTo || "/member/dashboard";
      }, 1000);
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-[#0b0b0b] rounded-2xl shadow-2xl p-8">
        <button
          onClick={() => {
            resetForm();
            onClose();
          }}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            {tab === "login" ? "Welcome Back" : "Join BearFit"}
          </h2>
          <p className="text-white/60 text-sm">
            {tab === "login"
              ? "Sign in to access your dashboard"
              : "Create your account to get started"}
          </p>
        </div>

        <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-lg">
          <button
            onClick={() => {
              setTab("login");
              setError("");
              setSuccess("");
            }}
            type="button"
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              tab === "login"
                ? "bg-[#F37120] text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setTab("signup");
              setError("");
              setSuccess("");
            }}
            type="button"
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              tab === "signup"
                ? "bg-[#F37120] text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={tab === "login" ? handleLogin : handleSignUp} className="space-y-4">
          {tab === "signup" && (
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-[#F37120]/50 focus:ring-1 focus:ring-[#F37120]/20"
                  required={tab === "signup"}
                />
              </div>
            </div>
          )}

          {tab === "signup" && (
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Phone (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-[#F37120]/50 focus:ring-1 focus:ring-[#F37120]/20"
              />
            </div>
          )}

          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-[#F37120]/50 focus:ring-1 focus:ring-[#F37120]/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-[#F37120]/50 focus:ring-1 focus:ring-[#F37120]/20"
                required
              />
            </div>
          </div>

          {tab === "signup" && (
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-[#F37120]/50 focus:ring-1 focus:ring-[#F37120]/20"
                  required={tab === "signup"}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#F37120] hover:bg-[#E86010] disabled:bg-[#F37120]/60 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-lg transition-colors mt-6"
          >
            {loading ? "Processing..." : tab === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="text-white/60 text-xs text-center mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
