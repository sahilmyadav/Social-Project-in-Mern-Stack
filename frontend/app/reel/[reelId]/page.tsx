'use client';

import Navigation from '@/components/navigation';
import ReportReelModal from '@/components/report-reel-modal';
import ShareModal from '@/components/share-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { reelService } from '@/lib/api-services';
import { showToast, toasts } from '@/lib/toast';
import {
  ArrowLeft,
  Bookmark,
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  MoreVertical,
  Pause,
  Play,
  Send,
  Share2,
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

  const [reel, setReel] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Video states
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reel states
  const [liked, setLiked] = useState(false);
  const [savedReel, setSavedReel] = useState(false);
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

  // Load reel details
  useEffect(() => {
    const fetchReel = async () => {
      if (!reelId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await reelService.getReelById(reelId);

        if (response.success && response.data) {
          setReel(response.data);
          setLikeCount(response.data.likes_count || response.data.likesCount || 0);
          setLiked(response.data.isLiked || false);
          setSavedReel(response.data.isSaved || false);

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
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Handle like
  const handleLike = async () => {
    if (isLiking || !reel) return;

    setIsLiking(true);
    const wasLiked = liked;

    // Optimistic update
    setLiked(!wasLiked);
    setLikeCount((prev) => (wasLiked ? prev - 1 : prev + 1));

    try {
      if (wasLiked) {
        await reelService.unlikeReel(reel._id);
      } else {
        await reelService.likeReel(reel._id);
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
  const handleDelete = async () => {
    if (isDeleting || !reel) return;

    if (!confirm('Are you sure you want to delete this reel?')) return;

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
  };

  // Handle comment submit
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment || !reel) return;

    setIsSubmittingComment(true);
    try {
      const response = await reelService.addReelComment(reel._id, newComment.trim());
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

  // Handle delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!reel) return;

    try {
      await reelService.deleteReelComment(reel._id, commentId);
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
  const author = reel?.author || reel?.user_id || reel?.user || {};
  const authorName = `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Unknown';
  const authorUsername = author.username || 'user';
  const authorAvatar = author.profileImage || author.profilePicture || author.avatar;
  const isOwner = user?._id === author._id;

  // Get video URL
  const videoUrl = reel?.videoUrl || reel?.video_url || reel?.media?.[0]?.url;

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
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              loop
              playsInline
              autoPlay
              muted={isMuted}
              onClick={togglePlayPause}
            />

            {/* Video Controls Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayPause}
                className="bg-black/50 hover:bg-black/70 text-white"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="bg-black/50 hover:bg-black/70 text-white"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
            </div>

            {/* Author Info Overlay */}
            <div className="absolute bottom-20 left-4 right-4">
              <Link href={`/profile/${author._id}`} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold overflow-hidden border-2 border-white">
                  {authorAvatar ? (
                    <img
                      src={authorAvatar}
                      alt={authorName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    authorName.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-semibold text-white text-shadow">{authorName}</p>
                  <p className="text-xs text-white/80">@{authorUsername}</p>
                </div>
              </Link>
              {reel.caption && (
                <p className="text-white text-sm mt-2 line-clamp-2">{reel.caption}</p>
              )}
            </div>

            {/* Side Actions */}
            <div className="absolute right-4 bottom-32 flex flex-col gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLike}
                disabled={isLiking}
                className="bg-black/50 hover:bg-black/70 text-white flex flex-col h-auto py-2"
              >
                <Heart className={`w-7 h-7 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
                <span className="text-xs mt-1">{likeCount}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => commentInputRef.current?.focus()}
                className="bg-black/50 hover:bg-black/70 text-white flex flex-col h-auto py-2"
              >
                <MessageCircle className="w-7 h-7" />
                <span className="text-xs mt-1">{comments.length}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowShareModal(true)}
                className="bg-black/50 hover:bg-black/70 text-white"
              >
                <Share2 className="w-7 h-7" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-black/50 hover:bg-black/70 text-white"
              >
                <Bookmark className={`w-7 h-7 ${savedReel ? 'fill-white' : ''}`} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-black/50 hover:bg-black/70 text-white"
                  >
                    <MoreVertical className="w-7 h-7" />
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
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-card rounded-xl border border-border p-4 flex flex-col max-h-[80vh]">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Comments ({comments.length})
            </h3>

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
                          <span className="text-xs text-muted-foreground ml-3">
                            {getTimeAgo(comment.createdAt)}
                          </span>
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
        contentType="reel"
        contentId={reel._id}
        title={reel.caption || 'Check out this reel'}
      />

      {/* Report Modal */}
      <ReportReelModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reelId={reel._id}
      />
    </div>
  );
}
