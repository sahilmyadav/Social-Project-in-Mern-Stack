"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  AlertCircle,
  TrendingUp,
  Activity,
  Package,
  ImageIcon,
  Tag,
  Bell,
  Map,
  CreditCard,
  Star,
  Headphones,
  RefreshCw,
  Key,
  Zap,
  ChevronDown,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AdminDashboard() {
  const [admin, setAdmin] = useState<any>(null)
  const [activeModule, setActiveModule] = useState("dashboard")
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    const adminData = localStorage.getItem("admin")
    if (!adminData) {
      router.push("/admin/login")
    } else {
      setAdmin(JSON.parse(adminData))
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("admin")
    router.push("/admin/login")
  }

  const toggleExpand = (item: string) => {
    setExpandedItems((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]))
  }

  const stats = [
    { icon: Users, label: "Total Users", value: "12,543", change: "+5.2%", color: "from-blue-500 to-cyan-500" },
    { icon: AlertCircle, label: "Reports", value: "234", change: "+12.5%", color: "from-red-500 to-orange-500" },
    { icon: Activity, label: "Active Now", value: "3,421", change: "+8.1%", color: "from-green-500 to-emerald-500" },
    { icon: TrendingUp, label: "Revenue", value: "$45,231", change: "+23.5%", color: "from-purple-500 to-pink-500" },
  ]

  const modules = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: BarChart3,
      items: [],
    },
    {
      id: "users",
      label: "User Management",
      icon: Users,
      items: [
        { name: "View All Users", action: "view_users" },
        { name: "Add New User", action: "add_user" },
        { name: "Block/Unblock Users", action: "block_users" },
        { name: "Delete Users", action: "delete_users" },
        { name: "Export Users", action: "export_users" },
      ],
    },
    {
      id: "services",
      label: "Service Management",
      icon: Package,
      items: [
        { name: "View Services", action: "view_services" },
        { name: "Add Service", action: "add_service" },
        { name: "Edit Service", action: "edit_service" },
        { name: "Manage Categories", action: "manage_categories" },
        { name: "Service Analytics", action: "service_analytics" },
      ],
    },
    {
      id: "content",
      label: "Content Management",
      icon: ImageIcon,
      items: [
        { name: "Manage Banners", action: "manage_banners" },
        { name: "Upload Content", action: "upload_content" },
        { name: "Manage Pages", action: "manage_pages" },
        { name: "SEO Settings", action: "seo_settings" },
      ],
    },
    {
      id: "promo",
      label: "Promo & Coupons",
      icon: Tag,
      items: [
        { name: "View Coupons", action: "view_coupons" },
        { name: "Create Coupon", action: "create_coupon" },
        { name: "Edit Coupon", action: "edit_coupon" },
        { name: "Coupon Analytics", action: "coupon_analytics" },
      ],
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      items: [
        { name: "Send Notification", action: "send_notification" },
        { name: "Notification History", action: "notification_history" },
        { name: "Templates", action: "notification_templates" },
      ],
    },
    {
      id: "locations",
      label: "Location & Areas",
      icon: Map,
      items: [
        { name: "Manage Areas", action: "manage_areas" },
        { name: "Service Zones", action: "service_zones" },
        { name: "Coverage Map", action: "coverage_map" },
      ],
    },
    {
      id: "staff",
      label: "Staff & Vendors",
      icon: Users,
      items: [
        { name: "Staff Management", action: "staff_management" },
        { name: "Vendor Monitoring", action: "vendor_monitoring" },
        { name: "Performance Reports", action: "performance_reports" },
      ],
    },
    {
      id: "finance",
      label: "Finance & Transactions",
      icon: CreditCard,
      items: [
        { name: "Transaction History", action: "transaction_history" },
        { name: "Revenue Reports", action: "revenue_reports" },
        { name: "Payment Methods", action: "payment_methods" },
        { name: "Refunds", action: "refunds" },
      ],
    },
    {
      id: "reviews",
      label: "Ratings & Reviews",
      icon: Star,
      items: [
        { name: "Moderation Queue", action: "moderation_queue" },
        { name: "Approved Reviews", action: "approved_reviews" },
        { name: "Rejected Reviews", action: "rejected_reviews" },
        { name: "Report Management", action: "report_management" },
      ],
    },
    {
      id: "support",
      label: "Support Tickets",
      icon: Headphones,
      items: [
        { name: "Open Tickets", action: "open_tickets" },
        { name: "Resolve Ticket", action: "resolve_ticket" },
        { name: "Ticket History", action: "ticket_history" },
      ],
    },
    {
      id: "refunds",
      label: "Refunds & Cancellations",
      icon: RefreshCw,
      items: [
        { name: "Refund Requests", action: "refund_requests" },
        { name: "Process Refund", action: "process_refund" },
        { name: "Cancellation Log", action: "cancellation_log" },
      ],
    },
    {
      id: "integrations",
      label: "API & Integrations",
      icon: Key,
      items: [
        { name: "API Keys", action: "api_keys" },
        { name: "Connected Services", action: "connected_services" },
        { name: "Webhooks", action: "webhooks" },
      ],
    },
    {
      id: "tracking",
      label: "Real-Time Tracking",
      icon: Zap,
      items: [
        { name: "Active Orders", action: "active_orders" },
        { name: "Live Map", action: "live_map" },
        { name: "Service Requests", action: "service_requests" },
      ],
    },
  ]

  if (!admin) {
    return null
  }

  return (
    <div className="flex h-screen bg-slate-950">
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
              A
            </div>
            <div>
              <p className="font-bold text-white text-sm">ClickME Admin</p>
              <p className="text-xs text-slate-400">{admin.role}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {modules.map((module) => (
            <div key={module.id}>
              <button
                onClick={() => {
                  setActiveModule(module.id)
                  if (module.items.length > 0) {
                    toggleExpand(module.id)
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${
                  activeModule === module.id
                    ? "text-purple-400 bg-purple-500/10 border-r-2 border-purple-500"
                    : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
                }`}
              >
                <module.icon size={18} />
                <span className="flex-1 text-left">{module.label}</span>
                {module.items.length > 0 && (
                  <ChevronDown
                    size={16}
                    className={`transition ${expandedItems.includes(module.id) ? "rotate-180" : ""}`}
                  />
                )}
              </button>

              {expandedItems.includes(module.id) && module.items.length > 0 && (
                <div className="bg-slate-800/30 py-2">
                  {module.items.map((item) => (
                    <button
                      key={item.action}
                      onClick={() => setActiveModule(`${module.id}_${item.action}`)}
                      className="w-full text-left px-8 py-2 text-xs text-slate-400 hover:text-purple-400 hover:bg-slate-800/50 transition"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <Button
            variant="outline"
            className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 justify-start gap-2 bg-transparent"
          >
            <Settings size={18} />
            Settings
          </Button>
          <Button
            onClick={handleLogout}
            className="w-full bg-red-500/10 text-red-400 hover:bg-red-500/20 justify-start gap-2"
          >
            <LogOut size={18} />
            Logout
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          {activeModule === "dashboard" && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <p className="text-slate-400 mt-2">Welcome back, {admin.name}. Here's your platform overview.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                  <Card
                    key={i}
                    className="p-6 border-slate-700 bg-slate-800/50 hover:shadow-lg transition cursor-pointer hover:border-purple-500/50"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                      >
                        <stat.icon className="text-white" size={24} />
                      </div>
                      <span className="text-green-400 text-sm font-semibold">{stat.change}</span>
                    </div>
                    <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 border-slate-700 bg-slate-800/50">
                  <h3 className="text-lg font-bold text-white mb-4">Recent Reports</h3>
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 transition cursor-pointer"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-white text-sm">Report #{i}</p>
                          <p className="text-xs text-slate-400">Inappropriate content flagged</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                          Pending
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6 border-slate-700 bg-slate-800/50">
                  <h3 className="text-lg font-bold text-white mb-4">Support Tickets</h3>
                  <div className="space-y-3">
                    {[
                      { id: 1, title: "Payment Issue", status: "Open" },
                      { id: 2, title: "Account Locked", status: "In Progress" },
                      { id: 3, title: "Refund Request", status: "Pending" },
                      { id: 4, title: "Technical Issue", status: "Resolved" },
                    ].map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 transition cursor-pointer"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-white text-sm">Ticket #{ticket.id}</p>
                          <p className="text-xs text-slate-400">{ticket.title}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            ticket.status === "Open"
                              ? "bg-blue-500/20 text-blue-400"
                              : ticket.status === "In Progress"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : ticket.status === "Pending"
                                  ? "bg-orange-500/20 text-orange-400"
                                  : "bg-green-500/20 text-green-400"
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeModule.startsWith("users") && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">User Management</h2>
                <p className="text-slate-400">Manage and monitor all users on the platform</p>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total Users", value: "12,543", color: "blue" },
                  { label: "Active Today", value: "3,421", color: "green" },
                  { label: "Blocked Users", value: "127", color: "red" },
                  { label: "Pending Verification", value: "89", color: "yellow" },
                ].map((stat, i) => (
                  <Card key={i} className="p-4 border-slate-700 bg-slate-800/50">
                    <p className="text-slate-400 text-xs mb-2">{stat.label}</p>
                    <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</p>
                  </Card>
                ))}
              </div>

              <Card className="border-slate-700 bg-slate-800/50 overflow-hidden">
                <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                  <h3 className="font-bold text-white">All Users</h3>
                  <Button className="bg-purple-500 hover:bg-purple-600 text-white">Add New User</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-900/50">
                        <th className="px-6 py-3 text-left text-slate-400 font-semibold">User</th>
                        <th className="px-6 py-3 text-left text-slate-400 font-semibold">Email</th>
                        <th className="px-6 py-3 text-left text-slate-400 font-semibold">Status</th>
                        <th className="px-6 py-3 text-left text-slate-400 font-semibold">Joined</th>
                        <th className="px-6 py-3 text-left text-slate-400 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "John Doe", email: "john@example.com", status: "Active", joined: "2024-01-15" },
                        { name: "Jane Smith", email: "jane@example.com", status: "Active", joined: "2024-02-20" },
                        { name: "Bob Wilson", email: "bob@example.com", status: "Blocked", joined: "2024-01-10" },
                        { name: "Alice Brown", email: "alice@example.com", status: "Inactive", joined: "2023-12-05" },
                        { name: "Charlie Davis", email: "charlie@example.com", status: "Active", joined: "2024-03-01" },
                      ].map((user, i) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-900/50 transition">
                          <td className="px-6 py-4 text-white">{user.name}</td>
                          <td className="px-6 py-4 text-slate-400">{user.email}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                user.status === "Active"
                                  ? "bg-green-500/20 text-green-400"
                                  : user.status === "Blocked"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-slate-500/20 text-slate-400"
                              }`}
                            >
                              {user.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">{user.joined}</td>
                          <td className="px-6 py-4 flex gap-2">
                            <button className="px-3 py-1 rounded bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30 transition">
                              Edit
                            </button>
                            <button className="px-3 py-1 rounded bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition">
                              Block
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {!activeModule.startsWith("dashboard") && !activeModule.startsWith("users") && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2 capitalize">
                  {modules.find((m) => m.id === activeModule.split("_")[0])?.label || activeModule}
                </h2>
                <p className="text-slate-400">Manage this section efficiently</p>
              </div>

              <Card className="p-12 border-slate-700 bg-slate-800/50 text-center">
                <Zap className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-white mb-2">Module Content</h3>
                <p className="text-slate-400">
                  This section would display detailed management tools for{" "}
                  {modules.find((m) => m.id === activeModule.split("_")[0])?.label || activeModule}
                </p>
                <div className="mt-6 flex gap-4 justify-center">
                  <Button className="bg-purple-500 hover:bg-purple-600 text-white">Create New</Button>
                  <Button
                    variant="outline"
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent"
                  >
                    View Settings
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
