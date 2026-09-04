
import { User, Comment } from './comment'

export interface Media {
    url: string
    thumbnail?: string
    type: 'image' | 'video'
    width?: number
    height?: number
    duration?: number
}

export interface Location {
    name: string
    latitude?: number
    longitude?: number
    address?: string
}

export interface Post {
    _id: string
    id?: string
    caption?: string
    content?: string
    media?: Media[]
    user_id: User
    likes_count: number
    comments_count: number
    shares_count: number
    isLiked: boolean
    isSaved: boolean
    createdAt: string
    updatedAt?: string
    location?: Location
    comments?: Comment[] | number  // Can be array or count
    file_url?: string
    image?: string
    author?: string
    avatar?: string
    timestamp?: string
    shares?: number  // Legacy field
    type?: 'post'
}

export interface PostResponse {
    success: boolean
    data: Post
    message?: string
}

export interface PostsListResponse {
    success: boolean
    data: {
        posts: Post[]
        total: number
        page: number
        limit: number
        hasMore?: boolean
        cursor?: string
    }
    message?: string
}
