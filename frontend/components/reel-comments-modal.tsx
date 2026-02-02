'use client';

import EmojiPicker, { CommentReactions } from '@/components/emoji-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import UserAvatar from '@/components/user-avatar';
import { commentService, reelService } from '@/lib/api-services';
import { showToast } from '@/lib/toast';
import { Heart, MessageCircle, Send, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Comment {
  _id: string;
  user_id?: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    profileImage?: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
  likes_count: number;
  replies_count?: number;
  isLiked?: boolean;
}

interface ReelCommentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reelId: string;
  commentsCount: number;
  currentUserId?: string;
}

export default function ReelCommentsModal({
  open,
  onOpenChange,
  reelId,
  commentsCount,
  currentUserId,
}: ReelCommentsModalProps) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(
    null
  );
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [repliesData, setRepliesData] = useState<Map<string, any[]>>(new Map());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && reelId) {
      fetchComments();
    }
  }, [open, reelId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await reelService.getReelComments(reelId);
      if (response.success) {
        // Reverse to show oldest at top, newest at bottom (chat style)
        setComments((response.data.comments || []).reverse());
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await reelService.commentOnReel(reelId, { text: newComment.trim() });
      if (response.success && response.data) {
        const currentUserData = localStorage.getItem('user');
        const user = currentUserData ? JSON.parse(currentUserData) : {};

        const newCommentData = {
          ...response.data.comment,
          user_id: {
            ...(response.data.comment?.user_id || {}),
            _id: response.data.comment?.user_id?._id || user._id,
            firstName: response.data.comment?.user_id?.firstName || user.firstName,
            lastName: response.data.comment?.user_id?.lastName || user.lastName,
            profileImage: response.data.comment?.user_id?.profileImage || user.profileImage,
            profilePicture: response.data.comment?.user_id?.profilePicture || user.profilePicture,
          },
        };

        setComments((prev) => [...prev, newCommentData]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      showToast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
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
      }
    } catch (error) {
      console.error('Error posting reply:', error);
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

  const handleLikeComment = async (commentId: string) => {
    try {
      const comment = comments.find((c) => c._id === commentId);
      const isCurrentlyLiked = comment?.isLiked || false;

      // Optimistic update
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

      // Update replies
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
      console.error('Error liking comment:', error);
      // Revert on error
      fetchComments();
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

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
      showToast.success('Comment deleted');
    } catch (error) {
      console.error('Error deleting comment:', error);
      showToast.error('Failed to delete comment');
      fetchComments();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle size={18} />
            Comments ({comments.length})
          </DialogTitle>
        </DialogHeader>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
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
                      <UserAvatar user={comment.user_id!} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="font-semibold text-sm cursor-pointer hover:text-primary transition"
                              onClick={() => router.push(`/profile/${comment.user_id?._id}`)}
                            >
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
                          <CommentReactions
                            commentId={comment._id}
                            onReact={(commentId, emoji) => {
                              // Add emoji reaction as a reply comment
                              commentService
                                .replyToComment(commentId, { text: emoji })
                                .then(() => {
                                  showToast.success('Reaction added!');
                                  // Refresh comments
                                  fetchComments();
                                })
                                .catch((error) => {
                                  console.error('Error adding emoji reaction:', error);
                                });
                            }}
                          />
                          <button
                            onClick={() =>
                              handleReplyClick(comment._id, comment.user_id?.firstName || 'User')
                            }
                            className="text-xs text-muted-foreground hover:text-primary transition"
                          >
                            Reply
                          </button>
                          {comment.user_id?._id === currentUserId && (
                            <button
                              onClick={() => handleDeleteComment(comment._id)}
                              className="text-xs text-muted-foreground hover:text-red-500 transition flex items-center gap-1"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          )}
                          {(comment.replies_count || 0) > 0 && (
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
                                    <span
                                      className="font-semibold text-xs cursor-pointer hover:text-primary transition"
                                      onClick={() => router.push(`/profile/${reply.user_id?._id}`)}
                                    >
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
                                      className={reply.isLiked ? 'fill-primary text-primary' : ''}
                                    />
                                    <span>{reply.likes_count || 0}</span>
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleReplyClick(
                                        comment._id,
                                        reply.user_id?.firstName || 'User'
                                      )
                                    }
                                    className="cursor-pointer text-xs text-muted-foreground hover:text-primary transition"
                                  >
                                    Reply
                                  </button>
                                  {reply.user_id?._id === currentUserId && (
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
            <div className="text-center py-8">
              <MessageCircle size={48} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">No comments yet</p>
              <p className="text-sm text-muted-foreground">Be the first to comment!</p>
            </div>
          )}
        </div>

        {/* Comment/Reply Input */}
        <div className="px-4 py-3 border-t border-border bg-background">
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
            className="flex gap-2 items-center"
          >
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={replyingTo ? replyText : newComment}
                onChange={(e) =>
                  replyingTo ? setReplyText(e.target.value) : setNewComment(e.target.value)
                }
                placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : 'Add a comment...'}
                className="w-full bg-muted rounded-full px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary border border-border"
                disabled={submitting || submittingReply}
              />
              <div className="absolute right-1">
                <EmojiPicker
                  onEmojiSelect={(emoji) => {
                    if (replyingTo) {
                      setReplyText((prev) => prev + emoji);
                    } else {
                      setNewComment((prev) => prev + emoji);
                    }
                  }}
                  triggerClassName="!p-1.5"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={
                replyingTo ? !replyText.trim() || submittingReply : !newComment.trim() || submitting
              }
              className="cursor-pointer p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting || submittingReply ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
