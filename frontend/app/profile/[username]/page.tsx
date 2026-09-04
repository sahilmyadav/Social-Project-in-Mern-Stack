'use client';

import Navigation from '@/components/navigation';
import PostDetailsModal from '@/components/post-details-modal';
import { ProfileImageEditor } from '@/components/profile-image-editor';
import ReelCard from '@/components/reel-card';
import ReelCommentsModal from '@/components/reel-comments-modal';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { authService, feedService, followService, reelService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import { showToast, toasts } from '@/lib/toast';
import {
    ArrowLeft,
    Ban,
    Camera,
    Clapperboard,
    Clock,
    Edit2,
    Flag,
    Grid,
    Heart,
    Link as LinkIcon,
    MessageCircle,
    MoreHorizontal,
    Share2,
    Unlock,
    User,
    UserCheck,
    UserPlus,
    UserX,
} from 'lucide-react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const usernameOrId = params.username as string; // Can be username or userId
  const { confirm, dialogProps } = useConfirmDialog();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profileUser, setProfileUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [reelsLoading, setReelsLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<'none' | 'following' | 'pending'>('none');
  const [followsYou, setFollowsYou] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  const [showPostDetails, setShowPostDetails] = useState(false);
  const [showProfileImageModal, setShowProfileImageModal] = useState(false);

  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [selectedReel, setSelectedReel] = useState<any>(null);
  const [showReelComments, setShowReelComments] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [showCoverEditor, setShowCoverEditor] = useState(false);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  useEffect(() => {
    loadCurrentUser();
    loadUserProfile();
  }, [usernameOrId]);

  useEffect(() => {
    if (profileUser) {
      loadUserPosts();
      loadUserReels();
    }
  }, [profileUser, followStatus]);

  const loadCurrentUser = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      } else {
        const response = await authService.getCurrentUser();
        if (response.success && response.data) {
          const userData = response.data.data || response.data;
          setCurrentUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }
      }
    } catch (error) {
    }
  };

  const loadUserProfile = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const response = await authService.getUserProfile(usernameOrId);

      if (response.success && response.data) {
        const user = response.data;

        setProfileUser({
          _id: user._id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          fullName: user.fullName || `${user.firstName} ${user.lastName}`,
          username:
            user.username || `${user.firstName?.toLowerCase()}${user.lastName?.toLowerCase()}`,
          bio: user.bio || '',
          profilePicture: user.profileImage || user.avatar || user.profilePicture || '👤',
          coverPhoto: user.coverPhoto || null,
          followersCount: user.followersCount || 0,
          followingCount: user.followingCount || 0,
          postsCount: user.postsCount || 0,
          reelsCount: user.reelsCount || user.totalReels || 0,
          isVerified: user.isVerified || false,
          isPrivate: user.profile_type === 'private' || user.isPrivate || false,
          isFollowing: user.isFollowing || false,
          isPending: user.isPending || false,
          followsYou: user.followsYou || false,
        });

        if (user.isBlocked === true) {
          setIsBlocked(true);
        } else {
          setIsBlocked(false);
        }

        setFollowsYou(user.followsYou || false);

        if (user.isFollowing === true) {
          setFollowStatus('following');
          localStorage.setItem(`follow_status_${user._id}`, 'following');
        } else if (user.isPending === true) {
          setFollowStatus('pending');
          localStorage.setItem(`follow_status_${user._id}`, 'pending');
        } else {
          setFollowStatus('none');
          localStorage.setItem(`follow_status_${user._id}`, 'none');
        }
      }
    } catch (error: any) {

      if (error?.statusCode === 404 || error?.status === 404) {
        setNotFound(true);
        setProfileUser(null);
      } else {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUserPosts = async () => {
    try {
      const isOwnProfile = currentUser?._id === profileUser?._id;

      if (profileUser?.isPrivate && followStatus !== 'following' && !isOwnProfile) {
        setPosts([]);
        return;
      }

      const response = await feedService.getUserPosts(profileUser._id, {
        page: 1,
        limit: 20,
      });
      if (response.success && response.data) {
        const userPosts = Array.isArray(response.data) ? response.data : response.data.posts || [];
        setPosts(userPosts);
      } else {
        setPosts([]);
      }
    } catch (error) {
      setPosts([]);
    }
  };

  const loadUserReels = async () => {
    try {
      setReelsLoading(true);
      const isOwnProfile = currentUser?._id === profileUser?._id;

      if (profileUser?.isPrivate && followStatus !== 'following' && !isOwnProfile) {
        setReels([]);
        setReelsLoading(false);
        return;
      }

      const response = await reelService.getUserReels(profileUser._id, {
        page: 1,
        limit: 20,
      });
      if (response.success && response.data) {
        const userReels = Array.isArray(response.data) ? response.data : response.data.reels || [];
        setReels(userReels);
      } else {
        setReels([]);
      }
    } catch (error) {
      setReels([]);
    } finally {
      setReelsLoading(false);
    }
  };
  const handleFollowAction = async () => {
    if (isProcessing || !profileUser?._id) return;

    const targetUserId = profileUser._id;
    setIsProcessing(true);
    try {
      if (followStatus === 'following') {
        const response = await followService.unfollowUser(targetUserId);
        if (response.success) {
          setFollowStatus('none');
          localStorage.setItem(`follow_status_${targetUserId}`, 'none');
          setProfileUser((prev: any) => ({
            ...prev,
            followersCount: Math.max(0, (prev?.followersCount || 0) - 1),
          }));
        }
      } else if (followStatus === 'pending') {
        try {
          const response = await followService.cancelFollowRequest(targetUserId);
          if (response.success) {
            setFollowStatus('none');
            localStorage.setItem(`follow_status_${targetUserId}`, 'none');
          }
        } catch (cancelError: any) {
          const errorMessage = cancelError?.message || cancelError?.error || '';
          const statusCode = cancelError?.statusCode || 0;

          if (statusCode === 404 || errorMessage.toLowerCase().includes('not found')) {
            setFollowStatus('none');
            localStorage.setItem(`follow_status_${targetUserId}`, 'none');
          } else {
            throw cancelError;
          }
        }
      } else {
        try {
          const response = await followService.sendFollowRequest(targetUserId);
          if (response.success) {
            if (
              response.data?.autoApproved ||
              response.data?.followRequest?.status === 'accepted'
            ) {
              setFollowStatus('following');
              localStorage.setItem(`follow_status_${targetUserId}`, 'following');
              setProfileUser((prev: any) => ({
                ...prev,
                followersCount: (prev?.followersCount || 0) + 1,
              }));
            } else {
              setFollowStatus('pending');
              localStorage.setItem(`follow_status_${targetUserId}`, 'pending');
            }
          }
        } catch (followError: any) {
          const errorMessage = followError?.message || followError?.error || '';
          if (errorMessage.toLowerCase().includes('already sent')) {
            setFollowStatus('pending');
            localStorage.setItem(`follow_status_${targetUserId}`, 'pending');
          } else {
            throw followError;
          }
        }
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.error || 'Failed to perform action';

      if (!errorMessage.toLowerCase().includes('already sent')) {
        toasts.error(errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMessage = async () => {
    const userName =
      profileUser?.fullName ||
      `${profileUser?.firstName} ${profileUser?.lastName}` ||
      profileUser?.username ||
      'User';
    const avatar = profileUser?.profilePicture || profileUser?.avatar || '👤';
    router.push(
      `/chat?userId=${profileUser._id}&userName=${encodeURIComponent(userName)}&avatar=${encodeURIComponent(avatar)}`
    );
  };

  const handleCoverPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toasts.error('File size too large (max 10MB)');
      return;
    }

    setSelectedCoverFile(file);
    setShowCoverEditor(true);

    e.target.value = '';
  };

  const handleCoverPhotoSave = async (croppedBlob: Blob, previewUrl: string) => {
    const formData = new FormData();
    formData.append('coverPhoto', croppedBlob, 'cover.jpg');

    const previousCover = profileUser.coverPhoto;

    setProfileUser((prev: any) => ({ ...prev, coverPhoto: previewUrl }));

    try {
      const response = await authService.updateCoverPhoto(formData);
      if (response.success && response.data) {
        showToast.success('Cover photo updated successfully');
        setProfileUser((prev: any) => ({ ...prev, coverPhoto: response.data.coverPhoto }));
      } else {
        setProfileUser((prev: any) => ({ ...prev, coverPhoto: previousCover }));
        toasts.error(response.message || 'Failed to update cover photo');
      }
    } catch (error: any) {
      if (Object.keys(error).length === 0) {
      }
      setProfileUser((prev: any) => ({ ...prev, coverPhoto: previousCover }));
      const errorMsg = error?.message || 'Failed to update cover photo';
      showToast.error(errorMsg);
    } finally {
      setSelectedCoverFile(null);
    }
  };

  const handleBlockUser = async () => {
    setShowOptionsMenu(false);

    confirm({
      title: 'Block User',
      message: `Are you sure you want to block ${profileUser.fullName || profileUser.username}?\n\n• They won't be able to find your profile or posts\n• They won't be able to message you\n• You won't see their posts or messages`,
      variant: 'danger',
      confirmText: 'Block',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await authService.blockUser(profileUser._id);

          if (response.success) {
            setIsBlocked(true);
            toasts.userBlocked(profileUser.fullName || profileUser.username);
          } else {
            toasts.error(response.message || 'Failed to block user');
          }
        } catch (error: any) {
          toasts.error(error?.message || 'Failed to block user');
        }
      },
    });
  };

  const handleUnblockUser = async () => {
    setShowOptionsMenu(false);

    confirm({
      title: 'Unblock User',
      message: `Unblock ${profileUser.fullName || profileUser.username}?\n\nThey will be able to see your profile and interact with you again.`,
      variant: 'warning',
      confirmText: 'Unblock',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await authService.unblockUser(profileUser._id);

          if (response.success) {
            setIsBlocked(false);
            toasts.userUnblocked(profileUser.fullName || profileUser.username);
          } else {
            toasts.error(response.message || 'Failed to unblock user');
          }
        } catch (error: any) {
          toasts.error(error?.message || 'Failed to unblock user');
        }
      },
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
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
        <h2 className="text-2xl font-bold text-foreground mb-2">User Not Found</h2>
        <p className="text-muted-foreground max-w-sm mb-8">
          Sorry, this page isn't available. The link you followed may be broken, or the page may
          have been removed.
        </p>
        <Button onClick={() => router.push('/')}>Go back to Home</Button>
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

  const isOwnProfile = currentUser?._id === profileUser?._id;

  return (
    <main className="min-h-screen bg-background">
      <ConfirmDialog {...dialogProps} />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 pb-20 lg:pb-0">
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={currentUser} onLogout={handleLogout} />
        </aside>

        <section className="lg:col-span-3 p-4 lg:p-8">
          <Button variant="ghost" onClick={() => router.back()} className="mb-6 gap-2">
            <ArrowLeft size={20} />
            Back
          </Button>

          <div className="bg-card rounded-2xl border border-border mb-6">
            <div className="h-48 md:h-64 relative bg-muted group rounded-t-2xl overflow-hidden">
              {profileUser.coverPhoto?.startsWith('http') ||
              profileUser.coverPhoto?.startsWith('/') ? (
                <img
                  src={getMediaUrl(profileUser.coverPhoto)}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-primary/10 to-secondary/10" />
              )}

              {isOwnProfile && (
                <>
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    className="absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition opacity-0 group-hover:opacity-100"
                    title="Change Cover Photo"
                  >
                    <Camera size={20} />
                  </button>
                  <input
                    type="file"
                    ref={coverInputRef}
                    className="hidden"
                    onChange={handleCoverPhotoSelect}
                    accept="image/*"
                  />
                </>
              )}
            </div>

            <div className="px-8 pb-8">
              <div className="flex flex-col md:flex-row items-center md:items-end -mt-16 md:-mt-20 gap-6">
                <div
                  className="relative cursor-pointer hover:opacity-90 transition"
                  onClick={() =>
                    (profileUser.profilePicture?.startsWith('http') ||
                      profileUser.profilePicture?.startsWith('/')) &&
                    setShowProfileImageModal(true)
                  }
                >
                  {profileUser.profilePicture?.startsWith('http') ||
                  profileUser.profilePicture?.startsWith('/') ? (
                    <img
                      src={getMediaUrl(profileUser.profilePicture)}
                      alt={
                        profileUser.fullName || `${profileUser.firstName} ${profileUser.lastName}`
                      }
                      className="w-32 h-32 rounded-full object-cover border-4 border-card"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center border-4 border-card">
                      <User size={48} className="text-white" />
                    </div>
                  )}
                  {profileUser.isVerified && (
                    <div className="absolute bottom-2 right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-card">
                      <span className="text-white text-sm">✓</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center md:text-left mt-4 md:mt-0 pt-4 md:pt-24 w-full">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-4 mb-4">
                    <div>
                      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 justify-center md:justify-start">
                        {profileUser.fullName || `${profileUser.firstName} ${profileUser.lastName}`}
                        {profileUser.isPrivate && (
                          <span className="text-muted-foreground text-lg">🔒</span>
                        )}
                      </h1>
                      <p className="text-muted-foreground">@{profileUser.username}</p>
                    </div>

                    {!isOwnProfile && (
                      <div className="flex gap-2">
                        <Button
                          onClick={handleFollowAction}
                          disabled={isProcessing}
                          variant={followStatus === 'none' ? 'default' : 'outline'}
                          className="gap-2"
                        >
                          {followStatus === 'following' && <UserCheck size={16} />}
                          {followStatus === 'pending' && <Clock size={16} />}
                          {followStatus === 'none' && <UserPlus size={16} />}
                          {followStatus === 'following'
                            ? 'Unfollow'
                            : followStatus === 'pending'
                              ? 'Requested'
                              : followsYou
                                ? 'Follow Back'
                                : profileUser.isPrivate
                                  ? 'Request'
                                  : 'Follow'}
                        </Button>
                        <Button
                          onClick={handleMessage}
                          variant="outline"
                          className="gap-2 hover:bg-primary/10 hover:text-primary dark:hover:text-primary transition-colors"
                        >
                          <MessageCircle size={16} />
                          Message
                        </Button>

                        <div className="relative">
                          <Button
                            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                            variant="outline"
                            size="icon"
                            className="relative"
                          >
                            <MoreHorizontal size={20} />
                          </Button>

                          {showOptionsMenu && (
                            <>
                              <div
                                className="fixed inset-0 z-[9998]"
                                onClick={() => setShowOptionsMenu(false)}
                              />

                              <div className="absolute right-0 top-12 w-48 bg-card rounded-lg border border-border shadow-2xl z-[9999]">
                                <button
                                  onClick={async () => {
                                    setShowOptionsMenu(false);
                                    const profileUrl = `${window.location.origin}/profile/${profileUser.username}`;
                                    if (navigator.share) {
                                      try {
                                        await navigator.share({
                                          title: `${profileUser.fullName || profileUser.username}'s Profile`,
                                          text: `Check out ${profileUser.fullName || profileUser.username} on our platform!`,
                                          url: profileUrl,
                                        });
                                      } catch (err) {}
                                    } else {
                                      await navigator.clipboard.writeText(profileUrl);
                                      showToast.success(
                                        'Link copied',
                                        'Profile link copied to clipboard!'
                                      );
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
                                    const profileUrl = `${window.location.origin}/profile/${profileUser.username}`;
                                    await navigator.clipboard.writeText(profileUrl);
                                    showToast.success(
                                      'Link copied',
                                      'Profile link copied to clipboard!'
                                    );
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition border-b border-border flex items-center gap-2 text-foreground cursor-pointer"
                                >
                                  <LinkIcon size={16} />
                                  <span>Copy Link</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setShowOptionsMenu(false);
                                    setShowReportModal(true);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition border-b border-border flex items-center gap-2 text-orange-500 cursor-pointer"
                                >
                                  <Flag size={16} />
                                  <span>Report User</span>
                                </button>

                                {isBlocked ? (
                                  <button
                                    onClick={() => {
                                      setShowOptionsMenu(false);
                                      handleUnblockUser();
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition flex items-center gap-2 text-foreground cursor-pointer"
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
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition flex items-center gap-2 text-destructive cursor-pointer"
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
                          onClick={() => router.push('/account-settings')}
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
                                    const profileUrl = `${window.location.origin}/profile/${profileUser.username}`;
                                    if (navigator.share) {
                                      try {
                                        await navigator.share({
                                          title: `${profileUser.fullName || profileUser.username}'s Profile`,
                                          text: `Check out ${profileUser.fullName || profileUser.username} on our platform!`,
                                          url: profileUrl,
                                        });
                                      } catch (err) {}
                                    } else {
                                      await navigator.clipboard.writeText(profileUrl);
                                      showToast.success(
                                        'Link copied',
                                        'Profile link copied to clipboard!'
                                      );
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
                                    const profileUrl = `${window.location.origin}/profile/${profileUser.username}`;
                                    await navigator.clipboard.writeText(profileUrl);
                                    showToast.success(
                                      'Link copied',
                                      'Profile link copied to clipboard!'
                                    );
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

                  {profileUser.bio && <p className="text-foreground text-lg">{profileUser.bio}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="flex border-b border-border mb-6">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 flex items-center justify-center gap-2 pb-3 text-sm font-medium transition cursor-pointer relative ${
                activeTab === 'posts'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid size={20} />
              Posts
              {profileUser.postsCount > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {profileUser.postsCount}
                </span>
              )}
              {activeTab === 'posts' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('reels')}
              className={`flex-1 flex items-center justify-center gap-2 pb-3 text-sm font-medium transition cursor-pointer relative ${
                activeTab === 'reels'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clapperboard size={20} />
              Reels
              {profileUser.reelsCount > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {profileUser.reelsCount}
                </span>
              )}
              {activeTab === 'reels' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>

          {activeTab === 'posts' && (
            <div className="mb-6">
              {!posts || posts.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <p className="text-muted-foreground">
                    {profileUser.isPrivate && followStatus !== 'following'
                      ? 'This account is private. Follow to see their posts.'
                      : 'No posts yet'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.isArray(posts) &&
                    posts.map((post) => {
                      const mediaUrl =
                        post.media?.[0]?.url || post.media?.[0]?.thumbnail || post.file_url;
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
                                alt={post.caption || 'Post'}
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
                              {post.caption || post.content || 'No caption'}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Heart size={14} className="text-red-500" /> {post.likes_count || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle size={14} /> {post.comments_count || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reels' && (
            <div className="mb-6">
              {reelsLoading ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading reels...</p>
                </div>
              ) : !reels || reels.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <p className="text-muted-foreground">
                    {profileUser.isPrivate && followStatus !== 'following'
                      ? 'This account is private. Follow to see their reels.'
                      : 'No reels yet'}
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
                        onCommentClick={() => {
                          setSelectedReel(reel);
                          setShowReelComments(true);
                        }}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <Navigation user={currentUser} onLogout={handleLogout} isMobile={true} />

      {selectedPost && (
        <PostDetailsModal
          isOpen={showPostDetails}
          onClose={() => setShowPostDetails(false)}
          post={selectedPost}
        />
      )}

      {selectedReel && (
        <ReelCommentsModal
          open={showReelComments}
          onOpenChange={setShowReelComments}
          reelId={selectedReel._id}
          commentsCount={selectedReel.comments_count || 0}
          currentUserId={currentUser?._id}
        />
      )}

      <Dialog open={showProfileImageModal} onOpenChange={setShowProfileImageModal}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/95 border-none sm:max-w-3xl md:max-w-4xl [&>button]:text-white [&>button]:bg-white/10 [&>button]:hover:bg-white/20">
          <DialogTitle className="sr-only">Profile Picture</DialogTitle>
          <div className="relative w-full h-[80vh] flex items-center justify-center group">
            <Image
              src={profileUser?.profilePicture}
              alt={profileUser?.username || 'Profile'}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              quality={100}
              priority
            />
          </div>
        </DialogContent>
      </Dialog>

      <ProfileImageEditor
        isOpen={showCoverEditor}
        onClose={() => {
          setShowCoverEditor(false);
          setSelectedCoverFile(null);
        }}
        imageFile={selectedCoverFile}
        type="cover"
        onSave={handleCoverPhotoSave}
        enableFaceDetection={false}
        coverAspectRatio={2.5}
      />

      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-lg font-semibold">Report User</DialogTitle>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Please specify the reason for reporting this user:
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Enter your reason..."
              className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowReportModal(false);
                setReportReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (reportReason.trim()) {
                  setShowReportModal(false);
                  setReportReason('');
                  confirm({
                    title: 'User Reported',
                    message: `User reported for: ${reportReason}\n\nThank you for helping keep our community safe.`,
                    variant: 'success',
                    confirmText: 'OK',
                    cancelText: null,
                  });
                }
              }}
              disabled={!reportReason.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Submit Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </main>
  );
}
