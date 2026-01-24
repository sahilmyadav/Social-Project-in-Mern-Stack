// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1',
  SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000',
  TIMEOUT: 30000, // 30 seconds
};

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    REGISTER: '/users/register',
    VERIFY_REGISTER: '/users/verify-register',
    RESEND_OTP: '/users/resend-otp',
    LOGIN: '/users/login',
    VERIFY_LOGIN: '/users/verify-login',
    LOGOUT: '/users/logout',
    REFRESH_TOKEN: '/users/refresh-token',
    FORGOT_PASSWORD: '/users/forgot-password',
    RESET_PASSWORD: '/users/reset-password',
    CHANGE_PASSWORD: '/users/change-password',
    CURRENT_USER: '/users/current-user',
    UPDATE_PROFILE: '/users/update-profile',
    GET_USER_PROFILE: (userId: string) => `/users/profile/${userId}`,
    UPDATE_PROFILE_PICTURE: '/users/update-profile-picture',
    UPDATE_COVER_PHOTO: '/users/update-cover-photo',
    BLOCK_USER: (userId: string) => `/users/block/${userId}`,
    UNBLOCK_USER: (userId: string) => `/users/unblock/${userId}`,
    GET_BLOCKED_USERS: '/users/blocked-list',
    CHECK_USERNAME: '/users/check-username',
    COMPLETE_PROFILE: '/users/complete-profile',
  },

  // Posts
  POSTS: {
    CREATE: '/post/upload',
    DELETE: (postId: string) => `/post/delete/${postId}`,
    GET_DETAILS: (postId: string) => `/post/details/${postId}`,
    LIKE: (postId: string) => `/post/like/${postId}`,
    UNLIKE: (postId: string) => `/post/unlike/${postId}`,
    COMMENT: (postId: string) => `/post/comment/${postId}`,
    GET_COMMENTS: (postId: string) => `/post/comments/${postId}`,
    SAVE: (postId: string) => `/post/save/${postId}`,
    UNSAVE: (postId: string) => `/post/unsave/${postId}`,
    SHARE: (postId: string) => `/post/share/${postId}`,
    GET_SAVED_POSTS: '/post/save/user-saved-posts',
    REPORT: (postId: string) => `/post/report/${postId}`,
    EXPLORE: '/post/explore',

    TOTAL_COUNT: '/post/totalPostCount', // todo update this into total followers and total following
  },

  // Comments
  COMMENTS: {
    LIKE: (commentId: string) => `/comment/like/${commentId}`,
    UNLIKE: (commentId: string) => `/comment/unlike/${commentId}`,
    REPLY: (commentId: string) => `/comment/reply/${commentId}`,
    GET_REPLIES: (commentId: string) => `/comment/replies/${commentId}`,
    EDIT: (commentId: string) => `/comment/edit/${commentId}`,
    DELETE: (commentId: string) => `/comment/delete/${commentId}`,
  },

  // Reels
  REELS: {
    UPLOAD: '/reel/upload',
    DELETE: (reelId: string) => `/reel/delete/${reelId}`,
    GET_DETAILS: (reelId: string) => `/reel/details/${reelId}`,
    TOGGLE_LIKE: (reelId: string) => `/reel/toggle-like/${reelId}`,
    COMMENT: (reelId: string) => `/reel/comment/${reelId}`,
    COMMENTS: (reelId: string) => `/reel/comments/${reelId}`,
    GET_USER_REELS: (userId: string) => `/reel/user/${userId}`,
    GET_FEED: '/feed/reels',
    SAVE: (reelId: string) => `/reel/save/${reelId}`,
    UNSAVE: (reelId: string) => `/reel/unsave/${reelId}`,
    GET_SAVED: '/reel/saved',
    REPORT: (reelId: string) => `/reel/report/${reelId}`,
  },

  // Stories
  STORIES: {
    UPLOAD: '/story/upload',
    DELETE: (storyId: string) => `/story/delete/${storyId}`,
    GET_USER_STORIES: (userId: string) => `/story/user/${userId}`,
    GET_ALL_STORIES: '/story/get-all-stories',
    CLEANUP: '/story/cleanup',
    VIEW_STORY: (storyId: string) => `/story/view/${storyId}`,
    GET_VIEWERS: (storyId: string) => `/story/viewers/${storyId}`,
  },

  // Feed
  FEED: {
    HOME: '/feed/home',
    REELS: '/feed/reels',
    STORIES: '/feed/stories',
    USER_POSTS: (userId: string) => `/feed/posts/${userId}`,
  },

  // Follow
  FOLLOW: {
    FOLLOW_USER: (userId: string) => `/follow/request/${userId}`,
    UNFOLLOW_USER: (userId: string) => `/follow/unfollow/${userId}`,
    SEND_REQUEST: (userId: string) => `/follow/request/${userId}`,
    ACCEPT_REQUEST: (requestId: string) => `/follow/accept/${requestId}`,
    REJECT_REQUEST: (requestId: string) => `/follow/reject/${requestId}`,
    CANCEL_REQUEST: (userId: string) => `/follow/cancel/${userId}`,
    GET_PENDING_REQUESTS: '/follow/pending-requests',
    GET_SENT_REQUESTS: '/follow/sent-requests',
    GET_FOLLOWERS: (userId: string) => `/follow/followers/${userId}`,
    GET_FOLLOWING: (userId: string) => `/follow/following/${userId}`,
    GET_SUGGESTIONS: '/follow/suggestions',
  },

  // Chat
  CHAT: {
    GET_THREAD: (userId: string) => `/chat/thread/${userId}`,
    SEND_MESSAGE: (threadId: string) => `/chat/message/send/${threadId}`,
    GET_THREADS: '/chat/threads',
    GET_MESSAGES: (threadId: string) => `/chat/messages/${threadId}`,
    MARK_SEEN: (threadId: string) => `/chat/messages/seen/${threadId}`,
    DELETE_MESSAGE: (messageId: string) => `/chat/message/delete/${messageId}`,
    EDIT_MESSAGE: (messageId: string) => `/chat/message/edit/${messageId}`,
    DELETE_THREAD: (threadId: string) => `/chat/thread/delete/${threadId}`,
    UPLOAD_MEDIA: '/chat/media/upload',

    // Group Chat Endpoints
    CREATE_GROUP: '/chat/group/create',
    GET_GROUP_DETAILS: (groupId: string) => `/chat/group/${groupId}`,
    UPDATE_GROUP: (groupId: string) => `/chat/group/${groupId}/update`,
    ADD_MEMBERS: (groupId: string) => `/chat/group/${groupId}/members/add`,
    REMOVE_MEMBER: (groupId: string) => `/chat/group/${groupId}/members/remove`,
    LEAVE_GROUP: (groupId: string) => `/chat/group/${groupId}/leave`,
    MAKE_ADMIN: (groupId: string) => `/chat/group/${groupId}/make-admin`,
    UPDATE_GROUP_AVATAR: (groupId: string) => `/chat/group/${groupId}/avatar`,
  },

  // Notifications
  NOTIFICATIONS: {
    GET_ALL: '/notifications/list',
    MARK_READ: (notificationId: string) => `/notifications/read/${notificationId}`,
    MARK_ALL_READ: '/notifications/read-all',
    GET_UNREAD_COUNT: '/notifications/unread-count',
    GET_SETTINGS: '/notifications/settings',
    UPDATE_SETTINGS: '/notifications/settings/update',
  },

  // Search
  SEARCH: {
    GLOBAL: '/search/global',
    USERS: '/search/users',
    PAGES: '/search/pages',
    HASHTAGS: '/search/hashtags',
    TRENDING: '/search/trending',
    HISTORY: '/search/history',
    CLEAR_HISTORY: '/search/history',
  },

  // Admin
  ADMIN: {
    LOGIN: '/admin/login',
    DASHBOARD: '/admin/dashboard',
    USERS: '/admin/users',
    VERIFY_USER: (userId: string) => `/admin/user/verify/${userId}`,
    BAN_USER: (userId: string) => `/admin/user/ban/${userId}`,
    DELETE_USER: (userId: string) => `/admin/user/delete/${userId}`,
    CONTENT: '/admin/content',
    REMOVE_CONTENT: (contentId: string) => `/admin/content/remove/${contentId}`,
    REPORTS: '/admin/reports',
    RESOLVE_REPORT: (reportId: string) => `/admin/reports/resolve/${reportId}`,
    SEND_NOTIFICATION: '/admin/notification/send-global',
    ANALYTICS: '/admin/analytics',
  },

  // Live Streaming
  LIVE: {
    CREATE: '/live/create',
    START: (streamId: string) => `/live/start/${streamId}`,
    END: (streamId: string) => `/live/end/${streamId}`,
    GET_DETAILS: (streamId: string) => `/live/details/${streamId}`,
    GET_ACTIVE: '/live/active',
    GET_ALL: '/live/all',
    GET_USER_STREAMS: (userId: string) => `/live/user/${userId}`,
    JOIN: (streamId: string) => `/live/join/${streamId}`,
    LEAVE: (streamId: string) => `/live/leave/${streamId}`,
    GET_VIEWERS: (streamId: string) => `/live/viewers/${streamId}`,
    SEND_COMMENT: (streamId: string) => `/live/comment/${streamId}`,
    GET_COMMENTS: (streamId: string) => `/live/comments/${streamId}`,
    DELETE: (streamId: string) => `/live/delete/${streamId}`,
  },

  // System
  SYSTEM: {
    APP_UPDATE: '/system/app-update',
    SERVER_HEALTH: '/system/server-health',
    MAINTENANCE_STATUS: '/system/maintenance-status',
  },
};
