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

  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = globalMuted;
    }
  }, [globalMuted]);

  const [liked, setLiked] = useState(false);
  const [savedReel, setSavedReel] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { confirm, dialogProps } = useConfirmDialog();

  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    const fetchReel = async () => {
      if (!reelId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await reelService.getReelDetails(reelId);

        if (response.success && response.data) {
          setReel(response.data);
          setLikeCount(response.data.likes_count || response.data.likesCount || 0);
          setViewCount(
            response.data.views_count || response.data.viewsCount || response.data.views || 0
          );
          const isLikedValue = response.data.isLiked || response.data.is_liked || false;
          setLiked(isLikedValue);
          setSavedReel(response.data.isSaved || response.data.is_saved || false);

          try {
            await reelService.viewReel(reelId);
            setViewCount((prev) => prev + 1);
          } catch (viewError) {
          }

          await loadComments();

          if (showComments) {
            setTimeout(() => {
              commentInputRef.current?.focus();
            }, 300);
          }
        } else {
          setError('Reel not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load reel');
      } finally {
        setLoading(false);
      }
    };

    fetchReel();
  }, [reelId, showComments]);

  const loadComments = async () => {
    if (!reelId) return;

    setLoadingComments(true);
    try {
      const response = await reelService.getReelComments(reelId, { limit: 50 });
      if (response.success && response.data) {
        setComments(response.data.comments || response.data || []);
      }
    } catch (error) {
    } finally {
      setLoadingComments(false);
    }
  };

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

  const toggleMute = () => {
    toggleGlobalMute(); // Toggle global mute state - affects all videos
  };

  const handleLike = async () => {
    if (isLiking || !reel) return;

    setIsLiking(true);
    const wasLiked = liked;
    const previousCount = likeCount;

    setLiked(!wasLiked);
    setLikeCount(wasLiked ? Math.max(0, previousCount - 1) : previousCount + 1);

    try {
      const response = await reelService.toggleLikeReel(reel._id);
      if (response.success) {
        const serverIsLiked = response.data?.isLiked ?? !wasLiked;
        const serverLikeCount =
          response.data?.likes_count ??
          response.data?.likesCount ??
          (serverIsLiked ? previousCount + 1 : previousCount - 1);
        setLiked(serverIsLiked);
        setLikeCount(serverLikeCount);
      } else {
        setLiked(wasLiked);
        setLikeCount(previousCount);
        showToast.error('Failed to update like');
      }
    } catch (error) {
      setLiked(wasLiked);
      setLikeCount(previousCount);
      showToast.error('Failed to update like');
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    if (isSaving || !reel) return;

    setIsSaving(true);
    const wasSaved = savedReel;

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
      setSavedReel(wasSaved);
      showToast.error('Failed to update save');
    } finally {
      setIsSaving(false);
    }
  };

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

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment || !reel) return;

    setIsSubmittingComment(true);
    try {
      const response = await reelService.commentOnReel(reel._id, { text: newComment.trim() });
      if (response.success && response.data) {
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

  const handleReplyClick = (commentId: string, username: string) => {
    setReplyingTo({ commentId, username });
    setReplyText(`@${username} `);
    commentInputRef.current?.focus();
  };

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

        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId ? { ...c, replies_count: (c.replies_count || 0) + 1 } : c
          )
        );

        setExpandedReplies((prev) => new Set(prev).add(commentId));

        try {
          const repliesResponse = await commentService.getCommentReplies(commentId, {
            page: 1,
            limit: 20,
          });
          if (repliesResponse.success && repliesResponse.data?.replies) {
            setRepliesData((prev) => new Map(prev).set(commentId, repliesResponse.data.replies));
          }
        } catch (error) {
        }

        showToast.success('Reply added');
      }
    } catch (error) {
      showToast.error('Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  };

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

  const handleLikeComment = async (commentId: string) => {
    try {
      const comment = comments.find((c) => c._id === commentId);
      let isCurrentlyLiked = false;
      let isReply = false;

      if (comment) {
        isCurrentlyLiked = comment.isLiked || false;
      } else {
        for (const [parentId, replies] of repliesData.entries()) {
          const reply = replies.find((r: any) => r._id === commentId);
          if (reply) {
            isCurrentlyLiked = reply.isLiked || false;
            isReply = true;
            break;
          }
        }
      }

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

      if (isCurrentlyLiked) {
        await commentService.unlikeComment(commentId);
      } else {
        await commentService.likeComment(commentId);
      }
    } catch (error) {
      loadComments();
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!reel) return;

    try {
      const isMainComment = comments.find((c) => c._id === commentId);
      let parentCommentId: string | null = null;

      if (!isMainComment) {
        for (const [parentId, replies] of repliesData.entries()) {
          const reply = replies.find((r: any) => r._id === commentId);
          if (reply) {
            parentCommentId = parentId;
            break;
          }
        }
      }

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

  const author = reel?.author || reel?.user_id || reel?.user || {};
  const authorName = `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Unknown';
  const authorUsername = author.username || 'user';
  const rawAuthorAvatar = author.profileImage || author.profilePicture || author.avatar;
  const authorAvatar = rawAuthorAvatar ? getMediaUrl(rawAuthorAvatar) : null;
  const isOwner = user?._id === author._id;

  const rawVideoUrl =
    reel?.media?.url ||
    reel?.videoUrl ||
    reel?.video_url ||
    (Array.isArray(reel?.media) ? reel?.media?.[0]?.url : null);
  const videoUrl = rawVideoUrl ? getMediaUrl(rawVideoUrl) : null;

  const thumbnailUrl = reel?.media?.thumbnail ? getMediaUrl(reel.media.thumbnail) : undefined;

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
      <aside className="hidden lg:block w-64 border-r border-border bg-card fixed left-0 top-0 h-screen overflow-y-auto p-6">
        <Navigation user={user} onLogout={handleLogout} />
      </aside>

      <main className="flex-1 lg:ml-64 px-4 py-6 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            {videoUrl && (
              <button
                onClick={toggleMute}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-black/40 hover:bg-black/60 transition text-white z-10 backdrop-blur-sm"
              >
                {globalMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}

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

            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />

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

            <div className="absolute right-2 bottom-6 flex flex-col items-center gap-3 z-10">
              <div className="flex flex-col items-center cursor-default">
                <Eye className="w-6 h-6 text-white" />
                <span className="text-white text-[11px] mt-0.5">{viewCount}</span>
              </div>

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

              <button
                onClick={() => commentInputRef.current?.focus()}
                className="flex flex-col items-center cursor-pointer"
              >
                <MessageCircle className="w-6 h-6 text-white" />
                <span className="text-white text-[11px] mt-0.5">{comments.length}</span>
              </button>

              <button
                onClick={() => setShowShareModal(true)}
                className="flex flex-col items-center cursor-pointer"
              >
                <Send className="w-6 h-6 text-white" />
              </button>

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

          <div className="bg-card rounded-xl border border-border p-4 flex flex-col max-h-[80vh]">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Comments ({comments.length})
            </h3>

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

      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        contentType="reel"
        contentId={reel._id}
      />

      <ReportReelModal
        open={showReportModal}
        onOpenChange={setShowReportModal}
        reelId={reel._id}
        reelAuthor={authorUsername}
      />

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
