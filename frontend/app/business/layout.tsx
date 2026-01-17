"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { BarChart3, ShoppingBag, Users, Wallet, Settings, MessageSquare, LogOut, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BusinessLayoutProps {
  children: React.ReactNode
}

export default function BusinessLayout({ children }: BusinessLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = [
    { icon: BarChart3, label: "Dashboard", href: "/business/dashboard" },
    { icon: ShoppingBag, label: "Content", href: "/business/content" },
    { icon: Wallet, label: "Wallet", href: "/business/wallet" },
    { icon: Users, label: "Customers", href: "/business/customers" },
    { icon: MessageSquare, label: "Support", href: "/business/support" },
    { icon: Settings, label: "Settings", href: "/business/settings" },
  ]

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 hover:bg-muted rounded-lg"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 fixed lg:static w-64 h-screen bg-card border-r border-border transition-transform duration-300 z-40 overflow-y-auto`}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-gradient-purple-peach flex items-center justify-center text-white font-bold">
              CB
            </div>
            <div>
              <h2 className="font-bold text-foreground">ClickME</h2>
              <p className="text-xs text-muted-foreground">Business Suite</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href}>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition text-foreground text-sm"
                >
                  <item.icon size={18} className="text-primary" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </Link>
            ))}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border bg-muted/30">
          <Button variant="outline" className="w-full gap-2 bg-transparent" size="sm">
            <LogOut size={16} />
            Exit Business
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-16 lg:pt-0">{children}</main>
    </div>
  )
}
