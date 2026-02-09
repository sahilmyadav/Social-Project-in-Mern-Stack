"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Phone, Video, X, Mic, MicOff, VideoIcon, VideoOff, PhoneOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import Navigation from "@/components/navigation"

interface Call {
  id: number
  name: string
  avatar: string
  duration: string
  type: "incoming" | "outgoing" | "missed"
  timestamp: string
  online: boolean
}

export default function CallsPage() {
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"history" | "active">("history")
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [callDuration, setCallDuration] = useState(0)
  const [calls] = useState<Call[]>([
    {
      id: 1,
      name: "Sarah Chen",
      avatar: "👩‍🦰",
      duration: "45 min",
      type: "outgoing",
      timestamp: "Today, 2:30 PM",
      online: true,
    },
    {
      id: 2,
      name: "Alex Rivera",
      avatar: "👨‍💼",
      duration: "12 min",
      type: "incoming",
      timestamp: "Today, 10:15 AM",
      online: false,
    },
    {
      id: 3,
      name: "Jordan Lee",
      avatar: "👩‍🎨",
      duration: "-",
      type: "missed",
      timestamp: "Yesterday, 9:45 PM",
      online: true,
    },
    {
      id: 4,
      name: "Maya Patel",
      avatar: "👩‍💻",
      duration: "1h 20 min",
      type: "outgoing",
      timestamp: "Yesterday, 3:00 PM",
      online: false,
    },
  ])
  const [onlineFriends] = useState([
    { id: 1, name: "Sarah Chen", avatar: "👩‍🦰" },
    { id: 2, name: "Jordan Lee", avatar: "👩‍🎨" },
    { id: 3, name: "Tom Harris", avatar: "👨‍🎤" },
    { id: 4, name: "Lisa Wong", avatar: "👩‍⚕️" },
  ])
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.push("/")
    } else {
      setUser(JSON.parse(userData))
    }
  }, [router])

  useEffect(() => {
    if (!activeCall) return
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [activeCall])

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  const handleStartCall = (friend: (typeof onlineFriends)[0]) => {
    setActiveCall({
      id: friend.id,
      name: friend.name,
      avatar: friend.avatar,
      duration: "0 sec",
      type: "outgoing",
      timestamp: new Date().toLocaleTimeString(),
      online: true,
    })
    setCallDuration(0)
  }

  const handleEndCall = () => {
    setActiveCall(null)
    setCallDuration(0)
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-background pb-20 lg:pb-0">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {activeCall ? (
          <section className="lg:col-span-3 flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
            <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-primary to-secondary p-8 text-center text-white">
                <div className="text-7xl mb-4">{activeCall.avatar}</div>
                <h2 className="text-2xl font-bold mb-2">{activeCall.name}</h2>
                <p className="text-lg opacity-90">{formatDuration(callDuration)}</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setIsMicOn(!isMicOn)}
                    className={`p-4 rounded-full transition ${
                      isMicOn ? "bg-muted hover:bg-muted/80" : "bg-accent/20 hover:bg-accent/30"
                    }`}
                  >
                    {isMicOn ? (
                      <Mic size={24} className="text-foreground" />
                    ) : (
                      <MicOff size={24} className="text-accent" />
                    )}
                  </button>

                  <button
                    onClick={() => setIsVideoOn(!isVideoOn)}
                    className={`p-4 rounded-full transition ${
                      isVideoOn ? "bg-muted hover:bg-muted/80" : "bg-accent/20 hover:bg-accent/30"
                    }`}
                  >
                    {isVideoOn ? (
                      <VideoIcon size={24} className="text-foreground" />
                    ) : (
                      <VideoOff size={24} className="text-accent" />
                    )}
                  </button>
                </div>

                <button
                  onClick={handleEndCall}
                  className="w-full py-4 bg-accent hover:bg-accent/90 text-accent-foreground rounded-full font-semibold transition flex items-center justify-center gap-2"
                >
                  <PhoneOff size={20} />
                  End Call
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="lg:col-span-3 pb-8">
            <div className="sticky top-0 z-20 mb-6 bg-background p-4 border-b border-border">
              <h1 className="text-3xl font-bold text-foreground mb-4">Calls</h1>

              <div className="flex gap-4 border-b border-border">
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-4 py-3 font-semibold border-b-2 transition ${
                    activeTab === "history"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  History
                </button>
                <button
                  onClick={() => setActiveTab("active")}
                  className={`px-4 py-3 font-semibold border-b-2 transition ${
                    activeTab === "active"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Online Friends
                </button>
              </div>
            </div>

            {activeTab === "history" && (
              <div className="max-w-2xl mx-auto px-4 space-y-2">
                {calls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl">
                          {call.avatar}
                        </div>
                        {call.online && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-card" />
                        )}
                      </div>

                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{call.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {call.type === "incoming" && <Phone size={12} />}
                          {call.type === "outgoing" && <Phone size={12} className="rotate-180" />}
                          {call.type === "missed" && <X size={12} className="text-accent" />}
                          <span>{call.timestamp}</span>
                          {call.type !== "missed" && <span>• {call.duration}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="p-2 rounded-full bg-muted hover:bg-primary/20 transition">
                        <Phone size={18} className="text-primary" />
                      </button>
                      <button className="p-2 rounded-full bg-muted hover:bg-secondary/20 transition">
                        <Video size={18} className="text-secondary" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "active" && (
              <div className="max-w-2xl mx-auto px-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {onlineFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="bg-card rounded-xl border border-border p-6 text-center hover:shadow-lg transition"
                    >
                      <div className="text-6xl mb-4 relative inline-block">
                        {friend.avatar}
                        <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-card" />
                      </div>
                      <p className="font-semibold text-foreground mb-4">{friend.name}</p>

                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => handleStartCall(friend)}
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                        >
                          <Phone size={18} />
                          Call
                        </Button>
                        <Button
                          onClick={() => handleStartCall(friend)}
                          className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground gap-2"
                        >
                          <Video size={18} />
                          Video
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <aside className="hidden lg:block lg:col-span-1 border-l border-border p-4">
          <div className="bg-card rounded-2xl border border-border p-4 sticky top-0">
            <h3 className="font-bold text-lg mb-4">Quick Dial</h3>
            <div className="space-y-3">
              {onlineFriends.slice(0, 4).map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => handleStartCall(friend)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-lg transition"
                >
                  <div className="flex items-center gap-2">
                    <div className="text-xl">{friend.avatar}</div>
                    <span className="text-sm font-medium text-foreground truncate">{friend.name}</span>
                  </div>
                  <Video size={16} className="text-primary" />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Navigation user={user} onLogout={handleLogout} isMobile={true} />
    </main>
  )
}
