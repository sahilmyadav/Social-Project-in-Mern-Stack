"use client"

import { useState, useEffect } from "react"
import { X, Search, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { followService, chatService } from "@/lib/api-services"
import UserAvatar from "@/components/user-avatar"

interface ShareModalProps {
    isOpen: boolean
    onClose: () => void
    contentType: "post" | "reel"
    contentId: string
    contentUrl?: string
}

interface User {
    _id: string
    firstName: string
    lastName?: string
    username: string
    profilePicture?: string
    avatar?: string
}

export default function ShareModal({
    isOpen,
    onClose,
    contentType,
    contentId,
    contentUrl,
}: ShareModalProps) {
    const [following, setFollowing] = useState<User[]>([])
    const [filteredUsers, setFilteredUsers] = useState<User[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [loading, setLoading] = useState(false)
    const [sharing, setSharing] = useState<string | null>(null)
    const [sharedUsers, setSharedUsers] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (isOpen) {
            loadFollowing()
            setSearchQuery("")
            setSharedUsers(new Set())
        }
    }, [isOpen])

    useEffect(() => {
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            const filtered = following.filter(
                (user) =>
                    user.firstName?.toLowerCase().includes(query) ||
                    user.lastName?.toLowerCase().includes(query) ||
                    user.username?.toLowerCase().includes(query)
            )
            setFilteredUsers(filtered)
        } else {
            setFilteredUsers(following)
        }
    }, [searchQuery, following])

    const loadFollowing = async () => {
        try {
            setLoading(true)
            const userData = localStorage.getItem("user")
            if (!userData) return

            const user = JSON.parse(userData)
            const response = await followService.getFollowing(user._id, { limit: 100 })

            if (response.success && response.data) {
                const users = response.data.following || response.data || []
                setFollowing(users)
                setFilteredUsers(users)
            }
        } catch (error) {
            console.error("Error loading following:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleShare = async (userId: string) => {
        if (sharing || sharedUsers.has(userId)) return

        setSharing(userId)
        try {
            // First, get or create thread with the user
            console.log('🔍 Getting thread for userId:', userId)
            const threadResponse = await chatService.getThread(userId)
            console.log('📥 Thread response:', threadResponse)

            // Try different possible response structures
            let threadId = null

            if (threadResponse.success && threadResponse.data?.thread?._id) {
                threadId = threadResponse.data.thread._id
            } else if (threadResponse.data?._id) {
                // Sometimes the thread is directly in data
                threadId = threadResponse.data._id
            } else if (threadResponse.thread?._id) {
                // Sometimes thread is at root level
                threadId = threadResponse.thread._id
            }

            console.log('🆔 Thread ID:', threadId)

            if (!threadId) {
                console.error('❌ Could not extract thread ID from response:', threadResponse)
                throw new Error('Failed to create conversation. Please try again.')
            }

            // Send rich message with shared content metadata
            console.log('📤 Sending message to thread:', threadId)
            const response = await chatService.sendMessage(threadId, {
                text: `Shared a ${contentType}`,
                messageType: contentType === 'post' ? 'shared_post' : 'shared_reel',
                sharedContent: {
                    contentId: contentId
                }
            })

            console.log('✅ Message response:', response)

            if (response.success) {
                setSharedUsers((prev) => new Set(prev).add(userId))
            }
        } catch (error: any) {
            console.error("❌ Error sharing:", error)
            alert(error.message || "Failed to share")
        } finally {
            setSharing(null)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-border"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-xl font-bold text-foreground">
                        Share {contentType}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-full transition"
                    >
                        <X size={20} className="text-muted-foreground" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-border">
                    <div className="relative">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            type="text"
                            placeholder="Search people..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Users List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">
                                {searchQuery
                                    ? "No users found"
                                    : "You're not following anyone yet"}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredUsers.map((user) => {
                                const isShared = sharedUsers.has(user._id)
                                const isSharing = sharing === user._id

                                return (
                                    <div
                                        key={user._id}
                                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <UserAvatar user={user} size="md" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground truncate">
                                                    {user.firstName} {user.lastName || ""}
                                                </p>
                                                <p className="text-sm text-muted-foreground truncate">
                                                    @{user.username}
                                                </p>
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleShare(user._id)
                                            }}
                                            disabled={isSharing || isShared}
                                            className="gap-2"
                                            variant={isShared ? "outline" : "default"}
                                        >
                                            {isSharing ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Sending...
                                                </>
                                            ) : isShared ? (
                                                <>
                                                    ✓ Sent
                                                </>
                                            ) : (
                                                <>
                                                    <Send size={14} />
                                                    Send
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                        Share this {contentType} with your followers via direct message
                    </p>
                </div>
            </div>
        </div>
    )
}
