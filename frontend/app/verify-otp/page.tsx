"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/api-services"
import { ApiError } from "@/lib/api-client"

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [timer, setTimer] = useState(120) // 2 minutes
  const [verificationData, setVerificationData] = useState<{
    identifier: string
    method: string
  } | null>(null)
  const router = useRouter()
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Get verification data from localStorage
    const data = localStorage.getItem("otpVerification")
    if (!data) {
      router.push("/signup")
      return
    }
    setVerificationData(JSON.parse(data))

    // Start countdown timer
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [router])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return // Only allow digits

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").slice(0, 6)
    if (!/^\d+$/.test(pastedData)) return

    const newOtp = [...otp]
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i]
    }
    setOtp(newOtp)

    // Focus last filled input
    const lastIndex = Math.min(pastedData.length, 5)
    inputRefs.current[lastIndex]?.focus()
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const otpCode = otp.join("")

    if (otpCode.length !== 6) {
      setError("Please enter complete 6-digit OTP")
      setLoading(false)
      return
    }

    if (!verificationData) {
      setError("Verification data missing. Please sign up again.")
      setLoading(false)
      return
    }

    try {
      const response = await authService.verifyRegisterOtp({
        email: verificationData.method === 'email' ? verificationData.identifier : undefined,
        phone: verificationData.method === 'sms' ? verificationData.identifier : undefined,
        userId: '',
        otp: otpCode,
      })

      if (response.success) {
        // NEW: Save access token and refresh token (user is now logged in!)
        if (response.data.accessToken) {
          localStorage.setItem("accessToken", response.data.accessToken)
        }
        if (response.data.refreshToken) {
          localStorage.setItem("refreshToken", response.data.refreshToken)
        }
        if (response.data.user) {
          localStorage.setItem("user", JSON.stringify(response.data.user))
        }

        // Clear verification data
        localStorage.removeItem("otpVerification")

        // Check if profile is completed
        if (response.data.user && !response.data.user.profileCompleted) {
          // Redirect to profile setup
          router.push("/setup-profile")
        } else {
          // Profile already completed
          router.push("/home")
        }
      } else {
        setError(response.message || "OTP verification failed. Please try again.")
      }
    } catch (err) {
      const apiError = err as ApiError

      if (apiError.statusCode === 400) {
        setError(apiError.message || "Invalid or expired OTP. Please try again.")
      } else {
        setError(apiError.message || "An error occurred. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (timer > 0 || !verificationData) return

    // For now, ask user to go back to signup
    setError("OTP expired. Please go back and sign up again to receive a new OTP.")
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
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
            <h1 className="text-3xl font-bold text-foreground">Verify OTP</h1>
            <p className="text-muted-foreground mt-2">
              Enter the 6-digit code sent to{" "}
              {verificationData?.identifier || "your contact"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* OTP Form */}
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="flex gap-2 justify-center">
              {otp.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={loading || resendLoading}
                  className="w-12 h-12 text-center text-xl font-bold"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {/* Timer */}
            <div className="text-center">
              {timer > 0 ? (
                <p className="text-muted-foreground text-sm">
                  Resend OTP in{" "}
                  <span className="font-semibold text-foreground">
                    {formatTime(timer)}
                  </span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="text-primary font-semibold hover:underline text-sm"
                >
                  {resendLoading ? "Sending..." : "Resend OTP"}
                </button>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2"
              disabled={loading || otp.some((d) => !d)}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                localStorage.removeItem("otpVerification")
                router.push("/signup")
              }}
              className="text-muted-foreground text-sm hover:text-foreground"
            >
              ← Back to Sign Up
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
