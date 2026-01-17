"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Comment {
  id: number
  author: string
  avatar: string
  content: string
  likes: number
  timestamp: string
}

interface CommentsModalProps {
  isOpen: boolean
  onClose: () => void
  postAuthor: string
  initialComments: Comment[]
}

export default function CommentsModal({ isOpen, onClose, postAuthor, initialComments }: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [newComment, setNewComment] = useState("")
  const [likedComments, setLikedComments] = useState<number[]>([])

  const handleAddComment = () => {
    if (newComment.trim()) {
      const comment: Comment = {
        id: comments.length + 1,
        author: "You",
        avatar: "😊",
        content: newComment,
        likes: 0,
        timestamp: "now",
      }
      setComments([comment, ...comments])
      setNewComment("")
    }
  }

  const handleLikeComment = (commentId: number) => {
    if (likedComments.includes(commentId)) {
      setLikedComments(likedComments.filter((id) => id !== commentId))
    } else {
      setLikedComments([...likedComments, commentId])
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-96">
        <DialogHeader>
          <DialogTitle>Comments on {postAuthor}'s post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Comment */}
          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg">
              😊
            </div>
            <div className="flex-1 space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="w-full p-2 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground text-sm"
                rows={2}
              />
              <Button
                onClick={handleAddComment}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm"
              >
                Post
              </Button>
            </div>
          </div>

          {/* Comments List */}
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3 p-3 hover:bg-muted rounded-lg transition">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg">
                  {comment.avatar}
                </div>
                <div className="flex-1">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="font-semibold text-foreground text-sm">{comment.author}</p>
                    <p className="text-foreground text-sm mt-1">{comment.content}</p>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{comment.timestamp}</span>
                    <button
                      onClick={() => handleLikeComment(comment.id)}
                      className={`flex items-center gap-1 ${likedComments.includes(comment.id) ? "text-accent" : ""}`}
                    >
                      <Heart size={14} fill={likedComments.includes(comment.id) ? "currentColor" : "none"} />
                      {comment.likes}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
