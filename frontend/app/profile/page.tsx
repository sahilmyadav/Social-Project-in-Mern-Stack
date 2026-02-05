'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import Navigation from '@/components/navigation';
import ReelCard from '@/components/reel-card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import {
  authService,
  feedService,
  followService,
  postService,
  reelService,
} from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import { showToast, toasts } from '@/lib/toast';
import {
  Bookmark,
  Camera,
  Clapperboard,
  Edit2,
  Eye,
  Film,
  Grid,
  Heart,
  ImageIcon,
  Link as LinkIcon,
  LogOut,
  MessageCircle,
  Moon,
  MoreVertical,
  Settings,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';

// Dynamic imports to reduce initial bundle size
const FollowersModal = dynamic(() => import('@/components/followers-modal'), { ssr: false });
const PostDetailsModal = dynamic(() => import('@/components/post-details-modal'), { ssr: false });
const ReelCommentsModal = dynamic(() => import('@/components/reel-comments-modal'), { ssr: false });
const ProfileImageEditor = dynamic(() => import('@/components/profile-image-editor'), {
  ssr: false,
});

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileImageModal, setShowProfileImageModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // For theme toggle hydration
  useEffect(() => {
    setMounted(true);
  }, []);
  const [showFollowingModal, setShowFollowingModal] = useState(false);

  const [showPostDetails, setShowPostDetails] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [bio, setBio] = useState('');
  const [editBio, setEditBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userStats, setUserStats] = useState({
    posts: 0,
    followers: 0,
    following: 0,
    reels: 0,
    savedPosts: 0,
  });

  const { confirm, dialogProps } = useConfirmDialog();

  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);

  // Split upload states
  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);
  const [isUploadingCoverPhoto, setIsUploadingCoverPhoto] = useState(false);

  // Image editor states
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editorImageFile, setEditorImageFile] = useState<File | null>(null);
  const [editorType, setEditorType] = useState<'profile' | 'cover'>('profile');

  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [savedPostsLoading, setSavedPostsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showReelComments, setShowReelComments] = useState(false);
  const [selectedReel, setSelectedReel] = useState<any>(null);

  const router = useRouter();

  useEffect(() => {
    loadUserProfile();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuPostId) {
        setOpenMenuPostId(null);
      }
      if (showSettingsMenu) {
        setShowSettingsMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuPostId, showSettingsMenu]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);

      // Check if user is logged in
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      // Fetch current user data from API
      const response = await authService.getCurrentUser();

      if (response.success && response.data) {
        // Handle nested data structure
        const userData = response.data.data || response.data;
        const followersCount = response.data.followersCount || 0;
        const followingCount = response.data.followingCount || 0;
        const totalPosts = response.data.totalPosts || 0;
        const totalReels = response.data.totalReels || 0;
        const totalSavedPosts = response.data.totalSavedPosts || 0;

        setUser(userData);
        setBio(userData.bio || 'Welcome to my profile!');
        setEditBio(userData.bio || '');

        // Set user stats from the single API response
        setUserStats({
          posts: totalPosts,
          followers: followersCount,
          following: followingCount,
          reels: totalReels,
          savedPosts: totalSavedPosts,
        });

        // Update localStorage
        localStorage.setItem('user', JSON.stringify(userData));

        // Load user posts
        if (userData._id) {
          await loadUserPosts(userData._id);
        }
      } else {
        router.push('/login');
      }
    } catch (err) {
      const apiError = err as ApiError;
      console.error('Failed to load profile:', apiError);

      if (apiError.statusCode === 401) {
        // Token expired or invalid
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        router.push('/login');
      } else {
        setError('Failed to load profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUserPosts = async (userId: string) => {
    try {
      const postsResponse = await feedService.getUserPosts(userId, { page: 1, limit: 100 });

      if (postsResponse.success && postsResponse.data) {
        const userPosts = Array.isArray(postsResponse.data)
          ? postsResponse.data
          : postsResponse.data.posts || [];
        setPosts(userPosts);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('Failed to fetch user posts:', err);
      setPosts([]);
    }
  };

  const loadUserReels = async (userId: string) => {
    try {
      setReelsLoading(true);
      const reelsResponse = await reelService.getUserReels(userId, { page: 1, limit: 100 });

      if (reelsResponse.success && reelsResponse.data) {
        const userReels = Array.isArray(reelsResponse.data)
          ? reelsResponse.data
          : reelsResponse.data.reels || [];
        setReels(userReels);
      } else {
        setReels([]);
      }
    } catch (err) {
      console.error('Failed to fetch user reels:', err);
      setReels([]);
    } finally {
      setReelsLoading(false);
    }
  };

  const loadFollowers = async (userId: string) => {
    try {
      setFollowersLoading(true);
      const response = await followService.getFollowers(userId, { page: 1, limit: 100 });

      if (response.success && response.data) {
        const followersList = response.data.followers || [];
        setFollowers(followersList);
      } else {
        setFollowers([]);
      }
    } catch (err) {
      console.error('Failed to load followers:', err);
      setFollowers([]);
    } finally {
      setFollowersLoading(false);
    }
  };

  const loadFollowing = async (userId: string) => {
    try {
      setFollowingLoading(true);
      const response = await followService.getFollowing(userId, { page: 1, limit: 100 });

      if (response.success && response.data) {
        const followingList = response.data.following || [];
        setFollowing(followingList);
      } else {
        setFollowing([]);
      }
    } catch (err) {
      console.error('Failed to load following:', err);
      setFollowing([]);
    } finally {
      setFollowingLoading(false);
    }
  };

  const loadSavedPosts = async () => {
    try {
      setSavedPostsLoading(true);
      const response = await postService.getSavedPosts({ page: 1, limit: 100 });
      if (response.success && response.data) {
        // Handle different response structures
        const savedPostsList = Array.isArray(response.data)
          ? response.data
          : response.data.savedPosts || response.data.posts || [];

        setSavedPosts(savedPostsList);
      } else {
        setSavedPosts([]);
      }
    } catch (err) {
      console.error('Failed to fetch saved posts:', err);
      setSavedPosts([]);
    } finally {
      setSavedPostsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.push('/login');
    }
  };

  const handleSaveBio = async () => {
    try {
      const response = await authService.updateProfile({
        bio: editBio,
      });

      if (response.success) {
        setBio(editBio);
        setShowEditModal(false);

        // Update user data
        if (user) {
          const updatedUser = { ...user, bio: editBio };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      } else {
        showToast.error('Failed to update bio', 'Please try again.');
      }
    } catch (err) {
      console.error('Failed to update bio:', err);
      showToast.error('Failed to update bio', 'Please try again.');
    }
  };

  const handleFollowChange = async (
    userId: string,
    isFollowing: boolean,
    list: 'followers' | 'following'
  ) => {
    try {
      if (isFollowing) {
        const targetUser =
          list === 'followers'
            ? followers.find((u) => u._id === userId || u.id === userId)
            : following.find((u) => u._id === userId || u.id === userId);

        const isPrivate = targetUser?.isPrivate || targetUser?.profile_type === 'private';

        if (!isPrivate) {
          setUserStats((prev) => ({ ...prev, following: prev.following + 1 }));
        }

        if (list === 'followers') {
          setFollowers(
            followers.map((u) =>
              u._id === userId || u.id === userId
                ? { ...u, isFollowing: !isPrivate, isPending: isPrivate }
                : u
            )
          );
        } else {
          setFollowing(
            following.map((u) =>
              u._id === userId || u.id === userId
                ? { ...u, isFollowing: !isPrivate, isPending: isPrivate }
                : u
            )
          );
        }
      } else {
        const targetUser =
          list === 'followers'
            ? followers.find((u) => u._id === userId || u.id === userId)
            : following.find((u) => u._id === userId || u.id === userId);

        const wasFollowing = targetUser?.isFollowing;

        if (wasFollowing) {
          setUserStats((prev) => ({ ...prev, following: Math.max(0, prev.following - 1) }));
        }

        if (list === 'following') {
          if (wasFollowing) {
            setFollowing(following.filter((u) => u._id !== userId && u.id !== userId));
          } else {
            setFollowing(
              following.map((u) =>
                u._id === userId || u.id === userId
                  ? { ...u, isFollowing: false, isPending: false }
                  : u
              )
            );
          }
        } else {
          setFollowers(
            followers.map((u) =>
              u._id === userId || u.id === userId
                ? { ...u, isFollowing: false, isPending: false }
                : u
            )
          );
        }
      }
    } catch (err) {
      console.error('Failed to update follow status:', err);
      showToast.error('Failed to update', 'Please try again');
    }
  };

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showToast.error('File too large', 'Profile picture must be less than 5MB');
      return;
    }

    // Open the image editor instead of direct upload
    setEditorImageFile(file);
    setEditorType('profile');
    setShowImageEditor(true);

    // Clear the input so the same file can be selected again
    event.target.value = '';
  };

  // Handle save from image editor for profile picture
  const handleProfileEditorSave = async (blob: Blob, previewUrl: string) => {
    const previousImage = user?.profileImage || user?.avatar || user?.profilePicture;

    try {
      setIsUploadingProfilePic(true);

      // Optimistic update - show preview immediately
      setUser((prev: any) => ({
        ...prev,
        profileImage: previewUrl,
        avatar: previewUrl,
        profilePicture: previewUrl,
      }));

      const formData = new FormData();
      formData.append('file', blob, 'profile-photo.jpg');

      const response = await authService.updateProfilePicture(formData);

      if (response.success) {
        // Update with actual URL from server
        const newImageUrl =
          response.data?.profileImage ||
          response.data?.avatar ||
          response.data?.user?.profileImage ||
          previewUrl;

        setUser((prev: any) => {
          const updatedUser = {
            ...prev,
            profileImage: newImageUrl,
            avatar: newImageUrl,
            profilePicture: newImageUrl,
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          return updatedUser;
        });

        showToast.success('Profile picture updated!', 'Your new photo is now live.');
      } else {
        // Revert to previous image on failure
        setUser((prev: any) => ({
          ...prev,
          profileImage: previousImage,
          avatar: previousImage,
          profilePicture: previousImage,
        }));
        showToast.error('Failed to update profile picture', 'Please try again.');
      }
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setUser((prev: any) => ({
        ...prev,
        profileImage: previousImage,
        avatar: previousImage,
        profilePicture: previousImage,
      }));
      showToast.error('Failed to update profile picture', 'Please try again.');
    } finally {
      setIsUploadingProfilePic(false);
    }
  };

  const handleCoverPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      showToast.error('File too large', 'Cover photo must be less than 10MB');
      return;
    }

    // Open the image editor instead of direct upload
    setEditorImageFile(file);
    setEditorType('cover');
    setShowImageEditor(true);

    // Clear the input so the same file can be selected again
    event.target.value = '';
  };

  // Handle save from image editor for cover photo
  const handleCoverEditorSave = async (blob: Blob, previewUrl: string) => {
    const previousCover = user?.coverPhoto;

    try {
      setIsUploadingCoverPhoto(true);

      // Optimistic update - show preview immediately
      setUser((prev: any) => ({
        ...prev,
        coverPhoto: previewUrl,
      }));

      const formData = new FormData();
      formData.append('coverPhoto', blob, 'cover-photo.jpg');

      const response = await authService.updateCoverPhoto(formData);

      if (response.success) {
        const newCoverUrl =
          response.data?.coverPhoto || response.data?.user?.coverPhoto || previewUrl;

        setUser((prev: any) => {
          const updatedUser = {
            ...prev,
            coverPhoto: newCoverUrl,
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          return updatedUser;
        });

        showToast.success('Cover photo updated!', 'Your new cover is now live.');
      } else {
        setUser((prev: any) => ({
          ...prev,
          coverPhoto: previousCover,
        }));
        showToast.error('Failed to update cover photo', 'Please try again.');
      }
    } catch (err) {
      console.error('Error uploading cover photo:', err);
      setUser((prev: any) => ({
        ...prev,
        coverPhoto: previousCover,
      }));
      showToast.error('Failed to update cover photo', 'Please try again.');
    } finally {
      setIsUploadingCoverPhoto(false);
    }
  };

  // Combined handler for the image editor
  const handleImageEditorSave = (blob: Blob, previewUrl: string) => {
    if (editorType === 'profile') {
      handleProfileEditorSave(blob, previewUrl);
    } else {
      handleCoverEditorSave(blob, previewUrl);
    }
  };

  // Delete Profile Picture
  const handleDeleteProfilePicture = async () => {
    const confirmed = await confirm({
      title: 'Delete Profile Picture',
      description:
        'Are you sure you want to delete your profile picture? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      setIsUploadingProfilePic(true);
      const response = await authService.deleteProfilePicture();

      if (response.success) {
        setUser((prev: any) => {
          const updatedUser = {
            ...prev,
            profileImage: null,
            avatar: null,
            profilePicture: null,
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          return updatedUser;
        });
        showToast.success('Profile picture deleted!', 'Your profile picture has been removed.');
      } else {
        showToast.error('Failed to delete profile picture', 'Please try again.');
      }
    } catch (err) {
      console.error('Error deleting profile picture:', err);
      showToast.error('Failed to delete profile picture', 'Please try again.');
    } finally {
      setIsUploadingProfilePic(false);
    }
  };

  // Delete Cover Photo
  const handleDeleteCoverPhoto = async () => {
    const confirmed = await confirm({
      title: 'Delete Cover Photo',
      description:
        'Are you sure you want to delete your cover photo? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      setIsUploadingCoverPhoto(true);
      const response = await authService.deleteCoverPhoto();

      if (response.success) {
        setUser((prev: any) => {
          const updatedUser = {
            ...prev,
            coverPhoto: null,
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          return updatedUser;
        });
        showToast.success('Cover photo deleted!', 'Your cover photo has been removed.');
      } else {
        showToast.error('Failed to delete cover photo', 'Please try again.');
      }
    } catch (err) {
      console.error('Error deleting cover photo:', err);
      showToast.error('Failed to delete cover photo', 'Please try again.');
    } finally {
      setIsUploadingCoverPhoto(false);
    }
  };

  const handleOpenPostDetails = (post: any) => {
    setSelectedPost(post);
    setShowPostDetails(true);
  };

  const handleClosePostDetails = () => {
    setShowPostDetails(false);
    // Refresh saved posts in case user unsaved the post
    if (activeTab === 'saved') {
      loadSavedPosts();
    }
  };

  const handleTabChange = (tab: 'posts' | 'reels' | 'saved') => {
    setActiveTab(tab);

    // Load reels only when Reels tab is clicked and reels haven't been loaded yet
    if (tab === 'reels' && reels.length === 0 && !reelsLoading && user?._id) {
      loadUserReels(user._id);
    }

    // Always reload saved posts when Saved tab is clicked to show newly saved posts
    if (tab === 'saved' && !savedPostsLoading) {
      loadSavedPosts();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadUserProfile}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background pb-20 lg:pb-0">
      <ConfirmDialog {...dialogProps} />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Main Content */}
        <section className="lg:col-span-3">
          {/* Header with Cover Photo */}
          <div className="relative">
            <div className="h-48 md:h-64 relative bg-muted group overflow-hidden">
              {user.coverPhoto ? (
                <img
                  src={getMediaUrl(user.coverPhoto)}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full gradient-purple-peach" />
              )}

              {/* Loading overlay for cover photo upload */}
              {isUploadingCoverPhoto && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    <span className="text-sm font-medium">Uploading...</span>
                  </div>
                </div>
              )}

              {/* Camera Icon Overlay for Quick Cover Photo Upload */}
              <button
                onClick={() => document.getElementById('coverPhotoInput')?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-300 cursor-pointer"
                aria-label="Change cover photo"
                disabled={isUploadingCoverPhoto}
              >
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center gap-2 text-white">
                  <Camera size={32} />
                  <span className="text-sm font-medium">Change Cover Photo</span>
                </div>
              </button>

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

            {/* Settings Button - Outside overflow-hidden container */}
            <div className="absolute top-2 right-2 md:top-4 md:right-4 z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettingsMenu(!showSettingsMenu);
                }}
                className="p-2 md:p-3 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition cursor-pointer shadow-lg"
                aria-label="Profile Settings"
              >
                <Settings size={20} className="text-white md:w-[22px] md:h-[22px]" />
              </button>

              {/* Settings Dropdown Menu */}
              {showSettingsMenu && (
                <div className="absolute top-full mt-2 right-0 bg-card rounded-xl shadow-lg border border-border min-w-[200px] md:min-w-[220px] z-50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettingsMenu(false);
                      router.push('/account-settings');
                    }}
                    className="w-full px-3 md:px-4 py-2.5 md:py-3 text-left hover:bg-muted transition flex items-center gap-2 md:gap-3 text-sm md:text-base rounded-t-xl"
                  >
                    <Edit2 size={16} className="text-muted-foreground md:w-[18px] md:h-[18px]" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettingsMenu(false);
                      document.getElementById('profilePictureInput')?.click();
                    }}
                    className="w-full px-3 md:px-4 py-2.5 md:py-3 text-left hover:bg-muted transition flex items-center gap-2 md:gap-3 text-sm md:text-base"
                  >
                    <Camera size={16} className="text-muted-foreground md:w-[18px] md:h-[18px]" />
                    <span>Change Profile</span>
                  </button>
                  {(user?.profileImage || user?.avatar || user?.profilePicture) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettingsMenu(false);
                        handleDeleteProfilePicture();
                      }}
                      className="w-full px-3 md:px-4 py-2.5 md:py-3 text-left hover:bg-muted transition flex items-center gap-2 md:gap-3 text-sm md:text-base text-red-500"
                    >
                      <Trash2 size={16} />
                      <span>Delete Profile Photo</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettingsMenu(false);
                      document.getElementById('coverPhotoInput')?.click();
                    }}
                    className="w-full px-3 md:px-4 py-2.5 md:py-3 text-left hover:bg-muted transition flex items-center gap-2 md:gap-3 text-sm md:text-base"
                  >
                    <ImageIcon
                      size={16}
                      className="text-muted-foreground md:w-[18px] md:h-[18px]"
                    />
                    <span>Change Cover</span>
                  </button>
                  {user?.coverPhoto && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettingsMenu(false);
                        handleDeleteCoverPhoto();
                      }}
                      className="w-full px-3 md:px-4 py-2.5 md:py-3 text-left hover:bg-muted transition flex items-center gap-2 md:gap-3 text-sm md:text-base text-red-500"
                    >
                      <Trash2 size={16} />
                      <span>Delete Cover Photo</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettingsMenu(false);
                      router.push('/account-settings');
                    }}
                    className="w-full px-3 md:px-4 py-2.5 md:py-3 text-left hover:bg-muted transition flex items-center gap-2 md:gap-3 text-sm md:text-base"
                  >
                    <Settings size={16} className="text-muted-foreground md:w-[18px] md:h-[18px]" />
                    <span>Settings</span>
                  </button>
                  {/* Theme Toggle */}
                  <div className="border-t border-border"></div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTheme(theme === 'dark' ? 'light' : 'dark');
                    }}
                    disabled={!mounted}
                    className="w-full px-3 md:px-4 py-2.5 md:py-3 hover:bg-muted transition flex items-center justify-between text-sm md:text-base rounded-b-xl cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      {mounted && theme === 'dark' ? (
                        <Sun size={16} className="text-muted-foreground md:w-[18px] md:h-[18px]" />
                      ) : (
                        <Moon size={16} className="text-muted-foreground md:w-[18px] md:h-[18px]" />
                      )}
                      <span>{mounted && theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
                    </div>
                    <div
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                        mounted && theme === 'dark' ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          mounted && theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </div>
                  </button>
                  {/* Logout - Mobile Only */}
                  <div className="border-t border-border lg:hidden"></div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettingsMenu(false);
                      handleLogout();
                    }}
                    className="w-full px-3 py-2.5 text-left hover:bg-muted transition flex items-center gap-2 text-sm rounded-b-xl text-red-500 lg:hidden"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="px-3 md:px-4 pb-6 md:pb-8">
            <div className="flex flex-col items-center -mt-12 md:-mt-20 gap-4 md:gap-6 mb-6 md:mb-8 relative z-10">
              <div className="relative w-24 h-24 md:w-32 md:h-32 shrink-0 group/avatar">
                <div
                  className="w-full h-full cursor-pointer relative"
                  onClick={() => {
                    const pp = user.profileImage || user.avatar || user.profilePicture;
                    if (pp && pp !== '👤' && (pp.startsWith('http') || pp.startsWith('/')))
                      setShowProfileImageModal(true);
                  }}
                >
                  {(() => {
                    const pp = user.profileImage || user.avatar || user.profilePicture;
                    if (pp && pp !== '👤' && (pp.startsWith('http') || pp.startsWith('/'))) {
                      return (
                        <img
                          src={getMediaUrl(pp)}
                          alt="Profile"
                          className="w-full h-full rounded-full object-cover border-3 md:border-4 border-card shadow-lg"
                        />
                      );
                    }
                    return (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center border-3 md:border-4 border-card shadow-lg">
                        <User size={48} className="text-white" />
                      </div>
                    );
                  })()}

                  {/* Loading overlay for profile picture upload */}
                  {isUploadingProfilePic && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>

                {/* Camera button to change profile picture */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById('profilePictureInput')?.click();
                  }}
                  className="absolute bottom-0 left-0 md:bottom-1 md:left-1 w-7 h-7 md:w-9 md:h-9 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center border-2 border-card shadow-lg cursor-pointer transition-transform hover:scale-110"
                  title="Change profile picture"
                >
                  <Camera size={14} className="text-white md:w-[16px] md:h-[16px]" />
                </button>

                {user.isVerified && (
                  <div
                    className="absolute bottom-0 right-0 md:bottom-1 md:right-1 w-6 h-6 md:w-8 md:h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-card z-10"
                    title="Verified"
                  >
                    <span className="text-white text-xs md:text-sm font-bold">✓</span>
                  </div>
                )}
              </div>

              <div className="text-center w-full">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {user.firstName || user.name || 'User'} {user.lastName || ''}
                </h1>
                <p className="text-base md:text-lg text-muted-foreground">
                  @
                  {user.username ||
                    ((user.firstName || user.name || user.email || 'user') + '')
                      .toLowerCase()
                      .replace(/\s+/g, '')}
                </p>

                <div className="flex justify-center gap-3 mt-4">
                  <Button
                    onClick={() => router.push('/account-settings')}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 cursor-pointer text-sm md:text-base"
                  >
                    <Edit2 size={16} className="md:w-[18px] md:h-[18px]" />
                    Edit Profile
                  </Button>
                  <Button
                    onClick={() => setShowEditModal(true)}
                    variant="outline"
                    className="gap-2 cursor-pointer text-sm md:text-base"
                  >
                    <Edit2 size={16} className="md:w-[18px] md:h-[18px]" />
                    Edit Bio
                  </Button>
                </div>
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
                      loadFollowers(user._id);
                    }
                    setShowFollowersModal(true);
                  }}
                >
                  <p className="font-bold text-2xl text-primary">
                    {userStats.followers.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Followers</p>
                </div>
                <div
                  className="text-center p-4 bg-muted rounded-xl hover:bg-muted/80 transition cursor-pointer"
                  onClick={() => {
                    if (user?._id) {
                      loadFollowing(user._id);
                    }
                    setShowFollowingModal(true);
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
                  onClick={() => handleTabChange('posts')}
                  className={`cursor-pointer flex-1 py-3 font-semibold transition ${
                    activeTab === 'posts'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Grid size={20} />
                    <span>Posts</span>
                    {userStats.posts > 0 && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        {userStats.posts}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => handleTabChange('reels')}
                  className={`cursor-pointer flex-1 py-3 font-semibold transition ${
                    activeTab === 'reels'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Clapperboard size={20} />
                    <span>Reels</span>
                    {userStats.reels > 0 && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        {userStats.reels}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => handleTabChange('saved')}
                  className={` cursor-pointer flex-1 py-3 font-semibold transition ${
                    activeTab === 'saved'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Bookmark size={20} />
                    <span>Saved</span>
                    {userStats.savedPosts > 0 && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        {userStats.savedPosts}
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Posts Tab Content */}
              {activeTab === 'posts' && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">My Posts</h2>
                  {posts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {posts.map((post) => {
                        // Get the first media item (image or video)
                        const mediaUrl =
                          post.media?.[0]?.url || post.media?.[0]?.thumbnail || post.file_url;
                        const mediaType = post.media?.[0]?.type;

                        return (
                          <div
                            key={post._id || post.id}
                            className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition cursor-pointer group"
                            onClick={() => handleOpenPostDetails(post)}
                          >
                            <div className="relative w-full h-48 bg-muted">
                              {mediaUrl ? (
                                mediaType === 'video' ? (
                                  <video
                                    src={mediaUrl}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300 absolute inset-0"
                                    muted
                                    preload="metadata"
                                  />
                                ) : (
                                  <Image
                                    src={mediaUrl}
                                    alt={post.caption || 'Post'}
                                    fill
                                    className="object-cover group-hover:scale-105 transition duration-300"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  />
                                )
                              ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary overflow-hidden group-hover:scale-105 transition duration-300">
                                  <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition">
                                    <Camera size={48} className="text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="p-4">
                              <p className="font-semibold text-foreground line-clamp-2">
                                {post.caption || post.content || 'No caption'}
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
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                      <p className="text-muted-foreground mb-4">No posts yet</p>
                      <Button
                        onClick={() => router.push('/create')}
                        className="bg-primary hover:bg-primary/90"
                      >
                        Create Your First Post
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Reels Tab Content */}
              {activeTab === 'reels' && (
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
                          onCommentClick={() => {
                            setSelectedReel(reel);
                            setShowReelComments(true);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                      <Film size={64} className="mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-2 text-lg font-semibold">
                        No Reels Yet
                      </p>
                      <p className="text-muted-foreground text-sm mb-4">
                        Create your first reel to share with your followers
                      </p>
                      <Button
                        onClick={() => router.push('/create')}
                        className="bg-primary hover:bg-primary/90"
                      >
                        Create Your First Reel
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Saved Tab Content */}
              {activeTab === 'saved' && (
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
                        const mediaUrl =
                          post.media?.[0]?.url || post.media?.[0]?.thumbnail || post.file_url;
                        const mediaType = post.media?.[0]?.type;

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
                                <MoreVertical className="text-white" size={16} />
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
                                    <Eye size={16} />
                                    <span>View Post</span>
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setOpenMenuPostId(null);
                                      try {
                                        const postUrl = `${window.location.origin}/home?post=${post._id || post.id}`;
                                        await navigator.clipboard.writeText(postUrl);
                                        showToast.success(
                                          'Link copied!',
                                          'Post link copied to clipboard'
                                        );
                                      } catch (err) {
                                        console.error('Error copying link:', err);
                                        showToast.error('Failed to copy link');
                                      }
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-muted transition border-b border-border flex items-center gap-3 text-foreground"
                                  >
                                    <LinkIcon size={16} />
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
                                          setSavedPosts(
                                            savedPosts.filter((p) => (p._id || p.id) !== postId)
                                          );
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
                                    <Trash2 size={16} />
                                    <span>Remove from Saved</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Saved Badge */}
                            <div className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                              <Bookmark size={12} fill="currentColor" />
                              <span>Saved</span>
                            </div>

                            <div className="relative w-full h-48 bg-muted">
                              {mediaUrl ? (
                                mediaType === 'video' ? (
                                  <video
                                    src={mediaUrl}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300 absolute inset-0"
                                    muted
                                    preload="metadata"
                                  />
                                ) : (
                                  <Image
                                    src={mediaUrl}
                                    alt={post.caption || 'Post'}
                                    fill
                                    className="object-cover group-hover:scale-105 transition duration-300"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  />
                                )
                              ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary overflow-hidden group-hover:scale-105 transition duration-300">
                                  <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition">
                                    <Camera size={48} className="text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="p-4">
                              <p className="font-semibold text-foreground line-clamp-2">
                                {post.caption || post.content || 'No caption'}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Heart size={14} className="text-red-500 fill-red-500" />{' '}
                                  {post.likes_count || 0}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageCircle size={14} /> {post.comments_count || 0}
                                </span>
                              </div>
                              {post.media && post.media.length > 1 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  +{post.media.length - 1} more
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                      <Bookmark size={64} className="mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-2 text-lg font-semibold">
                        No Saved Posts
                      </p>
                      <p className="text-muted-foreground text-sm mb-4">
                        Save posts to keep them for later
                      </p>
                      <Button
                        onClick={() => router.push('/home')}
                        className="bg-primary hover:bg-primary/90"
                      >
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
            <Button
              onClick={() => setShowEditModal(false)}
              variant="outline"
              className="bg-transparent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBio}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
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
        onFollowChange={(userId, isFollowing) =>
          handleFollowChange(userId, isFollowing, 'followers')
        }
      />

      <FollowersModal
        open={showFollowingModal}
        onOpenChange={setShowFollowingModal}
        title="Following"
        users={following}
        loading={followingLoading}
        onFollowChange={(userId, isFollowing) =>
          handleFollowChange(userId, isFollowing, 'following')
        }
      />

      {/* Post Details Modal */}
      {selectedPost && (
        <PostDetailsModal
          isOpen={showPostDetails}
          onClose={handleClosePostDetails}
          post={selectedPost}
        />
      )}

      {/* Reel Comments Modal */}
      {selectedReel && (
        <ReelCommentsModal
          open={showReelComments}
          onOpenChange={setShowReelComments}
          reelId={selectedReel._id}
          commentsCount={selectedReel.comments_count || 0}
          currentUserId={user?._id}
        />
      )}

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      {/* Profile Picture Modal */}
      <Dialog open={showProfileImageModal} onOpenChange={setShowProfileImageModal}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/95 border-none sm:max-w-3xl md:max-w-4xl [&>button]:text-white [&>button]:bg-white/10 [&>button]:hover:bg-white/20">
          <DialogTitle className="sr-only">Profile Picture</DialogTitle>
          <div className="relative w-full h-[80vh] flex items-center justify-center group">
            <Image
              src={getMediaUrl(user.profilePicture || user.profileImage)}
              alt={user.username || 'Profile Picture'}
              fill
              className="object-contain"
              quality={100}
              priority
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Image Editor Modal - WhatsApp/Instagram/Telegram style */}
      <ProfileImageEditor
        isOpen={showImageEditor}
        onClose={() => {
          setShowImageEditor(false);
          setEditorImageFile(null);
        }}
        imageFile={editorImageFile}
        type={editorType}
        onSave={handleImageEditorSave}
        enableFaceDetection={true}
        coverAspectRatio={2.5}
      />
    </main>
  );
}
