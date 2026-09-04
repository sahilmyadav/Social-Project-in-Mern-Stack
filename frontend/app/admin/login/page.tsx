"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ShieldAlert, Eye, EyeOff } from "lucide-react"
import Link from "next/link"

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState("admin@clickme.app")
  const [password, setPassword] = useState("Admin@123456")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const adminCreds = [
    { role: "Super Admin", email: "admin@clickme.app", password: "Admin@123456" },
    { role: "Sub-Admin", email: "subadmin@clickme.app", password: "Admin@123456" },
    { role: "Staff", email: "staff@clickme.app", password: "Admin@123456" },
  ]

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const validCred = adminCreds.find((cred) => cred.email === email && cred.password === password)

    if (validCred) {
      localStorage.setItem(
        "admin",
        JSON.stringify({
          id: "admin_" + Date.now(),
          name: email.split("@")[0].toUpperCase(),
          email,
          role: validCred.role,
          loginTime: new Date().toISOString(),
        }),
      )
      router.push("/admin")
    } else {
      setError("Invalid credentials. Please use the test accounts shown below.")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-5xl">
        <div className="flex flex-col justify-center">
          <Card className="p-8 border-purple-500/20 bg-slate-900/50 backdrop-blur">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <ShieldAlert className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
                <p className="text-xs text-purple-300">ClickME Management System</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                  placeholder="admin@clickme.app"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition pr-10"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-400 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-2 rounded-lg hover:shadow-lg transition"
              >
                {loading ? "Logging in..." : "Login to Dashboard"}
              </Button>
            </form>

            <p className="text-xs text-slate-400 text-center mt-4">
              Protected admin area. Unauthorized access is prohibited.
            </p>
          </Card>

          <div className="mt-6">
            <Link href="/">
              <Button
                variant="outline"
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent"
              >
                Back to App
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <Card className="p-6 border-purple-500/20 bg-slate-900/50 backdrop-blur">
            <h3 className="text-lg font-bold text-white mb-4">Test Admin Accounts</h3>
            <div className="space-y-3">
              {adminCreds.map((cred, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/50 transition cursor-pointer group"
                  onClick={() => {
                    setEmail(cred.email)
                    setPassword(cred.password)
                  }}
                >
                  <p className="font-semibold text-purple-300 text-sm mb-2">{cred.role}</p>
                  <div className="space-y-1 text-xs">
                    <p className="text-slate-400">
                      Email: <span className="text-white font-mono">{cred.email}</span>
                    </p>
                    <p className="text-slate-400">
                      Password: <span className="text-white font-mono">Admin@123456</span>
                    </p>
                  </div>
                  <p className="text-xs text-purple-400 mt-2 group-hover:text-purple-300">Click to auto-fill</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
