'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { commentService, postService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import { showToast } from '@/lib/toast';
import { Heart, Loader2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Comment {
  _id: string;
  id?: string;
  user_id: {
    _id: string;
    firstName: string;
    lastName?: string;
    username?: string;
    profileImage?: string;
    profilePicture?: string;
    avatar?: string;
  };
  text: string;
  likes_count: number;
  isLiked?: boolean;
  createdAt: string;
  replies_count?: number;
}

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postAuthor: string;
}

export default function CommentsModal({ isOpen, onClose, postId, postAuthor }: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      const userData = localStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
      loadComments();
    }
  }, [isOpen, postId]);

  const loadComments = async () => {
    if (!postId) return;
    setIsLoading(true);
    try {
      const response = await postService.getPostComments(postId, { limit: 50 });
      if (response.success && response.data) {
        setComments(response.data.comments || []);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || isSubmitting || !postId) return;

    setIsSubmitting(true);
    try {
      const response = await postService.commentOnPost(postId, { text: newComment.trim() });

      if (response.success && response.data) {
        const newCommentData: Comment = {
          ...response.data,
          _id: response.data._id || response.data.id,
          user_id: {
            _id: currentUser?._id || currentUser?.id,
            firstName: currentUser?.firstName || 'You',
            lastName: currentUser?.lastName || '',
            username: currentUser?.username,
            profileImage: currentUser?.profileImage,
            profilePicture: currentUser?.profilePicture,
            avatar: currentUser?.avatar,
          },
          text: newComment.trim(),
          likes_count: 0,
          isLiked: false,
          createdAt: new Date().toISOString(),
        };
        setComments((prev) => [newCommentData, ...prev]);
        setNewComment('');
      }
    } catch (error) {
      showToast.error('Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      const comment = comments.find((c) => c._id === commentId || c.id === commentId);
      if (!comment) return;

      const isCurrentlyLiked = comment.isLiked;

      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId || c.id === commentId
            ? {
                ...c,
                isLiked: !isCurrentlyLiked,
                likes_count: isCurrentlyLiked
                  ? Math.max(0, (c.likes_count || 1) - 1)
                  : (c.likes_count || 0) + 1,
              }
            : c
        )
      );

      if (isCurrentlyLiked) {
        await commentService.unlikeComment(commentId);
      } else {
        await commentService.likeComment(commentId);
      }
    } catch (error) {
      const comment = comments.find((c) => c._id === commentId || c.id === commentId);
      if (comment) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId || c.id === commentId
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
      }
    }
  };

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

  const getUserAvatar = (user: Comment['user_id']) => {
    const avatarUrl = user?.profileImage || user?.profilePicture || user?.avatar;
    if (avatarUrl) {
      return getMediaUrl(avatarUrl);
    }
    return null;
  };

  const getUserName = (user: Comment['user_id']) => {
    if (user?.firstName) {
      return `${user.firstName} ${user.lastName || ''}`.trim();
    }
    return user?.username || 'Unknown User';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Comments on {postAuthor}'s post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg overflow-hidden">
              {currentUser?.profileImage || currentUser?.avatar ? (
                <img
                  src={getMediaUrl(currentUser.profileImage || currentUser.avatar)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{currentUser?.firstName?.charAt(0) || '😊'}</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="w-full p-2 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground text-sm"
                rows={2}
                disabled={isSubmitting}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
              />
              <Button
                onClick={handleAddComment}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm"
                disabled={isSubmitting || !newComment.trim()}
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <Send size={16} className="mr-2" />
                )}
                Post
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No comments yet. Be the first to comment!
              </div>
            ) : (
              comments.map((comment) => {
                const commentId = comment._id || comment.id;
                const avatar = getUserAvatar(comment.user_id);
                const userName = getUserName(comment.user_id);

                return (
                  <div
                    key={commentId}
                    className="flex items-start gap-3 p-3 hover:bg-muted rounded-lg transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                      {avatar ? (
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{userName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="font-semibold text-foreground text-sm">{userName}</p>
                        <p className="text-foreground text-sm mt-1 break-words">{comment.text}</p>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{formatTimestamp(comment.createdAt)}</span>
                        <button
                          onClick={() => handleLikeComment(commentId!)}
                          className={`flex items-center gap-1 hover:text-red-500 transition ${
                            comment.isLiked ? 'text-red-500' : ''
                          }`}
                        >
                          <Heart size={14} fill={comment.isLiked ? 'currentColor' : 'none'} />
                          {comment.likes_count || 0}
                        </button>
                        {comment.replies_count ? (
                          <span>{comment.replies_count} replies</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
