"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import Navigation from "@/components/navigation"
import PostCard from "@/components/post-card"
import CreatePostModal from "@/components/create-post-modal"
import StoriesBar from "@/components/stories-bar"
import { feedService, reelService } from "@/lib/api-services"
import ReelCard from "@/components/reel-card"
import ReelComments from "@/components/reel-comments"
import { PostCardSkeleton, StorySkeleton } from "@/components/ui/skeleton"

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedReel, setSelectedReel] = useState<any>(null)
  const [showReelComments, setShowReelComments] = useState(false)
  const [posts, setPosts] = useState<any[]>([])
  const [reels, setReels] = useState<any[]>([])
  const [feed, setFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.push("/")
    } else {
      setUser(JSON.parse(userData))
    }
  }, [router])

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 // md breakpoint
      setIsMobile(mobile)
      console.log("Mobile detection:", { width: window.innerWidth, isMobile: mobile })
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load home feed
  const loadFeed = async () => {
    try {
      setLoading(true)

      console.log("Starting to fetch feed...")

      // Fetch both posts and reels concurrently
      const [postsResponse, reelsResponse] = await Promise.all([
        feedService.getHomeFeed({ limit: 10 }).catch(err => {
          console.error("Posts API error:", err)
          return { success: false, data: null, error: err }
        }),
        reelService.getReelsFeed({ limit: 10 }).catch(err => {
          console.error("Reels API error:", err)
          return { success: false, data: null, error: err }
        })
      ])



      const postsData = postsResponse.success && postsResponse.data ? postsResponse.data.posts || [] : []
      const reelsData = reelsResponse.success && reelsResponse.data ? reelsResponse.data.reels || [] : []

      // Mix posts and reels together
      const mixedFeed = []
      const maxLength = Math.max(postsData.length, reelsData.length)



      for (let i = 0; i < maxLength; i++) {
        // Add post if available
        if (postsData[i]) {
          mixedFeed.push({ ...postsData[i], type: 'post' })
          console.log("Added post:", postsData[i]._id)
        }
        // Add reel if available
        if (reelsData[i]) {
          mixedFeed.push({ ...reelsData[i], type: 'reel' })
          console.log("Added reel:", reelsData[i]._id)
        }
      }

      console.log("Mixed feed:", mixedFeed)
      console.log("Mixed feed length:", mixedFeed.length)

      setPosts(postsData)
      setReels(reelsData)
      setFeed(mixedFeed)
    } catch (error) {
      console.error("Error loading feed:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadFeed()
    }
  }, [user])

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
    router.push("/login")
  }

  const handleOpenPostDetails = (post: any) => {
    // Toggle inline comments for the post
    setFeed(prevFeed =>
      prevFeed.map(item => {
        if (item.type === 'post' && (item._id === post._id || item.id === post._id)) {
          return { ...item, showComments: !item.showComments }
        }
        return item
      })
    )
  }

  const handleOpenReelComments = (reel: any) => {
    setSelectedReel(reel)
    setShowReelComments(true)
  }

  const handleReelLikeUpdate = (reelId: string, isLiked: boolean, likeCount: number) => {
    setFeed(prevFeed =>
      prevFeed.map(item => {
        if (item.type === 'reel' && (item._id === reelId || item.id === reelId)) {
          return {
            ...item,
            isLiked,
            likes_count: likeCount
          }
        }
        return item
      })
    )
  }

  const handlePostLikeUpdate = (postId: string, isLiked: boolean, likeCount: number) => {
    setFeed(prevFeed =>
      prevFeed.map(item => {
        if (item.type === 'post' && (item._id === postId || item.id === postId)) {
          return {
            ...item,
            isLiked,
            likes_count: likeCount
          }
        }
        return item
      })
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="flex justify-center">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex lg:flex-col lg:w-[245px] xl:w-[335px] border-r border-border fixed left-0 top-0 h-screen">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Main Content */}
        <div className="w-full lg:ml-[245px] xl:ml-[335px] lg:mr-[320px] xl:mr-[400px]">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-3">
            <div className="flex items-center justify-between max-w-lg mx-auto">
              <h1 className="text-xl font-serif italic font-semibold">ClickME</h1>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="p-1"
                >
                  <Plus size={26} className="text-foreground" />
                </button>
              </div>
            </div>
          </header>

          {/* Feed Container */}
          <section className="max-w-[470px] mx-auto pb-20 lg:pb-8 lg:pt-4">
            {/* Stories Bar */}
            <StoriesBar
              currentUserId={user?._id}
              currentUserName={user?.fullName || user?.firstName || "You"}
              currentUserAvatar={user?.profileImage || user?.profilePicture || user?.avatar}
            />

            {/* Posts Feed */}
            <div className="space-y-0 sm:space-y-3">
              {loading ? (
                <>
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                </>
              ) : feed.length > 0 ? (
                feed.map((item) => (
                  item.type === 'post' ? (
                    <PostCard
                      key={`post-${item._id || item.id}`}
                      post={item}
                      onCommentClick={() => handleOpenPostDetails(item)}
                      onLikeUpdate={(postId: string, isLiked: boolean, likeCount: number) => handlePostLikeUpdate(postId, isLiked, likeCount)}
                      currentUserId={user?._id}
                      onPostClick={() => handleOpenPostDetails(item)}
                      showComments={item.showComments}
                    />
                  ) : (
                    <ReelCard
                      key={`reel-${item._id || item.id}`}
                      reel={item}
                      currentUserId={user?._id}
                      onCommentClick={() => handleOpenReelComments(item)}
                    />
                  )
                ))
              ) : (
                <div className="py-16 text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-foreground flex items-center justify-center">
                    <Plus size={32} className="text-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Welcome to ClickME</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    When you follow people, you'll see their photos and videos here.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Sidebar - Suggestions (Desktop Only) */}
        <aside className="hidden lg:block fixed right-0 top-0 w-[320px] xl:w-[400px] h-screen pt-8 px-8">
          {/* Current User */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center overflow-hidden">
              {(user?.profileImage || user?.profilePicture || user?.avatar)?.startsWith?.('http') ? (
                <img
                  src={user?.profileImage || user?.profilePicture || user?.avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-medium text-foreground">
                  {user?.firstName?.[0] || user?.username?.[0] || "U"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user?.username}</p>
              <p className="text-sm text-muted-foreground truncate">
                {user?.firstName} {user?.lastName}
              </p>
            </div>
            <button className="text-xs font-semibold text-[#0095F6] hover:text-[#1877F2] transition">
              Switch
            </button>
          </div>

          {/* Suggestions Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-muted-foreground">Suggested for you</span>
            <button className="text-xs font-semibold text-foreground hover:opacity-70 transition">
              See All
            </button>
          </div>

          {/* Suggested Users Placeholder */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-muted skeleton-wave" />
                <div className="flex-1">
                  <div className="w-24 h-3 bg-muted rounded skeleton-wave mb-1" />
                  <div className="w-16 h-2.5 bg-muted rounded skeleton-wave" />
                </div>
                <button className="text-xs font-semibold text-[#0095F6] hover:text-[#1877F2] transition">
                  Follow
                </button>
              </div>
            ))}
          </div>

          {/* Footer Links */}
          <div className="mt-8">
            <div className="flex flex-wrap gap-x-1 text-[11px] text-muted-foreground/60 mb-4">
              <a href="#" className="hover:underline">About</a> ·
              <a href="#" className="hover:underline">Help</a> ·
              <a href="#" className="hover:underline">Press</a> ·
              <a href="#" className="hover:underline">API</a> ·
              <a href="#" className="hover:underline">Jobs</a> ·
              <a href="#" className="hover:underline">Privacy</a> ·
              <a href="#" className="hover:underline">Terms</a>
            </div>
            <p className="text-[11px] text-muted-foreground/60 uppercase">© 2024 ClickME</p>
          </div>
        </aside>
      </div>

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          loadFeed() // Refresh feed after creating post
        }}
      />



      {/* Reel Comments Modal */}
      {selectedReel && (
        <ReelComments
          reel={selectedReel}
          currentUserId={user?._id}
          isOpen={showReelComments}
          onClose={() => setShowReelComments(false)}
        />
      )}
    </main>
  )
}
