import { api, getToken, removeToken, setRefreshToken, setToken } from './api-client';
import { API_CONFIG, API_ENDPOINTS } from './api-config';

// Auth Service
export const authService = {
  // Register
  register: async (data: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    password: string;
    gender?: string;
    dob?: string;
  }) => {
    return api.post(API_ENDPOINTS.AUTH.REGISTER, data);
  },

  // Verify Registration OTP
  verifyRegisterOtp: async (data: {
    email?: string;
    phone?: string;
    userId: string;
    otp: string;
  }) => {
    // Backend expects 'identifier' field (email or phone)
    const payload = {
      identifier: data.email || data.phone,
      otp: data.otp,
    };

    const response = await api.post(API_ENDPOINTS.AUTH.VERIFY_REGISTER, payload);

    if (response.success && response.data) {
      setToken(response.data.accessToken);
      setRefreshToken(response.data.refreshToken);
    }

    return response;
  },

  // Resend OTP
  resendOtp: async (data: { email?: string; phone?: string }) => {
    // Backend expects email or phone field directly
    const payload: any = {};
    if (data.email) {
      payload.email = data.email;
    }
    if (data.phone) {
      payload.phone = data.phone;
    }
    return api.post(API_ENDPOINTS.AUTH.RESEND_OTP, payload);
  },

  // Login
  login: async (data: { email?: string; phone?: string; password: string }) => {
    const payload: any = {
      password: data.password,
    };

    // Backend expects email or phone field directly
    if (data.email) {
      payload.email = data.email;
    }
    if (data.phone) {
      payload.phone = data.phone;
    }

    const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, payload);

    if (response.success && response.data) {
      setToken(response.data.accessToken);
      setRefreshToken(response.data.refreshToken);
    }

    return response;
  },

  // Verify Login OTP
  verifyLogin: async (data: { email?: string; phone?: string; userId: string; otp: string }) => {
    // Backend expects 'identifier' field (email or phone)
    const payload = {
      identifier: data.email || data.phone,
      otp: data.otp,
    };

    const response = await api.post(API_ENDPOINTS.AUTH.VERIFY_LOGIN, payload);

    if (response.success && response.data) {
      setToken(response.data.accessToken);
      setRefreshToken(response.data.refreshToken);
    }

    return response;
  },

  // Logout
  logout: async () => {
    const response = await api.post(API_ENDPOINTS.AUTH.LOGOUT);
    removeToken();
    return response;
  },

  // Get Current User
  getCurrentUser: async () => {
    return api.get(API_ENDPOINTS.AUTH.CURRENT_USER);
  },

  // Get User Profile by ID
  getUserProfile: async (userId: string) => {
    return api.get(API_ENDPOINTS.AUTH.GET_USER_PROFILE(userId));
  },

  // Update Profile Picture
  updateProfilePicture: async (formData: FormData) => {
    const token = getToken();
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_ENDPOINTS.AUTH.UPDATE_PROFILE_PICTURE}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type for FormData - browser will set it automatically
        },
        body: formData,
        credentials: 'include',
      }
    );

    return response.json();
  },

  // Update Cover Photo
  updateCoverPhoto: async (formData: FormData) => {
    const token = getToken();
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.AUTH.UPDATE_COVER_PHOTO}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      credentials: 'include',
    });

    const data = await response.json();

    // Normalize response to match ApiResponse interface if needed
    if (!response.ok) {
      throw {
        message: data.message || 'Failed to update cover photo',
        success: false,
        data: null,
      };
    }

    // If backend returns the raw user object or data wrapped in data
    return data;
  },

  // Update Profile
  updateProfile: async (data: {
    firstName?: string;
    lastName?: string;
    username?: string;
    bio?: string;
    profile_type?: string;
    coverPhoto?: string;
    dateOfBirth?: string;
  }) => {
    return api.put(API_ENDPOINTS.AUTH.UPDATE_PROFILE, data);
  },

  // Forgot Password
  forgotPassword: async (data: { email?: string; phone?: string }) => {
    // Backend may expect 'identifier' field (email or phone)
    const payload = {
      identifier: data.email || data.phone,
    };
    return api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, payload);
  },

  // Reset Password
  resetPassword: async (token: string, newPassword: string) => {
    return api.post(`${API_ENDPOINTS.AUTH.RESET_PASSWORD}?token=${token}`, { newPassword });
  },

  // Change Password
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    return api.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, data);
  },

  // Update Privacy Settings
  updatePrivacySettings: async (data: {
    profile_type?: 'private' | 'public';
    allowDownloads?: boolean;
  }) => {
    return api.put(API_ENDPOINTS.AUTH.UPDATE_PROFILE, data);
  },

  // Block User
  blockUser: async (userId: string) => {
    return api.post(API_ENDPOINTS.AUTH.BLOCK_USER(userId));
  },

  // Unblock User
  unblockUser: async (userId: string) => {
    return api.post(API_ENDPOINTS.AUTH.UNBLOCK_USER(userId));
  },

  // Get Blocked Users List
  getBlockedUsers: async () => {
    return api.get(API_ENDPOINTS.AUTH.GET_BLOCKED_USERS);
  },

  // Check Username Availability
  checkUsername: async (username: string) => {
    return api.get(API_ENDPOINTS.AUTH.CHECK_USERNAME, { username });
  },

  // Complete Profile Setup
  completeProfile: async (data: {
    username: string;
    bio?: string;
    profilePicture?: File;
    coverPhoto?: File;
    interests?: string[];
  }) => {
    const formData = new FormData();
    formData.append('username', data.username);
    if (data.bio) formData.append('bio', data.bio);
    if (data.profilePicture) formData.append('profilePicture', data.profilePicture);
    if (data.coverPhoto) formData.append('coverPhoto', data.coverPhoto);
    if (data.interests && data.interests.length > 0) {
      formData.append('interests', JSON.stringify(data.interests));
    }

    return api.upload(API_ENDPOINTS.AUTH.COMPLETE_PROFILE, formData);
  },

  // Request Email Change (sends OTP to both email and phone)
  requestEmailChange: async (data: { newEmail: string }) => {
    return api.post(API_ENDPOINTS.AUTH.REQUEST_EMAIL_CHANGE, data);
  },

  // Verify Email Change OTP
  verifyEmailChange: async (data: { newEmail: string; otp: string }) => {
    return api.post(API_ENDPOINTS.AUTH.VERIFY_EMAIL_CHANGE, data);
  },

  // Request Phone Change (sends OTP to both email and phone)
  requestPhoneChange: async (data: { newPhone: string }) => {
    return api.post(API_ENDPOINTS.AUTH.REQUEST_PHONE_CHANGE, data);
  },

  // Verify Phone Change OTP
  verifyPhoneChange: async (data: { newPhone: string; otp: string }) => {
    return api.post(API_ENDPOINTS.AUTH.VERIFY_PHONE_CHANGE, data);
  },
};

