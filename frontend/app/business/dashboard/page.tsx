"use client"

import { useState } from "react"
import { TrendingUp, Users, DollarSign, Eye, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function BusinessDashboard() {
  const [dateRange, setDateRange] = useState("month")

  const stats = [
    { icon: Eye, label: "Total Reach", value: "245.8K", change: "+12.5%", color: "text-blue-600" },
    { icon: Users, label: "Followers", value: "12,450", change: "+8.2%", color: "text-purple-600" },
    { icon: DollarSign, label: "Earnings", value: "₹24,580", change: "+23.1%", color: "text-green-600" },
    { icon: TrendingUp, label: "Engagement Rate", value: "8.4%", change: "+2.3%", color: "text-orange-600" },
  ]

  const chartData = [
    { label: "Mon", value: 2400, fill: "var(--color-primary)" },
    { label: "Tue", value: 2210, fill: "var(--color-chart-2)" },
    { label: "Wed", value: 2290, fill: "var(--color-primary)" },
    { label: "Thu", value: 2000, fill: "var(--color-chart-3)" },
    { label: "Fri", value: 2181, fill: "var(--color-primary)" },
    { label: "Sat", value: 2500, fill: "var(--color-chart-2)" },
    { label: "Sun", value: 2100, fill: "var(--color-primary)" },
  ]

  const topPosts = [
    { id: 1, title: "Summer Collection Launch", reach: 45200, engagement: 8.2, revenue: 5200 },
    { id: 2, title: "Behind the Scenes", reach: 32100, engagement: 6.5, revenue: 3800 },
    { id: 3, title: "Customer Testimonial", reach: 28900, engagement: 7.1, revenue: 3400 },
  ]

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start md:items-center gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your business performance.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {["week", "month", "year"].map((range) => (
            <Button
              key={range}
              onClick={() => setDateRange(range)}
              variant={dateRange === range ? "default" : "outline"}
              className="capitalize"
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-2xl p-6 hover:border-primary transition"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <button className="p-2 hover:bg-muted rounded-lg transition">
                <MoreVertical size={16} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-foreground mb-2">{stat.value}</p>
            <p className="text-xs text-green-600 font-semibold">{stat.change} from last month</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reach Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-foreground text-lg">Reach & Impressions</h3>
              <p className="text-sm text-muted-foreground">Last 7 days</p>
            </div>
            <button className="p-2 hover:bg-muted rounded-lg transition">
              <MoreVertical size={18} className="text-muted-foreground" />
            </button>
          </div>

          {/* Simple Bar Chart */}
          <div className="space-y-4">
            <div className="flex items-end justify-between h-48 gap-2">
              {chartData.map((item) => (
                <div key={item.label} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-primary rounded-t-lg transition hover:opacity-80"
                    style={{ height: `${(item.value / 2500) * 100}%` }}
                  ></div>
                  <span className="text-xs text-muted-foreground mt-2">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-border">
            <div>
              <p className="text-sm text-muted-foreground">Total Reach</p>
              <p className="text-xl font-bold text-foreground">156.2K</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg. Daily</p>
              <p className="text-xl font-bold text-foreground">22.3K</p>
            </div>
          </div>
        </div>

        {/* Engagement Breakdown */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-foreground text-lg">Engagement</h3>
              <p className="text-sm text-muted-foreground">Breakdown</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: "Likes", value: 45, color: "bg-red-500" },
              { label: "Comments", value: 28, color: "bg-blue-500" },
              { label: "Shares", value: 18, color: "bg-green-500" },
              { label: "Saves", value: 9, color: "bg-purple-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-bold text-foreground">{item.value}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Performing Posts */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-foreground text-lg">Top Performing Posts</h3>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Post Title</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Reach</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Engagement</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topPosts.map((post) => (
                <tr key={post.id} className="border-b border-border hover:bg-muted transition">
                  <td className="py-4 px-4">
                    <p className="font-semibold text-foreground">{post.title}</p>
                  </td>
                  <td className="py-4 px-4 text-foreground">{post.reach.toLocaleString()}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${post.engagement * 10}%` }}></div>
                      </div>
                      <span className="text-foreground text-sm">{post.engagement}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-green-600 font-semibold">₹{post.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
