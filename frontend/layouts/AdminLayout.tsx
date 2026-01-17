"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LayoutDashboard, Users, AlertCircle, BarChart3, LogOut, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AdminLayoutProps {
  children: ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()

  const adminNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
    { icon: Users, label: "Users", href: "/admin/users" },
    { icon: AlertCircle, label: "Reports", href: "/admin/reports" },
    { icon: BarChart3, label: "Analytics", href: "/admin/analytics" },
    { icon: Settings, label: "Settings", href: "/admin/settings" },
  ]

  const handleLogout = () => {
    localStorage.removeItem("adminToken")
    localStorage.removeItem("admin")
    router.push("/admin/login")
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
              ⚙️
            </div>
            <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
          </div>

          <nav className="space-y-2">
            {adminNavItems.map((item) => (
              <Link key={item.label} href={item.href}>
                <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition text-foreground text-sm font-medium">
                  <item.icon size={18} className="text-primary" />
                  {item.label}
                </button>
              </Link>
            ))}
          </nav>
        </div>

        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <Button onClick={handleLogout} className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
            <LogOut size={18} />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
