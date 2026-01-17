"use client"

import { useState } from "react"
import { Plus, Search, MoreVertical, Zap, Calendar, Eye, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ContentManagement() {
  const [activeTab, setActiveTab] = useState("posts")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const posts = [
    {
      id: 1,
      title: "Summer Collection 2024",
      image: "/summer-products.jpg",
      status: "published",
      reach: 12500,
      engagement: 8.2,
      timestamp: "2 days ago",
      date: "Dec 5, 2024",
    },
    {
      id: 2,
      title: "New Year Promo",
      image: "/new-year-promo.jpg",
      status: "scheduled",
      reach: 0,
      engagement: 0,
      timestamp: "Tomorrow",
      date: "Dec 10, 2024 - 10:00 AM",
    },
    {
      id: 3,
      title: "Customer Spotlight",
      image: "/customer-highlight.jpg",
      status: "draft",
      reach: 0,
      engagement: 0,
      timestamp: "Saved",
      date: "Dec 3, 2024",
    },
  ]

  const reels = [
    {
      id: 1,
      title: "Product Unboxing",
      thumbnail: "/unboxing-video.jpg",
      status: "published",
      views: 45200,
      engagement: 12.5,
      date: "Dec 4, 2024",
    },
    {
      id: 2,
      title: "Behind the Scenes",
      thumbnail: "/bts-video.jpg",
      status: "published",
      views: 32100,
      engagement: 9.8,
      date: "Dec 2, 2024",
    },
  ]

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start md:items-center gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Content Management</h1>
          <p className="text-muted-foreground">Create, schedule, and monitor your posts and reels</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={() => setShowCreateModal(true)} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus size={18} />
            New Post
          </Button>
          <Button onClick={() => setShowScheduleModal(true)} variant="outline" className="gap-2">
            <Calendar size={18} />
            Schedule
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        {["posts", "reels"].map((tab) => (
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

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search posts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Posts Tab */}
      {activeTab === "posts" && (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-card border border-border rounded-xl p-4 flex gap-4 hover:border-primary transition"
            >
              <img
                src={post.image || "/placeholder.svg"}
                alt={post.title}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-foreground">{post.title}</h3>
                    <p className="text-xs text-muted-foreground">{post.date}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      post.status === "published"
                        ? "bg-green-100 text-green-700"
                        : post.status === "scheduled"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
                {post.status === "published" && (
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye size={14} />
                      {post.reach.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart size={14} />
                      {post.engagement}% engagement
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Zap size={16} />
                  Boost
                </Button>
                <button className="p-2 hover:bg-muted rounded-lg transition">
                  <MoreVertical size={18} className="text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reels Tab */}
      {activeTab === "reels" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reels.map((reel) => (
            <div
              key={reel.id}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary transition"
            >
              <img src={reel.thumbnail || "/placeholder.svg"} alt={reel.title} className="w-full h-40 object-cover" />
              <div className="p-4">
                <h3 className="font-bold text-foreground mb-2">{reel.title}</h3>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-green-600 font-semibold bg-green-100 px-2 py-1 rounded">
                    {reel.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{reel.date}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <p className="text-muted-foreground">Views</p>
                    <p className="font-bold text-foreground">{reel.views.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Engagement</p>
                    <p className="font-bold text-foreground">{reel.engagement}%</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                  <Zap size={14} />
                  Promote Reel
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">Create New Post</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Post Caption</label>
                <textarea
                  placeholder="Write your caption here..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Add Media</label>
                <div className="border-2 border-dashed border-primary rounded-lg p-8 text-center cursor-pointer hover:bg-muted transition">
                  <Plus size={32} className="text-primary mx-auto mb-2" />
                  <p className="font-semibold text-foreground">Click or drag to upload</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, or Video up to 100MB</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Add Hashtags</label>
                <input
                  type="text"
                  placeholder="#trending #viral #foryou"
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button className="bg-primary hover:bg-primary/90">Post Now</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Post Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">Schedule Post</h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Select Date & Time</label>
                <input
                  type="datetime-local"
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Best Time to Post</label>
                <div className="grid grid-cols-3 gap-2">
                  {["9:00 AM", "1:00 PM", "6:00 PM"].map((time) => (
                    <button
                      key={time}
                      className="py-2 px-3 rounded-lg border border-border hover:bg-muted text-sm font-semibold transition"
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </Button>
                <Button className="bg-primary hover:bg-primary/90">Schedule</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
