'use client';

import ReportPostModal from '@/components/report-post-modal';
import ShareModal from '@/components/share-modal';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import UserAvatar from '@/components/user-avatar';
import { useVideoSafe } from '@/contexts/video-context';
import { useComments } from '@/hooks/useComments';
import { postService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import { showToast, toasts } from '@/lib/toast';
import {
  Bookmark,
  Copy,
  Download,
  Eye,
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

function PostVideoPlayer({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMuted: globalMuted, toggleMute: toggleGlobalMute } = useVideoSafe();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [userPaused, setUserPaused] = useState(false); // Auto-play when in view

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

  useEffect(() => {
    if (!videoRef.current) return;

    if (isInView && !userPaused) {
      videoRef.current.play().catch(() => {});
    } else if (!isInView) {
      videoRef.current.pause();
    }
  }, [isInView, userPaused]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = globalMuted;
    }
  }, [globalMuted]);

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
    toggleGlobalMute(); // Toggle global mute state - affects all videos
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
        muted={globalMuted}
        preload="metadata"
      />

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

      <button
        className="absolute bottom-4 right-4 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition cursor-pointer"
        onClick={handleMuteToggle}
      >
        {globalMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
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
  const [liked, setLiked] = useState(post.isLiked || post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.likes_count || 0);
  const [saved, setSaved] = useState(post.isSaved || post.is_saved || false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentCount, setCommentCount] = useState(
    Math.max(0, post.comments_count || post.comments || 0)
  );
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(
    null
  );
  const [replyText, setReplyText] = useState('');

  const {
    comments,
    repliesData,
    expandedReplies,
    loadingReplies,
    isLoading: commentsLoading,
    isSubmitting,
    loadComments,
    addComment,
    deleteComment,
    toggleLikeComment,
    addReply,
    toggleReplies,
  } = useComments({
    postId: post._id,
    onCommentCountChange: setCommentCount,
  });

  const [sharesCount, setSharesCount] = useState(post.shares_count || post.shares || 0);
  const [viewCount, setViewCount] = useState(post.views_count || 0);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const postCardRef = useRef<HTMLDivElement>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  useEffect(() => {
    if (hasTrackedView || !post?._id) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTrackedView) {
            postService.trackView(post._id).catch(() => {});
            setViewCount((prev: number) => prev + 1);
            setHasTrackedView(true);
          }
        });
      },
      { threshold: 0.5 }
    );

    if (postCardRef.current) {
      observer.observe(postCardRef.current);
    }

    return () => {
      if (postCardRef.current) {
        observer.unobserve(postCardRef.current);
      }
    };
  }, [post?._id, hasTrackedView]);

  useEffect(() => {
    setLiked(post.isLiked || false);
    setLikeCount(post.likes_count || 0);
    setCommentCount(Math.max(0, post.comments_count || post.comments || 0));
  }, [post._id, post.isLiked, post.likes_count, post.comments_count, post.comments]);

  useEffect(() => {
    if (showComments && post?._id && comments.length === 0) {
      loadComments();
    }
  }, [showComments, post?._id]);

  if (isHidden) {
    return null;
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;
    const success = await addComment(newComment.trim());
    if (success) setNewComment('');
  };

  const handleReplyClick = (commentId: string, username: string) => {
    setReplyingTo({ commentId, username });
    setReplyText(`@${username} `);
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !replyingTo || isSubmitting) return;
    const success = await addReply(replyingTo.commentId, replyText.trim());
    if (success) {
      setReplyText('');
      setReplyingTo(null);
    }
  };

  const handleToggleReplies = toggleReplies;
  const handleLikeComment = toggleLikeComment;

  const handleDeleteComment = (commentId: string) => {
    confirm({
      title: 'Delete Comment',
      message: 'Are you sure you want to delete this comment?',
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: () => deleteComment(commentId),
    });
  };

  const isOwnPost = currentUserId && post.user_id?._id === currentUserId;

  const postId = post._id || post.id;
  const authorName = post.user_id?.firstName
    ? `${post.user_id.firstName} ${post.user_id.lastName || ''}`.trim()
    : post.user_id?.username || post.author || 'Unknown User';
  const authorAvatar = post.user_id?.profileImage || post.avatar || '😊';
  const content = post.caption || post.content || '';
  const rawMediaUrl =
    post.media?.[0]?.url || post.media?.[0]?.thumbnail || post.image || post.file_url;
  const mediaUrl = getMediaUrl(rawMediaUrl);

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

    setLiked(!liked);
    setLikeCount(liked ? Math.max(0, likeCount - 1) : likeCount + 1);

    try {
      let response;
      if (previousLiked) {
        response = await postService.unlikePost(postId);
      } else {
        response = await postService.likePost(postId);
      }

      if (response.success && response.data) {
        const serverIsLiked = response.data.isLiked ?? !previousLiked;
        const serverLikeCount =
          response.data.likes_count ?? response.data.likesCount ?? previousCount;
        setLiked(serverIsLiked);
        setLikeCount(serverLikeCount);
        onLikeUpdate?.(postId, serverIsLiked, serverLikeCount);
      } else {
        setLiked(previousLiked);
        setLikeCount(previousCount);
      }
    } catch (error: any) {
      setLiked(previousLiked);
      setLikeCount(previousCount);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSharePost = () => {
    setIsShareModalOpen(true);
  };

  const handleDeletePost = () => {
    if (isDeleting || !postId) return;

    confirm({
      title: 'Delete Post',
      message: 'Are you sure you want to delete this post? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
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
          showToast.error('Delete failed', error.message || 'Failed to delete post');
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleSavePost = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // Prevent opening post details
    if (isSaving) return;

    setIsSaving(true);
    const previousSaved = saved;

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
      const errorMessage = error?.message || error?.error || '';

      if (errorMessage.toLowerCase().includes('already saved')) {
        setSaved(true);
        toasts.postSaved();
      } else if (
        errorMessage.toLowerCase().includes('not saved') ||
        errorMessage.toLowerCase().includes('already unsaved')
      ) {
        setSaved(false);
      } else {
        setSaved(previousSaved);
        toasts.saveError();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPost = async () => {
    const isOwnPost = currentUserId && post.user_id?._id === currentUserId;

    if (isOwnPost) {
    } else {
      const allowDownloads = post.user_id?.allowDownloads;
      const canDownload = post.canDownload;

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
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const fileExtension = post.media?.[0]?.type === 'video' ? 'mp4' : 'jpg';
      link.download = `post_${postId}.${fileExtension}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast.success('Downloaded', 'Post media downloaded successfully');
    } catch (error) {
      showToast.error('Download failed', 'Failed to download post media');
    }
  };

  return (
    <article
      ref={postCardRef}
      className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition w-full max-w-md mx-auto"
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              router.push(`/profile/${post.user_id?.username || post.user_id?._id}`);
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
                router.push(`/profile/${post.user_id?.username || post.user_id?._id}`);
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
                  <Bookmark size={16} className={`mr-2 ${saved ? 'fill-current' : ''}`} />
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
                  <Download size={16} className="mr-2" />
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
                  <span className="mr-2">⚠️</span>
                  Report Post
                </DropdownMenuItem>
              )}
              {isOwnPost && (
                <DropdownMenuItem
                  onClick={handleDeletePost}
                  disabled={isDeleting}
                  className="text-destructive"
                >
                  <Trash2 size={16} className="mr-2" />
                  {isDeleting ? 'Deleting...' : 'Delete Post'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  const postUrl = `${window.location.origin}/post/${post._id || post.id}`;

                  setTimeout(() => {
                    navigator.clipboard
                      .writeText(postUrl)
                      .then(() => {
                        showToast.success('Copied!', 'Post link copied to clipboard');
                      })
                      .catch(() => {
                        const textArea = document.createElement('textarea');
                        textArea.value = postUrl;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-999999px';
                        textArea.style.top = '-999999px';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        try {
                          document.execCommand('copy');
                          showToast.success('Copied!', 'Post link copied to clipboard');
                        } catch (err) {
                          showToast.error('Failed', 'Could not copy link to clipboard');
                        }
                        document.body.removeChild(textArea);
                      });
                  }, 100);
                }}
              >
                <Copy size={16} className="mr-2" />
                Copy Link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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

      {content && (
        <div className="px-4 pt-3">
          <p className="text-foreground leading-relaxed whitespace-pre-wrap line-clamp-3">
            {content}
          </p>
        </div>
      )}

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
          <div className="flex items-center gap-1 text-muted-foreground ml-auto">
            <Eye size={20} />
            <span className="text-sm">{viewCount}</span>
          </div>
        </div>
      </div>

      {showComments && (
        <div className="border-t border-border bg-muted/30" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 border-b border-border">
            <h4 className="font-semibold text-foreground">Comments</h4>
          </div>

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
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={
                  replyingTo
                    ? !replyText.trim() || isSubmitting
                    : !newComment.trim() || isSubmitting
                }
                className="cursor-pointer p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      <ReportPostModal
        open={isReportModalOpen}
        onOpenChange={setIsReportModalOpen}
        postId={postId}
        postAuthor={authorName}
        onReported={() => setIsHidden(true)}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        contentType="post"
        contentId={postId}
      />

      <ConfirmDialog {...dialogProps} />
    </article>
  );
}

export default memo(PostCard);