// Post Service
export const postService = {
  // Create Post
  createPost: async (formData: FormData) => {
    return api.upload(API_ENDPOINTS.POSTS.CREATE, formData);
  },

  // Delete Post
  deletePost: async (postId: string) => {
    return api.delete(API_ENDPOINTS.POSTS.DELETE(postId));
  },

  // Get Post Details
  getPostDetails: async (postId: string) => {
    return api.get(API_ENDPOINTS.POSTS.GET_DETAILS(postId));
  },

  // Like Post
  likePost: async (postId: string) => {
    return api.post(API_ENDPOINTS.POSTS.LIKE(postId));
  },

  // Unlike Post
  unlikePost: async (postId: string) => {
    return api.delete(API_ENDPOINTS.POSTS.UNLIKE(postId));
  },

  // Comment on Post
  commentOnPost: async (postId: string, data: { text: string; reply_to_comment_id?: string }) => {
    return api.post(API_ENDPOINTS.POSTS.COMMENT(postId), data);
  },

  // Get Post Comments
  getPostComments: async (postId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.POSTS.GET_COMMENTS(postId), params);
  },

  // Save Post
  savePost: async (postId: string) => {
    return api.post(API_ENDPOINTS.POSTS.SAVE(postId));
  },

  // Unsave Post
  unsavePost: async (postId: string) => {
    return api.delete(API_ENDPOINTS.POSTS.UNSAVE(postId));
  },

  // Get Saved Posts
  getSavedPosts: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.POSTS.GET_SAVED_POSTS, params);
  },

  // Share Post
  sharePost: async (postId: string, data?: { target?: string; caption?: string }) => {
    return api.post(API_ENDPOINTS.POSTS.SHARE(postId), data || {});
  },

  // Get Total Post Count
  getTotalPostCount: async () => {
    return api.get(API_ENDPOINTS.POSTS.TOTAL_COUNT);
  },

  // Report Post
  reportPost: async (postId: string, data: { reason: string; additionalInfo?: string }) => {
    return api.post(API_ENDPOINTS.POSTS.REPORT(postId), data);
  },

  // Get Explore Posts
  getExplorePosts: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.POSTS.EXPLORE, params);
  },
};

