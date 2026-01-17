"use client"

import { useState, useRef } from "react"
import { Heart, MessageCircle, Share2, Play, Volume2, VolumeX, MoreHorizontal, Bookmark } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { reelService } from "@/lib/api-services"
import ShareModal from "@/components/share-modal"
import ReportReelModal from "@/components/report-reel-modal"
import UserAvatar from "@/components/user-avatar"
import { useRouter } from "next/navigation"

interface ReelCardProps {
  reel: any
  currentUserId?: string
  onCommentClick?: () => void
}

export default function ReelCard({ reel, currentUserId, onCommentClick }: ReelCardProps) {
  const router = useRouter()
  const [liked, setLiked] = useState(reel.isLiked || false)
  const [likeCount, setLikeCount] = useState(reel.likes_count || 0)
  const [saved, setSaved] = useState(reel.isSaved || false)
  const [isLiking, setIsLiking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleOpenProfile = () => {
    router.push(`/profile/${reel.user_id?._id}`)
  }

  const handleLike = async () => {
    if (isLiking) return

    setIsLiking(true)
    const previousLiked = liked
    const previousCount = likeCount

    // Optimistic update
    setLiked(!liked)
    setLikeCount(liked ? likeCount - 1 : likeCount + 1)

    try {
      const response = await reelService.toggleLikeReel(reel._id)
      if (!response.success) {
        throw new Error(response.message || 'Failed to toggle like')
      }
    } catch (error: any) {
      console.error('Error toggling like:', error.message || error)
      // Revert on error
      setLiked(previousLiked)
      setLikeCount(previousCount)
    } finally {
      setIsLiking(false)
    }
  }

  const handleSaveReel = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSaving) return

    setIsSaving(true)
    const previousSaved = saved

    // Optimistic update
    setSaved(!saved)

    try {
      if (saved) {
        const response = await reelService.unsaveReel(reel._id)
        if (!response.success) {
          throw new Error(response.message || 'Failed to unsave reel')
        }
        console.log('Reel unsaved successfully')
      } else {
        const response = await reelService.saveReel(reel._id)
        if (!response.success) {
          throw new Error(response.message || 'Failed to save reel')
        }
        console.log('Reel saved successfully')
      }
    } catch (error: any) {
      console.error('Error saving/unsaving reel:', error.message || error)
      // Revert on error
      setSaved(previousSaved)
      alert(error.message || 'Failed to save reel')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const authorName = reel.user_id?.firstName
    ? `${reel.user_id.firstName} ${reel.user_id.lastName || ''}`.trim()
    : reel.user_id?.username || 'Unknown User'

  const videoUrl = reel.media?.url
  const thumbnailUrl = reel.media?.thumbnail || reel.media?.url

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition w-full max-w-md mx-auto">
      {/* User Header - Above Video */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            onClick={handleOpenProfile}
            className="cursor-pointer hover:opacity-80 transition"
          >
            <UserAvatar user={{
              _id: reel.user_id?._id || 'unknown',
              firstName: reel.user_id?.firstName,
              lastName: reel.user_id?.lastName,
              fullName: reel.user_id?.fullName,
              username: reel.user_id?.username,
              profileImage: reel.user_id?.profileImage,
              profilePicture: reel.user_id?.profilePicture,
              avatar: reel.user_id?.avatar
            }} size="sm" clickable={false} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-bold text-foreground truncate cursor-pointer hover:text-primary transition"
              onClick={handleOpenProfile}
            >
              {authorName}
            </h3>
            <p className="text-sm text-muted-foreground">Reel</p>
          </div>

          {/* Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 hover:bg-muted rounded-full transition">
                <MoreHorizontal size={20} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleSaveReel} disabled={isSaving}>
                <Bookmark size={16} className={`mr-2 ${saved ? 'fill-current' : ''}`} />
                {saved ? 'Unsave Reel' : 'Save Reel'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                setIsReportModalOpen(true)
              }}>
                <span className="mr-2">⚠️</span>
                Report Reel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Video Player */}
      <div className="relative aspect-[9/16] bg-black">
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
              muted={isMuted}
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
              className="absolute bottom-4 right-4 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition"
              onClick={(e) => {
                e.stopPropagation()
                handleMuteToggle()
              }}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
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
            {Math.floor(reel.media.duration / 60)}:{Math.floor(reel.media.duration % 60).toString().padStart(2, '0')}
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
              className={`flex items-center gap-1 transition ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={(e) => {
                e.stopPropagation()
                handleLike()
              }}
              disabled={isLiking}
            >
              <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
              <span className="text-sm">{likeCount}</span>
            </button>

            <button
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
              onClick={(e) => {
                e.stopPropagation()
                onCommentClick?.()
              }}
            >
              <MessageCircle size={20} />
              <span className="text-sm">{reel.comments_count || 0}</span>
            </button>

            <button
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
              onClick={(e) => {
                e.stopPropagation()
                setIsShareModalOpen(true)
              }}
            >
              <Share2 size={20} />
              <span className="text-sm">{reel.shares_count || 0}</span>
            </button>
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
      />
    </div>
  )
}
