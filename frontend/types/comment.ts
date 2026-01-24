export interface User {
    _id: string
    id?: string
    firstName: string
    lastName: string
    username: string
    email?: string
    profileImage?: string
    profilePicture?: string
    avatar?: string
    fullName?: string
}

export interface Reply {
    _id: string
    user_id: User
    post_id: string
    parent_comment_id: string
    text: string
    likes: string[] | number
    likes_count: number
    isLiked: boolean
    isLikedByCurrentUser?: boolean
    createdAt: string
    updatedAt: string
}

export interface Comment {
    _id: string
    user_id: User
    post_id: string
    text: string
    likes: string[] | number
    likes_count: number
    replies_count: number
    isLiked: boolean
    createdAt: string
    updatedAt: string
    replies?: Reply[]
}

export interface CommentResponse {
    success: boolean
    data: Comment
    message?: string
}

export interface CommentsListResponse {
    success: boolean
    data: {
        comments: Comment[]
        total: number
        page: number
        limit: number
        hasMore?: boolean
    }
    message?: string
}

export interface RepliesListResponse {
    success: boolean
    data: {
        replies: Reply[]
        total: number
        page: number
        limit: number
        hasMore?: boolean
    }
    message?: string
}
