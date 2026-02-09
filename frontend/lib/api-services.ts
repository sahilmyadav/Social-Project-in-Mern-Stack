import { api, removeToken, setRefreshToken, setToken } from './api-client';
import { API_ENDPOINTS } from './api-config';

export const authService = {
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

  verifyRegisterOtp: async (data: {
    email?: string;
    phone?: string;
    userId: string;
    otp: string;
  }) => {
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

  resendOtp: async (data: { email?: string; phone?: string }) => {
    const payload: Record<string, string> = {};
    if (data.email) {
      payload.email = data.email;
    }
    if (data.phone) {
      payload.phone = data.phone;
    }
    return api.post(API_ENDPOINTS.AUTH.RESEND_OTP, payload);
  },

  login: async (data: { email?: string; phone?: string; password: string }) => {
    const payload: Record<string, string> = {
      password: data.password,
    };

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

  verifyLogin: async (data: { email?: string; phone?: string; userId: string; otp: string }) => {
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

  logout: async () => {
    const response = await api.post(API_ENDPOINTS.AUTH.LOGOUT);
    removeToken();
    return response;
  },

  getCurrentUser: async () => {
    return api.get(API_ENDPOINTS.AUTH.CURRENT_USER);
  },

  getUserProfile: async (userId: string) => {
    return api.get(API_ENDPOINTS.AUTH.GET_USER_PROFILE(userId));
  },

  updateProfilePicture: async (formData: FormData) => {
    return api.put(API_ENDPOINTS.AUTH.UPDATE_PROFILE_PICTURE, formData, true);
  },

  updateCoverPhoto: async (formData: FormData) => {
    return api.put(API_ENDPOINTS.AUTH.UPDATE_COVER_PHOTO, formData, true);
  },

  deleteProfilePicture: async () => {
    return api.delete(API_ENDPOINTS.AUTH.DELETE_PROFILE_PICTURE);
  },

  deleteCoverPhoto: async () => {
    return api.delete(API_ENDPOINTS.AUTH.DELETE_COVER_PHOTO);
  },

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

  forgotPassword: async (data: { email?: string; phone?: string }) => {
    const payload = {
      identifier: data.email || data.phone,
    };
    return api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, payload);
  },

  resetPassword: async (token: string, newPassword: string) => {
    return api.post(`${API_ENDPOINTS.AUTH.RESET_PASSWORD}?token=${token}`, { newPassword });
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    return api.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, data);
  },

  updatePrivacySettings: async (data: {
    profile_type?: 'private' | 'public';
    allowDownloads?: boolean;
  }) => {
    return api.put(API_ENDPOINTS.AUTH.UPDATE_PROFILE, data);
  },

  blockUser: async (userId: string) => {
    return api.post(API_ENDPOINTS.AUTH.BLOCK_USER(userId));
  },

  unblockUser: async (userId: string) => {
    return api.post(API_ENDPOINTS.AUTH.UNBLOCK_USER(userId));
  },

  getBlockedUsers: async () => {
    return api.get(API_ENDPOINTS.AUTH.GET_BLOCKED_USERS);
  },

  checkUsername: async (username: string) => {
    return api.get(API_ENDPOINTS.AUTH.CHECK_USERNAME, { username });
  },

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

  requestEmailChange: async (data: { newEmail: string }) => {
    return api.post(API_ENDPOINTS.AUTH.REQUEST_EMAIL_CHANGE, data);
  },

  verifyEmailChange: async (data: { newEmail: string; otp: string }) => {
    return api.post(API_ENDPOINTS.AUTH.VERIFY_EMAIL_CHANGE, data);
  },

  requestPhoneChange: async (data: { newPhone: string }) => {
    return api.post(API_ENDPOINTS.AUTH.REQUEST_PHONE_CHANGE, data);
  },

  verifyPhoneChange: async (data: { newPhone: string; otp: string }) => {
    return api.post(API_ENDPOINTS.AUTH.VERIFY_PHONE_CHANGE, data);
  },
};

export const postService = {
  createPost: async (formData: FormData) => {
    return api.upload(API_ENDPOINTS.POSTS.CREATE, formData);
  },

  deletePost: async (postId: string) => {
    return api.delete(API_ENDPOINTS.POSTS.DELETE(postId));
  },

  getPostDetails: async (postId: string) => {
    return api.get(API_ENDPOINTS.POSTS.GET_DETAILS(postId));
  },

  likePost: async (postId: string) => {
    return api.post(API_ENDPOINTS.POSTS.LIKE(postId));
  },

  unlikePost: async (postId: string) => {
    return api.delete(API_ENDPOINTS.POSTS.UNLIKE(postId));
  },

  commentOnPost: async (postId: string, data: { text: string; reply_to_comment_id?: string }) => {
    return api.post(API_ENDPOINTS.POSTS.COMMENT(postId), data);
  },

  getPostComments: async (postId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.POSTS.GET_COMMENTS(postId), params);
  },

  savePost: async (postId: string) => {
    return api.post(API_ENDPOINTS.POSTS.SAVE(postId));
  },

  unsavePost: async (postId: string) => {
    return api.delete(API_ENDPOINTS.POSTS.UNSAVE(postId));
  },

  getSavedPosts: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.POSTS.GET_SAVED_POSTS, params);
  },

  sharePost: async (postId: string, data?: { target?: string; caption?: string }) => {
    return api.post(API_ENDPOINTS.POSTS.SHARE(postId), data || {});
  },

  getTotalPostCount: async () => {
    return api.get(API_ENDPOINTS.POSTS.TOTAL_COUNT);
  },

  reportPost: async (postId: string, data: { reason: string; additionalInfo?: string }) => {
    return api.post(API_ENDPOINTS.POSTS.REPORT(postId), data);
  },

  getExplorePosts: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.POSTS.EXPLORE, params);
  },

  trackView: async (postId: string) => {
    return api.post(`/post/view/${postId}`);
  },

  getViewCount: async (postId: string) => {
    return api.get(`/post/views/${postId}`);
  },
};

