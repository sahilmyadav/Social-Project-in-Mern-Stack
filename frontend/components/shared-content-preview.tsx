"use client"

import { useState } from "react"
import { Heart, MessageCircle, Play } from "lucide-react"
import UserAvatar from "@/components/user-avatar"
import PostDetailsModal from "@/components/post-details-modal"

interface SharedContentPreviewProps {
    messageType: "shared_post" | "shared_reel"
    contentData: {
        _id: string
        caption?: string
        media?: any
        user: {
            _id: string
            firstName: string
            lastName?: string
            username: string
            profilePicture?: string
            avatar?: string
        }
        likes_count?: number
        comments_count?: number
    }
}

export default function SharedContentPreview({
    messageType,
    contentData
}: SharedContentPreviewProps) {
    const [showModal, setShowModal] = useState(false)

    if (!contentData) {
        return (
            <div className="mt-2 p-3 border border-border rounded-lg bg-muted/50 text-muted-foreground text-sm">
                Content no longer available
            </div>
        )
    }

    const mediaUrl = contentData.media?.[0]?.url || contentData.media?.url
    const thumbnailUrl = contentData.media?.[0]?.thumbnail || mediaUrl
    const isVideo = contentData.media?.[0]?.type === 'video' || messageType === 'shared_reel'

    return (
        <>
            <div
                onClick={() => setShowModal(true)}
                className="mt-2 border border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary/50 transition max-w-sm"
            >
                {/* Preview Image/Video */}
                {mediaUrl && (
                    <div className="relative aspect-square bg-muted">
                        {isVideo ? (
                            <>
                                <video
                                    src={mediaUrl}
                                    poster={thumbnailUrl}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                                        <Play size={20} className="text-black ml-1" fill="black" />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <img
                                src={mediaUrl}
                                alt="Shared content"
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>
                )}

                {/* Content Info */}
                <div className="p-3 bg-card">
                    <div className="flex items-center gap-2 mb-2">
                        <UserAvatar user={contentData.user} size="sm" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                                {contentData.user.firstName} {contentData.user.lastName || ""}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                @{contentData.user.username}
                            </p>
                        </div>
                    </div>

                    {contentData.caption && (
                        <p className="text-sm text-foreground line-clamp-2 mb-2">
                            {contentData.caption}
                        </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Heart size={14} />
                            {contentData.likes_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                            <MessageCircle size={14} />
                            {contentData.comments_count || 0}
                        </span>
                    </div>

                    <div className="mt-2 text-xs text-primary font-medium">
                        Tap to view {messageType === 'shared_post' ? 'post' : 'reel'}
                    </div>
                </div>
            </div>

            {/* Full View Modal - Only for posts for now */}
            {showModal && messageType === 'shared_post' && (
                <PostDetailsModal
                    post={{
                        ...contentData,
                        user_id: contentData.user
                    }}
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                />
            )}

            {/* For reels, you can add a ReelDetailsModal later */}
            {showModal && messageType === 'shared_reel' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="relative max-w-md w-full">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300"
                        >
                            Close
                        </button>
                        <video
                            src={mediaUrl}
                            controls
                            autoPlay
                            className="w-full rounded-lg"
                        />
                    </div>
                </div>
            )}
        </>
    )
}
