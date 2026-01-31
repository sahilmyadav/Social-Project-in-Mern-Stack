'use client';

import ReportPostModal from '@/components/report-post-modal';
import ShareModal from '@/components/share-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import UserAvatar from '@/components/user-avatar';
import { commentService, postService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import { showToast, toasts } from '@/lib/toast';
import {
  Download,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
  Send,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo, useEffect, useRef, useState } from 'react';

interface PostCardProps {
  post: any;
  onCommentClick?: (post: any) => void;
  onLikeUpdate?: (postId: string, isLiked: boolean, likeCount: number) => void;
  currentUserId?: string;
  onPostClick?: (post: any) => void;
  showComments?: boolean;
}

// Custom Video Player Component for Posts (same as reel-card)
function PostVideoPlayer({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const [userPaused, setUserPaused] = useState(true); // Start paused by default

  // Intersection Observer for auto-play/pause
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInView(entry.isIntersecting);
        });
      },
      {
        threshold: 0.5,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  // Pause when out of view
  useEffect(() => {
    if (!videoRef.current) return;

    if (!isInView && isPlaying) {
      videoRef.current.pause();
    }
  }, [isInView, isPlaying]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setUserPaused(true);
      } else {
        videoRef.current.play().catch(() => {});
        setUserPaused(false);
      }
    }
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full bg-black aspect-square">
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        poster={poster}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        controls={false}
        loop
        playsInline
        muted={isMuted}
        preload="metadata"
      />

      {/* Play Button Overlay - Always show when not playing */}
      {!isPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={handlePlayPause}
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition">
            <Play size={32} className="text-white ml-1" />
          </div>
        </div>
      )}

      {/* Pause on click when playing */}
      {isPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition"
          onClick={handlePlayPause}
        >
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="w-0 h-0 border-l-[20px] border-l-white border-y-[12px] border-y-transparent ml-1"></div>
          </div>
        </div>
      )}

      {/* Mute/Unmute Button */}
      <button
        className="absolute bottom-4 right-4 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition cursor-pointer"
        onClick={handleMuteToggle}
      >
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
    </div>
  );
}

