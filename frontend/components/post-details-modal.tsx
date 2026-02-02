'use client';

import EmojiPicker, { CommentReactions } from '@/components/emoji-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { commentService, postService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import { toasts } from '@/lib/toast';
import { Bookmark, Heart, MessageCircle, MoreVertical, Share2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface PostDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: any;
}

export default function PostDetailsModal({
  isOpen,
  onClose,
  post: initialPost,
}: PostDetailsModalProps) {
  const [post, setPost] = useState<any>(initialPost);
  const [liked, setLiked] = useState(false);
  const [savedPost, setSavedPost] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [isLoadingPost, setIsLoadingPost] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const scrollPositionRef = useRef(0);

  // Save scroll position when modal opens
  useEffect(() => {
    if (isOpen) {
      scrollPositionRef.current = window.scrollY;
      // Load current user
      const userData = localStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    }
  }, [isOpen]);

  // Restore scroll position when modal closes
  const handleClose = () => {
    onClose();
    // Restore scroll position after a short delay to ensure modal is closed
    setTimeout(() => {
      window.scrollTo(0, scrollPositionRef.current);
    }, 0);
  };

  // Fetch full post details when modal opens
  useEffect(() => {
    const fetchPostDetails = async () => {
      if (!initialPost?._id && !initialPost?.id) return;

      setIsLoadingPost(true);
      try {
        const postId = initialPost._id || initialPost.id;
        const response = await postService.getPostDetails(postId);

        if (response.success && response.data) {
          setPost(response.data);
          setLikeCount(response.data.likes_count || 0);
          setLiked(response.data.isLiked || false);
          setSavedPost(response.data.isSaved || false);
          setComments(response.data.comments || []);
        } else {
          // Fallback to initial post data
          setPost(initialPost);
          setLikeCount(initialPost.likes_count || 0);
          setLiked(initialPost.isLiked || false);
          setSavedPost(initialPost.isSaved || false);
          setComments([]);
        }
      } catch (error) {
        console.error('Error fetching post details:', error);
        // Fallback to initial post data
        setPost(initialPost);
        setLikeCount(initialPost.likes_count || 0);
        setLiked(initialPost.isLiked || false);
        setSavedPost(initialPost.isSaved || false);
        setComments([]);
      } finally {
        setIsLoadingPost(false);
      }
    };

    if (isOpen) {
      fetchPostDetails();
    }
  }, [isOpen, initialPost]);

  if (!post) return null;

  const rawMediaUrl = post.media?.[0]?.url || post.media?.[0]?.thumbnail || post.file_url;
  const mediaUrl = getMediaUrl(rawMediaUrl);
  const mediaType = post.media?.[0]?.type || 'image';

  const authorName = post.user_id?.firstName
    ? `${post.user_id.firstName} ${post.user_id.lastName || ''}`.trim()
    : post.user_id?.username || post.author || 'Unknown User';

  const rawAuthorAvatar = post.user_id?.profileImage || post.user_id?.profilePicture;
  const authorAvatar = rawAuthorAvatar
    ? getMediaUrl(rawAuthorAvatar)
    : authorName?.charAt(0)?.toUpperCase() || '😊';

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
    if (isLiking || !post?._id) return;

    setIsLiking(true);
    const previousLiked = liked;
    const previousCount = likeCount;

    // Optimistic update
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);

    try {
      const postId = post._id || post.id;
      if (liked) {
        const response = await postService.unlikePost(postId);
        if (!response.success) {
          throw new Error(response.message || 'Failed to unlike post');
        }
      } else {
        const response = await postService.likePost(postId);
        if (!response.success) {
          throw new Error(response.message || 'Failed to like post');
        }
      }
    } catch (error: any) {
      console.error('Error toggling like:', error.message || error);
      // Revert on error
      setLiked(previousLiked);
      setLikeCount(previousCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || isSubmittingComment || !post?._id) return;

    setIsSubmittingComment(true);
    try {
      const postId = post._id || post.id;
      const response = await postService.commentOnPost(postId, {
        text: newComment.trim(),
      });

      if (response.success && response.data) {
        // Add new comment to the list
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        // Ensure the comment has complete user data
        // The API might return user_id but without all fields like profileImage
        const newCommentObj = {
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

        setComments([newCommentObj, ...comments]);
        setNewComment('');

        // Update comments count
        setPost((prev: any) => ({
          ...prev,
          comments_count: (prev.comments_count || 0) + 1,
        }));
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleSavePost = async () => {
    if (isSaving || !post?._id) return;

    setIsSaving(true);
    const previousSaved = savedPost;

    // Optimistic update
    setSavedPost(!savedPost);

    try {
      const postId = post._id || post.id;
      if (savedPost) {
        const response = await postService.unsavePost(postId);
        if (!response.success) {
          throw new Error(response.message || 'Failed to unsave post');
        }
        toasts.postUnsaved();
      } else {
        const response = await postService.savePost(postId);
        if (!response.success) {
          throw new Error(response.message || 'Failed to save post');
        }
        toasts.postSaved();
      }
    } catch (error: any) {
      console.error('Error toggling save:', error.message || error);

      // Check if error is "already saved" or "already unsaved"
      const errorMessage = error?.message || error?.error || '';

      if (errorMessage.toLowerCase().includes('already saved')) {
        // Post is already saved - sync state to saved
        setSavedPost(true);
        toasts.postSaved();
      } else if (
        errorMessage.toLowerCase().includes('not saved') ||
        errorMessage.toLowerCase().includes('already unsaved')
      ) {
        // Post is not saved - sync state to not saved
        setSavedPost(false);
      } else {
        // Other error - revert to previous state
        setSavedPost(previousSaved);
        toasts.saveError();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePost = async () => {
    if (isDeleting || !post?._id) return;

    if (!confirm('Are you sure you want to delete this post?')) return;

    setIsDeleting(true);

    try {
      const postId = post._id || post.id;
      const response = await postService.deletePost(postId);
      if (response.success) {
        handleClose(); // Close modal after deletion
      } else {
        throw new Error(response.message || 'Failed to delete post');
      }
    } catch (error: any) {
      console.error('Error deleting post:', error.message || error);
      alert('Failed to delete post. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if current user is the post author
  const isOwnPost = currentUser?._id === post?.user_id?._id;

  // Format comment timestamp
  const formatCommentTime = (timestamp: string) => {
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

  const handleLikeComment = async (commentId: string) => {
    try {
      // Find the comment to check current like status
      const comment = comments.find((c) => c._id === commentId || c.id === commentId);
      const isCurrentlyLiked = comment?.isLiked || false;

      // Optimistically update the UI
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId || c.id === commentId
            ? {
                ...c,
                isLiked: !c.isLiked,
                likes_count: c.isLiked ? (c.likes_count || 1) - 1 : (c.likes_count || 0) + 1,
              }
            : c
        )
      );

      // Call the appropriate API
      if (isCurrentlyLiked) {
        await commentService.unlikeComment(commentId);
      } else {
        await commentService.likeComment(commentId);
      }
    } catch (error) {
      console.error('Error liking comment:', error);
      // Revert on error
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId || c.id === commentId
            ? {
                ...c,
                isLiked: !c.isLiked,
                likes_count: c.isLiked ? (c.likes_count || 1) - 1 : (c.likes_count || 0) + 1,
              }
            : c
        )
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 bg-background z-10 p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle>Post Details</DialogTitle>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-muted rounded-full transition"
              aria-label="Close"
            >
              <X size={24} className="text-foreground" />
            </button>
          </div>
        </DialogHeader>

        {isLoadingPost ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading post details...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 p-6">
            {/* Post Image/Video */}
            <div className="relative w-full h-96 rounded-xl overflow-hidden bg-muted">
              {mediaUrl ? (
                mediaType === 'video' ? (
                  <video src={mediaUrl} controls className="w-full h-full object-cover" />
                ) : (
                  <img
                    src={mediaUrl}
                    alt={post.caption || 'Post image'}
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-8xl opacity-80">
                  📸
                </div>
              )}
            </div>

            {/* Post Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl overflow-hidden">
                  {authorAvatar.startsWith('http') || authorAvatar.startsWith('/uploads') ? (
                    <img
                      src={authorAvatar}
                      alt={authorName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{authorAvatar}</span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{authorName}</p>
                  <p className="text-xs text-muted-foreground">{timestamp}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 hover:bg-muted rounded-full transition">
                    <MoreVertical size={20} className="text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!isOwnPost && (
                    <DropdownMenuItem onClick={handleSavePost} disabled={isSaving}>
                      {isSaving ? 'Saving...' : savedPost ? 'Unsave Post' : 'Save Post'}
                    </DropdownMenuItem>
                  )}
                  {!isOwnPost && <DropdownMenuItem>Report Post</DropdownMenuItem>}
                  {isOwnPost && (
                    <DropdownMenuItem
                      onClick={handleDeletePost}
                      disabled={isDeleting}
                      className="text-red-600"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Post'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>Copy Link</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Post Content */}
            {post.caption && (
              <div>
                <p className="text-foreground text-lg leading-relaxed whitespace-pre-wrap">
                  {post.caption}
                </p>
              </div>
            )}

            {/* Location */}
            {post.location?.name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>📍</span>
                <span>{post.location.name}</span>
              </div>
            )}

            {/* Post Stats */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-xl">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{likeCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Likes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{post.comments_count || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Comments</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{post.shares_count || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Shares</p>
              </div>
            </div>

            {/* Interaction Buttons */}
            <div className="flex gap-3 p-4 bg-muted rounded-xl">
              <Button
                onClick={handleLike}
                disabled={isLiking}
                className={`flex-1 flex items-center justify-center gap-2 ${
                  liked
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-background hover:bg-muted text-foreground'
                } ${isLiking ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Heart size={18} fill={liked ? 'white' : 'none'} />
                {isLiking ? 'Loading...' : 'Like'}
              </Button>
              <Button className="flex-1 flex items-center justify-center gap-2 bg-background hover:bg-muted text-foreground">
                <MessageCircle size={18} />
                Comment
              </Button>
              <Button className="flex-1 flex items-center justify-center gap-2 bg-background hover:bg-muted text-foreground">
                <Share2 size={18} />
                Share
              </Button>
              <Button
                onClick={handleSavePost}
                disabled={isSaving}
                className={`flex-1 flex items-center justify-center gap-2 ${
                  savedPost
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                    : 'bg-background hover:bg-muted text-foreground'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Bookmark size={18} fill={savedPost ? 'currentColor' : 'none'} />
                {isSaving ? '' : savedPost ? 'Saved' : 'Save'}
              </Button>
            </div>

            {/* Comments Section */}
            <div className="border-t border-border pt-4">
              <h3 className="font-semibold text-foreground mb-4">Comments ({comments.length})</h3>

              <div className="space-y-4 mb-6">
                {comments.length > 0 ? (
                  comments.map((comment) => {
                    const commentAuthor = comment.user_id?.firstName
                      ? `${comment.user_id.firstName} ${comment.user_id.lastName || ''}`.trim()
                      : comment.user_id?.username || 'Unknown User';
                    const rawCommentAvatar =
                      comment.user_id?.profileImage || comment.user_id?.profilePicture;
                    const commentAvatar = rawCommentAvatar
                      ? getMediaUrl(rawCommentAvatar)
                      : commentAuthor?.charAt(0)?.toUpperCase() || '😊';

                    return (
                      <div key={comment._id || comment.id} className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                          {commentAvatar.startsWith('http') ||
                          commentAvatar.startsWith('/uploads') ? (
                            <img
                              src={commentAvatar}
                              alt={commentAuthor}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{commentAvatar}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="bg-muted rounded-lg p-3">
                            <p className="font-semibold text-sm text-foreground">{commentAuthor}</p>
                            <p className="text-sm text-foreground mt-1">
                              {comment.comment_text || comment.text}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 mt-2 px-1">
                            <span className="text-xs text-muted-foreground">
                              {formatCommentTime(comment.createdAt)}
                            </span>
                            <button
                              onClick={() => handleLikeComment(comment._id || comment.id)}
                              className="text-xs text-muted-foreground hover:text-primary transition font-medium flex items-center gap-1"
                            >
                              <Heart
                                size={12}
                                className={comment.isLiked ? 'fill-primary text-primary' : ''}
                              />
                              {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
                              <span>Like</span>
                            </button>
                            <CommentReactions
                              commentId={comment._id || comment.id}
                              onReact={(commentId, emoji) => {
                                // Add emoji reaction as a reply comment
                                commentService
                                  .replyToComment(commentId, { text: emoji })
                                  .then(() => {
                                    toasts.commentAdded();
                                    // Refresh comments
                                    postService.getPostDetails(post._id).then((response) => {
                                      if (response.success && response.data) {
                                        setComments(response.data.comments || []);
                                      }
                                    });
                                  })
                                  .catch((error) => {
                                    console.error('Error adding emoji reaction:', error);
                                  });
                              }}
                            />
                            <button
                              onClick={() => {
                                // TODO: Implement reply functionality
                              }}
                              className="text-xs text-muted-foreground hover:text-primary transition font-medium"
                            >
                              Reply
                            </button>
                            {comment.replies_count > 0 && (
                              <button
                                onClick={() => {
                                  // TODO: Implement view replies functionality
                                }}
                                className="text-xs text-primary hover:underline font-medium"
                              >
                                View {comment.replies_count}{' '}
                                {comment.replies_count === 1 ? 'reply' : 'replies'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No comments yet. Be the first to comment!
                  </p>
                )}
              </div>

              {/* Add Comment */}
              <div className="flex gap-2 pt-4 border-t border-border">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                  {(() => {
                    const user =
                      typeof window !== 'undefined'
                        ? JSON.parse(localStorage.getItem('user') || '{}')
                        : {};
                    const rawUserAvatar = user.profileImage || user.profilePicture;
                    const userAvatar = rawUserAvatar
                      ? getMediaUrl(rawUserAvatar)
                      : user.firstName?.charAt(0)?.toUpperCase() || '😊';
                    return userAvatar.startsWith('http') || userAvatar.startsWith('/uploads') ? (
                      <img src={userAvatar} alt="You" className="w-full h-full object-cover" />
                    ) : (
                      <span>{userAvatar}</span>
                    );
                  })()}
                </div>
                <div className="flex-1 flex gap-2 items-center">
                  <div className="flex-1 relative flex items-center">
                    <Input
                      placeholder="Write a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitComment();
                        }
                      }}
                      className="bg-muted border-0 rounded-full pr-10"
                      disabled={isSubmittingComment}
                    />
                    <div className="absolute right-1">
                      <EmojiPicker
                        onEmojiSelect={(emoji) => setNewComment((prev) => prev + emoji)}
                        triggerClassName="!p-1.5"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || isSubmittingComment}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6"
                  >
                    {isSubmittingComment ? 'Posting...' : 'Post'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
