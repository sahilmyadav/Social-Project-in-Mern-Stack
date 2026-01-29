'use client';

import Navigation from '@/components/navigation';
import ReportPostModal from '@/components/report-post-modal';
import ShareModal from '@/components/share-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { commentService, postService } from '@/lib/api-services';
import { showToast, toasts } from '@/lib/toast';
import {
  ArrowLeft,
  Bookmark,
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  MoreVertical,
  Send,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = params.postId as string;
  const showComments = searchParams.get('comments') === 'true';

  const [post, setPost] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Post states
  const [liked, setLiked] = useState(false);
  const [savedPost, setSavedPost] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Comments states
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [replyText, setReplyText] = useState('');

  // Modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

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

  // Load post details
  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await postService.getPostDetails(postId);

        if (response.success && response.data) {
          setPost(response.data);
          setLikeCount(response.data.likes_count || 0);
          setLiked(response.data.isLiked || false);
          setSavedPost(response.data.isSaved || false);
          setComments(response.data.comments || []);

          // Auto-focus comment input if showComments is true
          if (showComments) {
            setTimeout(() => {
              commentInputRef.current?.focus();
            }, 300);
          }
        } else {
          setError('Post not found');
        }
      } catch (err: any) {
        console.error('Error fetching post:', err);
        setError(err.message || 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId, showComments]);

  // Load comments
  const loadComments = async () => {
    if (!postId) return;

    setLoadingComments(true);
    try {
      const response = await commentService.getComments(postId, { limit: 50 });
      if (response.success && response.data) {
        setComments(response.data.comments || response.data || []);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  // Handle like
  const handleLike = async () => {
    if (isLiking || !post) return;

    setIsLiking(true);
    const wasLiked = liked;

    // Optimistic update
    setLiked(!wasLiked);
    setLikeCount((prev) => (wasLiked ? prev - 1 : prev + 1));

    try {
      if (wasLiked) {
        await postService.unlikePost(post._id);
      } else {
        await postService.likePost(post._id);
      }
    } catch (error) {
      // Revert on error
      setLiked(wasLiked);
      setLikeCount((prev) => (wasLiked ? prev + 1 : prev - 1));
      showToast.error('Failed to update like');
    } finally {
      setIsLiking(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (isSaving || !post) return;

    setIsSaving(true);
    const wasSaved = savedPost;

    // Optimistic update
    setSavedPost(!wasSaved);

    try {
      if (wasSaved) {
        await postService.unsavePost(post._id);
        toasts.postUnsaved();
      } else {
        await postService.savePost(post._id);
        toasts.postSaved();
      }
    } catch (error) {
      // Revert on error
      setSavedPost(wasSaved);
      showToast.error('Failed to update save');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (isDeleting || !post) return;

    if (!confirm('Are you sure you want to delete this post?')) return;

    setIsDeleting(true);
    try {
      await postService.deletePost(post._id);
      toasts.postDeleted();
      router.push('/home');
    } catch (error) {
      showToast.error('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle comment submit
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment || !post) return;

    setIsSubmittingComment(true);
    try {
      const response = await commentService.addComment(post._id, newComment.trim());
      if (response.success && response.data) {
        setComments((prev) => [response.data, ...prev]);
        setNewComment('');
        toasts.commentAdded();
      }
    } catch (error) {
      showToast.error('Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Handle reply submit
  const handleSubmitReply = async (commentId: string) => {
    if (!replyText.trim() || !post) return;

    try {
      const response = await commentService.replyToComment(post._id, commentId, replyText.trim());
      if (response.success && response.data) {
        // Update the comment with the new reply
        setComments((prev) =>
          prev.map((c) => {
            if (c._id === commentId) {
              return {
                ...c,
                replies: [...(c.replies || []), response.data],
              };
            }
            return c;
          })
        );
        setReplyText('');
        setReplyingTo(null);
        toasts.replyAdded();
      }
    } catch (error) {
      showToast.error('Failed to add reply');
    }
  };

  // Handle delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!post) return;

    try {
      await commentService.deleteComment(post._id, commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      toasts.commentDeleted();
    } catch (error) {
      showToast.error('Failed to delete comment');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // Get author info
  const author = post?.author || post?.user_id || {};
  const authorName = `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Unknown';
  const authorUsername = author.username || 'user';
  const authorAvatar = author.profileImage || author.profilePicture || author.avatar;
  const isOwner = user?._id === author._id;

  // Get media
  const mediaUrl = post?.media?.[0]?.url || post?.media?.[0]?.thumbnail || post?.file_url;
  const mediaType = post?.media?.[0]?.type || 'image';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || 'Post not found'}</p>
        <Button onClick={() => router.push('/home')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
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
      <main className="flex-1 lg:ml-64 px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Post Card */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Post Header */}
          <div className="flex items-center justify-between p-4">
            <Link href={`/profile/${author._id}`} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold overflow-hidden">
                {authorAvatar ? (
                  <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" />
                ) : (
                  authorName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className="font-semibold text-foreground">{authorName}</p>
                <p className="text-xs text-muted-foreground">@{authorUsername}</p>
              </div>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwner ? (
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? 'Deleting...' : 'Delete Post'}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setShowReportModal(true)}>
                    <Flag className="w-4 h-4 mr-2" />
                    Report Post
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Media */}
          {mediaUrl && (
            <div className="relative aspect-square bg-muted">
              {mediaType === 'video' ? (
                <video
                  src={mediaUrl}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                />
              ) : (
                <img src={mediaUrl} alt="Post" className="w-full h-full object-contain" />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLike}
                  disabled={isLiking}
                  className="gap-2"
                >
                  <Heart className={`w-6 h-6 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
                  <span>{likeCount}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => commentInputRef.current?.focus()}
                  className="gap-2"
                >
                  <MessageCircle className="w-6 h-6" />
                  <span>{comments.length}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowShareModal(true)}>
                  <Share2 className="w-6 h-6" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSave} disabled={isSaving}>
                <Bookmark className={`w-6 h-6 ${savedPost ? 'fill-foreground' : ''}`} />
              </Button>
            </div>

            {/* Caption */}
            {post.caption && (
              <p className="text-foreground mb-4">
                <span className="font-semibold">{authorUsername}</span> {post.caption}
              </p>
            )}

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground mb-4">{getTimeAgo(post.createdAt)}</p>

            {/* Comments Section */}
            <div className="border-t border-border pt-4">
              <h3 className="font-semibold text-foreground mb-4">Comments ({comments.length})</h3>

              {/* Comment Input */}
              <form onSubmit={handleSubmitComment} className="flex gap-2 mb-4">
                <Input
                  ref={commentInputRef}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1"
                  disabled={isSubmittingComment}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newComment.trim() || isSubmittingComment}
                >
                  {isSubmittingComment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>

              {/* Comments List */}
              {loadingComments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {comments.map((comment: any) => {
                    const commentUser = comment.user_id || comment.user || {};
                    const commentName =
                      `${commentUser.firstName || ''} ${commentUser.lastName || ''}`.trim() ||
                      'Unknown';
                    const commentAvatar =
                      commentUser.profileImage || commentUser.profilePicture || commentUser.avatar;
                    const isCommentOwner = user?._id === commentUser._id;

                    return (
                      <div key={comment._id} className="flex gap-3">
                        <Link href={`/profile/${commentUser._id}`}>
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
                              <Link href={`/profile/${commentUser._id}`}>
                                <span className="font-semibold text-sm text-foreground hover:underline">
                                  {commentName}
                                </span>
                              </Link>
                              {isCommentOwner && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteComment(comment._id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            <p className="text-sm text-foreground">
                              {comment.content || comment.text}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 mt-1 px-3">
                            <span className="text-xs text-muted-foreground">
                              {getTimeAgo(comment.createdAt)}
                            </span>
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setReplyingTo(replyingTo?._id === comment._id ? null : comment)
                              }
                            >
                              Reply
                            </button>
                          </div>

                          {/* Reply Input */}
                          {replyingTo?._id === comment._id && (
                            <div className="flex gap-2 mt-2 ml-2">
                              <Input
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder={`Reply to ${commentName}...`}
                                className="flex-1 h-8 text-sm"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSubmitReply(comment._id)}
                                disabled={!replyText.trim()}
                                className="h-8"
                              >
                                <Send className="w-3 h-3" />
                              </Button>
                            </div>
                          )}

                          {/* Replies */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="mt-3 space-y-2 ml-4 border-l-2 border-border pl-4">
                              {comment.replies.map((reply: any) => {
                                const replyUser = reply.user_id || reply.user || {};
                                const replyName =
                                  `${replyUser.firstName || ''} ${replyUser.lastName || ''}`.trim() ||
                                  'Unknown';
                                const replyAvatar =
                                  replyUser.profileImage ||
                                  replyUser.profilePicture ||
                                  replyUser.avatar;

                                return (
                                  <div key={reply._id} className="flex gap-2">
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
                                    <div className="flex-1">
                                      <div className="bg-muted/50 rounded-lg p-2">
                                        <span className="font-semibold text-xs text-foreground">
                                          {replyName}
                                        </span>
                                        <p className="text-xs text-foreground">
                                          {reply.content || reply.text}
                                        </p>
                                      </div>
                                      <span className="text-xs text-muted-foreground ml-2">
                                        {getTimeAgo(reply.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
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
        contentType="post"
        contentId={post._id}
        title={post.caption || 'Check out this post'}
      />

      {/* Report Modal */}
      <ReportPostModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        postId={post._id}
      />
    </div>
  );
}
