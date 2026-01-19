"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Settings, Edit2, MessageCircle, Share } from "lucide-react"
import Navigation from "@/components/navigation"
import FollowersModal from "@/components/followers-modal"
import PostDetailsModal from "@/components/post-details-modal"
import ReelCard from "@/components/reel-card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { authService, feedService, followService, postService, reelService } from "@/lib/api-services"
import { ApiError } from "@/lib/api-client"
import { toasts, showToast } from "@/lib/toast"

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showFollowersModal, setShowFollowersModal] = useState(false)
  const [showFollowingModal, setShowFollowingModal] = useState(false)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showPostDetails, setShowPostDetails] = useState(false)
  const [selectedPost, setSelectedPost] = useState<any>(null)
  const [bio, setBio] = useState("")
  const [editBio, setEditBio] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [userStats, setUserStats] = useState({
    posts: 0,
    followers: 0,
    following: 0,
  })

  const [followers, setFollowers] = useState<any[]>([])
  const [following, setFollowing] = useState<any[]>([])
  const [followersLoading, setFollowersLoading] = useState(false)
  const [followingLoading, setFollowingLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [posts, setPosts] = useState<any[]>([])
  const [reels, setReels] = useState<any[]>([])
  const [reelsLoading, setReelsLoading] = useState(false)
  const [savedPosts, setSavedPosts] = useState<any[]>([])
  const [savedPostsLoading, setSavedPostsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"posts" | "reels" | "saved">("posts")
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    loadUserProfile()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuPostId) {
        setOpenMenuPostId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuPostId])

  const loadUserProfile = async () => {
    try {
      setLoading(true)

      // Check if user is logged in
      const token = localStorage.getItem("accessToken")
      if (!token) {
        router.push("/login")
        return
      }

      // Fetch current user data from API
      const response = await authService.getCurrentUser()

      if (response.success && response.data) {
        // Handle nested data structure
        const userData = response.data.data || response.data
        const followersCount = response.data.followersCount || 0
        const followingCount = response.data.followingCount || 0
        const totalPosts = response.data.totalPosts || 0

        setUser(userData)
        setBio(userData.bio || "Welcome to my profile!")
        setEditBio(userData.bio || "")

        // Set user stats from the single API response
        setUserStats({
          posts: totalPosts,
          followers: followersCount,
          following: followingCount,
        })

        // Update localStorage
        localStorage.setItem("user", JSON.stringify(userData))

        // Load user posts
        if (userData._id) {
          await loadUserPosts(userData._id)
        }
      } else {
        router.push("/login")
      }
    } catch (err) {
      const apiError = err as ApiError
      console.error("Failed to load profile:", apiError)

      if (apiError.statusCode === 401) {
        // Token expired or invalid
        localStorage.removeItem("accessToken")
        localStorage.removeItem("refreshToken")
        localStorage.removeItem("user")
        router.push("/login")
      } else {
        setError("Failed to load profile. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const loadUserPosts = async (userId: string) => {
    try {
      const postsResponse = await feedService.getUserPosts(userId, { page: 1, limit: 100 })

      if (postsResponse.success && postsResponse.data) {
        const userPosts = Array.isArray(postsResponse.data) ? postsResponse.data : postsResponse.data.posts || []
        setPosts(userPosts)
      } else {
        setPosts([])
      }
    } catch (err) {
      console.error("Failed to fetch user posts:", err)
      setPosts([])
    }
  }

  const loadUserReels = async (userId: string) => {
    try {
      setReelsLoading(true)
      const reelsResponse = await reelService.getUserReels(userId, { page: 1, limit: 100 })

      if (reelsResponse.success && reelsResponse.data) {
        const userReels = Array.isArray(reelsResponse.data) ? reelsResponse.data : reelsResponse.data.reels || []
        setReels(userReels)
      } else {
        setReels([])
      }
    } catch (err) {
      console.error("Failed to fetch user reels:", err)
      setReels([])
    } finally {
      setReelsLoading(false)
    }
  }

  const loadFollowers = async (userId: string) => {
    try {
      setFollowersLoading(true)
      const response = await followService.getFollowers(userId, { page: 1, limit: 100 })

      if (response.success && response.data) {
        const followersList = response.data.followers || []
        setFollowers(followersList)
      } else {
        setFollowers([])
      }
    } catch (err) {
      console.error("Failed to load followers:", err)
      setFollowers([])
    } finally {
      setFollowersLoading(false)
    }
  }

  const loadFollowing = async (userId: string) => {
    try {
      setFollowingLoading(true)
      const response = await followService.getFollowing(userId, { page: 1, limit: 100 })

      if (response.success && response.data) {
        const followingList = response.data.following || []
        setFollowing(followingList)
      } else {
        setFollowing([])
      }
    } catch (err) {
      console.error("Failed to load following:", err)
      setFollowing([])
    } finally {
      setFollowingLoading(false)
    }
  }

  const loadSavedPosts = async () => {
    try {
      setSavedPostsLoading(true)
      const response = await postService.getSavedPosts({ page: 1, limit: 100 })
      if (response.success && response.data) {
        // Handle different response structures
        const savedPostsList = Array.isArray(response.data)
          ? response.data
          : response.data.savedPosts || response.data.posts || []

        setSavedPosts(savedPostsList)
      } else {
        setSavedPosts([])
      }
    } catch (err) {
      console.error('Failed to fetch saved posts:', err)
      setSavedPosts([])
    } finally {
      setSavedPostsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await authService.logout()
    } catch (err) {
      console.error("Logout error:", err)
    } finally {
      localStorage.removeItem("user")
      localStorage.removeItem("accessToken")
      localStorage.removeItem("refreshToken")
      router.push("/login")
    }
  }

  const handleSaveBio = async () => {
    try {
      const response = await authService.updateProfile({
        bio: editBio,
      })

      if (response.success) {
        setBio(editBio)
        setShowEditModal(false)

        // Update user data
        if (user) {
          const updatedUser = { ...user, bio: editBio }
          setUser(updatedUser)
          localStorage.setItem("user", JSON.stringify(updatedUser))
        }
      } else {
        alert("Failed to update bio. Please try again.")
      }
    } catch (err) {
      console.error("Failed to update bio:", err)
      alert("Failed to update bio. Please try again.")
    }
  }

  const handleFollowChange = async (userId: string, isFollowing: boolean, list: "followers" | "following") => {
    try {
      if (isFollowing) {
        // Follow the user
        await followService.followUser(userId)
      } else {
        // Unfollow the user
        await followService.unfollowUser(userId)
      }

      // Update local state
      if (list === "followers") {
        setFollowers(followers.map((u) => (u._id === userId || u.id === userId ? { ...u, isFollowing } : u)))
      } else {
        setFollowing(following.map((u) => (u._id === userId || u.id === userId ? { ...u, isFollowing } : u)))
      }
    } catch (err) {
      console.error("Failed to update follow status:", err)
    }
  }

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    console.log("frontend side --->", file)
    if (!file) return

    try {
      setUploadingImage(true)

      // Try different FormData approaches
      const formData = new FormData()

      // Method 1: Standard append
      formData.append('file', file)
      console.log("Method 1 - FormData file entry:", formData.get('file'))

      // Method 2: Check all FormData entries
      console.log("All FormData entries:")
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value)
      }

      // Method 3: Create new FormData and test
      const testFormData = new FormData()
      testFormData.append('file', file)
      console.log("Test FormData file entry:", testFormData.get('file'))

      const response = await authService.updateProfilePicture(formData)
      console.log("API response:", response)

      if (response.success) {
        // Reload profile to get updated image
        await loadUserProfile()
        alert('Profile picture updated successfully!')
      } else {
        alert('Failed to update profile picture')
      }
    } catch (err) {
      console.error('Error uploading profile picture:', err)
      alert('Failed to update profile picture')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleCoverPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingImage(true)
      const formData = new FormData()
      formData.append('coverPhoto', file)

      const response = await authService.updateCoverPhoto(formData)

      if (response.success) {
        // Reload profile to get updated image
        await loadUserProfile()
        alert('Cover photo updated successfully!')
      } else {
        alert('Failed to update cover photo')
      }
    } catch (err) {
      console.error('Error uploading cover photo:', err)
      alert('Failed to update cover photo')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleOpenPostDetails = (post: any) => {
    setSelectedPost(post)
    setShowPostDetails(true)
  }

  const handleClosePostDetails = () => {
    setShowPostDetails(false)
    // Refresh saved posts in case user unsaved the post
    if (activeTab === 'saved') {
      loadSavedPosts()
    }
  }

  const handleTabChange = (tab: "posts" | "reels" | "saved") => {
    setActiveTab(tab)

    // Load reels only when Reels tab is clicked and reels haven't been loaded yet
    if (tab === "reels" && reels.length === 0 && !reelsLoading && user?._id) {
      loadUserReels(user._id)
    }

    // Always reload saved posts when Saved tab is clicked to show newly saved posts
    if (tab === "saved" && !savedPostsLoading) {
      loadSavedPosts()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={loadUserProfile}>Retry</Button>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-background pb-20 lg:pb-0">
      <div className="flex justify-center">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex lg:flex-col lg:w-[245px] xl:w-[335px] border-r border-border fixed left-0 top-0 h-screen">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Main Content */}
        <div className="w-full lg:ml-[245px] xl:ml-[335px] max-w-[935px]">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="p-1"
              >
                <Settings size={24} />
              </button>
              <h1 className="text-base font-semibold">{user.username || "Profile"}</h1>
              <div className="w-6" />
            </div>
          </header>

          {/* Profile Header Section */}
          <div className="px-4 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row gap-8 mb-8">
              {/* Profile Picture */}
              <div className="flex-shrink-0 flex justify-center sm:justify-start">
                <div className="w-[77px] h-[77px] sm:w-[150px] sm:h-[150px] rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center overflow-hidden ring-1 ring-border">
                  {(user.profilePicture || user.profileImage) ? (
                    <img
                      src={user.profilePicture || user.profileImage}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-4xl sm:text-6xl">👤</span>
                  )}
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                {/* Username row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
                  <h1 className="text-xl font-normal text-center sm:text-left">
                    {user.username || user.firstName?.toLowerCase().replace(/\s+/g, "")}
                  </h1>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Button
                      onClick={() => setShowEditModal(true)}
                      variant="secondary"
                      size="sm"
                      className="font-semibold text-sm h-8 px-4"
                    >
                      Edit profile
                    </Button>
                    <button
                      onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                      className="p-1 hidden lg:block"
                    >
                      <Settings size={24} />
                    </button>
                  </div>
                </div>

                {/* Stats row - Desktop */}
                <div className="hidden sm:flex items-center gap-10 mb-5">
                  <div className="text-center sm:text-left">
                    <span className="font-semibold">{userStats.posts}</span>
                    <span className="text-sm ml-1">posts</span>
                  </div>
                  <button
                    onClick={() => {
                      if (user?._id) loadFollowers(user._id)
                      setShowFollowersModal(true)
                    }}
                    className="text-center sm:text-left hover:opacity-70 transition"
                  >
                    <span className="font-semibold">{userStats.followers.toLocaleString()}</span>
                    <span className="text-sm ml-1">followers</span>
                  </button>
                  <button
                    onClick={() => {
                      if (user?._id) loadFollowing(user._id)
                      setShowFollowingModal(true)
                    }}
                    className="text-center sm:text-left hover:opacity-70 transition"
                  >
                    <span className="font-semibold">{userStats.following}</span>
                    <span className="text-sm ml-1">following</span>
                  </button>
                </div>

                {/* Bio */}
                <div className="hidden sm:block">
                  <p className="font-semibold text-sm">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{bio}</p>
                </div>
              </div>
            </div>

            {/* Bio - Mobile */}
            <div className="sm:hidden mb-4 -mt-2">
              <p className="font-semibold text-sm">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm whitespace-pre-wrap">{bio}</p>
            </div>

            {/* Stats row - Mobile */}
            <div className="sm:hidden flex items-center justify-around py-3 border-y border-border mb-4 -mx-4 px-4">
              <div className="text-center">
                <p className="font-semibold">{userStats.posts}</p>
                <p className="text-xs text-muted-foreground">posts</p>
              </div>
              <button
                onClick={() => {
                  if (user?._id) loadFollowers(user._id)
                  setShowFollowersModal(true)
                }}
                className="text-center"
              >
                <p className="font-semibold">{userStats.followers.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">followers</p>
              </button>
              <button
                onClick={() => {
                  if (user?._id) loadFollowing(user._id)
                  setShowFollowingModal(true)
                }}
                className="text-center"
              >
                <p className="font-semibold">{userStats.following}</p>
                <p className="text-xs text-muted-foreground">following</p>
              </button>
            </div>
          </div>

          {/* Hidden file inputs */}
          <input
            id="coverPhotoInput"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverPhotoUpload}
          />
          <input
            id="profilePictureInput"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleProfilePictureUpload}
          />

          {/* Settings Dropdown */}
          {showSettingsMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSettingsMenu(false)} />
              <div className="fixed lg:absolute right-4 top-16 lg:top-20 lg:right-8 w-[260px] bg-card rounded-xl border border-border shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => document.getElementById('profilePictureInput')?.click()}
                  disabled={uploadingImage}
                  className="w-full text-left px-4 py-3 hover:bg-muted/80 transition text-sm disabled:opacity-50"
                >
                  {uploadingImage ? 'Uploading...' : 'Change profile photo'}
                </button>
                <a
                  href="/account-settings"
                  className="block w-full text-left px-4 py-3 hover:bg-muted/80 transition text-sm"
                >
                  Settings
                </a>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 hover:bg-muted/80 transition text-sm text-destructive"
                >
                  Log out
                </button>
              </div>
            </>
          )}

          {/* Tabs */}
          <div className="border-t border-border">
            <div className="flex items-center justify-center gap-16">
              <button
                onClick={() => handleTabChange("posts")}
                className={`flex items-center gap-1.5 py-4 text-xs tracking-wider uppercase border-t-[1px] -mt-[1px] transition ${
                  activeTab === "posts"
                    ? "text-foreground border-foreground font-semibold"
                    : "text-muted-foreground border-transparent"
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                  <rect x="0" y="0" width="7" height="7" />
                  <rect x="8.5" y="0" width="7" height="7" />
                  <rect x="17" y="0" width="7" height="7" />
                  <rect x="0" y="8.5" width="7" height="7" />
                  <rect x="8.5" y="8.5" width="7" height="7" />
                  <rect x="17" y="8.5" width="7" height="7" />
                  <rect x="0" y="17" width="7" height="7" />
                  <rect x="8.5" y="17" width="7" height="7" />
                  <rect x="17" y="17" width="7" height="7" />
                </svg>
                Posts
              </button>
              <button
                onClick={() => handleTabChange("reels")}
                className={`flex items-center gap-1.5 py-4 text-xs tracking-wider uppercase border-t-[1px] -mt-[1px] transition ${
                  activeTab === "reels"
                    ? "text-foreground border-foreground font-semibold"
                    : "text-muted-foreground border-transparent"
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5 13h-4v4c0 .6-.4 1-1 1s-1-.4-1-1v-4H7c-.6 0-1-.4-1-1s.4-1 1-1h4V7c0-.6.4-1 1-1s1 .4 1 1v4h4c.6 0 1 .4 1 1s-.4 1-1 1z"/>
                </svg>
                Reels
              </button>
              <button
                onClick={() => handleTabChange("saved")}
                className={`flex items-center gap-1.5 py-4 text-xs tracking-wider uppercase border-t-[1px] -mt-[1px] transition ${
                  activeTab === "saved"
                    ? "text-foreground border-foreground font-semibold"
                    : "text-muted-foreground border-transparent"
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                Saved
              </button>
            </div>
          </div>

          {/* Grid Content */}
          <div className="pb-8">
            {activeTab === "posts" && (
              posts.length > 0 ? (
                <div className="grid grid-cols-3 gap-1">
                  {posts.map((post) => {
                    const mediaUrl = post.media?.[0]?.url || post.media?.[0]?.thumbnail || post.file_url
                    const mediaType = post.media?.[0]?.type
                    return (
                      <div
                        key={post._id || post.id}
                        className="aspect-square bg-muted overflow-hidden cursor-pointer group relative"
                        onClick={() => handleOpenPostDetails(post)}
                      >
                        {mediaUrl ? (
                          mediaType === 'video' ? (
                            <video src={mediaUrl} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                          )
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center text-4xl">📸</div>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-6">
                          <div className="flex items-center gap-1.5 text-white font-semibold">
                            <span>❤️</span>
                            <span>{post.likes_count || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-white font-semibold">
                            <span>💬</span>
                            <span>{post.comments_count || 0}</span>
                          </div>
                        </div>
                        {/* Multi-image indicator */}
                        {post.media?.length > 1 && (
                          <div className="absolute top-2 right-2">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white drop-shadow" fill="currentColor">
                              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
                              <rect x="7" y="7" width="10" height="10" rx="1"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-foreground flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <path d="M21 15l-5-5L5 21"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-light mb-2">Share Photos</h3>
                  <p className="text-sm text-muted-foreground">
                    When you share photos, they will appear on your profile.
                  </p>
                </div>
              )
            )}
            {activeTab === "reels" && (
              reelsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-primary border-t-transparent" />
                </div>
              ) : reels.length > 0 ? (
                <div className="grid grid-cols-3 gap-1">
                  {reels.map((reel) => {
                    const videoUrl = reel.video?.url || reel.videoUrl
                    return (
                      <div
                        key={reel._id || reel.id}
                        className="aspect-[9/16] bg-black overflow-hidden cursor-pointer group relative"
                      >
                        {videoUrl && (
                          <video src={videoUrl} className="w-full h-full object-cover" muted />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <div className="flex items-center gap-1.5 text-white font-semibold">
                            <span>▶</span>
                            <span>{reel.views_count || 0}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-foreground flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <polygon points="10,8 16,12 10,16"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-light mb-2">Share Reels</h3>
                  <p className="text-sm text-muted-foreground">
                    When you share reels, they will appear on your profile.
                  </p>
                </div>
              )
            )}

            {activeTab === "saved" && (
              savedPostsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-primary border-t-transparent" />
                </div>
              ) : savedPosts.length > 0 ? (
                <div className="grid grid-cols-3 gap-1">
                  {savedPosts.map((post) => {
                    const mediaUrl = post.media?.[0]?.url || post.media?.[0]?.thumbnail || post.file_url
                    const mediaType = post.media?.[0]?.type
                    return (
                      <div
                        key={post._id || post.id}
                        className="aspect-square bg-muted overflow-hidden cursor-pointer group relative"
                        onClick={() => handleOpenPostDetails(post)}
                      >
                        {mediaUrl ? (
                          mediaType === 'video' ? (
                            <video src={mediaUrl} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                          )
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center text-4xl">📸</div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-6">
                          <div className="flex items-center gap-1.5 text-white font-semibold">
                            <span>❤️</span>
                            <span>{post.likes_count || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-white font-semibold">
                            <span>💬</span>
                            <span>{post.comments_count || 0}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-foreground flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-light mb-2">Save</h3>
                  <p className="text-sm text-muted-foreground">
                    Save photos and videos that you want to see again.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Edit Bio Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-center font-semibold">Edit bio</DialogTitle>
          </DialogHeader>
          <textarea
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            placeholder="Bio"
            className="w-full p-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground text-sm"
            rows={4}
            maxLength={150}
          />
          <p className="text-xs text-muted-foreground text-right">{editBio.length}/150</p>
          <DialogFooter className="gap-2">
            <Button onClick={() => setShowEditModal(false)} variant="ghost" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveBio} className="flex-1 bg-[#0095F6] hover:bg-[#1877F2] text-white">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FollowersModal
        open={showFollowersModal}
        onOpenChange={setShowFollowersModal}
        title="Followers"
        users={followers}
        loading={followersLoading}
        onFollowChange={(userId, isFollowing) => handleFollowChange(userId, isFollowing, "followers")}
      />

      <FollowersModal
        open={showFollowingModal}
        onOpenChange={setShowFollowingModal}
        title="Following"
        users={following}
        loading={followingLoading}
        onFollowChange={(userId, isFollowing) => handleFollowChange(userId, isFollowing, "following")}
      />

      {selectedPost && (
        <PostDetailsModal isOpen={showPostDetails} onClose={handleClosePostDetails} post={selectedPost} />
      )}

      <Navigation user={user} onLogout={handleLogout} isMobile={true} />
    </main>
  )
}