// Comment Service
export const commentService = {
  // Like Comment
  likeComment: async (commentId: string) => {
    return api.post(API_ENDPOINTS.COMMENTS.LIKE(commentId));
  },

  // Unlike Comment
  unlikeComment: async (commentId: string) => {
    return api.delete(API_ENDPOINTS.COMMENTS.UNLIKE(commentId));
  },

  // Reply to Comment
  replyToComment: async (commentId: string, data: { text: string }) => {
    return api.post(API_ENDPOINTS.COMMENTS.REPLY(commentId), data);
  },

  // Get Comment Replies
  getCommentReplies: async (commentId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.COMMENTS.GET_REPLIES(commentId), params);
  },

  // Edit Comment
  editComment: async (commentId: string, data: { text: string }) => {
    return api.put(API_ENDPOINTS.COMMENTS.EDIT(commentId), data);
  },

  // Delete Comment
  deleteComment: async (commentId: string) => {
    return api.delete(API_ENDPOINTS.COMMENTS.DELETE(commentId));
  },
};

// Reel Service
export const reelService = {
  // Upload Reel
  uploadReel: async (formData: FormData) => {
    return api.upload(API_ENDPOINTS.REELS.UPLOAD, formData);
  },

  // Get Reels Feed
  getReelsFeed: async (params?: { limit?: number; page?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.page) queryParams.append('page', params.page.toString());
    const queryString = queryParams.toString();
    return api.get(`${API_ENDPOINTS.REELS.GET_FEED}${queryString ? `?${queryString}` : ''}`);
  },

  // Delete Reel
  deleteReel: async (reelId: string) => {
    return api.delete(API_ENDPOINTS.REELS.DELETE(reelId));
  },

  // Get Reel Details
  getReelDetails: async (reelId: string) => {
    return api.get(API_ENDPOINTS.REELS.GET_DETAILS(reelId));
  },

  // Toggle Like/Unlike Reel
  toggleLikeReel: async (reelId: string) => {
    return api.post(API_ENDPOINTS.REELS.TOGGLE_LIKE(reelId));
  },

  // Comment on Reel
  commentOnReel: async (reelId: string, data: { text: string; reply_to_comment_id?: string }) => {
    return api.post(API_ENDPOINTS.REELS.COMMENT(reelId), data);
  },

  // Get Reel Comments
  getReelComments: async (reelId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.REELS.COMMENTS(reelId), params);
  },

  // Get User Reels
  getUserReels: async (userId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.REELS.GET_USER_REELS(userId), params);
  },

  // Save Reel
  saveReel: async (reelId: string) => {
    return api.post(API_ENDPOINTS.REELS.SAVE(reelId));
  },

  // Unsave Reel (DELETE method to match backend)
  unsaveReel: async (reelId: string) => {
    return api.delete(API_ENDPOINTS.REELS.UNSAVE(reelId));
  },

  // Get Saved Reels
  getSavedReels: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.REELS.GET_SAVED, params);
  },

  // Report Reel
  reportReel: async (reelId: string, data: { reason: string; additionalInfo?: string }) => {
    return api.post(API_ENDPOINTS.REELS.REPORT(reelId), data);
  },

  // View Reel (track view)
  viewReel: async (reelId: string) => {
    return api.post(API_ENDPOINTS.REELS.VIEW(reelId));
  },
};