export const commentService = {
  likeComment: async (commentId: string) => {
    return api.post(API_ENDPOINTS.COMMENTS.LIKE(commentId));
  },

  unlikeComment: async (commentId: string) => {
    return api.delete(API_ENDPOINTS.COMMENTS.UNLIKE(commentId));
  },

  replyToComment: async (commentId: string, data: { text: string }) => {
    return api.post(API_ENDPOINTS.COMMENTS.REPLY(commentId), data);
  },

  getCommentReplies: async (commentId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.COMMENTS.GET_REPLIES(commentId), params);
  },

  editComment: async (commentId: string, data: { text: string }) => {
    return api.put(API_ENDPOINTS.COMMENTS.EDIT(commentId), data);
  },

  deleteComment: async (commentId: string) => {
    return api.delete(API_ENDPOINTS.COMMENTS.DELETE(commentId));
  },
};

export const reelService = {
  uploadReel: async (formData: FormData) => {
    return api.upload(API_ENDPOINTS.REELS.UPLOAD, formData);
  },

  getReelsFeed: async (params?: { limit?: number; page?: number }) => {
    return api.get(API_ENDPOINTS.REELS.GET_FEED, params);
  },

  deleteReel: async (reelId: string) => {
    return api.delete(API_ENDPOINTS.REELS.DELETE(reelId));
  },

  getReelDetails: async (reelId: string) => {
    return api.get(API_ENDPOINTS.REELS.GET_DETAILS(reelId));
  },

  toggleLikeReel: async (reelId: string) => {
    return api.post(API_ENDPOINTS.REELS.TOGGLE_LIKE(reelId));
  },

  commentOnReel: async (reelId: string, data: { text: string; reply_to_comment_id?: string }) => {
    return api.post(API_ENDPOINTS.REELS.COMMENT(reelId), data);
  },

  getReelComments: async (reelId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.REELS.COMMENTS(reelId), params);
  },

  getUserReels: async (userId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.REELS.GET_USER_REELS(userId), params);
  },

  saveReel: async (reelId: string) => {
    return api.post(API_ENDPOINTS.REELS.SAVE(reelId));
  },

  unsaveReel: async (reelId: string) => {
    return api.delete(API_ENDPOINTS.REELS.UNSAVE(reelId));
  },

  getSavedReels: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.REELS.GET_SAVED, params);
  },

  reportReel: async (reelId: string, data: { reason: string; additionalInfo?: string }) => {
    return api.post(API_ENDPOINTS.REELS.REPORT(reelId), data);
  },

  viewReel: async (reelId: string) => {
    return api.post(API_ENDPOINTS.REELS.VIEW(reelId));
  },
};

