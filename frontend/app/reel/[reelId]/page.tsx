'use client';

import Navigation from '@/components/navigation';
import ReportReelModal from '@/components/report-reel-modal';
import ShareModal from '@/components/share-modal';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useVideoSafe } from '@/contexts/video-context';
import { commentService, reelService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import { showToast, toasts } from '@/lib/toast';
import {
    ArrowLeft,
    Bookmark,
    Eye,
    Flag,
    Heart,
    Loader2,
    MessageCircle,
    MoreVertical,
    Play,
    Send,
    Trash2,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function ReelPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reelId = params.reelId as string;
  const showComments = searchParams.get('comments') === 'true';
  const { isMuted: globalMuted, toggleMute: toggleGlobalMute } = useVideoSafe();

  const [reel, setReel] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Video states
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Sync video muted state with global mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = globalMuted;
    }
  }, [globalMuted]);

  // Reel states
  const [liked, setLiked] = useState(false);
  const [savedReel, setSavedReel] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Comments states
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(
    null
  );
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [repliesData, setRepliesData] = useState<Map<string, any[]>>(new Map());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  // Modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { confirm, dialogProps } = useConfirmDialog();

  const commentInputRef = useRef<HTMLInputElement>(null);

  // Load user
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      router.push('/login');
    }
  }, [router]);

  // Load reel details
  useEffect(() => {
    const fetchReel = async () => {
      if (!reelId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await reelService.getReelDetails(reelId);

        // Debug: Log full API response to understand the structure
        console.log('Full API response:', response);
        console.log('Response data:', response.data);

        if (response.success && response.data) {
          setReel(response.data);
          setLikeCount(response.data.likes_count || response.data.likesCount || 0);
          setViewCount(
            response.data.views_count || response.data.viewsCount || response.data.views || 0
          );
          // Backend returns is_liked (snake_case), check both formats
          const isLikedValue = response.data.isLiked || response.data.is_liked || false;
          console.log('Like status from API:', {
            isLiked: response.data.isLiked,
            is_liked: response.data.is_liked,
            finalValue: isLikedValue,
            likes_count: response.data.likes_count,
          });
          setLiked(isLikedValue);
          setSavedReel(response.data.isSaved || response.data.is_saved || false);

          // Increment view count
          try {
            await reelService.viewReel(reelId);
            setViewCount((prev) => prev + 1);
          } catch (viewError) {
            console.log('View count update skipped');
          }

          // Load comments
          await loadComments();

          // Auto-focus comment input if showComments is true
          if (showComments) {
            setTimeout(() => {
              commentInputRef.current?.focus();
            }, 300);
          }
        } else {
          setError('Reel not found');
        }
      } catch (err: any) {
        console.error('Error fetching reel:', err);
        setError(err.message || 'Failed to load reel');
      } finally {
        setLoading(false);
      }
    };

    fetchReel();
  }, [reelId, showComments]);

  // Load comments
  const loadComments = async () => {
    if (!reelId) return;

    setLoadingComments(true);
    try {
      const response = await reelService.getReelComments(reelId, { limit: 50 });
      if (response.success && response.data) {
        setComments(response.data.comments || response.data || []);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  // Handle video play/pause
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle mute/unmute
  const toggleMute = () => {
    toggleGlobalMute(); // Toggle global mute state - affects all videos
  };

  // Handle like
  const handleLike = async () => {
    if (isLiking || !reel) return;

    setIsLiking(true);
    const wasLiked = liked;
    const previousCount = likeCount;

    // Optimistic update
    setLiked(!wasLiked);
    setLikeCount(wasLiked ? Math.max(0, previousCount - 1) : previousCount + 1);

    try {
      // toggleLikeReel handles both like and unlike
      const response = await reelService.toggleLikeReel(reel._id);
      if (response.success) {
        // Always use server response to sync state
        const serverIsLiked = response.data?.isLiked ?? !wasLiked;
        const serverLikeCount =
          response.data?.likes_count ??
          response.data?.likesCount ??
          (serverIsLiked ? previousCount + 1 : previousCount - 1);
        setLiked(serverIsLiked);
        setLikeCount(serverLikeCount);
      } else {
        // Revert on failure
        setLiked(wasLiked);
        setLikeCount(previousCount);
        showToast.error('Failed to update like');
      }
    } catch (error) {
      // Revert on error
      setLiked(wasLiked);
      setLikeCount(previousCount);
      showToast.error('Failed to update like');
    } finally {
      setIsLiking(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (isSaving || !reel) return;

    setIsSaving(true);
    const wasSaved = savedReel;

    // Optimistic update
    setSavedReel(!wasSaved);

    try {
      if (wasSaved) {
        await reelService.unsaveReel(reel._id);
        toasts.reelUnsaved();
      } else {
        await reelService.saveReel(reel._id);
        toasts.reelSaved();
      }
    } catch (error) {
      // Revert on error
      setSavedReel(wasSaved);
      showToast.error('Failed to update save');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = () => {
    if (isDeleting || !reel) return;

    confirm({
      title: 'Delete Reel',
      message: 'Are you sure you want to delete this reel? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await reelService.deleteReel(reel._id);
          toasts.reelDeleted();
          router.push('/reels');
        } catch (error) {
          showToast.error('Failed to delete reel');
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  // Handle comment submit
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment || !reel) return;

    setIsSubmittingComment(true);
    try {
      const response = await reelService.commentOnReel(reel._id, { text: newComment.trim() });
      if (response.success && response.data) {
        // Get current user data from localStorage for complete user info
        const currentUserData = localStorage.getItem('user');
        const currentUser = currentUserData ? JSON.parse(currentUserData) : {};

        const newCommentData = {
          ...response.data,
          user_id: {
            ...(response.data.user_id || {}),
            _id: response.data.user_id?._id || currentUser._id,
            firstName: response.data.user_id?.firstName || currentUser.firstName,
            lastName: response.data.user_id?.lastName || currentUser.lastName,
            profileImage: response.data.user_id?.profileImage || currentUser.profileImage,
            profilePicture: response.data.user_id?.profilePicture || currentUser.profilePicture,
          },
          likes_count: 0,
          replies_count: 0,
          isLiked: false,
        };
        setComments((prev) => [newCommentData, ...prev]);
        setNewComment('');
        toasts.commentAdded();
      }
    } catch (error) {
      showToast.error('Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Handle reply click
  const handleReplyClick = (commentId: string, username: string) => {
    setReplyingTo({ commentId, username });
    setReplyText(`@${username} `);
    commentInputRef.current?.focus();
  };

  // Handle submit reply
  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !replyingTo || submittingReply) return;

    setSubmittingReply(true);
    try {
      const response = await commentService.replyToComment(replyingTo.commentId, {
        text: replyText.trim(),
      });
      if (response.success) {
        setReplyText('');
        const commentId = replyingTo.commentId;
        setReplyingTo(null);

        // Update the parent comment's reply count
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId ? { ...c, replies_count: (c.replies_count || 0) + 1 } : c
          )
        );

        // Auto-expand replies
        setExpandedReplies((prev) => new Set(prev).add(commentId));

        // Reload replies
        try {
          const repliesResponse = await commentService.getCommentReplies(commentId, {
            page: 1,
            limit: 20,
          });
          if (repliesResponse.success && repliesResponse.data?.replies) {
            setRepliesData((prev) => new Map(prev).set(commentId, repliesResponse.data.replies));
          }
        } catch (error) {
          console.error('Error loading replies:', error);
        }

        showToast.success('Reply added');
      }
    } catch (error) {
      console.error('Error posting reply:', error);
      showToast.error('Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Handle toggle replies
  const handleToggleReplies = async (commentId: string) => {
    const isExpanded = expandedReplies.has(commentId);

    if (isExpanded) {
      setExpandedReplies((prev) => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    } else {
      setExpandedReplies((prev) => new Set(prev).add(commentId));

      if (!repliesData.has(commentId)) {
        setLoadingReplies((prev) => new Set(prev).add(commentId));
        try {
          const response = await commentService.getCommentReplies(commentId, {
            page: 1,
            limit: 20,
          });
          if (response.success && response.data?.replies) {
            setRepliesData((prev) => new Map(prev).set(commentId, response.data.replies));
          }
        } catch (error) {
          console.error('Error loading replies:', error);
        } finally {
          setLoadingReplies((prev) => {
            const newSet = new Set(prev);
            newSet.delete(commentId);
            return newSet;
          });
        }
      }
    }
  };

  // Handle like comment
  const handleLikeComment = async (commentId: string) => {
    try {
      // Check main comments first
      const comment = comments.find((c) => c._id === commentId);
      let isCurrentlyLiked = false;
      let isReply = false;

      if (comment) {
        isCurrentlyLiked = comment.isLiked || false;
      } else {
        // Check in replies
        for (const [parentId, replies] of repliesData.entries()) {
          const reply = replies.find((r: any) => r._id === commentId);
          if (reply) {
            isCurrentlyLiked = reply.isLiked || false;
            isReply = true;
            break;
          }
        }
      }

      // Optimistic update for main comments
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId
            ? {
                ...c,
                isLiked: !c.isLiked,
                likes_count: c.isLiked
                  ? Math.max(0, (c.likes_count || 1) - 1)
                  : (c.likes_count || 0) + 1,
              }
            : c
        )
      );

      // Optimistic update for replies
      setRepliesData((prev) => {
        const newMap = new Map(prev);
        for (const [parentId, replies] of newMap.entries()) {
          const updatedReplies = replies.map((r: any) =>
            r._id === commentId
              ? {
                  ...r,
                  isLiked: !r.isLiked,
                  likes_count: r.isLiked
                    ? Math.max(0, (r.likes_count || 1) - 1)
                    : (r.likes_count || 0) + 1,
                }
              : r
          );
          newMap.set(parentId, updatedReplies);
        }
        return newMap;
      });

      // API call
      if (isCurrentlyLiked) {
        await commentService.unlikeComment(commentId);
      } else {
        await commentService.likeComment(commentId);
      }
    } catch (error) {
      console.error('Error liking comment:', error);
      // Reload comments on error
      loadComments();
    }
  };

  // Handle delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!reel) return;

    try {
      const isMainComment = comments.find((c) => c._id === commentId);
      let parentCommentId: string | null = null;

      if (!isMainComment) {
        // Find parent comment for replies
        for (const [parentId, replies] of repliesData.entries()) {
          const reply = replies.find((r: any) => r._id === commentId);
          if (reply) {
            parentCommentId = parentId;
            break;
          }
        }
      }

      // Optimistic delete
      if (isMainComment) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
      } else if (parentCommentId) {
        setRepliesData((prev) => {
          const newMap = new Map(prev);
          const replies = newMap.get(parentCommentId!) || [];
          newMap.set(
            parentCommentId!,
            replies.filter((r: any) => r._id !== commentId)
          );
          return newMap;
        });
        setComments((prev) =>
          prev.map((c) =>
            c._id === parentCommentId
              ? { ...c, replies_count: Math.max(0, (c.replies_count || 1) - 1) }
              : c
          )
        );
      }

      await commentService.deleteComment(commentId);
      toasts.commentDeleted();
    } catch (error) {
      showToast.error('Failed to delete comment');
      loadComments(); // Reload on error
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const getTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // Get author info
  const author = reel?.author || reel?.user_id || reel?.user || {};
  const authorName = `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Unknown';
  const authorUsername = author.username || 'user';
  const rawAuthorAvatar = author.profileImage || author.profilePicture || author.avatar;
  const authorAvatar = rawAuthorAvatar ? getMediaUrl(rawAuthorAvatar) : null;
  const isOwner = user?._id === author._id;

  // Get video URL - check all possible locations where video URL might be stored
  // Priority: media.url (most common) > videoUrl > video_url > media array
  const rawVideoUrl =
    reel?.media?.url ||
    reel?.videoUrl ||
    reel?.video_url ||
    (Array.isArray(reel?.media) ? reel?.media?.[0]?.url : null);
  const videoUrl = rawVideoUrl ? getMediaUrl(rawVideoUrl) : null;

  // Get thumbnail
  const thumbnailUrl = reel?.media?.thumbnail ? getMediaUrl(reel.media.thumbnail) : undefined;

  // Debug log to help identify the structure
  console.log('Reel data:', {
    media: reel?.media,
    videoUrl: reel?.videoUrl,
    video_url: reel?.video_url,
    resolvedVideoUrl: videoUrl,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !reel) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || 'Reel not found'}</p>
        <Button onClick={() => router.push('/reels')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Reels
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Navigation */}
      <aside className="hidden lg:block w-64 border-r border-border bg-card fixed left-0 top-0 h-screen overflow-y-auto p-6">
        <Navigation user={user} onLogout={handleLogout} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 px-4 py-6 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Section */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-[9/16] max-h-[80vh]">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                loop
                playsInline
                autoPlay
                muted={globalMuted}
                onClick={togglePlayPause}
                preload="auto"
                poster={thumbnailUrl}
                onCanPlay={() => {
                  // Ensure video plays when ready
                  if (videoRef.current && isPlaying) {
                    videoRef.current.play().catch((e) => console.log('Autoplay prevented:', e));
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={(e) => console.error('Video error:', e)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <p>Video not available</p>
              </div>
            )}

            {/* Video Controls - Mute button top right */}
            {videoUrl && (
              <button
                onClick={toggleMute}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-black/40 hover:bg-black/60 transition text-white z-10 backdrop-blur-sm"
              >
                {globalMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}

            {/* Play/Pause Overlay */}
            {videoUrl && !isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <button
                  onClick={togglePlayPause}
                  className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition text-white"
                >
                  <Play className="w-12 h-12" fill="white" />
                </button>
              </div>
            )}

            {/* Bottom gradient overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />

            {/* Author Info Overlay */}
            <div className="absolute bottom-4 left-4 right-16 z-10">
              <Link href={`/profile/${author.username || author._id}`} className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white">
                  {authorAvatar ? (
                    <img
                      src={authorAvatar}
                      alt={authorName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold">
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="text-white">
                  <p className="font-semibold text-sm">{authorName}</p>
                  <p className="text-xs text-white/80">@{authorUsername}</p>
                </div>
              </Link>
              {reel.caption && <p className="text-white text-sm line-clamp-2">{reel.caption}</p>}
            </div>

            {/* Side Actions - Same style as reels feed */}
            <div className="absolute right-2 bottom-6 flex flex-col items-center gap-3 z-10">
              {/* View Count */}
              <div className="flex flex-col items-center cursor-default">
                <Eye className="w-6 h-6 text-white" />
                <span className="text-white text-[11px] mt-0.5">{viewCount}</span>
              </div>

              {/* Like */}
              <button
                onClick={handleLike}
                disabled={isLiking}
                className="flex flex-col items-center cursor-pointer"
              >
                <Heart
                  className={`w-6 h-6 ${liked ? 'text-red-500' : 'text-white'}`}
                  fill={liked ? 'currentColor' : 'none'}
                />
                <span className="text-white text-[11px] mt-0.5">{likeCount}</span>
              </button>

              {/* Comment */}
              <button
                onClick={() => commentInputRef.current?.focus()}
                className="flex flex-col items-center cursor-pointer"
              >
                <MessageCircle className="w-6 h-6 text-white" />
                <span className="text-white text-[11px] mt-0.5">{comments.length}</span>
              </button>

              {/* Share */}
              <button
                onClick={() => setShowShareModal(true)}
                className="flex flex-col items-center cursor-pointer"
              >
                <Send className="w-6 h-6 text-white" />
              </button>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex flex-col items-center cursor-pointer"
              >
                <Bookmark
                  className="w-6 h-6 text-white"
                  fill={savedReel ? 'currentColor' : 'none'}
                />
              </button>

              {/* More Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex flex-col items-center cursor-pointer">
                    <MoreVertical className="w-6 h-6 text-white" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isOwner ? (
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="text-destructive"
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {isDeleting ? 'Deleting...' : 'Delete Reel'}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setShowReportModal(true)}>
                      <Flag className="w-4 h-4 mr-2" />
                      Report Reel
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Author Avatar - like in reels feed */}
              <Link
                href={`/profile/${author.username || author._id}`}
                className="w-7 h-7 rounded border-2 border-white overflow-hidden mt-1"
              >
                {authorAvatar ? (
                  <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-[10px] font-semibold">
                    {authorName.charAt(0).toUpperCase()}
                  </div>
                )}
              </Link>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-card rounded-xl border border-border p-4 flex flex-col max-h-[80vh]">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Comments ({comments.length})
            </h3>

            {/* Reply indicator */}
            {replyingTo && (
              <div className="mb-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    <p className="text-xs font-medium text-foreground">
                      Replying to <span className="text-primary">@{replyingTo.username}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText('');
                    }}
                    className="text-muted-foreground hover:text-foreground transition p-1 rounded hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Comment Input */}
            <form
              onSubmit={replyingTo ? handleSubmitReply : handleSubmitComment}
              className="flex gap-2 mb-4"
            >
              <Input
                ref={commentInputRef}
                value={replyingTo ? replyText : newComment}
                onChange={(e) =>
                  replyingTo ? setReplyText(e.target.value) : setNewComment(e.target.value)
                }
                placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : 'Add a comment...'}
                className="flex-1"
                disabled={isSubmittingComment || submittingReply}
              />
              <Button
                type="submit"
                size="icon"
                disabled={
                  replyingTo
                    ? !replyText.trim() || submittingReply
                    : !newComment.trim() || isSubmittingComment
                }
              >
                {isSubmittingComment || submittingReply ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto">
              {loadingComments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment: any, index: number) => {
                    const commentUser = comment.user_id || comment.user || {};
                    const commentName =
                      `${commentUser.firstName || ''} ${commentUser.lastName || ''}`.trim() ||
                      'Unknown';
                    const rawCommentAvatar =
                      commentUser.profileImage || commentUser.profilePicture || commentUser.avatar;
                    const commentAvatar = rawCommentAvatar ? getMediaUrl(rawCommentAvatar) : null;
                    const isCommentOwner = user?._id === commentUser._id;

                    return (
                      <div key={comment._id || comment.id || index}>
                        {/* Main Comment */}
                        <div className="flex gap-3">
                          <Link href={`/profile/${commentUser.username || commentUser._id}`}>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-semibold overflow-hidden flex-shrink-0">
                              {commentAvatar ? (
                                <img
                                  src={commentAvatar}
                                  alt={commentName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                commentName.charAt(0).toUpperCase()
                              )}
                            </div>
                          </Link>
                          <div className="flex-1">
                            <div className="bg-muted rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <Link href={`/profile/${commentUser.username || commentUser._id}`}>
                                  <span className="font-semibold text-sm text-foreground hover:underline">
                                    {commentName}
                                  </span>
                                </Link>
                              </div>
                              <p className="text-sm text-foreground">
                                {comment.content || comment.text}
                              </p>
                            </div>
                            {/* Comment Actions */}
                            <div className="flex items-center gap-3 mt-1 ml-3">
                              <span className="text-xs text-muted-foreground">
                                {getTimeAgo(comment.createdAt)}
                              </span>
                              <button
                                onClick={() => handleLikeComment(comment._id)}
                                className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1"
                              >
                                <Heart
                                  className={`w-3 h-3 ${comment.isLiked ? 'fill-primary text-primary' : ''}`}
                                />
                                <span>{comment.likes_count || 0}</span>
                              </button>
                              <button
                                onClick={() =>
                                  handleReplyClick(comment._id, commentUser.firstName || 'User')
                                }
                                className="text-xs text-muted-foreground hover:text-primary transition"
                              >
                                Reply
                              </button>
                              {isCommentOwner && (
                                <button
                                  onClick={() => handleDeleteComment(comment._id)}
                                  className="text-xs text-muted-foreground hover:text-red-500 transition flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              )}
                              {(comment.replies_count || 0) > 0 && (
                                <button
                                  onClick={() => handleToggleReplies(comment._id)}
                                  className="text-xs text-primary hover:underline"
                                >
                                  {expandedReplies.has(comment._id) ? 'Hide' : 'View'}{' '}
                                  {comment.replies_count}{' '}
                                  {comment.replies_count === 1 ? 'reply' : 'replies'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Nested Replies */}
                        {expandedReplies.has(comment._id) && (
                          <div className="ml-11 mt-3 space-y-3 border-l-2 border-muted pl-4">
                            {loadingReplies.has(comment._id) ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="ml-2 text-xs text-muted-foreground">
                                  Loading replies...
                                </span>
                              </div>
                            ) : repliesData?.get(comment._id)?.length ? (
                              (repliesData.get(comment._id) || []).map((reply: any) => {
                                const replyUser = reply.user_id || reply.user || {};
                                const replyName =
                                  `${replyUser.firstName || ''} ${replyUser.lastName || ''}`.trim() ||
                                  'Unknown';
                                const rawReplyAvatar =
                                  replyUser.profileImage ||
                                  replyUser.profilePicture ||
                                  replyUser.avatar;
                                const replyAvatar = rawReplyAvatar
                                  ? getMediaUrl(rawReplyAvatar)
                                  : null;
                                const isReplyOwner = user?._id === replyUser._id;

                                return (
                                  <div key={reply._id} className="flex gap-2">
                                    <Link href={`/profile/${replyUser.username || replyUser._id}`}>
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-semibold overflow-hidden flex-shrink-0">
                                        {replyAvatar ? (
                                          <img
                                            src={replyAvatar}
                                            alt={replyName}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          replyName.charAt(0).toUpperCase()
                                        )}
                                      </div>
                                    </Link>
                                    <div className="flex-1 min-w-0">
                                      <div className="bg-muted rounded-lg px-3 py-2">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Link href={`/profile/${replyUser.username || replyUser._id}`}>
                                            <span className="font-semibold text-xs text-foreground hover:text-primary transition">
                                              {replyName}
                                            </span>
                                          </Link>
                                          <span className="text-xs text-muted-foreground">
                                            {getTimeAgo(reply.createdAt)}
                                          </span>
                                        </div>
                                        <p className="text-xs text-foreground break-words">
                                          {reply.text || reply.content}
                                        </p>
                                      </div>
                                      {/* Reply Actions */}
                                      <div className="flex items-center gap-3 mt-1 px-2">
                                        <button
                                          onClick={() => handleLikeComment(reply._id)}
                                          className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1"
                                        >
                                          <Heart
                                            className={`w-3 h-3 ${reply.isLiked ? 'fill-primary text-primary' : ''}`}
                                          />
                                          <span>{reply.likes_count || 0}</span>
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleReplyClick(
                                              comment._id,
                                              replyUser.firstName || 'User'
                                            )
                                          }
                                          className="text-xs text-muted-foreground hover:text-primary transition"
                                        >
                                          Reply
                                        </button>
                                        {isReplyOwner && (
                                          <button
                                            onClick={() => handleDeleteComment(reply._id)}
                                            className="text-xs text-muted-foreground hover:text-red-500 transition flex items-center gap-1"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                            Delete
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                No replies yet
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        contentType="reel"
        contentId={reel._id}
      />

      {/* Report Modal */}
      <ReportReelModal
        open={showReportModal}
        onOpenChange={setShowReportModal}
        reelId={reel._id}
        reelAuthor={authorUsername}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