// Story Service
export const storyService = {
  // Upload Story
  uploadStory: async (formData: FormData) => {
    return api.upload(API_ENDPOINTS.STORIES.UPLOAD, formData);
  },

  // Delete Story
  deleteStory: async (storyId: string) => {
    return api.delete(API_ENDPOINTS.STORIES.DELETE(storyId));
  },

  // Get User Stories
  getUserStories: async (userId: string) => {
    // Add timestamp to prevent caching
    return api.get(API_ENDPOINTS.STORIES.GET_USER_STORIES(userId), { _t: Date.now() });
  },

  // Get All Stories (Feed)
  getAllStories: async (params?: { page?: number; limit?: number }) => {
    // Add timestamp to prevent caching
    return api.get(API_ENDPOINTS.STORIES.GET_ALL_STORIES, { ...params, _t: Date.now() });
  },

  // Cleanup Expired Stories
  cleanupExpiredStories: async () => {
    return api.post(API_ENDPOINTS.STORIES.CLEANUP);
  },

  // View Story (track view)
  viewStory: async (storyId: string) => {
    return api.post(API_ENDPOINTS.STORIES.VIEW_STORY(storyId));
  },

  // Get Story Viewers
  getStoryViewers: async (storyId: string) => {
    return api.get(API_ENDPOINTS.STORIES.GET_VIEWERS(storyId));
  },
};

// Feed Service
export const feedService = {
  // Get Home Feed
  getHomeFeed: async (params?: { cursor?: string; limit?: number; filter?: string }) => {
    return api.get(API_ENDPOINTS.FEED.HOME, params);
  },

  // Get Reels Feed
  getReelsFeed: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FEED.REELS, params);
  },

  // Get Stories Feed
  getStoriesFeed: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FEED.STORIES, params);
  },

  // Get User Posts
  getUserPosts: async (userId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FEED.USER_POSTS(userId), params);
  },
};

// Follow Service
export const followService = {
  // Follow User (for public accounts)
  followUser: async (userId: string) => {
    return api.post(API_ENDPOINTS.FOLLOW.FOLLOW_USER(userId));
  },

  // Unfollow User
  unfollowUser: async (userId: string) => {
    return api.delete(API_ENDPOINTS.FOLLOW.UNFOLLOW_USER(userId));
  },

  // Send Follow Request (for private accounts)
  sendFollowRequest: async (userId: string) => {
    return api.post(API_ENDPOINTS.FOLLOW.SEND_REQUEST(userId));
  },

  // Accept Follow Request
  acceptFollowRequest: async (requestId: string) => {
    return api.post(API_ENDPOINTS.FOLLOW.ACCEPT_REQUEST(requestId));
  },

  // Reject Follow Request
  rejectFollowRequest: async (requestId: string) => {
    return api.post(API_ENDPOINTS.FOLLOW.REJECT_REQUEST(requestId));
  },

  // Get Followers
  getFollowers: async (userId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FOLLOW.GET_FOLLOWERS(userId), params);
  },

  // Get Following
  getFollowing: async (userId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FOLLOW.GET_FOLLOWING(userId), params);
  },

  // Cancel Sent Follow Request
  cancelFollowRequest: async (userId: string) => {
    return api.delete(API_ENDPOINTS.FOLLOW.CANCEL_REQUEST(userId));
  },

  // Get Pending Follow Requests (received)
  getPendingRequests: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FOLLOW.GET_PENDING_REQUESTS, params);
  },

  // Get Sent Follow Requests
  getSentRequests: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FOLLOW.GET_SENT_REQUESTS, params);
  },

  // Get Suggestions
  getSuggestions: async (params?: { limit?: number }) => {
    return api.get(API_ENDPOINTS.FOLLOW.GET_SUGGESTIONS, params);
  },

  // Follow Back a user who follows you
  followBack: async (userId: string) => {
    return api.post(API_ENDPOINTS.FOLLOW.FOLLOW_BACK(userId));
  },
};