export const storyService = {
  uploadStory: async (formData: FormData) => {
    return api.upload(API_ENDPOINTS.STORIES.UPLOAD, formData);
  },

  deleteStory: async (storyId: string) => {
    return api.delete(API_ENDPOINTS.STORIES.DELETE(storyId));
  },

  getUserStories: async (userId: string) => {
    return api.get(API_ENDPOINTS.STORIES.GET_USER_STORIES(userId), { _t: Date.now() });
  },

  getAllStories: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.STORIES.GET_ALL_STORIES, { ...params, _t: Date.now() });
  },

  cleanupExpiredStories: async () => {
    return api.post(API_ENDPOINTS.STORIES.CLEANUP);
  },

  viewStory: async (storyId: string) => {
    return api.post(API_ENDPOINTS.STORIES.VIEW_STORY(storyId));
  },

  getStoryViewers: async (storyId: string) => {
    return api.get(API_ENDPOINTS.STORIES.GET_VIEWERS(storyId));
  },
};

export const feedService = {
  getHomeFeed: async (params?: { cursor?: string; limit?: number; filter?: string }) => {
    return api.get(API_ENDPOINTS.FEED.HOME, params);
  },

  getReelsFeed: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FEED.REELS, params);
  },

  getStoriesFeed: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FEED.STORIES, params);
  },

  getUserPosts: async (userId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FEED.USER_POSTS(userId), params);
  },
};

export const followService = {
  followUser: async (userId: string) => {
    return api.post(API_ENDPOINTS.FOLLOW.FOLLOW_USER(userId));
  },

  unfollowUser: async (userId: string) => {
    return api.delete(API_ENDPOINTS.FOLLOW.UNFOLLOW_USER(userId));
  },

  sendFollowRequest: async (userId: string) => {
    return api.post(API_ENDPOINTS.FOLLOW.FOLLOW_USER(userId));
  },

  acceptFollowRequest: async (requestId: string) => {
    return api.post(API_ENDPOINTS.FOLLOW.ACCEPT_REQUEST(requestId));
  },

  rejectFollowRequest: async (requestId: string) => {
    return api.post(API_ENDPOINTS.FOLLOW.REJECT_REQUEST(requestId));
  },

  getFollowers: async (userId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FOLLOW.GET_FOLLOWERS(userId), params);
  },

  getFollowing: async (userId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FOLLOW.GET_FOLLOWING(userId), params);
  },

  cancelFollowRequest: async (userId: string) => {
    return api.delete(API_ENDPOINTS.FOLLOW.CANCEL_REQUEST(userId));
  },

  getPendingRequests: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FOLLOW.GET_PENDING_REQUESTS, params);
  },

  getSentRequests: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.FOLLOW.GET_SENT_REQUESTS, params);
  },

  getSuggestions: async (params?: { limit?: number }) => {
    return api.get(API_ENDPOINTS.FOLLOW.GET_SUGGESTIONS, params);
  },

  followBack: async (userId: string) => {
    return api.post(API_ENDPOINTS.FOLLOW.FOLLOW_BACK(userId));
  },
};

export const searchService = {
  globalSearch: async (params: { query: string; type?: string; limit?: number }) => {
    return api.get(API_ENDPOINTS.SEARCH.GLOBAL, params);
  },

  searchUsers: async (params: { query: string; page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.SEARCH.USERS, params);
  },

  searchPages: async (params: { query: string; page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.SEARCH.PAGES, params);
  },

  searchHashtags: async (params: { query: string; page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.SEARCH.HASHTAGS, params);
  },

  getTrending: async (params?: { timeframe?: string; limit?: number }) => {
    return api.get(API_ENDPOINTS.SEARCH.TRENDING, params);
  },
};

export const notificationService = {
  getNotifications: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.NOTIFICATIONS.GET_ALL, params);
  },

  markAsRead: async (notificationId: string) => {
    return api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId));
  },

  markAllAsRead: async () => {
    return api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
  },

  getUnreadCount: async () => {
    return api.get(API_ENDPOINTS.NOTIFICATIONS.GET_UNREAD_COUNT);
  },
};

