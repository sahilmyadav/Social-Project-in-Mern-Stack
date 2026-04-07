"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Phone, Video, X, Mic, MicOff, VideoIcon, VideoOff, PhoneOff, Trash2, Loader2, PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react"
import { Button } from "@/components/ui/button"
import Navigation from "@/components/navigation"
import { api } from "@/lib/api-client"
import { API_ENDPOINTS } from "@/lib/api-config"
import Image from "next/image"

interface CallUser {
  _id: string
  firstName: string
  lastName: string
  username: string
  profilePicture?: string
  avatar?: string
}

interface CallRecord {
  callId: string
  callType: "audio" | "video"
  caller: CallUser
  receiver: CallUser
  direction: "incoming" | "outgoing"
  status: string
  duration: number
  startedAt: string | null
  endedAt: string | null
  endReason: string | null
  createdAt: string
  threadId: string
}

export default function CallsPage() {
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"history" | "active">("history")
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [callDuration, setCallDuration] = useState(0)
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const router = useRouter()

  const fetchCallHistory = useCallback(async (skip = 0, append = false) => {
    try {
      setLoading(true)
      const res = await api.get<{ calls: CallRecord[]; total: number; hasMore: boolean }>(
        API_ENDPOINTS.CHAT.CALL_HISTORY,
        { limit: 30, skip }
      )
      if (res.data) {
        setCalls((prev) => (append ? [...prev, ...res.data!.calls] : res.data!.calls))
        setHasMore(res.data.hasMore)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.push("/")
    } else {
      setUser(JSON.parse(userData))
    }
  }, [router])

  useEffect(() => {
    if (user) fetchCallHistory()
  }, [user, fetchCallHistory])

  useEffect(() => {
    if (!activeCall) return
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [activeCall])

  const handleDeleteCall = async (callId: string) => {
    try {
      await api.delete(API_ENDPOINTS.CHAT.DELETE_CALL_LOG(callId))
      setCalls((prev) => prev.filter((c) => c.callId !== callId))
    } catch {
      // silently fail
    }
  }

  const handleLoadMore = () => {
    const nextSkip = page + 30
    setPage(nextSkip)
    fetchCallHistory(nextSkip, true)
  }

  const handleEndCall = () => {
    setActiveCall(null)
    setCallDuration(0)
  }

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "0s"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    if (diffDays === 0) return `Today, ${time}`
    if (diffDays === 1) return `Yesterday, ${time}`
    if (diffDays < 7) return `${date.toLocaleDateString([], { weekday: "long" })}, ${time}`
    return date.toLocaleDateString([], { month: "short", day: "numeric" }) + `, ${time}`
  }

  const getOtherUser = (call: CallRecord): CallUser => {
    return call.direction === "outgoing" ? call.receiver : call.caller
  }

  const getUserAvatar = (u: CallUser) => {
    return u.profilePicture || u.avatar || ""
  }

  const getUserName = (u: CallUser) => {
    return `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username || "Unknown"
  }

  const getCallStatus = (call: CallRecord) => {
    if (call.status === "missed" || call.status === "rejected" || call.status === "failed") return "missed"
    if (call.status === "initiated" || call.status === "ringing") {
      // Stale initiated/ringing calls = missed or cancelled
      return call.direction === "incoming" ? "missed" : "cancelled"
    }
    return call.direction
  }

  const getCallStatusLabel = (call: CallRecord) => {
    const status = getCallStatus(call)
    if (status === "cancelled") return "Cancelled"
    if (status === "missed") return call.direction === "incoming" ? "Missed" : "No answer"
    if (call.duration > 0) return formatDuration(call.duration)
    return call.callType === "video" ? "Video call" : "Voice call"
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-background pb-20 lg:pb-0">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={() => { localStorage.removeItem("user"); router.push("/") }} />
        </aside>

        {activeCall ? (
          <section className="lg:col-span-3 flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
            <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-primary to-secondary p-8 text-center text-white">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
                  {getUserName(getOtherUser(activeCall)).charAt(0).toUpperCase()}
                </div>
                <h2 className="text-2xl font-bold mb-2">{getUserName(getOtherUser(activeCall))}</h2>
                <p className="text-lg opacity-90">{formatDuration(callDuration)}</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setIsMicOn(!isMicOn)}
                    className={`p-4 rounded-full transition ${isMicOn ? "bg-muted hover:bg-muted/80" : "bg-accent/20 hover:bg-accent/30"}`}
                  >
                    {isMicOn ? <Mic size={24} className="text-foreground" /> : <MicOff size={24} className="text-accent" />}
                  </button>
                  <button
                    onClick={() => setIsVideoOn(!isVideoOn)}
                    className={`p-4 rounded-full transition ${isVideoOn ? "bg-muted hover:bg-muted/80" : "bg-accent/20 hover:bg-accent/30"}`}
                  >
                    {isVideoOn ? <VideoIcon size={24} className="text-foreground" /> : <VideoOff size={24} className="text-accent" />}
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
                  className={`px-4 py-3 font-semibold border-b-2 transition ${activeTab === "history"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                  History
                </button>
              </div>
            </div>

            {activeTab === "history" && (
              <div className="max-w-2xl mx-auto px-4 space-y-2">
                {loading && calls.length === 0 ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : calls.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <Phone className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No call history</p>
                    <p className="text-sm mt-1">Your calls will appear here</p>
                  </div>
                ) : (
                  <>
                    {calls.map((call) => {
                      const otherUser = getOtherUser(call)
                      const avatar = getUserAvatar(otherUser)
                      const name = getUserName(otherUser)
                      const status = getCallStatus(call)
                      const isMissed = status === "missed" || status === "cancelled"

                      return (
                        <div
                          key={call.callId}
                          className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:shadow-md transition group"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="relative flex-shrink-0">
                              {avatar ? (
                                <Image
                                  src={avatar}
                                  alt={name}
                                  width={56}
                                  height={56}
                                  className="w-14 h-14 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold">
                                  {name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold truncate ${isMissed ? "text-red-500" : "text-foreground"}`}>
                                {name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {status === "incoming" && <PhoneIncoming size={12} className="text-green-500" />}
                                {status === "outgoing" && <PhoneOutgoing size={12} className="text-blue-500" />}
                                {status === "missed" && <PhoneMissed size={12} className="text-red-500" />}
                                {status === "cancelled" && <PhoneOutgoing size={12} className="text-red-500" />}
                                {call.callType === "video" && (
                                  <Video size={12} />
                                )}
                                <span className={isMissed ? "text-red-500/70" : ""}>
                                  {getCallStatusLabel(call)}
                                </span>
                                <span>•</span>
                                <span>{formatTimestamp(call.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteCall(call.callId)}
                              className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition"
                              title="Delete"
                            >
                              <Trash2 size={16} className="text-red-500" />
                            </button>
                            <button className="p-2 rounded-full bg-muted hover:bg-primary/20 transition">
                              <Phone size={18} className="text-primary" />
                            </button>
                            <button className="p-2 rounded-full bg-muted hover:bg-secondary/20 transition">
                              <Video size={18} className="text-secondary" />
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {hasMore && (
                      <div className="text-center pt-4">
                        <Button
                          variant="outline"
                          onClick={handleLoadMore}
                          disabled={loading}
                          className="gap-2"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Load More
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <Navigation user={user} onLogout={() => { localStorage.removeItem("user"); router.push("/") }} isMobile={true} />
    </main>
  )
}
