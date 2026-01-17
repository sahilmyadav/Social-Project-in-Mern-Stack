"use client"

import { useState } from "react"
import { Search, Send, MoreVertical, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CustomersPage() {
  const [selectedCustomer, setSelectedCustomer] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [messageText, setMessageText] = useState("")
  const [activeTab, setActiveTab] = useState("inbox")

  const customers = [
    {
      id: 1,
      name: "Priya Sharma",
      avatar: "/avatar-1.jpg",
      status: "active",
      lastMessage: "Thanks for the quick response!",
      timestamp: "2 min ago",
      unread: 0,
      orders: 5,
      spent: 12500,
      tags: ["loyal", "vip"],
    },
    {
      id: 2,
      name: "Arjun Kumar",
      avatar: "/avatar-2.jpg",
      status: "active",
      lastMessage: "When will the order arrive?",
      timestamp: "15 min ago",
      unread: 1,
      orders: 2,
      spent: 5200,
      tags: ["new"],
    },
    {
      id: 3,
      name: "Neha Patel",
      avatar: "/avatar-3.jpg",
      status: "away",
      lastMessage: "Product quality is amazing!",
      timestamp: "1 hour ago",
      unread: 0,
      orders: 8,
      spent: 28900,
      tags: ["loyal", "premium"],
    },
    {
      id: 4,
      name: "Rahul Singh",
      avatar: "/avatar-4.jpg",
      status: "offline",
      lastMessage: "Is there a discount available?",
      timestamp: "3 hours ago",
      unread: 2,
      orders: 1,
      spent: 2100,
      tags: ["new"],
    },
  ]

  const selectedCust = customers.find((c) => c.id === selectedCustomer)

  const messages = [
    { id: 1, sender: "customer", text: "Hi, do you have this in blue?", timestamp: "10:30 AM" },
    { id: 2, sender: "you", text: "Yes! We have it in blue, red, and green.", timestamp: "10:32 AM" },
    { id: 3, sender: "customer", text: "Great! Blue one please. When will it ship?", timestamp: "10:35 AM" },
    { id: 4, sender: "you", text: "We'll ship it tomorrow. You'll get it by Dec 8.", timestamp: "10:36 AM" },
    { id: 5, sender: "customer", text: "Thanks for the quick response!", timestamp: "10:38 AM" },
  ]

  const leads = [
    {
      id: 1,
      name: "Varun Gupta",
      status: "hot",
      lastActivity: "Viewed product",
      date: "Today",
      value: "High",
    },
    {
      id: 2,
      name: "Anjali Desai",
      status: "warm",
      lastActivity: "Added to cart",
      date: "Yesterday",
      value: "Medium",
    },
    {
      id: 3,
      name: "Vikram Reddy",
      status: "cold",
      lastActivity: "Viewed 3 items",
      date: "2 days ago",
      value: "Low",
    },
  ]

  return (
    <div className="p-6 md:p-8 h-screen overflow-hidden flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Customers & Support</h1>
        <p className="text-muted-foreground">Manage customer relationships and leads</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border mb-6">
        {["inbox", "leads", "crm"].map((tab) => (
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

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sidebar - Customer List */}
        <div className="w-full md:w-80 flex flex-col border border-border rounded-2xl overflow-hidden hidden md:flex">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "inbox" &&
              customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted transition ${
                    selectedCustomer === customer.id ? "bg-muted border-l-4 border-l-primary" : ""
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    <div className="relative flex-shrink-0">
                      <img
                        src={customer.avatar || "/placeholder.svg"}
                        alt={customer.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${
                          customer.status === "active"
                            ? "bg-green-500"
                            : customer.status === "away"
                              ? "bg-yellow-500"
                              : "bg-gray-500"
                        }`}
                      ></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-foreground text-sm">{customer.name}</p>
                        <span className="text-xs text-muted-foreground">{customer.timestamp}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{customer.lastMessage}</p>
                      {customer.unread > 0 && (
                        <div className="w-5 h-5 bg-primary rounded-full text-white text-xs flex items-center justify-center mt-1">
                          {customer.unread}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}

            {activeTab === "leads" &&
              leads.map((lead) => (
                <button
                  key={lead.id}
                  className="w-full text-left px-4 py-3 border-b border-border hover:bg-muted transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-foreground text-sm">{lead.name}</p>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        lead.status === "hot"
                          ? "bg-red-100 text-red-700"
                          : lead.status === "warm"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {lead.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{lead.lastActivity}</p>
                  <p className="text-xs text-muted-foreground mt-1">{lead.date}</p>
                </button>
              ))}
          </div>
        </div>

        {/* Chat/Details Area */}
        <div className="flex-1 flex flex-col border border-border rounded-2xl overflow-hidden bg-card">
          {selectedCust ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedCust.avatar || "/placeholder.svg"}
                    alt={selectedCust.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-foreground">{selectedCust.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedCust.status === "active" ? "Active now" : "Away"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="gap-2 bg-transparent">
                    <Phone size={16} />
                  </Button>
                  <button className="p-2 hover:bg-muted rounded-lg transition">
                    <MoreVertical size={18} className="text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === "you" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.sender === "you" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                      <p
                        className={`text-xs mt-1 ${msg.sender === "you" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                      >
                        {msg.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Customer Stats */}
              {activeTab === "inbox" && (
                <div className="px-4 py-3 bg-muted border-t border-border grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                    <p className="font-bold text-foreground">{selectedCust.orders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                    <p className="font-bold text-foreground">₹{selectedCust.spent.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1">
                    {selectedCust.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className="p-4 border-t border-border flex gap-3">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
                <Button
                  onClick={() => setMessageText("")}
                  className="bg-primary hover:bg-primary/90 gap-2 px-4 py-2"
                  size="sm"
                >
                  <Send size={16} />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a customer to view conversation
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