export const chatService = {
  getThread: async (userId: string) => {
    return api.post(API_ENDPOINTS.CHAT.GET_THREAD(userId));
  },

  sendMessage: async (
    threadId: string,
    data:
      | {
          text?: string;
          reply_to?: string;
          isForwarded?: boolean;
          messageType?: string;
          sharedContent?: { contentId: string };
          location?: {
            latitude: number;
            longitude: number;
            address?: string;
            name?: string;
            isLiveLocation?: boolean;
            duration?: number;
          };
        }
      | FormData
  ) => {
    if (data instanceof FormData) {
      return api.upload(API_ENDPOINTS.CHAT.SEND_MESSAGE(threadId), data);
    }
    return api.post(API_ENDPOINTS.CHAT.SEND_MESSAGE(threadId), data);
  },

  getThreads: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.CHAT.GET_THREADS, params);
  },

  getUnreadCount: async () => {
    return api.get(API_ENDPOINTS.CHAT.GET_UNREAD_COUNT);
  },

  getMessages: async (threadId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.CHAT.GET_MESSAGES(threadId), params);
  },

  markThreadAsRead: async (threadId: string) => {
    return api.put(API_ENDPOINTS.CHAT.MARK_SEEN(threadId));
  },

  deleteMessage: async (messageId: string, deleteFor: 'me' | 'everyone' = 'me') => {
    return api.delete(API_ENDPOINTS.CHAT.DELETE_MESSAGE(messageId), { deleteFor });
  },

  editMessage: async (messageId: string, data: { text: string }) => {
    return api.put(API_ENDPOINTS.CHAT.EDIT_MESSAGE(messageId), data);
  },

  deleteThread: async (threadId: string) => {
    return api.delete(API_ENDPOINTS.CHAT.DELETE_THREAD(threadId));
  },


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
      return api.upload(API_ENDPOINTS.GROUP.CREATE, formData);
    }
    return api.post(API_ENDPOINTS.GROUP.CREATE, {
      name: data.name,
      description: data.description,
      memberIds: data.memberIds,
    });
  },

  getGroupDetails: async (groupId: string) => {
    return api.get(API_ENDPOINTS.GROUP.GET_DETAILS(groupId));
  },

  updateGroup: async (groupId: string, data: { name?: string; description?: string }) => {
    return api.put(API_ENDPOINTS.GROUP.UPDATE(groupId), data);
  },

  updateGroupAvatar: async (groupId: string, avatar: File) => {
    const formData = new FormData();
    formData.append('avatar', avatar);
    return api.put(API_ENDPOINTS.GROUP.UPDATE(groupId), formData, true);
  },

  addMembers: async (groupId: string, memberIds: string[]) => {
    return api.post(API_ENDPOINTS.GROUP.ADD_MEMBERS(groupId), { memberIds });
  },

  removeMember: async (groupId: string, memberId: string) => {
    return api.delete(API_ENDPOINTS.GROUP.REMOVE_MEMBER(groupId, memberId));
  },

  leaveGroup: async (groupId: string, userId: string) => {
    return api.delete(API_ENDPOINTS.GROUP.REMOVE_MEMBER(groupId, userId));
  },

  makeAdmin: async (groupId: string, memberId: string) => {
    return api.put(API_ENDPOINTS.GROUP.UPDATE_ROLE(groupId, memberId), { role: 'admin' });
  },
};

export const liveStreamService = {
  createLiveStream: async (data: { title: string; description?: string; thumbnail?: File }) => {
    if (data.thumbnail) {
      const formData = new FormData();
      formData.append('title', data.title);
      if (data.description) formData.append('description', data.description);
      formData.append('file', data.thumbnail);
      return api.upload(API_ENDPOINTS.LIVE.CREATE, formData);
    }
    return api.post(API_ENDPOINTS.LIVE.CREATE, {
      title: data.title,
      description: data.description,
    });
  },

  startLiveStream: async (streamId: string) => {
    return api.post(API_ENDPOINTS.LIVE.START(streamId));
  },

  endLiveStream: async (streamId: string) => {
    return api.post(API_ENDPOINTS.LIVE.END(streamId));
  },

  getLiveStreamDetails: async (streamId: string) => {
    return api.get(API_ENDPOINTS.LIVE.GET_DETAILS(streamId));
  },

  getActiveLiveStreams: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.LIVE.GET_ACTIVE, params);
  },

  getAllLiveStreams: async (params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.LIVE.GET_ALL, params);
  },

  getUserLiveStreams: async (userId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.LIVE.GET_USER_STREAMS(userId), params);
  },

  joinLiveStream: async (streamId: string) => {
    return api.post(API_ENDPOINTS.LIVE.JOIN(streamId));
  },

  leaveLiveStream: async (streamId: string) => {
    return api.post(API_ENDPOINTS.LIVE.LEAVE(streamId));
  },

  getLiveStreamViewers: async (streamId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.LIVE.GET_VIEWERS(streamId), params);
  },

  sendLiveComment: async (streamId: string, data: { text: string }) => {
    return api.post(API_ENDPOINTS.LIVE.SEND_COMMENT(streamId), data);
  },

  getLiveComments: async (streamId: string, params?: { page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.LIVE.GET_COMMENTS(streamId), params);
  },

  deleteLiveStream: async (streamId: string) => {
    return api.delete(API_ENDPOINTS.LIVE.DELETE(streamId));
  },
};

