/**
 * User-related types used across the application.
 */

export interface UserSummary {
  _id: string;
  id?: string;
  firstName: string;
  lastName: string;
  username: string;
  profileImage?: string;
  profilePicture?: string;
  avatar?: string;
  isVerified?: boolean;
  allowDownloads?: boolean;
}

export interface UserProfile extends UserSummary {
  email?: string;
  phone?: string;
  bio?: string;
  coverPhoto?: string;
  gender?: string;
  dateOfBirth?: string;
  website?: string;
  isPrivate?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
  profileCompleted?: boolean;
  interests?: string[];
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  isFollowing?: boolean;
  isFollower?: boolean;
  isBlocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Authentication response from login/register. */
export interface AuthResponse {
  success: boolean;
  data: {
    user: UserProfile;
    accessToken: string;
    refreshToken: string;
  };
  message?: string;
}

export interface Notification {
  _id: string;
  recipient_id: string;
  sender_id: UserSummary;
  type:
    | 'like'
    | 'comment'
    | 'follow'
    | 'tag'
    | 'share'
    | 'mention'
    | 'reel_like'
    | 'reel_comment'
    | string;
  reference_id: string;
  reference_type: string;
  title: string;
  message: string;
  thumbnail?: string;
  is_read: boolean;
  action_url?: string;
  createdAt: string;
}

export interface ChatThread {
  _id: string;
  participant: UserSummary;
  lastMessage?: {
    text: string | null;
    media?: unknown[];
    createdAt: string;
    senderId: string;
    isDeleted: boolean;
  };
  lastMessageAt?: string;
  unreadCount: number;
  isArchived: boolean;
  isPinned: boolean;
  isBlocked: boolean;
  blockedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  threadId: string;
  senderId: string | UserSummary;
  text?: string;
  media?: {
    type: 'image' | 'video' | 'audio' | 'file';
    url: string;
    filename?: string;
    size?: number;
  }[];
  messageType: string;
  isDeleted: boolean;
  isEdited: boolean;
  replyTo?: ChatMessage;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore?: boolean;
  };
  message?: string;
}

export interface Story {
  _id: string;
  user_id: UserSummary;
  media: {
    url: string;
    type: 'image' | 'video';
    thumbnail?: string;
    duration?: number;
  };
  music?: {
    name: string;
    artist: string;
    url: string;
  };
  filter?: string;
  viewCount: number;
  views?: { user_id: string; viewedAt: string }[];
  expires_at: string;
  is_deleted: boolean;
  createdAt: string;
}
