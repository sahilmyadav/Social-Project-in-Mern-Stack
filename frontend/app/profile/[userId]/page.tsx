"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MessageCircle,
  UserPlus,
  UserCheck,
  Clock,
  MoreHorizontal,
  Share2,
  Link as LinkIcon,
  Flag,
  Ban,
  Unlock,
  Grid,
  Clapperboard,
  Edit2,
  Camera,
  Heart,
  UserX,
} from "lucide-react";
import PostDetailsModal from "@/components/post-details-modal";
import Navigation from "@/components/navigation";
import PostCard from "@/components/post-card";
import ReelCard from "@/components/reel-card";
import { authService, feedService, followService, reelService } from "@/lib/api-services";
import { toasts, showToast } from "@/lib/toast";
import { useConfirmDialog, ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const { confirm, dialogProps } = useConfirmDialog();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profileUser, setProfileUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [reelsLoading, setReelsLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<
    "none" | "following" | "pending"
  >("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "reels">("posts");
  const [showPostDetails, setShowPostDetails] = useState(false);

  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    loadUserProfile();
  }, [userId]);

  // Load posts and reels when profile loads or follow status changes
  useEffect(() => {
    if (profileUser) {
      loadUserPosts();
      loadUserReels();
    }
  }, [profileUser, followStatus]);

  const loadCurrentUser = async () => {
    try {
      const userData = localStorage.getItem("user");
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      } else {
        // Try to fetch from API
        const response = await authService.getCurrentUser();
        if (response.success && response.data) {
          setCurrentUser(response.data);
          localStorage.setItem("user", JSON.stringify(response.data));
        }
      }
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const loadUserProfile = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const response = await authService.getUserProfile(userId);

      if (response.success && response.data) {
        const user = response.data;

        setProfileUser({
          _id: user._id || userId,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          fullName: user.fullName || `${user.firstName} ${user.lastName}`,
          username:
            user.username ||
            `${user.firstName?.toLowerCase()}${user.lastName?.toLowerCase()}`,
          bio: user.bio || "",
          profilePicture: user.profilePicture || user.avatar || "👤",
          coverPhoto: user.coverPhoto || null,
          followersCount: user.followersCount || 0,
          followingCount: user.followingCount || 0,
          postsCount: user.postsCount || 0,
          reelsCount: user.reelsCount || user.totalReels || 0,
          isVerified: user.isVerified || false,
          isPrivate: user.profile_type === "private" || user.isPrivate || false,
          isFollowing: user.isFollowing || false,
          isPending: user.isPending || false,
        });

        // Set blocked status from API response
        if (user.isBlocked === true) {
          setIsBlocked(true);
        } else {
          setIsBlocked(false);
        }

        // Set follow status from API response (API is source of truth)
        if (user.isFollowing === true) {
          setFollowStatus("following");
          localStorage.setItem(`follow_status_${userId}`, "following");
        } else if (user.isPending === true) {
          setFollowStatus("pending");
          localStorage.setItem(`follow_status_${userId}`, "pending");
        } else {
          // Not following
          setFollowStatus("none");
          localStorage.setItem(`follow_status_${userId}`, "none");
        }
      }
    } catch (error: any) {
      console.error("Error loading user profile:", error);

      // Handle 404 Not Found (User blocked or doesn't exist)
      if (error?.statusCode === 404 || error?.status === 404) {
        setNotFound(true);
        setProfileUser(null);
      } else {
        // Only set fallback if it's NOT a 404 error (e.g. network error)
        // Or we can just set notFound to true as well for safety to avoid crashing
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUserPosts = async () => {
    try {
      const isOwnProfile = currentUser?._id === userId;

      // Don't load posts if account is private and not following
      if (profileUser?.isPrivate && followStatus !== "following" && !isOwnProfile) {
        setPosts([]);
        return;
      }

      const response = await feedService.getUserPosts(userId, {
        page: 1,
        limit: 20,
      });
      if (response.success && response.data) {
        // Handle different response structures - data might be an array or an object with posts
        const userPosts = Array.isArray(response.data)
          ? response.data
          : response.data.posts || [];
        setPosts(userPosts);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error("Error loading user posts:", error);
      setPosts([]);
    }
  };

  const loadUserReels = async () => {
    try {
      setReelsLoading(true);
      const isOwnProfile = currentUser?._id === userId;

      // Don't load reels if account is private and not following
      if (profileUser?.isPrivate && followStatus !== "following" && !isOwnProfile) {
        setReels([]);
        setReelsLoading(false);
        return;
      }

      const response = await reelService.getUserReels(userId, {
        page: 1,
        limit: 20,
      });
      if (response.success && response.data) {
        // Handle different response structures - data might be an array or an object with reels
        const userReels = Array.isArray(response.data)
          ? response.data
          : response.data.reels || [];
        setReels(userReels);
      } else {
        setReels([]);
      }
    } catch (error) {
      console.error("Error loading user reels:", error);
      setReels([]);
    } finally {
      setReelsLoading(false);
    }
  };
  // const handleFollowAction
  const handleFollowAction = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      if (followStatus === "following") {
        const response = await followService.unfollowUser(userId);
        if (response.success) {
          setFollowStatus("none");
          localStorage.setItem(`follow_status_${userId}`, "none");
          // Update follower count
          setProfileUser((prev: any) => ({
            ...prev,
            followersCount: Math.max(0, (prev?.followersCount || 0) - 1),
          }));
        }
      } else if (followStatus === "pending") {
        try {
          const response = await followService.cancelFollowRequest(userId);
          if (response.success) {
            setFollowStatus("none");
            localStorage.setItem(`follow_status_${userId}`, "none");
          }
        } catch (cancelError: any) {
          // Check if error is "not found" (request already canceled or doesn't exist)
          const errorMessage = cancelError?.message || cancelError?.error || "";
          const statusCode = cancelError?.statusCode || 0;

          if (statusCode === 404 || errorMessage.toLowerCase().includes("not found")) {
            // Request doesn't exist - set status to none anyway
            setFollowStatus("none");
            localStorage.setItem(`follow_status_${userId}`, "none");
          } else {
            // Other error - rethrow
            throw cancelError;
          }
        }
      } else {
        // Use sendFollowRequest for all accounts (public and private)
        try {
          const response = await followService.sendFollowRequest(userId);
          if (response.success) {
            // Check if auto-approved (public account)
            if (
              response.data?.autoApproved ||
              response.data?.followRequest?.status === "accepted"
            ) {
              setFollowStatus("following");
              localStorage.setItem(`follow_status_${userId}`, "following");
              // Update follower count for public accounts
              setProfileUser((prev: any) => ({
                ...prev,
                followersCount: (prev?.followersCount || 0) + 1,
              }));
            } else {
              // Request pending for private accounts
              setFollowStatus("pending");
              localStorage.setItem(`follow_status_${userId}`, "pending");
            }
          }
        } catch (followError: any) {
          // Check if error is "already sent"
          const errorMessage = followError?.message || followError?.error || "";
          if (errorMessage.toLowerCase().includes("already sent")) {
            // Request already exists - set status to pending
            setFollowStatus("pending");
            localStorage.setItem(`follow_status_${userId}`, "pending");
          } else {
            // Other error - rethrow to be caught by outer catch
            throw followError;
          }
        }
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.error || "Failed to perform action";

      // Don't show alert for "already sent" errors (already handled above)
      if (!errorMessage.toLowerCase().includes("already sent")) {
        toasts.error(errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMessage = async () => {
    // Navigate to chat page with user info
    const userName = profileUser?.fullName || `${profileUser?.firstName} ${profileUser?.lastName}` || profileUser?.username || 'User';
    const avatar = profileUser?.profilePicture || profileUser?.avatar || '👤';
    router.push(`/chat?userId=${userId}&userName=${encodeURIComponent(userName)}&avatar=${encodeURIComponent(avatar)}`);
  };

  const handleBlockUser = async () => {
    setShowOptionsMenu(false);

    confirm({
      title: "Block User",
      message: `Are you sure you want to block ${profileUser.fullName || profileUser.username}?\n\n• They won't be able to find your profile or posts\n• They won't be able to message you\n• You won't see their posts or messages`,
      variant: "danger",
      confirmText: "Block",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          const response = await authService.blockUser(userId);

          if (response.success) {
            setIsBlocked(true);
            toasts.userBlocked(profileUser.fullName || profileUser.username);
          } else {
            toasts.error(response.message || 'Failed to block user');
          }
        } catch (error: any) {
          console.error('Error blocking user:', error);
          toasts.error(error?.message || 'Failed to block user');
        }
      }
    });
  };

  const handleUnblockUser = async () => {
    setShowOptionsMenu(false);

    confirm({
      title: "Unblock User",
      message: `Unblock ${profileUser.fullName || profileUser.username}?\n\nThey will be able to see your profile and interact with you again.`,
      variant: "warning",
      confirmText: "Unblock",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          const response = await authService.unblockUser(userId);

          if (response.success) {
            setIsBlocked(false);
            toasts.userUnblocked(profileUser.fullName || profileUser.username);
          } else {
            toasts.error(response.message || 'Failed to unblock user');
          }
        } catch (error: any) {
          console.error('Error unblocking user:', error);
          toasts.error(error?.message || 'Failed to unblock user');
        }
      }
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }



  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
          <UserX className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          User Not Found
        </h2>
        <p className="text-muted-foreground max-w-sm mb-8">
          Sorry, this page isn't available. The link you followed may be broken, or the page may have been removed.
        </p>
        <Button onClick={() => router.push("/")}>
          Go back to Home
        </Button>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-xl font-bold mb-2">User not found</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?._id === userId;

  return (
    <main className="min-h-screen bg-background">
      <ConfirmDialog {...dialogProps} />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 pb-20 lg:pb-0">
        {/* Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={currentUser} onLogout={handleLogout} />
        </aside>

        {/* Main Content */}
        <section className="lg:col-span-3 p-4 lg:p-8">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6 gap-2"
          >
            <ArrowLeft size={20} />
            Back
          </Button>

          {/* Profile Header */}
          <div className="bg-card rounded-2xl border border-border p-8 mb-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Profile Picture */}
              <div className="relative">
                {profileUser.profilePicture &&
                  profileUser.profilePicture !== "👤" &&
                  profileUser.profilePicture.startsWith("http") ? (
                  <img
                    src={profileUser.profilePicture}
                    alt={
                      profileUser.fullName ||
                      `${profileUser.firstName} ${profileUser.lastName}`
                    }
                    className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-5xl border-4 border-primary/20">
                    {profileUser.profilePicture === "👤" ||
                      !profileUser.profilePicture
                      ? (profileUser.firstName?.[0] || "U").toUpperCase()
                      : profileUser.profilePicture}
                  </div>
                )}
                {profileUser.isVerified && (
                  <div className="absolute bottom-2 right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-card">
                    <span className="text-white text-sm">✓</span>
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-4 mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 justify-center md:justify-start">
                      {profileUser.fullName ||
                        `${profileUser.firstName} ${profileUser.lastName}`}
                      {profileUser.isPrivate && (
                        <span className="text-muted-foreground text-lg">
                          🔒
                        </span>
                      )}
                    </h1>
                    <p className="text-muted-foreground">
                      @{profileUser.username}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  {!isOwnProfile && (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleFollowAction}
                        disabled={isProcessing}
                        variant={
                          followStatus === "none" ? "default" : "outline"
                        }
                        className="gap-2"
                      >
                        {followStatus === "following" && (
                          <UserCheck size={16} />
                        )}
                        {followStatus === "pending" && <Clock size={16} />}
                        {followStatus === "none" && <UserPlus size={16} />}
                        {followStatus === "following"
                          ? "Unfollow"
                          : followStatus === "pending"
                            ? "Requested"
                            : profileUser.isPrivate
                              ? "Request"
                              : "Follow"}
                      </Button>
                      <Button
                        onClick={handleMessage}
                        variant="outline"
                        className="gap-2"
                      >
                        <MessageCircle size={16} />
                        Message
                      </Button>

                      {/* 3-Dot Options Menu */}
                      <div className="relative">
                        <Button
                          onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                          variant="outline"
                          size="icon"
                          className="relative"
                        >
                          <MoreHorizontal size={20} />
                        </Button>

                        {/* Dropdown Menu */}
                        {showOptionsMenu && (
                          <>
                            {/* Backdrop to close menu */}
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setShowOptionsMenu(false)}
                            />

                            <div className="absolute right-0 top-12 w-48 bg-card rounded-lg border border-border shadow-2xl z-50 overflow-hidden">
                              {/* Share Profile */}
                              <button
                                onClick={async () => {
                                  setShowOptionsMenu(false);
                                  const profileUrl = `${window.location.origin}/profile/${userId}`;
                                  if (navigator.share) {
                                    try {
                                      await navigator.share({
                                        title: `${profileUser.fullName || profileUser.username}'s Profile`,
                                        text: `Check out ${profileUser.fullName || profileUser.username} on our platform!`,
                                        url: profileUrl,
                                      });
                                    } catch (err) {
                                    }
                                  } else {
                                    await navigator.clipboard.writeText(profileUrl);
                                    showToast.success('Link copied', 'Profile link copied to clipboard!');
                                  }
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition border-b border-border flex items-center gap-2 text-foreground cursor-pointer"
                              >
                                <Share2 size={16} />
                                <span>Share Profile</span>
                              </button>

                              {/* Copy Profile Link */}
                              <button
                                onClick={async () => {
                                  setShowOptionsMenu(false);
                                  const profileUrl = `${window.location.origin}/profile/${userId}`;
                                  await navigator.clipboard.writeText(profileUrl);
                                  showToast.success('Link copied', 'Profile link copied to clipboard!');
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition border-b border-border flex items-center gap-2 text-foreground cursor-pointer"
                              >
                                <LinkIcon size={16} />
                                <span>Copy Link</span>
                              </button>

                              {/* Report User */}
                              <button
                                onClick={() => {
                                  setShowOptionsMenu(false);
                                  const reason = prompt('Please specify the reason for reporting this user:');
                                  if (reason && reason.trim()) {
                                    // TODO: Implement report user API call
                                    confirm({
                                      title: "User Reported",
                                      message: `User reported for: ${reason}\n\nThank you for helping keep our community safe.`,
                                      variant: "success",
                                      confirmText: "OK",
                                      cancelText: null
                                    });
                                  }
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition border-b border-border flex items-center gap-2 text-orange-500 cursor-pointer"
                              >
                                <Flag size={16} />
                                <span>Report User</span>
                              </button>

                              {/* Block/Unblock User */}
                              {isBlocked ? (
                                <button
                                  onClick={() => {
                                    setShowOptionsMenu(false);
                                    handleUnblockUser();
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-950/20 transition flex items-center gap-2 text-green-600 cursor-pointer"
                                >
                                  <Unlock size={16} />
                                  <span>Unblock User</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setShowOptionsMenu(false);
                                    handleBlockUser();
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition flex items-center gap-2 text-destructive cursor-pointer"
                                >
                                  <Ban size={16} />
                                  <span>Block User</span>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {isOwnProfile && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => router.push("/account-settings")}
                        variant="outline"
                        className="gap-2 cursor-pointer"
                      >
                        <Edit2 size={16} />
                        Edit Profile
                      </Button>

                      <div className="relative">
                        <Button
                          onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                          variant="outline"
                          size="icon"
                          className="relative cursor-pointer"
                        >
                          <MoreHorizontal size={20} />
                        </Button>

                        {showOptionsMenu && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setShowOptionsMenu(false)}
                            />

                            <div className="absolute right-0 top-12 w-48 bg-card rounded-lg border border-border shadow-2xl z-50 overflow-hidden">
                              <button
                                onClick={async () => {
                                  setShowOptionsMenu(false);
                                  const profileUrl = `${window.location.origin}/profile/${userId}`;
                                  if (navigator.share) {
                                    try {
                                      await navigator.share({
                                        title: `${profileUser.fullName || profileUser.username}'s Profile`,
                                        text: `Check out ${profileUser.fullName || profileUser.username} on our platform!`,
                                        url: profileUrl,
                                      });
                                    } catch (err) {
                                    }
                                  } else {
                                    await navigator.clipboard.writeText(profileUrl);
                                    showToast.success('Link copied', 'Profile link copied to clipboard!');
                                  }
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition border-b border-border flex items-center gap-2 text-foreground cursor-pointer"
                              >
                                <Share2 size={16} />
                                <span>Share Profile</span>
                              </button>

                              <button
                                onClick={async () => {
                                  setShowOptionsMenu(false);
                                  const profileUrl = `${window.location.origin}/profile/${userId}`;
                                  await navigator.clipboard.writeText(profileUrl);
                                  showToast.success('Link copied', 'Profile link copied to clipboard!');
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition border-b border-border flex items-center gap-2 text-foreground cursor-pointer"
                              >
                                <LinkIcon size={16} />
                                <span>Copy Link</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex justify-center md:justify-start gap-8 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">
                      {profileUser.postsCount || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Posts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">
                      {profileUser.followersCount || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">
                      {profileUser.followingCount || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Following</p>
                  </div>
                </div>

                {/* Bio */}
                {profileUser.bio ? (
                  <p className="text-foreground text-lg">{profileUser.bio}</p>
                ) : (
                  <p className="text-muted-foreground italic">No bio yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Content Tabs */}
          <div className="flex border-b border-border mb-6">
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex-1 flex items-center justify-center gap-2 pb-3 text-sm font-medium transition cursor-pointer relative ${activeTab === "posts"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Grid size={20} />
              Posts
              {profileUser.postsCount > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {profileUser.postsCount}
                </span>
              )}
              {activeTab === "posts" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("reels")}
              className={`flex-1 flex items-center justify-center gap-2 pb-3 text-sm font-medium transition cursor-pointer relative ${activeTab === "reels"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Clapperboard size={20} />
              Reels
              {profileUser.reelsCount > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {profileUser.reelsCount}
                </span>
              )}
              {activeTab === "reels" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>

          {/* Posts Section */}
          {activeTab === "posts" && (
            <div className="mb-6">
              {!posts || posts.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <p className="text-muted-foreground">
                    {profileUser.isPrivate && followStatus !== "following"
                      ? "This account is private. Follow to see their posts."
                      : "No posts yet"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.isArray(posts) &&
                    posts.map((post) => {
                      const mediaUrl = post.media?.[0]?.url || post.media?.[0]?.thumbnail || post.file_url;
                      const mediaType = post.media?.[0]?.type;

                      return (
                        <div
                          key={post._id || post.id}
                          className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition cursor-pointer group"
                          onClick={() => {
                            setSelectedPost(post);
                            setShowPostDetails(true);
                          }}
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
                              <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition">
                                <Camera size={48} className="text-white" />
                              </div>
                            </div>
                          )}
                          <div className="p-4">
                            <p className="font-semibold text-foreground line-clamp-2">
                              {post.caption || post.content || "No caption"}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1"><Heart size={14} className="text-red-500" /> {post.likes_count || 0}</span>
                              <span className="flex items-center gap-1"><MessageCircle size={14} /> {post.comments_count || 0}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Reels Section */}
          {activeTab === "reels" && (
            <div className="mb-6">
              {reelsLoading ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading reels...</p>
                </div>
              ) : !reels || reels.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <p className="text-muted-foreground">
                    {profileUser.isPrivate && followStatus !== "following"
                      ? "This account is private. Follow to see their reels."
                      : "No reels yet"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.isArray(reels) &&
                    reels.map((reel) => (
                      <ReelCard
                        key={reel.id || reel._id}
                        reel={reel}
                        currentUserId={currentUser?._id}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Mobile Navigation */}
      <Navigation user={currentUser} onLogout={handleLogout} isMobile={true} />

      {selectedPost && (
        <PostDetailsModal
          isOpen={showPostDetails}
          onClose={() => setShowPostDetails(false)}
          post={selectedPost}
        />
      )}
    </main>
  );
}