export const groupService = {

  createGroup: async (data: {
    name: string;
    description?: string;
    memberIds: string[];
    type?: 'private' | 'public';
    avatar?: File;
  }) => {
    const formData = new FormData();
    formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    formData.append('memberIds', JSON.stringify(data.memberIds));
    if (data.type) formData.append('type', data.type);
    if (data.avatar) formData.append('avatar', data.avatar);
    return api.upload(API_ENDPOINTS.GROUP.CREATE, formData);
  },

  getMyGroups: async (params?: { limit?: number; skip?: number; search?: string }) => {
    return api.get(API_ENDPOINTS.GROUP.GET_MY_GROUPS, params);
  },

  getGroupDetails: async (groupId: string) => {
    return api.get(API_ENDPOINTS.GROUP.GET_DETAILS(groupId));
  },

  updateGroup: async (
    groupId: string,
    data: {
      name?: string;
      description?: string;
      settings?: Record<string, unknown>;
      avatar?: File;
    }
  ) => {
    const formData = new FormData();
    if (data.name) formData.append('name', data.name);
    if (data.description !== undefined) formData.append('description', data.description);
    if (data.settings) formData.append('settings', JSON.stringify(data.settings));
    if (data.avatar) formData.append('avatar', data.avatar);
    return api.put(API_ENDPOINTS.GROUP.UPDATE(groupId), formData, true);
  },

  deleteGroup: async (groupId: string) => {
    return api.delete(API_ENDPOINTS.GROUP.DELETE(groupId));
  },


  addMembers: async (groupId: string, memberIds: string[]) => {
    return api.post(API_ENDPOINTS.GROUP.ADD_MEMBERS(groupId), { memberIds });
  },

  removeMember: async (groupId: string, memberId: string) => {
    return api.delete(API_ENDPOINTS.GROUP.REMOVE_MEMBER(groupId, memberId));
  },

  leaveGroup: async (groupId: string, userId: string) => {
    return api.delete(API_ENDPOINTS.GROUP.REMOVE_MEMBER(groupId, userId));
  },

  updateMemberRole: async (
    groupId: string,
    memberId: string,
    role: 'admin' | 'moderator' | 'member'
  ) => {
    return api.put(API_ENDPOINTS.GROUP.UPDATE_ROLE(groupId, memberId), { role });
  },


  generateInviteLink: async (
    groupId: string,
    options?: { expiresIn?: number; usageLimit?: number }
  ) => {
    return api.post(API_ENDPOINTS.GROUP.GENERATE_INVITE(groupId), options);
  },

  joinViaInvite: async (code: string) => {
    return api.post(API_ENDPOINTS.GROUP.JOIN_VIA_INVITE(code));
  },


  sendGroupMessage: async (
    groupId: string,
    data: {
      text?: string;
      messageType?: string;
      replyTo?: string;
      mentions?: string[];
      sharedContent?: { contentType: string; contentId: string };
      location?: {
        latitude: number;
        longitude: number;
        address?: string;
        name?: string;
        isLive?: boolean;
        duration?: number;
      };
      contact?: { name: string; phone?: string; email?: string };
      poll?: {
        question: string;
        options: string[];
        allowMultiple?: boolean;
        expiresAt?: Date;
        isAnonymous?: boolean;
      };
      files?: File[];
    }
  ) => {
    const formData = new FormData();
    if (data.text) formData.append('text', data.text);
    if (data.messageType) formData.append('messageType', data.messageType);
    if (data.replyTo) formData.append('replyTo', data.replyTo);
    if (data.mentions?.length) formData.append('mentions', JSON.stringify(data.mentions));
    if (data.sharedContent) formData.append('sharedContent', JSON.stringify(data.sharedContent));
    if (data.location) formData.append('location', JSON.stringify(data.location));
    if (data.contact) formData.append('contact', JSON.stringify(data.contact));
    if (data.poll) formData.append('poll', JSON.stringify(data.poll));
    if (data.files?.length) {
      data.files.forEach((file) => formData.append('files', file));
    }
    return api.upload(API_ENDPOINTS.GROUP.SEND_MESSAGE(groupId), formData);
  },

  getGroupMessages: async (
    groupId: string,
    params?: { limit?: number; before?: string; after?: string }
  ) => {
    return api.get(API_ENDPOINTS.GROUP.GET_MESSAGES(groupId), params);
  },

  reactToMessage: async (groupId: string, messageId: string, emoji: string) => {
    return api.post(API_ENDPOINTS.GROUP.REACT_TO_MESSAGE(groupId, messageId), { emoji });
  },

  deleteMessage: async (groupId: string, messageId: string, deleteForEveryone: boolean = false) => {
    return api.delete(API_ENDPOINTS.GROUP.DELETE_MESSAGE(groupId, messageId), {
      deleteForEveryone,
    });
  },

  forwardMessage: async (messageId: string, targetGroupIds: string[]) => {
    return api.post(API_ENDPOINTS.GROUP.FORWARD_MESSAGE(messageId), { targetGroupIds });
  },

  togglePinMessage: async (groupId: string, messageId: string) => {
    return api.put(API_ENDPOINTS.GROUP.PIN_MESSAGE(groupId, messageId));
  },

  toggleStarMessage: async (groupId: string, messageId: string) => {
    return api.put(API_ENDPOINTS.GROUP.STAR_MESSAGE(groupId, messageId));
  },

  voteOnPoll: async (groupId: string, messageId: string, optionIds: string[]) => {
    return api.post(API_ENDPOINTS.GROUP.VOTE_POLL(groupId, messageId), { optionIds });
  },

  searchMessages: async (
    groupId: string,
    params?: { query?: string; type?: string; from?: string; limit?: number }
  ) => {
    return api.get(API_ENDPOINTS.GROUP.SEARCH_MESSAGES(groupId), params);
  },

  getStarredMessages: async (groupId: string, params?: { limit?: number }) => {
    return api.get(API_ENDPOINTS.GROUP.GET_STARRED(groupId), params);
  },

  getGroupMedia: async (
    groupId: string,
    params?: { type?: 'image' | 'video' | 'file' | 'all'; limit?: number; skip?: number }
  ) => {
    return api.get(API_ENDPOINTS.GROUP.GET_MEDIA(groupId), params);
  },


  initiateGroupCall: async (
    groupId: string,
    callType: 'audio' | 'video',
    settings?: {
      maxParticipants?: number;
      waitingRoomEnabled?: boolean;
      muteOnJoin?: boolean;
      recordingEnabled?: boolean;
      screenSharingAllowed?: boolean;
    }
  ) => {
    return api.post(API_ENDPOINTS.GROUP.INITIATE_CALL(groupId), { callType, settings });
  },

  getActiveCall: async (groupId: string) => {
    return api.get(API_ENDPOINTS.GROUP.GET_ACTIVE_CALL(groupId));
  },

  getCallHistory: async (groupId: string, params?: { limit?: number; skip?: number }) => {
    return api.get(API_ENDPOINTS.GROUP.GET_CALL_HISTORY(groupId), params);
  },

  joinCall: async (callId: string, peerId?: string) => {
    return api.post(API_ENDPOINTS.GROUP.JOIN_CALL(callId), { peerId });
  },

  leaveCall: async (callId: string) => {
    return api.post(API_ENDPOINTS.GROUP.LEAVE_CALL(callId));
  },

  endCall: async (callId: string) => {
    return api.post(API_ENDPOINTS.GROUP.END_CALL(callId));
  },

  getCallInfo: async (callId: string) => {
    return api.get(API_ENDPOINTS.GROUP.GET_CALL_INFO(callId));
  },

  toggleMediaState: async (
    callId: string,
    mediaType: 'audio' | 'video' | 'screenShare',
    enabled: boolean
  ) => {
    return api.put(API_ENDPOINTS.GROUP.TOGGLE_MEDIA(callId), { mediaType, enabled });
  },

  admitFromWaitingRoom: async (callId: string, waitingUserId: string, admit: boolean = true) => {
    return api.post(API_ENDPOINTS.GROUP.ADMIT_USER(callId), { waitingUserId, admit });
  },

  toggleHandRaise: async (callId: string, raised: boolean) => {
    return api.put(API_ENDPOINTS.GROUP.TOGGLE_HAND(callId), { raised });
  },

  muteParticipant: async (callId: string, targetUserId: string, muted: boolean) => {
    return api.post(API_ENDPOINTS.GROUP.MUTE_PARTICIPANT(callId), { targetUserId, muted });
  },

  toggleRecording: async (callId: string, record: boolean) => {
    return api.put(API_ENDPOINTS.GROUP.TOGGLE_RECORDING(callId), { record });
  },
};
