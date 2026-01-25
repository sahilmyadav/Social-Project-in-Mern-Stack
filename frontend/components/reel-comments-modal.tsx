"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import UserAvatar from "@/components/user-avatar"
import { reelService } from "@/lib/api-services"
import { Heart, MessageCircle, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface Comment {
  _id: string
  user_id?: {
    _id: string
    firstName: string
    lastName: string
    profilePicture?: string
  }
  user?: {
    _id: string
    firstName: string
    lastName: string
    profilePicture?: string
  }
  text: string
  createdAt: string
  likes_count: number
  replies?: Comment[]
}

interface ReelCommentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reelId: string
  commentsCount: number
  currentUserId?: string
}

export default function ReelCommentsModal({
  open,
  onOpenChange,
  reelId,
  commentsCount,
  currentUserId
}: ReelCommentsModalProps) {
  const router = useRouter()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && reelId) {
      fetchComments()
    }
  }, [open, reelId])

  const fetchComments = async () => {
    setLoading(true)
    try {
      const response = await reelService.getReelComments(reelId)

      if (response.success) {
        setComments(response.data.comments || [])
      } else {
        console.error("API returned error:", response.message)
        setComments([])
      }
    } catch (error) {
      console.error("Error fetching comments:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      setComments([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitComment = async () => {
    if (!newComment.trim() || submitting) return

    setSubmitting(true)
    try {
      const response = await reelService.commentOnReel(reelId, { text: newComment.trim() })

      if (response.success) {
        setComments([response.data.comment, ...comments])
        setNewComment("")
      }
    } catch (error) {
      console.error("Error adding comment:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const getUserName = (user: any) => {
    if (!user) return 'Unknown User'
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Unknown User'
  }

  const getUserAvatar = (user: any) => {
    if (!user) return '?'
    const name = getUserName(user)
    return user.profilePicture || (name ? name.charAt(0).toUpperCase() : 'U')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle size={20} />
            Comments ({commentsCount})
          </DialogTitle>
        </DialogHeader>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No comments yet</p>
              <p className="text-sm text-muted-foreground">Be the first to comment!</p>
            </div>
          ) : (
            comments.map((comment) => {
              const user = comment.user_id || comment.user
              return (
                <div key={comment._id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  {user && <UserAvatar user={user} size="md" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {user && <span
                        className="font-semibold text-sm cursor-pointer hover:text-primary transition"
                        onClick={() => router.push(`/profile/${user._id}`)}
                      >
                        {user.firstName} {user.lastName}
                      </span>}
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground break-words">{comment.text}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
                        <Heart size={12} />
                        {comment.likes_count || 0}
                      </button>
                      <button className="text-xs text-muted-foreground hover:text-foreground transition">
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Comment Input */}
        <div className="border-t border-border pt-4 mt-4">
          <div className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1"
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
            />
            <Button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              size="sm"
              className="px-3"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
