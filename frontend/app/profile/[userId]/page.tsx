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
} from "lucide-react";
import Navigation from "@/components/navigation";
import PostCard from "@/components/post-card";
import ReelCard from "@/components/reel-card";
import { authService, feedService, followService, reelService } from "@/lib/api-services";

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

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
          isVerified: user.isVerified || false,
          isPrivate: user.profile_type === "private" || user.isPrivate || false,
          isFollowing: user.isFollowing || false,
          isPending: user.isPending || false,
        });

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
    } catch (error) {
      console.error("Error loading user profile:", error);
      // Fallback to basic profile
      setProfileUser({
        _id: userId,
        firstName: "User",
        lastName: "Profile",
        fullName: "User Profile",
        username: "userprofile",
        bio: "",
        profilePicture: "👤",
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        isVerified: false,
        isPrivate: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserPosts = async () => {
    try {
      const isOwnProfile = currentUser?._id === userId;

      // Don't load posts if account is private and not following
      if (profileUser?.isPrivate && followStatus !== "following" && !isOwnProfile) {
        console.log("🔒 Account is private and not following - not loading posts");
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
        console.log("🔒 Account is private and not following - not loading reels");
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
            console.log("✅ Follow request not found - assuming already canceled");
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
            console.log("✅ Follow request already exists - setting status to pending");
            setFollowStatus("pending");
            localStorage.setItem(`follow_status_${userId}`, "pending");
          } else {
            // Other error - rethrow to be caught by outer catch
            throw followError;
          }
        }
      }
    } catch (error: any) {
      console.error("❌ Error with follow action:", error);
      const errorMessage = error?.message || error?.error || "Failed to perform action";

      // Don't show alert for "already sent" errors (already handled above)
      if (!errorMessage.toLowerCase().includes("already sent")) {
        alert(errorMessage + ". Please try again.");
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

          {/* Posts Section */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">Posts</h2>
            {!posts || posts.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <p className="text-muted-foreground">
                  {profileUser.isPrivate && followStatus !== "following"
                    ? "This account is private. Follow to see their posts."
                    : "No posts yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Array.isArray(posts) &&
                  posts.map((post) => <PostCard key={post._id || post.id} post={post} />)}
              </div>
            )}
          </div>

          {/* Reels Section */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">Reels</h2>
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
        </section>
      </div>

      {/* Mobile Navigation */}
      <Navigation user={currentUser} onLogout={handleLogout} isMobile={true} />
    </main>
  );
}
