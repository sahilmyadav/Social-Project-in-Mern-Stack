import { commentService, postService } from '@/lib/api-services';
import { showToast } from '@/lib/toast';
import { Comment, Reply, User } from '@/types';
import { useCallback, useState } from 'react';

interface UseCommentsProps {
  postId: string;
  onCommentCountChange?: (count: number) => void;
}

export const useComments = ({ postId, onCommentCountChange }: UseCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [repliesData, setRepliesData] = useState<Map<string, Reply[]>>(new Map());
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getCompleteUser = useCallback((partialUser: any): User => {
    const localUser = localStorage.getItem('user');
    const parsedLocalUser = localUser ? JSON.parse(localUser) : {};

    if (
      parsedLocalUser._id &&
      (partialUser._id === parsedLocalUser._id || partialUser.id === parsedLocalUser._id)
    ) {
      return {
        ...partialUser,
        _id: partialUser._id || partialUser.id || parsedLocalUser._id,
        firstName: partialUser.firstName || parsedLocalUser.firstName,
        lastName: partialUser.lastName || parsedLocalUser.lastName,
        username: partialUser.username || parsedLocalUser.username,
        profileImage:
          partialUser.profileImage ||
          parsedLocalUser.profileImage ||
          parsedLocalUser.profilePicture ||
          parsedLocalUser.avatar,
        profilePicture:
          partialUser.profileImage ||
          parsedLocalUser.profileImage ||
          parsedLocalUser.profilePicture ||
          parsedLocalUser.avatar,
        avatar:
          partialUser.profileImage ||
          parsedLocalUser.profileImage ||
          parsedLocalUser.profilePicture ||
          parsedLocalUser.avatar,
      };
    }
    return partialUser as User;
  }, []);

  const loadComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await postService.getPostComments(postId, { limit: 20 });
      if (response.success && response.data) {
        const commentsList = (response.data as any).comments || response.data || [];
        setComments(commentsList);
      }
    } catch (error) {
      showToast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  const addComment = useCallback(
    async (text: string) => {
      if (!text.trim() || isSubmitting) return false;

      setIsSubmitting(true);
      try {
        const response = await postService.commentOnPost(postId, { text });

        if (response.success && response.data) {
          const responseData = response.data as any;
          const commentData = responseData.comment || responseData;

          const enrichedComment = {
            ...commentData,
            user_id: getCompleteUser(commentData.user_id),
          };

          setComments((prev) => [enrichedComment, ...prev]);
          if (onCommentCountChange) {
            onCommentCountChange(comments.length + 1);
          }
          return true;
        }
        return false;
      } catch (error) {
        showToast.error('Failed to post comment');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [postId, isSubmitting, comments.length, onCommentCountChange, getCompleteUser]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      try {
        const isMainComment = comments.find((c) => c._id === commentId);
        let parentCommentId: string | null = null;

        if (!isMainComment) {
          for (const [parentId, replies] of repliesData.entries()) {
            const reply = replies.find((r: Reply) => r._id === commentId);
            if (reply) {
              parentCommentId = parentId;

              break;
            }
          }
        }

        if (isMainComment) {
          setComments((prev) => prev.filter((c) => c._id !== commentId));
          onCommentCountChange?.(comments.length - 1);
        } else if (parentCommentId) {
          setRepliesData((prev) => {
            const newMap = new Map(prev);
            const replies = newMap.get(parentCommentId!) || [];
            newMap.set(
              parentCommentId!,
              replies.filter((r: Reply) => r._id !== commentId)
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

          onCommentCountChange?.(comments.length - 1);
        }

        await commentService.deleteComment(commentId);
        showToast.success('Comment deleted');
        return true;
      } catch (error) {
        showToast.error('Failed to delete comment');
        loadComments();
        return false;
      }
    },
    [comments, repliesData, onCommentCountChange, loadComments]
  );

  const toggleLikeComment = useCallback(
    async (commentId: string) => {
      try {
        let isCurrentlyLiked = false;

        const comment = comments.find((c) => c._id === commentId);
        if (comment) {
          isCurrentlyLiked = comment.isLiked || false;
        } else {
          for (const [, replies] of repliesData.entries()) {
            const reply = replies.find((r: Reply) => r._id === commentId);
            if (reply) {
              isCurrentlyLiked = reply.isLiked || reply.isLikedByCurrentUser || false;
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
                  likes_count: c.isLiked ? (c.likes_count || 1) - 1 : (c.likes_count || 0) + 1,
                }
              : c
          )
        );

        setRepliesData((prev) => {
          const newMap = new Map(prev);
          for (const [parentId, replies] of newMap.entries()) {
            const updatedReplies = replies.map((r: Reply) => {
              if (r._id === commentId) {
                const currentLiked = r.isLiked || r.isLikedByCurrentUser || false;
                return {
                  ...r,
                  isLiked: !currentLiked,
                  isLikedByCurrentUser: !currentLiked,
                  likes_count: currentLiked
                    ? Math.max(0, (r.likes_count || 1) - 1)
                    : (r.likes_count || 0) + 1,
                } as Reply;
              }
              return r;
            });
            if (updatedReplies !== replies) {
              newMap.set(parentId, updatedReplies);
            }
          }
          return newMap;
        });

        if (isCurrentlyLiked) {
          const response = await commentService.unlikeComment(commentId);
          if (!response.success && response.message?.includes('not liked')) {
            return true;
          } else if (!response.success) {
            throw new Error(response.message || 'Failed to unlike');
          }
        } else {
          const response = await commentService.likeComment(commentId);
          if (!response.success && response.message?.includes('already liked')) {
            return true;
          } else if (!response.success) {
            throw new Error(response.message || 'Failed to like');
          }
        }
        return true;
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to update like';

        if (!errorMessage.includes('already liked') && !errorMessage.includes('not liked')) {
          showToast.error(errorMessage);

          loadComments();
          return false;
        }
        return true;
      }
    },
    [comments, repliesData, loadComments]
  );

  const addReply = useCallback(
    async (commentId: string, text: string) => {
      if (!text.trim() || isSubmitting) return false;

      setIsSubmitting(true);
      try {
        const response = await commentService.replyToComment(commentId, { text });

        if (response.success) {
          onCommentCountChange?.(comments.length + 1);

          setComments((prev) =>
            prev.map((c) =>
              c._id === commentId ? { ...c, replies_count: (c.replies_count || 0) + 1 } : c
            )
          );

          setExpandedReplies((prev) => new Set(prev).add(commentId));

          await loadReplies(commentId);
          return true;
        }
        return false;
      } catch (error) {
        showToast.error('Failed to post reply');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [comments.length, isSubmitting, onCommentCountChange]
  );

  const loadReplies = async (commentId: string) => {
    setLoadingReplies((prev) => new Set(prev).add(commentId));
    try {
      const response = await commentService.getCommentReplies(commentId, { limit: 20 });
      if (response.success && response.data) {
        const replies = (response.data as any).replies || response.data || [];
        setRepliesData((prev) => new Map(prev).set(commentId, replies));
      }
    } catch (error) {
      showToast.error('Failed to load replies');
    } finally {
      setLoadingReplies((prev) => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const toggleReplies = useCallback(
    async (commentId: string) => {
      if (expandedReplies.has(commentId)) {
        setExpandedReplies((prev) => {
          const newSet = new Set(prev);
          newSet.delete(commentId);
          return newSet;
        });
      } else {
        setExpandedReplies((prev) => new Set(prev).add(commentId));
        if (!repliesData.has(commentId)) {
          await loadReplies(commentId);
        }
      }
    },
    [expandedReplies, repliesData]
  );

  return {
    comments,
    repliesData,
    expandedReplies,
    loadingReplies,
    isLoading,
    isSubmitting,
    loadComments,
    addComment,
    deleteComment,
    toggleLikeComment,
    addReply,
    toggleReplies,
  };
};