// Search Service
export const searchService = {
  // Global Search
  globalSearch: async (params: { query: string; type?: string; limit?: number }) => {
    return api.get(API_ENDPOINTS.SEARCH.GLOBAL, params);
  },

  // Search Users
  searchUsers: async (params: { query: string; page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.SEARCH.USERS, params);
  },

  // Search Pages
  searchPages: async (params: { query: string; page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.SEARCH.PAGES, params);
  },

  // Search Hashtags
  searchHashtags: async (params: { query: string; page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.SEARCH.HASHTAGS, params);
  },

  // Get Trending
  getTrending: async (params?: { timeframe?: string; limit?: number }) => {
    return api.get(API_ENDPOINTS.SEARCH.TRENDING, params);
  },
};

// Notification Service
export const notificationService = {
  // Get All Notifications
  getNotifications: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.NOTIFICATIONS.GET_ALL, params);
  },

  // Mark as Read
  markAsRead: async (notificationId: string) => {
    return api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId));
  },

  // Mark All as Read
  markAllAsRead: async () => {
    return api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
  },

  // Get Unread Count
  getUnreadCount: async () => {
    return api.get(API_ENDPOINTS.NOTIFICATIONS.GET_UNREAD_COUNT);
  },
};

// Chat Service
export const chatService = {
  // Get or Create Thread with User
  getThread: async (userId: string) => {
    return api.post(API_ENDPOINTS.CHAT.GET_THREAD(userId));
  },

  // Send Message (supports text and media)
  sendMessage: async (threadId: string, data: { text: string } | FormData) => {
    if (data instanceof FormData) {
      return api.upload(API_ENDPOINTS.CHAT.SEND_MESSAGE(threadId), data);
    }
    return api.post(API_ENDPOINTS.CHAT.SEND_MESSAGE(threadId), data);
  },

  // Get All Threads
  getThreads: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.CHAT.GET_THREADS, params);
  },

  // Get Unread Count
  getUnreadCount: async () => {
    return api.get(API_ENDPOINTS.CHAT.GET_UNREAD_COUNT);
  },

  // Get Messages in Thread
  getMessages: async (threadId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.CHAT.GET_MESSAGES(threadId), params);
  },

  // Mark Messages as Seen
  markThreadAsRead: async (threadId: string) => {
    return api.put(API_ENDPOINTS.CHAT.MARK_SEEN(threadId));
  },

  // Delete Message
  deleteMessage: async (messageId: string, deleteFor: 'me' | 'everyone' = 'me') => {
    return api.delete(API_ENDPOINTS.CHAT.DELETE_MESSAGE(messageId), { data: { deleteFor } });
  },

  // Edit Message
  editMessage: async (messageId: string, data: { text: string }) => {
    return api.put(API_ENDPOINTS.CHAT.EDIT_MESSAGE(messageId), data);
  },

  // Delete Thread/Conversation
  deleteThread: async (threadId: string) => {
    return api.delete(API_ENDPOINTS.CHAT.DELETE_THREAD(threadId));
  },

  // Group Chat Methods

  // Create Group
  createGroup: async (data: {
    name: string;
    description?: string;
    memberIds: string[];
    avatar?: File;
  }) => {
    if (data.avatar) {
      const formData = new FormData();
      formData.append('name', data.name);
      if (data.description) formData.append('description', data.description);
      formData.append('memberIds', JSON.stringify(data.memberIds));
      formData.append('avatar', data.avatar);
      return api.upload(API_ENDPOINTS.CHAT.CREATE_GROUP, formData);
    }
    return api.post(API_ENDPOINTS.CHAT.CREATE_GROUP, {
      name: data.name,
      description: data.description,
      memberIds: data.memberIds,
    });
  },

  // Get Group Details
  getGroupDetails: async (groupId: string) => {
    return api.get(API_ENDPOINTS.CHAT.GET_GROUP_DETAILS(groupId));
  },

  // Update Group Info
  updateGroup: async (groupId: string, data: { name?: string; description?: string }) => {
    return api.put(API_ENDPOINTS.CHAT.UPDATE_GROUP(groupId), data);
  },

  // Update Group Avatar
  updateGroupAvatar: async (groupId: string, avatar: File) => {
    const formData = new FormData();
    formData.append('avatar', avatar);
    return api.upload(API_ENDPOINTS.CHAT.UPDATE_GROUP_AVATAR(groupId), formData);
  },

  // Add Members to Group
  addMembers: async (groupId: string, memberIds: string[]) => {
    return api.post(API_ENDPOINTS.CHAT.ADD_MEMBERS(groupId), { memberIds });
  },

  // Remove Member from Group
  removeMember: async (groupId: string, memberId: string) => {
    return api.delete(API_ENDPOINTS.CHAT.REMOVE_MEMBER(groupId), { data: { memberId } });
  },

  // Leave Group
  leaveGroup: async (groupId: string) => {
    return api.post(API_ENDPOINTS.CHAT.LEAVE_GROUP(groupId));
  },

  // Make Admin
  makeAdmin: async (groupId: string, memberId: string) => {
    return api.post(API_ENDPOINTS.CHAT.MAKE_ADMIN(groupId), { memberId });
  },
};

