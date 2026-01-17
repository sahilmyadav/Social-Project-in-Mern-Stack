"use client"

import { useState } from "react"
import { CreditCard, Zap, TrendingUp, Send, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function WalletPage() {
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [withdrawAmount, setWithdrawAmount] = useState("")

  const walletData = {
    balance: 45280,
    pending: 12540,
    withdrawn: 234580,
  }

  const boostOptions = [
    { tier: "Basic", amount: 500, reach: "5K", engagement: "2-5%", price: 499 },
    { tier: "Pro", amount: 1000, reach: "15K", engagement: "5-10%", price: 999 },
    { tier: "Premium", amount: 5000, reach: "50K+", engagement: "10-15%", price: 4999 },
  ]

  const transactions = [
    { id: 1, type: "earning", description: "Post Reach Bonus", amount: 250, date: "Dec 5, 2024" },
    { id: 2, type: "boost", description: "Boost Campaign", amount: -500, date: "Dec 5, 2024" },
    { id: 3, type: "earning", description: "Engagement Bonus", amount: 180, date: "Dec 4, 2024" },
    { id: 4, type: "withdrawal", description: "Withdrawal to Bank", amount: -5000, date: "Dec 3, 2024" },
  ]

  const recentCampaigns = [
    { id: 1, name: "Summer Collection", budget: 2500, reach: 45200, roi: "320%" },
    { id: 2, name: "Flash Sale", budget: 1500, reach: 32100, roi: "280%" },
  ]

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start md:items-center gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Wallet & Monetization</h1>
          <p className="text-muted-foreground">Manage earnings and boost your content</p>
        </div>
        <Button onClick={() => setShowWithdraw(true)} className="bg-primary hover:bg-primary/90 gap-2 md:w-auto w-full">
          <Send size={18} />
          Withdraw
        </Button>
      </div>

      {/* Wallet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Available Balance */}
        <div className="bg-gradient-purple-peach rounded-2xl p-6 text-white">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-white/80 text-sm mb-2">Available Balance</p>
              <p className="text-4xl font-bold">₹{walletData.balance.toLocaleString()}</p>
            </div>
            <CreditCard size={28} className="text-white/60" />
          </div>
          <p className="text-xs text-white/60">Withdraw anytime, minimum ₹100</p>
        </div>

        {/* Pending Earnings */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-muted-foreground text-sm mb-2">Pending Earnings</p>
              <p className="text-3xl font-bold text-foreground">₹{walletData.pending.toLocaleString()}</p>
            </div>
            <TrendingUp size={24} className="text-blue-600" />
          </div>
          <p className="text-xs text-muted-foreground">Credited within 24-48 hours</p>
        </div>

        {/* Total Withdrawn */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-muted-foreground text-sm mb-2">Total Withdrawn</p>
              <p className="text-3xl font-bold text-foreground">₹{walletData.withdrawn.toLocaleString()}</p>
            </div>
            <Send size={24} className="text-green-600" />
          </div>
          <p className="text-xs text-muted-foreground">All-time withdrawals</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        {["overview", "boost", "transactions"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-4 font-semibold transition capitalize border-b-2 ${
              activeTab === tab
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Earning Breakdown */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-bold text-foreground text-lg mb-6">Earning Breakdown</h3>
            <div className="space-y-4">
              {[
                { label: "Content Reach Bonus", amount: 12500, percentage: 45 },
                { label: "Engagement Rewards", amount: 8200, percentage: 30 },
                { label: "Campaign Bonuses", amount: 5580, percentage: 20 },
                { label: "Referral Earnings", amount: 1000, percentage: 5 },
              ].map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">{item.label}</span>
                    <span className="text-sm font-bold text-primary">₹{item.amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${item.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Campaigns */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-foreground text-lg">Recent Boost Campaigns</h3>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
            <div className="space-y-4">
              {recentCampaigns.map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-semibold text-foreground">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">Budget: ₹{campaign.budget}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{campaign.reach.toLocaleString()} Reach</p>
                    <p className="text-xs text-green-600 font-semibold">{campaign.roi} ROI</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Boost Tab */}
      {activeTab === "boost" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {boostOptions.map((option) => (
              <div
                key={option.tier}
                className="bg-card border border-border rounded-2xl p-6 hover:border-primary transition"
              >
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Boost Tier</p>
                  <h3 className="text-2xl font-bold text-foreground">{option.tier}</h3>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reach</p>
                    <p className="font-bold text-foreground">{option.reach}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Engagement</p>
                    <p className="font-bold text-foreground">{option.engagement}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Price</p>
                    <p className="text-2xl font-bold text-primary">₹{option.price}</p>
                  </div>
                </div>

                <Button className="w-full bg-primary hover:bg-primary/90 gap-2">
                  <Zap size={16} />
                  Choose Plan
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-foreground text-lg">Transaction History</h3>
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <Download size={16} />
              Export
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border hover:bg-muted transition">
                    <td className="py-4 px-4">
                      <p className="font-semibold text-foreground">{tx.description}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          tx.type === "earning"
                            ? "bg-green-100 text-green-700"
                            : tx.type === "withdrawal"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className={`py-4 px-4 font-bold ${tx.amount > 0 ? "text-green-600" : "text-foreground"}`}>
                      {tx.amount > 0 ? "+" : ""}₹{Math.abs(tx.amount).toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">{tx.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">Withdraw Funds</h2>
              <button onClick={() => setShowWithdraw(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-3">Available Balance</p>
                <p className="text-3xl font-bold text-primary mb-6">₹{walletData.balance.toLocaleString()}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Withdrawal Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-foreground font-bold">₹</span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full pl-8 pr-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex gap-2 text-xs">
                {[1000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setWithdrawAmount(amt.toString())}
                    className="flex-1 py-2 px-3 rounded-lg border border-border hover:bg-muted font-semibold transition"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                Funds will be transferred to your registered bank account within 24 hours.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => setShowWithdraw(false)}>
                  Cancel
                </Button>
                <Button className="bg-primary hover:bg-primary/90">Request Withdrawal</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
