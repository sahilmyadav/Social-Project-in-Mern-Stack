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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Main Content */}
        <section className="lg:col-span-3">
          {/* Header with gradient background */}
          <div className="gradient-purple-peach h-48 relative">
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="p-2 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 transition"
                aria-label="Settings menu"
              >
                <Settings size={20} className="text-white" />
              </button>

              {showSettingsMenu && (
                <div className="absolute right-0 top-12 w-56 bg-card rounded-lg border border-border shadow-2xl z-50">
                  <button
                    onClick={() => document.getElementById('coverPhotoInput')?.click()}
                    disabled={uploadingImage}
                    className="w-full text-left px-4 py-3 hover:bg-muted transition border-b border-border flex items-center gap-3 text-foreground disabled:opacity-50"
                  >
                    <span>🖼️</span>
                    <span>{uploadingImage ? 'Uploading...' : 'Change Cover Photo'}</span>
                  </button>
                  <button
                    onClick={() => document.getElementById('profilePictureInput')?.click()}
                    disabled={uploadingImage}
                    className="w-full text-left px-4 py-3 hover:bg-muted transition border-b border-border flex items-center gap-3 text-foreground disabled:opacity-50"
                  >
                    <span>📷</span>
                    <span>{uploadingImage ? 'Uploading...' : 'Change Profile Picture'}</span>
                  </button>
                  <a
                    href="/account-settings"
                    className="w-full text-left px-4 py-3 hover:bg-muted transition border-b border-border flex items-center gap-3 text-foreground"
                  >
                    <span>⚙️</span>
                    <span>Account Settings</span>
                  </a>
                  <button className="w-full text-left px-4 py-3 hover:bg-muted transition border-b border-border flex items-center gap-3 text-foreground">
                    <span>🔒</span>
                    <span>Privacy & Security</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 hover:bg-muted transition flex items-center gap-3 text-red-500"
                  >
                    <span>🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              )}

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
            </div>
          </div>

          {/* Profile Info */}
          <div className="px-4 pb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-16 mb-8 relative z-10">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-6xl border-4 border-card shadow-lg overflow-hidden">
                {(user.profilePicture || user.profileImage) ? (
                  <img
                    src={user.profilePicture || user.profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to emoji if image fails to load
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = '<span>👤</span>';
                    }}
                  />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-foreground">
                  {user.firstName || user.name || "User"} {user.lastName || ""}
                </h1>
                <p className="text-lg text-muted-foreground">
                  @{user.username || ((user.firstName || user.name || user.email || "user") + "").toLowerCase().replace(/\s+/g, "")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/chat')}
                  className="p-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <MessageCircle size={20} />
                </button>
                <button className="p-2 rounded-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                  <Share size={20} />
                </button>
                <Button
                  onClick={() => setShowEditModal(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                >
                  <Edit2 size={18} />
                  Edit Bio
                </Button>
              </div>
            </div>

            {/* Bio Section */}
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <p className="text-foreground mb-6 leading-relaxed">{bio}</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-xl hover:bg-muted/80 transition cursor-pointer">
                  <p className="font-bold text-2xl text-primary">{userStats.posts}</p>
                  <p className="text-sm text-muted-foreground mt-1">Posts</p>
                </div>
                <div
                  className="text-center p-4 bg-muted rounded-xl hover:bg-muted/80 transition cursor-pointer"
                  onClick={() => {
                    if (user?._id) {
                      loadFollowers(user._id)
                    }
                    setShowFollowersModal(true)
                  }}
                >
                  <p className="font-bold text-2xl text-primary">{userStats.followers.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">Followers</p>
                </div>
                <div
                  className="text-center p-4 bg-muted rounded-xl hover:bg-muted/80 transition cursor-pointer"
                  onClick={() => {
                    if (user?._id) {
                      loadFollowing(user._id)
                    }
                    setShowFollowingModal(true)
                  }}
                >
                  <p className="font-bold text-2xl text-primary">{userStats.following}</p>
                  <p className="text-sm text-muted-foreground mt-1">Following</p>
                </div>
              </div>
            </div>

            {/* Posts and Saved Tabs */}
            <div>
              {/* Tab Headers */}
              <div className="flex border-b border-border mb-6">
                <button
                  onClick={() => handleTabChange("posts")}
                  className={`flex-1 py-3 font-semibold transition ${activeTab === "posts"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">📸</span>
                    <span>Posts</span>
                    {userStats.posts > 0 && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        {userStats.posts}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => handleTabChange("reels")}
                  className={`flex-1 py-3 font-semibold transition ${activeTab === "reels"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">🎬</span>
                    <span>Reels</span>
                    {reels.length > 0 && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        {reels.length}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => handleTabChange("saved")}
                  className={`flex-1 py-3 font-semibold transition ${activeTab === "saved"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">🔖</span>
                    <span>Saved</span>
                    {savedPosts.length > 0 && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        {savedPosts.length}
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Posts Tab Content */}
              {activeTab === "posts" && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">My Posts</h2>
                  {posts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {posts.map((post) => {
                        // Get the first media item (image or video)
                        const mediaUrl = post.media?.[0]?.url || post.media?.[0]?.thumbnail || post.file_url
                        const mediaType = post.media?.[0]?.type

                        return (
                          <div
                            key={post._id || post.id}
                            className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition cursor-pointer group"
                            onClick={() => handleOpenPostDetails(post)}
                          >
                            {mediaUrl ? (
                              mediaType === 'video' ? (
                                <video
                                  src={mediaUrl}
                                  className="w-full h-48 object-cover group-hover:scale-105 transition duration-300"
                                  muted
                                />
                              ) : (
                                <img
                                  src={mediaUrl}
                                  alt={post.caption || "Post"}
                                  className="w-full h-48 object-cover group-hover:scale-105 transition duration-300"
                                />
                              )
                            ) : (
                              <div className="w-full h-48 bg-gradient-to-br from-primary to-secondary relative overflow-hidden group-hover:scale-105 transition duration-300">
                                <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-80 group-hover:opacity-100 transition">
                                  📸
                                </div>
                              </div>
                            )}
                            <div className="p-4">
                              <p className="font-semibold text-foreground line-clamp-2">
                                {post.caption || post.content || "No caption"}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span>❤️ {post.likes_count || 0}</span>
                                <span>💬 {post.comments_count || 0}</span>
                              </div>
                              {post.media && post.media.length > 1 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  +{post.media.length - 1} more
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                      <p className="text-muted-foreground mb-4">No posts yet</p>
                      <Button onClick={() => router.push("/create")} className="bg-primary hover:bg-primary/90">
                        Create Your First Post
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Reels Tab Content */}
              {activeTab === "reels" && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">My Reels</h2>
                  {reelsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="ml-3 text-muted-foreground text-sm">Loading reels...</p>
                    </div>
                  ) : reels.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {reels.map((reel) => (
                        <ReelCard
                          key={reel._id || reel.id}
                          reel={reel}
                          currentUserId={user?._id}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                      <div className="text-6xl mb-4">🎬</div>
                      <p className="text-muted-foreground mb-2 text-lg font-semibold">No Reels Yet</p>
                      <p className="text-muted-foreground text-sm mb-4">
                        Create your first reel to share with your followers
                      </p>
                      <Button onClick={() => router.push("/create")} className="bg-primary hover:bg-primary/90">
                        Create Your First Reel
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Saved Tab Content */}
              {activeTab === "saved" && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Saved Posts</h2>
                  {savedPostsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="ml-3 text-muted-foreground text-sm">Loading saved posts...</p>
                    </div>
                  ) : savedPosts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {savedPosts.map((post) => {
                        // Get the first media item (image or video)
                        const mediaUrl = post.media?.[0]?.url || post.media?.[0]?.thumbnail || post.file_url
                        const mediaType = post.media?.[0]?.type

                        return (
                          <div
                            key={post._id || post.id}
                            className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition cursor-pointer group relative"
                            onClick={() => handleOpenPostDetails(post)}
                          >
                            {/* 3-Dot Menu Button */}
                            <div className="absolute top-2 right-2 z-20">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const postId = post._id || post.id;
                                  setOpenMenuPostId(openMenuPostId === postId ? null : postId);
                                }}
                                className="p-2 bg-black/50 backdrop-blur hover:bg-black/70 rounded-full transition"
                                title="Options"
                              >
                                <span className="text-white text-lg font-bold">⋮</span>
                              </button>

                              {/* Dropdown Menu */}
                              {openMenuPostId === (post._id || post.id) && (
                                <div className="absolute right-0 top-12 w-48 bg-card rounded-lg border border-border shadow-2xl overflow-hidden">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuPostId(null);
                                      handleOpenPostDetails(post);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-muted transition border-b border-border flex items-center gap-3 text-foreground"
                                  >
                                    <span>👁️</span>
                                    <span>View Post</span>
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setOpenMenuPostId(null);
                                      try {
                                        const postUrl = `${window.location.origin}/home?post=${post._id || post.id}`;
                                        await navigator.clipboard.writeText(postUrl);
                                        showToast.success('Link copied!', 'Post link copied to clipboard');
                                      } catch (err) {
                                        console.error('Error copying link:', err);
                                        showToast.error('Failed to copy link');
                                      }
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-muted transition border-b border-border flex items-center gap-3 text-foreground"
                                  >
                                    <span>🔗</span>
                                    <span>Copy Link</span>
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setOpenMenuPostId(null);
                                      try {
                                        const postId = post._id || post.id;
                                        const response = await postService.unsavePost(postId);
                                        if (response.success) {
                                          setSavedPosts(savedPosts.filter(p => (p._id || p.id) !== postId));
                                          toasts.postUnsaved();
                                        } else {
                                          toasts.saveError();
                                        }
                                      } catch (err) {
                                        console.error('Error unsaving post:', err);
                                        toasts.saveError();
                                      }
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-950/20 transition flex items-center gap-3 text-red-500"
                                  >
                                    <span>🗑️</span>
                                    <span>Remove from Saved</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Saved Badge */}
                            <div className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                              <span>🔖</span>
                              <span>Saved</span>
                            </div>

                            {mediaUrl ? (
                              mediaType === 'video' ? (
                                <video
                                  src={mediaUrl}
                                  className="w-full h-48 object-cover group-hover:scale-105 transition duration-300"
                                  muted
                                />
                              ) : (
                                <img
                                  src={mediaUrl}
                                  alt={post.caption || "Post"}
                                  className="w-full h-48 object-cover group-hover:scale-105 transition duration-300"
                                />
                              )
                            ) : (
                              <div className="w-full h-48 bg-gradient-to-br from-primary to-secondary relative overflow-hidden group-hover:scale-105 transition duration-300">
                                <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-80 group-hover:opacity-100 transition">
                                  📸
                                </div>
                              </div>
                            )}
                            <div className="p-4">
                              <p className="font-semibold text-foreground line-clamp-2">
                                {post.caption || post.content || "No caption"}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span>❤️ {post.likes_count || 0}</span>
                                <span>💬 {post.comments_count || 0}</span>
                              </div>
                              {post.media && post.media.length > 1 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  +{post.media.length - 1} more
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                      <div className="text-6xl mb-4">🔖</div>
                      <p className="text-muted-foreground mb-2 text-lg font-semibold">No Saved Posts</p>
                      <p className="text-muted-foreground text-sm mb-4">
                        Save posts to keep them for later
                      </p>
                      <Button onClick={() => router.push("/home")} className="bg-primary hover:bg-primary/90">
                        Explore Posts
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Edit Bio Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Your Bio</DialogTitle>
          </DialogHeader>
          <textarea
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            placeholder="Tell us about yourself..."
            className="w-full p-4 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            rows={5}
            maxLength={160}
          />
          <p className="text-xs text-muted-foreground">{editBio.length}/160 characters</p>
          <DialogFooter>
            <Button onClick={() => setShowEditModal(false)} variant="outline" className="bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleSaveBio} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Save Bio
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

      {/* Post Details Modal */}
      {selectedPost && (
        <PostDetailsModal isOpen={showPostDetails} onClose={handleClosePostDetails} post={selectedPost} />
      )}

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />
    </main>
  )
}