function PostCard({
  post,
  onCommentClick,
  onLikeUpdate,
  currentUserId,
  onPostClick,
  showComments,
}: PostCardProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.isLiked || false);
  const [likeCount, setLikeCount] = useState(post.likes_count || 0);
  const [saved, setSaved] = useState(post.isSaved || false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentCount, setCommentCount] = useState(
    Math.max(0, post.comments_count || post.comments || 0)
  );
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(
    null
  );
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [repliesData, setRepliesData] = useState<Map<string, any[]>>(new Map());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [sharesCount, setSharesCount] = useState(post.shares_count || post.shares || 0);

  // Sync with API data when it changes
  useEffect(() => {
    setLiked(post.isLiked || false);
    setLikeCount(post.likes_count || 0);
    setCommentCount(Math.max(0, post.comments_count || post.comments || 0));
  }, [post._id, post.isLiked, post.likes_count, post.comments_count, post.comments]);

  // Load comments when showComments becomes true
  useEffect(() => {
    if (showComments && post?._id && comments.length === 0) {
      loadComments();
    }
  }, [showComments, post?._id]);

  // If post is hidden (reported), don't render it
  // IMPORTANT: This must come AFTER all hooks to follow React's Rules of Hooks
  if (isHidden) {
    return null;
  }

  const loadComments = async () => {
    try {
      setCommentsLoading(true);
      const response = await postService.getPostComments(post._id, { limit: 20 });
      if (response.success && response.data) {
        setComments(response.data.comments || []);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      const response = await postService.commentOnPost(post._id, { text: newComment.trim() });

      if (response.success && response.data) {
        // Get current user data from localStorage
        const currentUserData = localStorage.getItem('user');
        const user = currentUserData ? JSON.parse(currentUserData) : {};

        // Ensure the comment has complete user data
        // The API might return user_id but without all fields like profileImage
        const newCommentData = {
          ...response.data,
          user_id: {
            // Merge API user_id with localStorage user data
            ...(response.data.user_id || {}),
            _id: response.data.user_id?._id || user._id || user.id,
            firstName: response.data.user_id?.firstName || user.firstName,
            lastName: response.data.user_id?.lastName || user.lastName,
            username: response.data.user_id?.username || user.username,
            profileImage: response.data.user_id?.profileImage || user.profileImage,
            profilePicture:
              response.data.user_id?.profilePicture || user.profilePicture || user.profileImage,
            avatar: response.data.user_id?.avatar || user.avatar,
          },
        };

        // API returns the comment directly in data, not data.comment
        setComments((prev) => [newCommentData, ...prev]);
        setCommentCount((prev) => Math.max(0, prev + 1)); // Increment comment count with safeguard
        setNewComment('');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReplyClick = (commentId: string, username: string) => {
    setReplyingTo({ commentId, username });
    setReplyText(`@${username} `);
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !replyingTo || submittingReply) return;

    setSubmittingReply(true);
    try {
      // Call the reply API
      const response = await commentService.replyToComment(replyingTo.commentId, {
        text: replyText,
      });

      if (response.success) {
        // Clear the reply state
        setReplyText('');
        const commentId = replyingTo.commentId;
        setReplyingTo(null);

        // Increment the total comment count (replies count as comments)
        setCommentCount((prev) => prev + 1);

        // Update the parent comment's reply count
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId ? { ...c, replies_count: (c.replies_count || 0) + 1 } : c
          )
        );

        // Auto-expand the replies for this comment
        setExpandedReplies((prev) => new Set(prev).add(commentId));

        // Reload replies for this specific comment
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
      }
    } catch (error) {
      console.error('Error posting reply:', error);
      alert('Failed to post reply. Please try again.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleToggleReplies = async (commentId: string) => {
    const isExpanded = expandedReplies.has(commentId);

    if (isExpanded) {
      // Just collapse
      setExpandedReplies((prev) => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    } else {
      // Expand and fetch replies if not already loaded
      setExpandedReplies((prev) => new Set(prev).add(commentId));

      if (!repliesData.has(commentId)) {
        // Fetch replies from API
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
          alert('Failed to load replies');
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
      // Check if it's a main comment or a reply
      let isCurrentlyLiked = false;
      let isReply = false;

      // First check main comments
      const comment = comments.find((c) => c._id === commentId);
      if (comment) {
        isCurrentlyLiked = comment.isLiked || false;
      } else {
        // Check if it's a reply in repliesData
        for (const [parentId, replies] of repliesData.entries()) {
          const reply = replies.find((r: any) => r._id === commentId);
          if (reply) {
            isCurrentlyLiked = reply.isLiked || reply.isLikedByCurrentUser || false;
            isReply = true;
            break;
          }
        }
      }

      // Optimistically update the UI for main comments
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId
            ? {
                ...c,
                isLiked: !c.isLiked,
                likes_count: c.isLiked ? (c.likes_count || 1) - 1 : (c.likes_count || 0) + 1,
              }
            : c
        )
      );

      // Optimistically update the UI for replies
      setRepliesData((prev) => {
        const newMap = new Map(prev);
        for (const [parentId, replies] of newMap.entries()) {
          const updatedReplies = replies.map((r: any) =>
            r._id === commentId
              ? {
                  ...r,
                  isLiked: !r.isLiked,
                  isLikedByCurrentUser: !r.isLikedByCurrentUser,
                  likes_count:
                    r.isLiked || r.isLikedByCurrentUser
                      ? (r.likes_count || 1) - 1
                      : (r.likes_count || 0) + 1,
                }
              : r
          );
          if (updatedReplies !== replies) {
            newMap.set(parentId, updatedReplies);
          }
        }
        return newMap;
      });

      // Call the appropriate API
      if (isCurrentlyLiked) {
        await commentService.unlikeComment(commentId);
      } else {
        await commentService.likeComment(commentId);
      }
    } catch (error) {
      console.error('Error liking comment:', error);
      // Revert on error for main comments
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId
            ? {
                ...c,
                isLiked: !c.isLiked,
                likes_count: c.isLiked ? (c.likes_count || 1) - 1 : (c.likes_count || 0) + 1,
              }
            : c
        )
      );
      // Revert on error for replies
      setRepliesData((prev) => {
        const newMap = new Map(prev);
        for (const [parentId, replies] of newMap.entries()) {
          const updatedReplies = replies.map((r: any) =>
            r._id === commentId
              ? {
                  ...r,
                  isLiked: !r.isLiked,
                  isLikedByCurrentUser: !r.isLikedByCurrentUser,
                  likes_count:
                    r.isLiked || r.isLikedByCurrentUser
                      ? (r.likes_count || 1) - 1
                      : (r.likes_count || 0) + 1,
                }
              : r
          );
          if (updatedReplies !== replies) {
            newMap.set(parentId, updatedReplies);
          }
        }
        return newMap;
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      // Check if it's a main comment or a reply
      const isMainComment = comments.find((c) => c._id === commentId);
      let parentCommentId: string | null = null;

      // If it's a reply, find the parent comment
      if (!isMainComment) {
        for (const [parentId, replies] of repliesData.entries()) {
          const reply = replies.find((r: any) => r._id === commentId);
          if (reply) {
            parentCommentId = parentId;
            break;
          }
        }
      }

      // Optimistically remove from UI
      if (isMainComment) {
        // Remove main comment
        setComments((prev) => prev.filter((c) => c._id !== commentId));
        setCommentCount((prev) => Math.max(0, prev - 1));
      } else if (parentCommentId) {
        // Remove reply from repliesData
        setRepliesData((prev) => {
          const newMap = new Map(prev);
          const replies = newMap.get(parentCommentId!) || [];
          newMap.set(
            parentCommentId!,
            replies.filter((r: any) => r._id !== commentId)
          );
          return newMap;
        });

        // Decrease the reply count on the parent comment
        setComments((prev) =>
          prev.map((c) =>
            c._id === parentCommentId
              ? { ...c, replies_count: Math.max(0, (c.replies_count || 1) - 1) }
              : c
          )
        );

        // Decrease the total comment count (replies are also counted as comments)
        setCommentCount((prev) => Math.max(0, prev - 1));
      }

      // Call the delete API
      await commentService.deleteComment(commentId);
    } catch (error) {
      console.error('Error deleting comment:', error);
      // Revert on error
      loadComments();
      alert('Failed to delete comment');
    }
  };

  // Check if current user is the post author
  const isOwnPost = currentUserId && post.user_id?._id === currentUserId;

  // Get post data
  const postId = post._id || post.id;
  const authorName = post.user_id?.firstName
    ? `${post.user_id.firstName} ${post.user_id.lastName || ''}`.trim()
    : post.user_id?.username || post.author || 'Unknown User';
  const authorAvatar = post.user_id?.profileImage || post.avatar || '😊';
  const content = post.caption || post.content || '';
  const rawMediaUrl =
    post.media?.[0]?.url || post.media?.[0]?.thumbnail || post.image || post.file_url;
  const mediaUrl = getMediaUrl(rawMediaUrl);

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const timestamp = formatTimestamp(post.createdAt || post.timestamp);

  const handleLike = async () => {
    if (isLoading) return;

    setIsLoading(true);
    const previousLiked = liked;
    const previousCount = likeCount;

    // Optimistic update
    const newLikedState = !liked;
    const newLikeCount = liked ? likeCount - 1 : likeCount + 1;

    setLiked(newLikedState);
    setLikeCount(newLikeCount);

    try {
      if (liked) {
        // Unlike the post
        const response = await postService.unlikePost(postId);
        if (response.success) {
          onLikeUpdate?.(postId, newLikedState, newLikeCount);
        }
      } else {
        // Like the post
        const response = await postService.likePost(postId);
        if (response.success) {
          onLikeUpdate?.(postId, newLikedState, newLikeCount);
        }
      }
    } catch (error: any) {
      console.error('Error toggling like:', error);

      // Check if error is about already liked/unliked
      const errorMessage = error?.message || error?.error || '';

      if (errorMessage.toLowerCase().includes('already liked')) {
        // Post is already liked - sync state to liked
        setLiked(true);
        // Keep the optimistic count or fetch fresh data
      } else if (
        errorMessage.toLowerCase().includes('not liked') ||
        errorMessage.toLowerCase().includes("haven't liked")
      ) {
        // Post is not liked - sync state to not liked
        setLiked(false);
        // Keep the optimistic count or fetch fresh data
      } else {
        // Other error - revert to previous state
        setLiked(previousLiked);
        setLikeCount(previousCount);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSharePost = () => {
    setIsShareModalOpen(true);
  };

  const handleDeletePost = async () => {
    if (isDeleting || !postId) return;

    if (!confirm('Are you sure you want to delete this post?')) return;

    setIsDeleting(true);

    try {
      const response = await postService.deletePost(postId);
      if (response.success) {
        showToast.success('Deleted', 'Post deleted successfully');
        setIsHidden(true); // Hide the post immediately
      } else {
        throw new Error(response.message || 'Failed to delete post');
      }
    } catch (error: any) {
      console.error('Error deleting post:', error.message || error);
      showToast.error('Delete failed', error.message || 'Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSavePost = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // Prevent opening post details
    if (isSaving) return;

    setIsSaving(true);
    const previousSaved = saved;

    // Optimistic update
    setSaved(!saved);

    try {
      if (saved) {
        const response = await postService.unsavePost(postId);
        if (response.success) {
          toasts.postUnsaved();
        } else {
          throw new Error(response.message || 'Failed to unsave post');
        }
      } else {
        const response = await postService.savePost(postId);
        if (response.success) {
          toasts.postSaved();
        } else {
          throw new Error(response.message || 'Failed to save post');
        }
      }
    } catch (error: any) {
      console.error('Error toggling save:', error.message || error);

      // Check if error is "already saved" or "already unsaved"
      const errorMessage = error?.message || error?.error || '';

      if (errorMessage.toLowerCase().includes('already saved')) {
        // Post is already saved - sync state to saved
        setSaved(true);
        toasts.postSaved();
      } else if (
        errorMessage.toLowerCase().includes('not saved') ||
        errorMessage.toLowerCase().includes('already unsaved')
      ) {
        // Post is not saved - sync state to not saved
        setSaved(false);
      } else {
        // Other error - revert to previous state
        setSaved(previousSaved);
        toasts.saveError();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPost = async () => {
    // Check if it's own post - always allow download of own content
    const isOwnPost = currentUserId && post.user_id?._id === currentUserId;

    if (isOwnPost) {
      // Allow downloading own posts
    } else {
      // For other users' posts, check if download is explicitly allowed
      // If allowDownloads is explicitly set to false, block download
      const allowDownloads = post.user_id?.allowDownloads;
      const canDownload = post.canDownload;

      // Block if either flag is explicitly false
      if (allowDownloads === false || canDownload === false) {
        showToast.error('Download not allowed', 'The creator has disabled downloads for this post');
        return;
      }
    }

    if (!mediaUrl) {
      showToast.error('No media', 'This post has no media to download');
      return;
    }

    try {
      // Download the media file
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Determine file extension from media type or URL
      const fileExtension = post.media?.[0]?.type === 'video' ? 'mp4' : 'jpg';
      link.download = `post_${postId}.${fileExtension}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast.success('Downloaded', 'Post media downloaded successfully');
    } catch (error) {
      console.error('Error downloading post:', error);
      showToast.error('Download failed', 'Failed to download post media');
    }
  };

  return (
    <article className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition w-full max-w-md mx-auto">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              router.push(`/profile/${post.user_id?._id}`);
            }}
            className="cursor-pointer hover:opacity-80 transition"
          >
            <UserAvatar
              user={{
                _id: post.user_id?._id || 'unknown',
                firstName: post.user_id?.firstName,
                lastName: post.user_id?.lastName,
                fullName: post.user_id?.fullName,
                username: post.user_id?.username,
                profileImage: post.user_id?.profileImage,
                profilePicture: post.user_id?.profilePicture,
                avatar: post.user_id?.avatar,
              }}
              size="sm"
              clickable={false}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-bold text-foreground truncate cursor-pointer hover:text-primary transition"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                router.push(`/profile/${post.user_id?._id}`);
              }}
            >
              {authorName}
            </h3>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{timestamp}</p>
              {post.isSuggested && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  Suggested
                </span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-2 hover:bg-muted rounded-full transition cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal size={20} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!isOwnPost && (
                <DropdownMenuItem onClick={handleSavePost} disabled={isSaving}>
                  {isSaving ? 'Saving...' : saved ? 'Unsave Post' : 'Save Post'}
                </DropdownMenuItem>
              )}
              {!isOwnPost && mediaUrl && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadPost();
                  }}
                  disabled={post.canDownload === false || post.user_id?.allowDownloads === false}
                >
                  <Download size={14} className="mr-2" />
                  {post.canDownload === false || post.user_id?.allowDownloads === false
                    ? 'Download Disabled'
                    : 'Download'}
                </DropdownMenuItem>
              )}
              {!isOwnPost && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsReportModalOpen(true);
                  }}
                >
                  Report Post
                </DropdownMenuItem>
              )}
              {isOwnPost && (
                <DropdownMenuItem onClick={handleDeletePost} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete Post'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Copy Link</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Image/Video */}
      {mediaUrl && (
        <div className="relative w-full bg-black aspect-square overflow-hidden">
          {post.media?.[0]?.type === 'video' ? (
            <PostVideoPlayer src={mediaUrl} poster={getMediaUrl(post.media?.[0]?.thumbnail)} />
          ) : (
            <img
              src={mediaUrl}
              alt="Post"
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
      )}

      {/* Caption/Content - Below Media */}
      {content && (
        <div className="px-4 pt-3">
          <p className="text-foreground leading-relaxed whitespace-pre-wrap line-clamp-3">
            {content}
          </p>
        </div>
      )}

      {/* Interactions - Same format as Reel */}
      <div className="p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLike();
            }}
            disabled={isLoading}
            className={`flex items-center gap-1 transition cursor-pointer ${
              liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
            <span className="text-sm">{likeCount}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCommentClick?.(post);
            }}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <MessageCircle size={20} />
            <span className="text-sm">{commentCount}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSharePost();
            }}
            disabled={isSharing}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <Share2 size={20} />
            <span className="text-sm">{sharesCount}</span>
          </button>
        </div>
      </div>

      {/* Inline Comments Section (Mobile) */}
      {showComments && (
        <div className="border-t border-border bg-muted/30" onClick={(e) => e.stopPropagation()}>
          {/* Comments Header */}
          <div className="p-4 border-b border-border">
            <h4 className="font-semibold text-foreground">Comments</h4>
          </div>

          {/* Comments List */}
          <div className="max-h-64 overflow-y-auto p-4">
            {commentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-4">
                {comments
                  .filter((comment) => comment?.user_id)
                  .map((comment) => (
                    <div key={comment._id} className="space-y-2">
                      {/* Main Comment */}
                      <div className="flex gap-3">
                        <UserAvatar user={comment.user_id} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="bg-muted rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm">
                                {comment.user_id?.firstName} {comment.user_id?.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-foreground break-words">{comment.text}</p>
                          </div>

                          {/* Comment Actions */}
                          <div className="flex items-center gap-4 mt-1 px-3">
                            <button
                              onClick={() => handleLikeComment(comment._id)}
                              className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1"
                            >
                              <Heart
                                size={12}
                                className={comment.isLiked ? 'fill-primary text-primary' : ''}
                              />
                              <span>
                                {comment.likes_count || 0}{' '}
                                {comment.likes_count === 1 ? 'Like' : 'Likes'}
                              </span>
                            </button>
                            <button
                              onClick={() =>
                                handleReplyClick(
                                  comment._id,
                                  comment.user_id?.firstName || comment.user_id?.username || 'User'
                                )
                              }
                              className="text-xs text-muted-foreground hover:text-primary transition"
                            >
                              Reply
                            </button>
                            {(comment.user_id?._id === currentUserId || isOwnPost) && (
                              <button
                                onClick={() => handleDeleteComment(comment._id)}
                                className="text-xs text-muted-foreground hover:text-red-500 transition flex items-center gap-1"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            )}
                            {comment.replies_count > 0 && (
                              <button
                                onClick={() => handleToggleReplies(comment._id)}
                                className="cursor-pointer text-xs text-primary hover:underline"
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
                        <div className="ml-12 mt-3 space-y-3 border-l-2 border-muted pl-4">
                          {loadingReplies.has(comment._id) ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                              <span className="ml-2 text-xs text-muted-foreground">
                                Loading replies...
                              </span>
                            </div>
                          ) : repliesData?.get(comment._id)?.length ? (
                            (repliesData.get(comment._id) || []).map((reply: any) => (
                              <div key={reply._id} className="flex gap-2">
                                <UserAvatar user={reply.user_id} size="sm" />
                                <div className="flex-1 min-w-0">
                                  <div className="bg-muted rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-semibold text-xs">
                                        {reply.user_id?.firstName} {reply.user_id?.lastName}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(reply.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="text-xs text-foreground break-words">
                                      {reply.text}
                                    </p>
                                  </div>

                                  {/* Reply Actions */}
                                  <div className="flex items-center gap-3 mt-1 px-2">
                                    <button
                                      onClick={() => handleLikeComment(reply._id)}
                                      className="cursor-pointer text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1"
                                    >
                                      <Heart
                                        size={10}
                                        className={
                                          reply.isLiked || reply.isLikedByCurrentUser
                                            ? 'fill-primary text-primary'
                                            : ''
                                        }
                                      />
                                      <span>{reply.likes_count || 0}</span>
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleReplyClick(
                                          comment._id,
                                          reply.user_id?.firstName ||
                                            reply.user_id?.username ||
                                            'User'
                                        )
                                      }
                                      className="cursor-pointer text-xs text-muted-foreground hover:text-primary transition"
                                    >
                                      Reply
                                    </button>
                                    {(reply.user_id?._id === currentUserId || isOwnPost) && (
                                      <button
                                        onClick={() => handleDeleteComment(reply._id)}
                                        className="cursor-pointer text-xs text-muted-foreground hover:text-red-500 transition flex items-center gap-1"
                                      >
                                        <Trash2 size={10} />
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              No replies yet
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <MessageCircle size={32} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No comments yet</p>
                <p className="text-xs text-muted-foreground">Be the first to comment!</p>
              </div>
            )}
          </div>

          {/* Comment/Reply Input */}
          <div className="p-4 border-t border-border">
            {replyingTo && (
              <div className="mb-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <MessageCircle size={14} className="text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground mb-0.5">
                        Replying to <span className="text-primary">@{replyingTo.username}</span>
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {comments.find((c) => c._id === replyingTo.commentId)?.text || 'Comment'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText('');
                    }}
                    className="text-muted-foreground hover:text-foreground transition p-1 rounded hover:bg-muted"
                    title="Cancel reply"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            <form
              onSubmit={replyingTo ? handleSubmitReply : handleSubmitComment}
              className="flex gap-2"
            >
              <input
                type="text"
                value={replyingTo ? replyText : newComment}
                onChange={(e) =>
                  replyingTo ? setReplyText(e.target.value) : setNewComment(e.target.value)
                }
                placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : 'Add a comment...'}
                className="flex-1 bg-background rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary border border-border"
                disabled={submittingComment || submittingReply}
              />
              <button
                type="submit"
                disabled={
                  replyingTo
                    ? !replyText.trim() || submittingReply
                    : !newComment.trim() || submittingComment
                }
                className="cursor-pointer p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Report Post Modal */}
      <ReportPostModal
        open={isReportModalOpen}
        onOpenChange={setIsReportModalOpen}
        postId={postId}
        postAuthor={authorName}
        onReported={() => setIsHidden(true)}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        contentType="post"
        contentId={postId}
      />
    </article>
  );
}

export default memo(PostCard);
