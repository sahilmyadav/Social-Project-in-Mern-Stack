import { useState, useCallback, useEffect } from 'react'
import { commentService, postService } from '@/lib/api-services'
import { toast } from 'sonner'
import { Comment, Reply, User } from '@/types'

interface UseCommentsProps {
    postId: string
    onCommentCountChange?: (count: number) => void
}

export const useComments = ({ postId, onCommentCountChange }: UseCommentsProps) => {
    const [comments, setComments] = useState<Comment[]>([])
    const [repliesData, setRepliesData] = useState<Map<string, Reply[]>>(new Map())
    const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
    const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set())
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Helper to get complete user data
    const getCompleteUser = useCallback((partialUser: any): User => {
        const localUser = localStorage.getItem("user")
        const parsedLocalUser = localUser ? JSON.parse(localUser) : {}

        // If the partial user matches current user (by ID), merge with local data
        if (parsedLocalUser._id && (partialUser._id === parsedLocalUser._id || partialUser.id === parsedLocalUser._id)) {
            return {
                ...partialUser,
                _id: partialUser._id || partialUser.id || parsedLocalUser._id,
                firstName: partialUser.firstName || parsedLocalUser.firstName,
                lastName: partialUser.lastName || parsedLocalUser.lastName,
                username: partialUser.username || parsedLocalUser.username,
                profileImage: partialUser.profileImage || parsedLocalUser.profileImage || parsedLocalUser.profilePicture || parsedLocalUser.avatar,
                profilePicture: partialUser.profileImage || parsedLocalUser.profileImage || parsedLocalUser.profilePicture || parsedLocalUser.avatar,
                avatar: partialUser.profileImage || parsedLocalUser.profileImage || parsedLocalUser.profilePicture || parsedLocalUser.avatar
            }
        }
        return partialUser as User
    }, [])

    // Load comments for the post
    const loadComments = useCallback(async () => {
        try {
            setIsLoading(true)
            const response = await postService.getPostComments(postId, { limit: 20 })
            if (response.success && response.data) {
                // Determine structure based on API response
                // Some APIs return { comments: [...] } others might return array directly
                const commentsList = (response.data as any).comments || response.data || []
                setComments(commentsList)
            }
        } catch (error) {
            console.error('Error loading comments:', error)
            toast.error('Failed to load comments')
        } finally {
            setIsLoading(false)
        }
    }, [postId])

    // Add a new comment
    const addComment = useCallback(async (text: string) => {
        if (!text.trim() || isSubmitting) return false

        setIsSubmitting(true)
        try {
            const response = await postService.commentOnPost(postId, { text })

            if (response.success && response.data) {
                // Ensure the user object is complete (fix for missing profileImage)
                const responseData = response.data as any
                // Handle different response structures (sometimes data is the comment, sometimes data.comment)
                const commentData = responseData.comment || responseData

                const enrichedComment = {
                    ...commentData,
                    user_id: getCompleteUser(commentData.user_id)
                }

                setComments(prev => [enrichedComment, ...prev])
                if (onCommentCountChange) {
                    onCommentCountChange(comments.length + 1)
                }
                return true
            }
            return false
        } catch (error) {
            console.error('Error adding comment:', error)
            toast.error('Failed to post comment')
            return false
        } finally {
            setIsSubmitting(false)
        }
    }, [postId, isSubmitting, comments.length, onCommentCountChange, getCompleteUser])

    // Delete a comment or reply
    const deleteComment = useCallback(async (commentId: string) => {

        try {
            // Check if it's a main comment or a reply
            const isMainComment = comments.find(c => c._id === commentId)
            let parentCommentId: string | null = null


            // If it's a reply, find the parent comment
            if (!isMainComment) {
                for (const [parentId, replies] of repliesData.entries()) {
                    const reply = replies.find((r: Reply) => r._id === commentId)
                    if (reply) {
                        parentCommentId = parentId

                        break
                    }
                }
            }

            // Optimistically remove from UI
            if (isMainComment) {

                setComments(prev => prev.filter(c => c._id !== commentId))
                onCommentCountChange?.(comments.length - 1)
            } else if (parentCommentId) {

                // Remove reply from repliesData
                setRepliesData(prev => {
                    const newMap = new Map(prev)
                    const replies = newMap.get(parentCommentId!) || []
                    newMap.set(parentCommentId!, replies.filter((r: Reply) => r._id !== commentId))

                    return newMap
                })

                // Decrease the reply count on the parent comment
                setComments(prev => prev.map(c =>
                    c._id === parentCommentId
                        ? { ...c, replies_count: Math.max(0, (c.replies_count || 1) - 1) }
                        : c
                ))

                // Decrease the total comment count
                onCommentCountChange?.(comments.length - 1)
            }

            // Call the delete API
            await commentService.deleteComment(commentId)
            toast.success('Comment deleted')
            return true
        } catch (error) {
            console.error('Error deleting comment:', error)
            toast.error('Failed to delete comment')
            // Revert on error
            loadComments()
            return false
        }
    }, [comments, repliesData, onCommentCountChange, loadComments])

    // Like/unlike a comment or reply
    const toggleLikeComment = useCallback(async (commentId: string) => {
        try {
            // Check if it's a main comment or a reply
            let isCurrentlyLiked = false

            // First check main comments
            const comment = comments.find(c => c._id === commentId)
            if (comment) {
                isCurrentlyLiked = comment.isLiked || false
            } else {
                // Check if it's a reply in repliesData
                for (const [, replies] of repliesData.entries()) {
                    const reply = replies.find((r: Reply) => r._id === commentId)
                    if (reply) {
                        isCurrentlyLiked = reply.isLiked || reply.isLikedByCurrentUser || false
                        break
                    }
                }
            }

            // Optimistically update the UI for main comments
            setComments(prev => prev.map(c =>
                c._id === commentId
                    ? { ...c, isLiked: !c.isLiked, likes_count: c.isLiked ? (c.likes_count || 1) - 1 : (c.likes_count || 0) + 1 }
                    : c
            ))

            // Optimistically update the UI for replies
            setRepliesData(prev => {
                const newMap = new Map(prev)
                for (const [parentId, replies] of newMap.entries()) {
                    const updatedReplies = replies.map((r: Reply) => {
                        if (r._id === commentId) {
                            const currentLiked = r.isLiked || r.isLikedByCurrentUser || false
                            return {
                                ...r,
                                isLiked: !currentLiked,
                                isLikedByCurrentUser: !currentLiked,
                                likes_count: currentLiked ? Math.max(0, (r.likes_count || 1) - 1) : (r.likes_count || 0) + 1
                            } as Reply
                        }
                        return r
                    })
                    if (updatedReplies !== replies) {
                        newMap.set(parentId, updatedReplies)
                    }
                }
                return newMap
            })


            // Call the appropriate API
            if (isCurrentlyLiked) {
                const response = await commentService.unlikeComment(commentId)
                // If API fail or already unliked (400), we typically don't revert unless it's a real error
                // But if the server says "not liked", our optimistic update was actually correct (syncing with server)
                if (!response.success && response.message?.includes('not liked')) {
                    // It was already unliked on server, so our optimistic "unlike" matches server state. Do nothing.
                    return true
                } else if (!response.success) {
                    throw new Error(response.message || 'Failed to unlike')
                }
            } else {
                const response = await commentService.likeComment(commentId)
                if (!response.success && response.message?.includes('already liked')) {
                    // Already liked on server, optimistic "like" matches.
                    return true
                } else if (!response.success) {
                    throw new Error(response.message || 'Failed to like')
                }
            }
            return true
        } catch (error: any) {
            console.error('Error toggling like:', error)
            const errorMessage = error.message || 'Failed to update like'

            // If it's just a sync issue, we might not want to show an error, but let's be safe
            if (!errorMessage.includes('already liked') && !errorMessage.includes('not liked')) {
                toast.error(errorMessage)

                // Revert on real error
                loadComments()
                return false
            }
            return true
        }
    }, [comments, repliesData, loadComments])

    // Add a reply to a comment
    const addReply = useCallback(async (commentId: string, text: string) => {
        if (!text.trim() || isSubmitting) return false

        setIsSubmitting(true)
        try {
            const response = await commentService.replyToComment(commentId, { text })

            if (response.success) {
                // Increment the total comment count
                onCommentCountChange?.(comments.length + 1)

                // Update the parent comment's reply count
                setComments(prev => prev.map(c =>
                    c._id === commentId
                        ? { ...c, replies_count: (c.replies_count || 0) + 1 }
                        : c
                ))

                // Auto-expand the replies for this comment
                setExpandedReplies(prev => new Set(prev).add(commentId))

                // Reload replies for this specific comment to get the new one
                // The API might return the new reply, but getting the list is safer for consistent ordering
                await loadReplies(commentId)
                return true
            }
            return false
        } catch (error) {
            console.error('Error adding reply:', error)
            toast.error('Failed to post reply')
            return false
        } finally {
            setIsSubmitting(false)
        }
    }, [comments.length, isSubmitting, onCommentCountChange])

    // Load replies for a specific comment
    const loadReplies = async (commentId: string) => {
        setLoadingReplies(prev => new Set(prev).add(commentId))
        try {
            const response = await commentService.getCommentReplies(commentId, { limit: 20 })
            if (response.success && response.data) {
                const replies = (response.data as any).replies || response.data || []
                setRepliesData(prev => new Map(prev).set(commentId, replies))
            }
        } catch (error) {
            console.error('Error loading replies:', error)
            toast.error('Failed to load replies')
        } finally {
            setLoadingReplies(prev => {
                const newSet = new Set(prev)
                newSet.delete(commentId)
                return newSet
            })
        }
    }

    // Toggle replies visibility
    const toggleReplies = useCallback(async (commentId: string) => {
        if (expandedReplies.has(commentId)) {
            setExpandedReplies(prev => {
                const newSet = new Set(prev)
                newSet.delete(commentId)
                return newSet
            })
        } else {
            setExpandedReplies(prev => new Set(prev).add(commentId))
            if (!repliesData.has(commentId)) {
                await loadReplies(commentId)
            }
        }
    }, [expandedReplies, repliesData])

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
        toggleReplies
    }
}
