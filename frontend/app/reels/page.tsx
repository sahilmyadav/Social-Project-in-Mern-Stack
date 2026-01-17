"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Play, Pause } from "lucide-react"
import Navigation from "@/components/navigation"
import ReelCommentsModal from "@/components/reel-comments-modal"
import UserAvatar from "@/components/user-avatar"
import { feedService, reelService } from "@/lib/api-services"

interface Reel {
  _id: string
  media: {
    url: string
    thumbnail: string
    duration: number
    width: number
    height: number
  }
  user_id: {
    _id: string
    firstName: string
    lastName: string
  }
  caption: string
  tags: string[]
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  is_deleted: boolean
  createdAt: string
  updatedAt: string
}

export default function ReelsPage() {
  const [user, setUser] = useState<any>(null)
  const [currentReelIndex, setCurrentReelIndex] = useState(0)
  const [likedReels, setLikedReels] = useState<string[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [reels, setReels] = useState<Reel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showComments, setShowComments] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
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
    const fetchReels = async () => {
      try {
        setLoading(true)
        const response = await feedService.getReelsFeed({ page: 1, limit: 20 })
        if (response.success && response.data) {
          setReels(response.data.reels || [])
          
          // Set initial liked state based on reel data
          const likedReelsFromAPI = response.data.reels
            .filter((reel: any) => reel.isLiked)
            .map((reel: any) => reel._id)
          setLikedReels(likedReelsFromAPI)
        } else {
          setError("Failed to load reels")
        }
      } catch (err) {
        setError("Error loading reels")
        console.error("Error fetching reels:", err)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchReels()
    }
  }, [user])

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play()
      } else {
        videoRef.current.pause()
      }
    }
  }, [isPlaying, currentReelIndex])

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  const currentReel = reels[currentReelIndex]
  const isLiked = likedReels.includes(currentReel?._id)

  const handleLike = async () => {
    if (!currentReel) return
    
    try {
      console.log("Toggling like for reel:", currentReel._id)
      const response = await reelService.toggleLikeReel(currentReel._id)
      console.log("API response:", response)
      
      if (response.success) {
        if (response.data.isLiked) {
          setLikedReels([...likedReels, currentReel._id])
        } else {
          setLikedReels(likedReels.filter((id) => id !== currentReel._id))
        }
        // Update the reel's like count
        setReels(reels.map(reel => 
          reel._id === currentReel._id 
            ? { ...reel, likes_count: response.data.likes_count }
            : reel
        ))
      } else {
        console.error("API returned error:", response.message)
      }
    } catch (error) {
      console.error("Error toggling like:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
    }
  }

  const handlePrevious = () => {
    setCurrentReelIndex((prev) => (prev === 0 ? reels.length - 1 : prev - 1))
    setIsPlaying(true)
  }

  const handleNext = () => {
    setCurrentReelIndex((prev) => (prev === reels.length - 1 ? 0 : prev + 1))
    setIsPlaying(true)
  }

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  
  if (loading) {
    return (
      <main className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground">Loading reels...</p>
        </div>
      </main>
    )
  }

  if (error || reels.length === 0) {
    return (
      <main className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || "No reels available"}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  if (!user || !currentReel) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Reels Feed */}
        <section className="lg:col-span-2 pb-20 lg:pb-0">
          <div className="sticky top-0 z-20 mb-4">
            <h1 className="text-3xl font-bold text-foreground p-4">Reels</h1>
          </div>

          <div className="max-w-2xl mx-auto">
            {/* Reel Video Container */}
            <div className="relative bg-black rounded-3xl overflow-hidden aspect-[9/16] max-h-[600px] mx-auto shadow-2xl mb-6">
              {/* Video Element */}
              <video
                ref={videoRef}
                src={currentReel.media.url}
                poster={currentReel.media.thumbnail}
                className="w-full h-full object-cover"
                loop
                playsInline
                muted={isMuted}
                onClick={togglePlayPause}
              />

              {/* Play/Pause Overlay */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <button
                    onClick={togglePlayPause}
                    className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition text-white"
                  >
                    <Play size={48} fill="white" />
                  </button>
                </div>
              )}

              {/* Video Controls */}
              <button
                onClick={toggleMute}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition text-white z-10"
              >
                {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </button>

              {/* Bottom gradient overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />

              {/* Author Info */}
              <div className="absolute bottom-4 left-4 flex items-center gap-3 z-10">
                <UserAvatar user={currentReel.user_id} size="lg" className="border-2 border-white" />
                <div className="text-white">
                  <p className="font-bold">
                    {currentReel.user_id.firstName} {currentReel.user_id.lastName}
                  </p>
                  <p className="text-sm opacity-80">Follow</p>
                </div>
              </div>

              {/* Caption */}
              {currentReel.caption && (
                <div className="absolute bottom-20 left-4 right-16 z-10">
                  <p className="text-white text-sm line-clamp-2">{currentReel.caption}</p>
                </div>
              )}

              {/* Right Side Actions */}
              <div className="absolute right-4 bottom-24 flex flex-col gap-6 z-10">
                <button
                  onClick={handleLike}
                  className={`flex flex-col items-center gap-2 transition ${isLiked ? "text-accent" : "text-white"}`}
                >
                  <div className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition backdrop-blur">
                    <Heart size={24} fill={isLiked ? "currentColor" : "none"} />
                  </div>
                  <span className="text-xs font-semibold">{currentReel.likes_count}</span>
                </button>

                <button 
                  onClick={() => setShowComments(true)}
                  className="flex flex-col items-center gap-2 text-white"
                >
                  <div className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition backdrop-blur">
                    <MessageCircle size={24} />
                  </div>
                  <span className="text-xs font-semibold">{currentReel.comments_count}</span>
                </button>

                <button className="flex flex-col items-center gap-2 text-white">
                  <div className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition backdrop-blur">
                    <Share2 size={24} />
                  </div>
                  <span className="text-xs font-semibold">{currentReel.shares_count}</span>
                </button>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-4 px-4">
              <button
                onClick={handlePrevious}
                className="px-6 py-3 rounded-lg bg-muted hover:bg-muted/80 transition font-semibold"
              >
                Previous
              </button>
              <div className="flex gap-2">
                {reels.map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full transition ${
                      i === currentReelIndex ? "bg-primary w-8" : "bg-muted w-2"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={handleNext}
                className="px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {/* Right Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 border-l border-border p-4">
          <div className="bg-card rounded-2xl border border-border p-4 sticky top-0">
            <h3 className="font-bold text-lg mb-4">Suggested Creators</h3>
            <div className="space-y-3">
              {["@creative_hub", "@design_pro", "@studio_art", "@videografer"].map((creator, i) => (
                <div key={i} className="p-3 hover:bg-muted rounded-lg cursor-pointer transition">
                  <p className="text-primary font-semibold">{creator}</p>
                  <p className="text-sm text-muted-foreground">50K followers</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      {/* Comment Modal */}
      <ReelCommentsModal 
        open={showComments}
        onOpenChange={setShowComments}
        reelId={currentReel._id}
        commentsCount={currentReel.comments_count}
        currentUserId={user._id}
      />
    </main>
  )
}
