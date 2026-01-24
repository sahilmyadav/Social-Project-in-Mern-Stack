"use client"

import { useState, useEffect } from "react"
import { MessageCircle, X, Send, Heart, Trash2 } from "lucide-react"
import { reelService, commentService } from "@/lib/api-services"
import UserAvatar from "@/components/user-avatar"
import { useConfirmDialog, ConfirmDialog } from "@/components/ui/confirm-dialog"

interface ReelCommentsProps {
  reel: any
  currentUserId?: string
  isOpen: boolean
  onClose: () => void
}

export default function ReelComments({ reel, currentUserId, isOpen, onClose }: ReelCommentsProps) {
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Reply States
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null)
  const [replyText, setReplyText] = useState("")
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [repliesData, setRepliesData] = useState<Map<string, any[]>>(new Map())
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set())
  const [submittingReply, setSubmittingReply] = useState(false)

  const { confirm, dialogProps } = useConfirmDialog()

  /* Safe Comparison Helper */
  const isOwner = (id1: any, id2: any) => {
    if (!id1 || !id2) return false
    return String(id1) === String(id2)
  }

  const isReelOwner = currentUserId && (
    isOwner(reel?.user_id?._id, currentUserId) ||
    isOwner(reel?.user_id, currentUserId)
  )

  useEffect(() => {
    if (isOpen && reel?._id) {
      loadComments()
    }
  }, [isOpen, reel?._id])

  const loadComments = async () => {
    try {
      setLoading(true)
      const response = await reelService.getReelComments(reel._id, { limit: 50 })
      if (response.success && response.data) {
        setComments(response.data.comments || [])
      }
    } catch (error) {
      console.error("Error loading comments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || submitting) return

    try {
      setSubmitting(true)
      const response = await reelService.commentOnReel(reel._id, { text: newComment.trim() })

      if (response.success && response.data) {
        setComments(prev => [response.data.comment, ...prev])
        setNewComment("")
      }
    } catch (error) {
      console.error("Error posting comment:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReplyClick = (commentId: string, username: string) => {
    setReplyingTo({ commentId, username })
    setReplyText(`@${username} `)
  }

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !replyingTo || submittingReply) return

    setSubmittingReply(true)
    try {
      const response = await commentService.replyToComment(replyingTo.commentId, {
        text: replyText
      })

      if (response.success) {
        setReplyText("")
        const commentId = replyingTo.commentId
        setReplyingTo(null)

        // Update reply count for the main comment
        setComments(prev => prev.map(c =>
          c._id === commentId
            ? { ...c, replies_count: (c.replies_count || 0) + 1 }
            : c
        ))

        // Auto-expand replies and fetch new list
        setExpandedReplies(prev => new Set(prev).add(commentId))

        try {
          const repliesResponse = await commentService.getCommentReplies(commentId, { page: 1, limit: 20 })
          if (repliesResponse.success && repliesResponse.data?.replies) {
            setRepliesData(prev => new Map(prev).set(commentId, repliesResponse.data.replies))
          }
        } catch (error) {
          console.error("Error loading replies:", error)
        }
      }
    } catch (error) {
      console.error("Error posting reply:", error)
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleToggleReplies = async (commentId: string) => {
    const isExpanded = expandedReplies.has(commentId)

    if (isExpanded) {
      setExpandedReplies(prev => {
        const newSet = new Set(prev)
        newSet.delete(commentId)
        return newSet
      })
    } else {
      setExpandedReplies(prev => new Set(prev).add(commentId))

      if (!repliesData.has(commentId)) {
        setLoadingReplies(prev => new Set(prev).add(commentId))
        try {
          const response = await commentService.getCommentReplies(commentId, { page: 1, limit: 20 })
          if (response.success && response.data?.replies) {
            setRepliesData(prev => new Map(prev).set(commentId, response.data.replies))
          }
        } catch (error) {
          console.error("Error loading replies:", error)
        } finally {
          setLoadingReplies(prev => {
            const newSet = new Set(prev)
            newSet.delete(commentId)
            return newSet
          })
        }
      }
    }
  }

  const handleLikeComment = async (commentId: string) => {
    try {
      let isCurrentlyLiked = false

      // Check if main comment
      const comment = comments.find(c => c._id === commentId)
      if (comment) {
        isCurrentlyLiked = comment.isLiked || false
      } else {
        // Check replies
        for (const [parentId, replies] of repliesData.entries()) {
          const reply = replies.find((r: any) => r._id === commentId)
          if (reply) {
            isCurrentlyLiked = reply.isLiked || reply.isLikedByCurrentUser || false
            break
          }
        }
      }

      // Optimistic update for main comments
      setComments(prev => prev.map(c =>
        c._id === commentId
          ? { ...c, isLiked: !c.isLiked, likes_count: c.isLiked ? (c.likes_count || 1) - 1 : (c.likes_count || 0) + 1 }
          : c
      ))

      // Optimistic update for replies
      setRepliesData(prev => {
        const newMap = new Map(prev)
        for (const [parentId, replies] of newMap.entries()) {
          const updatedReplies = replies.map((r: any) =>
            r._id === commentId
              ? { ...r, isLiked: !r.isLiked, isLikedByCurrentUser: !r.isLikedByCurrentUser, likes_count: (r.isLiked || r.isLikedByCurrentUser) ? (r.likes_count || 1) - 1 : (r.likes_count || 0) + 1 }
              : r
          )
          if (updatedReplies !== replies) {
            newMap.set(parentId, updatedReplies)
          }
        }
        return newMap
      })

      if (isCurrentlyLiked) {
        await commentService.unlikeComment(commentId)
      } else {
        await commentService.likeComment(commentId)
      }
    } catch (error) {
      console.error("Error liking comment:", error)
      // We should technically revert here if error, but user can retry
    }
  }

  const handleDeleteComment = (commentId: string) => {
    confirm({
      title: "Delete Comment",
      message: "Are you sure you want to delete this comment? This action cannot be undone.",
      variant: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          const isMainComment = comments.find(c => c._id === commentId)
          let parentCommentId: string | null = null

          if (!isMainComment) {
            for (const [parentId, replies] of repliesData.entries()) {
              if (replies.find((r: any) => r._id === commentId)) {
                parentCommentId = parentId
                break
              }
            }
          }

          if (isMainComment) {
            setComments(prev => prev.filter(c => c._id !== commentId))
          } else if (parentCommentId) {
            setRepliesData(prev => {
              const newMap = new Map(prev)
              const replies = newMap.get(parentCommentId!) || []
              newMap.set(parentCommentId!, replies.filter((r: any) => r._id !== commentId))
              return newMap
            })

            // Update reply count UI on parent
            setComments(prev => prev.map(c =>
              c._id === parentCommentId
                ? { ...c, replies_count: Math.max(0, (c.replies_count || 1) - 1) }
                : c
            ))
          }

          await commentService.deleteComment(commentId)
        } catch (error) {
          console.error("Error deleting comment:", error)
          loadComments()
        }
      }
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <ConfirmDialog {...dialogProps} />
      <div className="bg-card rounded-2xl border border-border w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold text-lg">Comments</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment._id} className="space-y-2">
                  {/* Main Comment */}
                  <div className="flex gap-3">
                    <UserAvatar user={comment.user_id} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {comment.user_id?.firstName} {comment.user_id?.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground break-words">{comment.text}</p>
                      </div>

                      {/* Comment Actions */}
                      <div className="flex items-center gap-3 mt-1 px-2">
                        <button
                          onClick={() => handleLikeComment(comment._id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition"
                        >
                          <Heart size={12} className={comment.isLiked ? "fill-primary text-primary" : ""} />
                          <span>{comment.likes_count || 0}</span>
                        </button>
                        <button
                          onClick={() => handleReplyClick(comment._id, comment.user_id?.firstName || "User")}
                          className="text-xs text-muted-foreground hover:text-primary transition"
                        >
                          Reply
                        </button>
                        {(isOwner(comment.user_id?._id, currentUserId) || isReelOwner) && (
                          <button
                            onClick={() => handleDeleteComment(comment._id)}
                            className="text-xs text-muted-foreground hover:text-red-500 transition"
                          >
                            Delete
                          </button>
                        )}
                        {comment.replies_count > 0 && (
                          <button
                            onClick={() => handleToggleReplies(comment._id)}
                            className="text-xs text-primary hover:underline font-medium ml-2"
                          >
                            {expandedReplies.has(comment._id) ? "Hide" : "View"} {comment.replies_count} {comment.replies_count === 1 ? "reply" : "replies"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Nested Replies */}
                  {expandedReplies.has(comment._id) && (
                    <div className="ml-12 mt-2 space-y-3 pl-3 border-l-2 border-muted/50">
                      {loadingReplies.has(comment._id) ? (
                        <div className="py-2 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        </div>
                      ) : (repliesData.get(comment._id) || []).map((reply: any) => (
                        <div key={reply._id} className="flex gap-2">
                          <UserAvatar user={reply.user_id} size="sm" className="w-6 h-6 text-[10px]" />
                          <div className="flex-1 min-w-0">
                            <div className="bg-muted rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-xs">
                                  {reply.user_id?.firstName}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(reply.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-xs text-foreground break-words">{reply.text}</p>
                            </div>

                            <div className="flex items-center gap-3 mt-1 px-2">
                              <button
                                onClick={() => handleLikeComment(reply._id)}
                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition"
                              >
                                <Heart size={10} className={reply.isLiked || reply.isLikedByCurrentUser ? "fill-primary text-primary" : ""} />
                                <span>{reply.likes_count || 0}</span>
                              </button>
                              <button
                                onClick={() => handleReplyClick(comment._id, reply.user_id?.firstName || "User")}
                                className="text-[10px] text-muted-foreground hover:text-primary transition"
                              >
                                Reply
                              </button>
                              {(isOwner(reply.user_id?._id, currentUserId) || isReelOwner) && (
                                <button
                                  onClick={() => handleDeleteComment(reply._id)}
                                  className="text-[10px] text-muted-foreground hover:text-red-500 transition"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageCircle size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No comments yet</p>
              <p className="text-sm text-muted-foreground">Be the first to comment!</p>
            </div>
          )}
        </div>

        {/* Comment Input */}
        <div className="p-4 border-t border-border bg-card">
          {replyingTo && (
            <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-lg mb-2 text-xs">
              <span>Replying to <span className="font-bold text-primary">@{replyingTo.username}</span></span>
              <button
                onClick={() => { setReplyingTo(null); setReplyText(""); }}
                className="hover:bg-muted rounded-full p-1 transition"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <form onSubmit={replyingTo ? handleSubmitReply : handleSubmitComment} className="flex gap-2">
            <input
              type="text"
              value={replyingTo ? replyText : newComment}
              onChange={(e) => replyingTo ? setReplyText(e.target.value) : setNewComment(e.target.value)}
              placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
              className="flex-1 bg-muted rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={submitting || submittingReply}
            />
            <button
              type="submit"
              disabled={(replyingTo ? !replyText.trim() : !newComment.trim()) || submitting || submittingReply}
              className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
