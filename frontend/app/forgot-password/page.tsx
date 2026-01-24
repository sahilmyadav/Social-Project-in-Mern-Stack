"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/api-services"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await authService.forgotPassword({ email });
      if (response.success) {
        setEmailSent(true)
      } else {
        setError(response.message || "Failed to send reset link")
      }
    } catch (err: any) {
      setError(err.message || "Failed to send reset link. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleBackToLogin = () => {
    router.push("/login")
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border p-8 shadow-lg">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Reset Password</h1>
            <p className="text-muted-foreground mt-2">Recover access to your account</p>
          </div>

          {/* Email Form or Success Message */}
          {!emailSent ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Email Address</label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
                  <Mail className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Check Your Email</h2>
                <p className="text-muted-foreground mb-1">
                  We've sent a password reset link to
                </p>
                <p className="font-semibold text-foreground mb-4">{email}</p>
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to reset your password. The link will expire in 15 minutes.
                </p>
              </div>

              <Button
                onClick={handleBackToLogin}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2"
              >
                Back to Login
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setEmailSent(false)}
                  className="text-sm text-primary hover:underline"
                >
                  Try another email
                </button>
              </div>
            </div>
          )}

          {/* Back to Login */}
          {!emailSent && (
            <div className="mt-6 text-center">
              <Link href="/login" className="inline-flex items-center gap-2 text-primary hover:underline">
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