// Live Streaming Service
export const liveStreamService = {
  // Create Live Stream
  createLiveStream: async (data: { title: string; description?: string; thumbnail?: File }) => {
    if (data.thumbnail) {
      const formData = new FormData();
      formData.append('title', data.title);
      if (data.description) formData.append('description', data.description);
      // Backend expects the field name to be 'file' (from uploadSingle middleware)
      formData.append('file', data.thumbnail);
      return api.upload(API_ENDPOINTS.LIVE.CREATE, formData);
    }
    return api.post(API_ENDPOINTS.LIVE.CREATE, {
      title: data.title,
      description: data.description,
    });
  },

  // Start Live Stream
  startLiveStream: async (streamId: string) => {
    return api.post(API_ENDPOINTS.LIVE.START(streamId));
  },

  // End Live Stream
  endLiveStream: async (streamId: string) => {
    return api.post(API_ENDPOINTS.LIVE.END(streamId));
  },

  // Get Live Stream Details
  getLiveStreamDetails: async (streamId: string) => {
    return api.get(API_ENDPOINTS.LIVE.GET_DETAILS(streamId));
  },

  // Get Active Live Streams (from followed users)
  getActiveLiveStreams: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.LIVE.GET_ACTIVE, params);
  },

  // Get All Public Live Streams
  getAllLiveStreams: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.LIVE.GET_ALL, params);
  },

  // Get User's Live Stream History
  getUserLiveStreams: async (userId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.LIVE.GET_USER_STREAMS(userId), params);
  },

  // Join Live Stream as Viewer
  joinLiveStream: async (streamId: string) => {
    return api.post(API_ENDPOINTS.LIVE.JOIN(streamId));
  },

  // Leave Live Stream
  leaveLiveStream: async (streamId: string) => {
    return api.post(API_ENDPOINTS.LIVE.LEAVE(streamId));
  },

  // Get Live Stream Viewers
  getLiveStreamViewers: async (streamId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.LIVE.GET_VIEWERS(streamId), params);
  },

  // Send Comment on Live Stream
  sendLiveComment: async (streamId: string, data: { text: string }) => {
    return api.post(API_ENDPOINTS.LIVE.SEND_COMMENT(streamId), data);
  },

  // Get Live Stream Comments
  getLiveComments: async (streamId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.LIVE.GET_COMMENTS(streamId), params);
  },

  // Delete Live Stream
  deleteLiveStream: async (streamId: string) => {
    return api.delete(API_ENDPOINTS.LIVE.DELETE(streamId));
  },
};
