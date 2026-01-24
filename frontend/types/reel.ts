import { User } from './comment'
import { Media } from './post'

export interface Reel {
    _id: string
    id?: string
    caption?: string
    media?: Media
    user_id: User
    likes_count: number
    comments_count: number
    shares_count: number
    isLiked: boolean
    isSaved: boolean
    createdAt: string
    updatedAt?: string
    type?: 'reel' // To distinguish in mixed feeds
}

export interface ReelResponse {
    success: boolean
    data: Reel
    message?: string
}

export interface ReelsListResponse {
    success: boolean
    data: {
        reels: Reel[]
        total: number
        page: number
        limit: number
        hasMore?: boolean
    }
    message?: string
}
