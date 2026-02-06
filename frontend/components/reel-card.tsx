'use client';

import ReportReelModal from '@/components/report-reel-modal';
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
import { reelService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import { showToast } from '@/lib/toast';
import {
    Bookmark,
    Download,
    Eye,
    Heart,
    MessageCircle,
    MoreHorizontal,
    Play,
    Share2,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface ReelCardProps {
  reel: any;
  currentUserId?: string;
  onCommentClick?: () => void;
  onViewUpdate?: (reelId: string, viewCount: number) => void;
}

export default function ReelCard({
  reel,
  currentUserId,
  onCommentClick,
  onViewUpdate,
}: ReelCardProps) {
  const router = useRouter();
  const { isMuted: globalMuted, toggleMute: toggleGlobalMute } = useVideoSafe();
  // Backend may return is_liked (snake_case) or isLiked (camelCase)
  const [liked, setLiked] = useState(reel.isLiked || reel.is_liked || false);
  const [likeCount, setLikeCount] = useState(reel.likes_count || 0);
  const [saved, setSaved] = useState(reel.isSaved || reel.is_saved || false);
  const [viewCount, setViewCount] = useState(reel.views_count || 0);
  const [isViewed, setIsViewed] = useState(reel.isViewed || reel.is_viewed || false);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [userPaused, setUserPaused] = useState(false); // Track if user manually paused
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTrackedView = useRef(reel.isViewed || false);
  const { confirm, dialogProps } = useConfirmDialog();

  // Check if this is the user's own reel
  const isOwnReel = currentUserId && reel.user_id?._id === currentUserId;

  // Sync video muted state with global mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = globalMuted;
    }
  }, [globalMuted]);

  // Intersection Observer for auto-play/pause
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInView(entry.isIntersecting);
        });
      },
      {
        threshold: 0.5, // Trigger when 50% of the video is visible
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

  // Auto-play/pause based on visibility
  useEffect(() => {
    if (!videoRef.current) return;

    if (isInView && !userPaused) {
      // Auto-play when in view and user hasn't manually paused
      videoRef.current.play().catch((error) => {});
    } else {
      // Pause when out of view
      videoRef.current.pause();
    }
  }, [isInView, userPaused]);

  // Track reel view when in view
  useEffect(() => {
    if (!isInView || hasTrackedView.current || !reel._id) return;

    const trackView = async () => {
      try {
        hasTrackedView.current = true;
        setIsViewed(true);
        const response = await reelService.viewReel(reel._id);
        if (response.success && response.data) {
          setViewCount(response.data.views_count);
          // Notify parent of the view update
          onViewUpdate?.(reel._id, response.data.views_count);
        }
      } catch (error) {
        console.error('Error tracking reel view:', error);
        hasTrackedView.current = false; // Allow retry
        setIsViewed(false);
      }
    };

    // Small delay to avoid tracking if user is just scrolling through
    const timeoutId = setTimeout(trackView, 1500);
    return () => clearTimeout(timeoutId);
  }, [isInView, reel._id, onViewUpdate]);

  // If reel is hidden (reported), don't render it
  // IMPORTANT: This must come AFTER all hooks to follow React's Rules of Hooks
  if (isHidden) {
    return null;
  }

  const handleOpenProfile = () => {
    router.push(`/profile/${reel.user_id?.username || reel.user_id?._id}`);
  };

  const handleLike = async () => {
    if (isLiking) return;

    setIsLiking(true);
    const previousLiked = liked;
    const previousCount = likeCount;

    // Optimistic update
    setLiked(!liked);
    setLikeCount(liked ? Math.max(0, likeCount - 1) : likeCount + 1);

    try {
      const response = await reelService.toggleLikeReel(reel._id);
      if (response.success) {
        // Always use server response to sync state
        const serverIsLiked = response.data?.isLiked ?? !previousLiked;
        const serverLikeCount =
          response.data?.likes_count ??
          response.data?.likesCount ??
          (serverIsLiked ? previousCount + 1 : previousCount - 1);
        setLiked(serverIsLiked);
        setLikeCount(serverLikeCount);
      } else {
        throw new Error(response.message || 'Failed to toggle like');
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

  const handleSaveReel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving) return;

    setIsSaving(true);
    const previousSaved = saved;

    // Optimistic update
    setSaved(!saved);

    try {
      if (saved) {
        const response = await reelService.unsaveReel(reel._id);
        if (!response.success) {
          throw new Error(response.message || 'Failed to unsave reel');
        }
      } else {
        const response = await reelService.saveReel(reel._id);
        if (!response.success) {
          throw new Error(response.message || 'Failed to save reel');
        }
      }
    } catch (error: any) {
      console.error('Error saving/unsaving reel:', error.message || error);
      // Revert on error
      setSaved(previousSaved);
      showToast.error(error.message || 'Failed to save reel');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setUserPaused(true); // User manually paused
      } else {
        videoRef.current.play();
        setUserPaused(false); // User manually played
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteToggle = () => {
    toggleGlobalMute(); // Toggle global mute state - affects all videos
  };

  const handleDownloadReel = async () => {
    // Check if it's own reel - always allow download of own content
    const isOwnReel = currentUserId && reel.user_id?._id === currentUserId;

    if (isOwnReel) {
      // Allow downloading own reels
    } else {
      // For other users' reels, check if download is explicitly allowed
      // If allowDownloads is explicitly set to false, block download
      const allowDownloads = reel.user_id?.allowDownloads;
      const canDownload = reel.canDownload;

      // Block if either flag is explicitly false
      if (allowDownloads === false || canDownload === false) {
        showToast.error('Download not allowed', 'The creator has disabled downloads for this reel');
        return;
      }
    }

    if (!videoUrl) {
      showToast.error('No video', 'This reel has no video to download');
      return;
    }

    try {
      // Download the video file
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reel_${reel._id}.mp4`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast.success('Downloaded', 'Reel downloaded successfully');
    } catch (error) {
      console.error('Error downloading reel:', error);
      showToast.error('Download failed', 'Failed to download reel');
    }
  };

  const handleDeleteReel = () => {
    confirm({
      title: 'Delete Reel',
      message: 'Are you sure you want to delete this reel? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const response = await reelService.deleteReel(reel._id);
          if (response.success) {
            showToast.success('Deleted', 'Reel deleted successfully');
            setIsHidden(true); // Hide the reel immediately
          } else {
            throw new Error(response.message || 'Failed to delete reel');
          }
        } catch (error: any) {
          console.error('Error deleting reel:', error);
          showToast.error('Delete failed', error.message || 'Failed to delete reel');
        }
      },
    });
  };

  const authorName = reel.user_id?.firstName
    ? `${reel.user_id.firstName} ${reel.user_id.lastName || ''}`.trim()
    : reel.user_id?.username || 'Unknown User';

  const videoUrl = getMediaUrl(reel.media?.url);
  const thumbnailUrl = getMediaUrl(reel.media?.thumbnail || reel.media?.url);

  return (
    <div
      ref={containerRef}
      className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition w-full max-w-md mx-auto"
    >
      {/* User Header - Above Video */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div onClick={handleOpenProfile} className="cursor-pointer hover:opacity-80 transition">
            <UserAvatar
              user={{
                _id: reel.user_id?._id || 'unknown',
                firstName: reel.user_id?.firstName,
                lastName: reel.user_id?.lastName,
                fullName: reel.user_id?.fullName,
                username: reel.user_id?.username,
                profileImage: reel.user_id?.profileImage,
                profilePicture: reel.user_id?.profilePicture,
                avatar: reel.user_id?.avatar,
              }}
              size="sm"
              clickable={false}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-bold text-foreground truncate cursor-pointer hover:text-primary transition"
              onClick={handleOpenProfile}
            >
              {authorName}
            </h3>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Reel</p>
              {isViewed && (
                <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-medium">
                  Viewed
                </span>
              )}
              {reel.isSuggested && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  Suggested
                </span>
              )}
            </div>
          </div>

          {/* Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 hover:bg-muted rounded-full transition cursor-pointer ">
                <MoreHorizontal size={20} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!isOwnReel && (
                <DropdownMenuItem onClick={handleSaveReel} disabled={isSaving}>
                  <Bookmark size={16} className={`mr-2 ${saved ? 'fill-current' : ''}`} />
                  {saved ? 'Unsave Reel' : 'Save Reel'}
                </DropdownMenuItem>
              )}
              {!isOwnReel && videoUrl && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadReel();
                  }}
                >
                  <Download size={16} className="mr-2" />
                  {reel.canDownload === false || reel.user_id?.allowDownloads === false
                    ? 'Download Disabled'
                    : 'Download'}
                </DropdownMenuItem>
              )}
              {!isOwnReel && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsReportModalOpen(true);
                  }}
                >
                  <span className="mr-2">⚠️</span>
                  Report Reel
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setIsShareModalOpen(true);
                }}
              >
                <Share2 size={16} className="mr-2" />
                Share
              </DropdownMenuItem>
              {isOwnReel && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteReel();
                  }}
                  className="text-destructive"
                >
                  Delete Reel
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Video Player */}
      <div className="relative aspect-[3/4] bg-black">
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-cover"
              poster={thumbnailUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              controls={false}
              loop
              playsInline
              muted={globalMuted}
              preload="metadata"
            />

            {/* Play Button Overlay */}
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

            {/* Pause Button (when playing) */}
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
              onClick={(e) => {
                e.stopPropagation();
                handleMuteToggle();
              }}
            >
              {globalMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play size={48} className="text-white/50" />
          </div>
        )}

        {/* Duration Badge */}
        {reel.media?.duration && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {Math.floor(reel.media.duration / 60)}:
            {Math.floor(reel.media.duration % 60)
              .toString()
              .padStart(2, '0')}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Caption */}
        {reel.caption && (
          <p className="text-sm text-foreground mb-3 line-clamp-2">{reel.caption}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className={`flex items-center gap-1 transition ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground cursor-pointer'}`}
              onClick={(e) => {
                e.stopPropagation();
                handleLike();
              }}
              disabled={isLiking}
            >
              <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
              <span className="text-sm">{likeCount}</span>
            </button>

            <button
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onCommentClick?.();
              }}
            >
              <MessageCircle size={20} />
              <span className="text-sm">{reel.comments_count || 0}</span>
            </button>

            <button
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsShareModalOpen(true);
              }}
            >
              <Share2 size={20} />
              <span className="text-sm">{reel.shares_count || 0}</span>
            </button>
          </div>

          {/* View count */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Eye size={16} />
            <span className="text-sm">{viewCount}</span>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        contentType="reel"
        contentId={reel._id}
      />

      {/* Report Modal */}
      <ReportReelModal
        open={isReportModalOpen}
        onOpenChange={setIsReportModalOpen}
        reelId={reel._id}
        reelAuthor={authorName}
        onReported={() => setIsHidden(true)}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
