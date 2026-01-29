import { toast } from 'sonner';

export const showToast = {
  // Success toasts
  success: (message: string, description?: string) => {
    toast.success(message, { description });
  },

  // Error toasts
  error: (message: string, description?: string) => {
    toast.error(message, { description });
  },

  // Info toasts
  info: (message: string, description?: string) => {
    toast.info(message, { description });
  },

  // Warning toasts
  warning: (message: string, description?: string) => {
    toast.warning(message, { description });
  },

  // Loading toast
  loading: (message: string) => {
    return toast.loading(message);
  },

  // Custom toast with action button
  action: (message: string, actionLabel: string, onAction: () => void, description?: string) => {
    toast(message, {
      description,
      action: {
        label: actionLabel,
        onClick: onAction,
      },
    });
  },

  // Promise toast (for async operations)
  promise: <T>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(promise, {
      loading,
      success,
      error,
    });
  },

  // Dismiss a specific toast
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },

  // Dismiss all toasts
  dismissAll: () => {
    toast.dismiss();
  },
};

// Predefined toasts for common actions
export const toasts = {
  // Post actions
  postCreated: () => showToast.success('Post created successfully', 'Your post is now live!'),
  postDeleted: () => showToast.success('Post deleted', 'Your post has been removed'),
  postSaved: () => showToast.success('Post saved', 'Added to your saved posts'),
  postUnsaved: () => showToast.success('Post unsaved', 'Removed from saved posts'),
  postReported: () =>
    showToast.success('Report submitted', 'Thank you for helping keep our community safe'),
  postShared: () => showToast.success('Post shared', 'Link copied to clipboard!'),
  postUpdated: () => showToast.success('Post updated', 'Your changes have been saved'),

  // Reel actions
  reelUploaded: () => showToast.success('Reel uploaded successfully', 'Your reel is now live!'),
  reelDeleted: () => showToast.success('Reel deleted', 'Your reel has been removed'),
  reelSaved: () => showToast.success('Reel saved', 'Added to your saved reels'),
  reelUnsaved: () => showToast.success('Reel unsaved', 'Removed from saved reels'),
  reelReported: () =>
    showToast.success('Report submitted', 'Thank you for helping keep our community safe'),
  reelShared: () => showToast.success('Reel shared', 'Link copied to clipboard!'),

  // Story actions
  storyUploaded: () =>
    showToast.success('Story uploaded', 'Your story is now visible to your followers'),
  storyDeleted: () => showToast.success('Story deleted', 'Your story has been removed'),
  storyViewed: () => showToast.info('Story viewed', ''),

  // Comment actions
  commentAdded: () => showToast.success('Comment added', 'Your comment has been posted'),
  commentDeleted: () => showToast.success('Comment deleted', 'Your comment has been removed'),
  commentUpdated: () => showToast.success('Comment updated', 'Your comment has been edited'),
  replyAdded: () => showToast.success('Reply added', 'Your reply has been posted'),

  // Like actions
  postLiked: () => showToast.success('Post liked', ''),
  postUnliked: () => showToast.info('Post unliked', ''),
  commentLiked: () => showToast.success('Comment liked', ''),
  reelLiked: () => showToast.success('Reel liked', ''),

  // Follow actions
  userFollowed: (username: string) =>
    showToast.success('Following', `You are now following ${username}`),
  userUnfollowed: (username: string) => showToast.info('Unfollowed', `You unfollowed ${username}`),
  followRequestSent: (username: string) =>
    showToast.success('Follow request sent', `Waiting for ${username} to accept`),
  followRequestAccepted: (username: string) =>
    showToast.success('Request accepted', `${username} can now see your posts`),
  followRequestRejected: () => showToast.info('Request declined', ''),

  // Block actions
  userBlocked: (username: string) =>
    showToast.success(
      'User blocked',
      `${username} has been blocked. They won't be able to find your profile or contact you.`
    ),
  userUnblocked: (username: string) =>
    showToast.success(
      'User unblocked',
      `${username} has been unblocked. You can now interact with them again.`
    ),

  // Message/Chat actions
  messageSent: () => showToast.success('Message sent', ''),
  messageDeleted: () => showToast.success('Message deleted', ''),
  messageEdited: () => showToast.success('Message edited', ''),
  chatDeleted: () => showToast.success('Chat deleted', 'Conversation has been removed'),
  chatMuted: () => showToast.info('Chat muted', "You won't receive notifications for this chat"),
  chatUnmuted: () => showToast.success('Chat unmuted', 'Notifications enabled'),
  newMessage: (sender: string) => showToast.info('New message', `${sender} sent you a message`),

  // Group actions
  groupCreated: () => showToast.success('Group created', 'Your group is ready!'),
  groupUpdated: () => showToast.success('Group updated', 'Changes saved successfully'),
  groupDeleted: () => showToast.success('Group deleted', 'The group has been removed'),
  groupLeft: () => showToast.info('Left group', 'You are no longer a member'),
  memberAdded: (name?: string) =>
    showToast.success('Member added', name ? `${name} has been added` : ''),
  memberRemoved: (name?: string) =>
    showToast.success('Member removed', name ? `${name} has been removed` : ''),
  madeAdmin: (name: string) => showToast.success('Admin added', `${name} is now an admin`),
  removedAdmin: (name: string) => showToast.info('Admin removed', `${name} is no longer an admin`),

  // Call actions
  callStarted: () => showToast.info('Call started', ''),
  callEnded: () => showToast.info('Call ended', ''),
  callMissed: (caller: string) =>
    showToast.warning('Missed call', `You missed a call from ${caller}`),
  callDeclined: () => showToast.info('Call declined', ''),
  callFailed: () => showToast.error('Call failed', 'Unable to connect. Please try again.'),

  // Live stream actions
  liveStarted: () => showToast.success("You're live!", 'Your live stream has started'),
  liveEnded: () => showToast.info('Live ended', 'Your live stream has ended'),
  liveJoined: (host: string) => showToast.info('Joined live', `Watching ${host}'s live stream`),
  liveViewerJoined: (viewer: string) => showToast.info('New viewer', `${viewer} joined your live`),

  // Profile actions
  profileUpdated: () => showToast.success('Profile updated', 'Your changes have been saved'),
  avatarUpdated: () => showToast.success('Profile photo updated', 'Your new photo is now visible'),
  coverUpdated: () => showToast.success('Cover photo updated', 'Your new cover is now visible'),
  bioUpdated: () => showToast.success('Bio updated', 'Your bio has been saved'),
  usernameChanged: () => showToast.success('Username changed', 'Your new username is active'),
  passwordChanged: () => showToast.success('Password changed', 'Your password has been updated'),
  emailChanged: () =>
    showToast.success('Email updated', 'Verification email sent to your new address'),

  // Authentication actions
  loginSuccess: () => showToast.success('Welcome back!', 'You have successfully logged in'),
  logoutSuccess: () => showToast.success('Logged out', 'See you soon!'),
  signupSuccess: () => showToast.success('Account created', 'Welcome to ClickME!'),
  otpSent: () => showToast.success('OTP sent', 'Check your email for the verification code'),
  otpVerified: () => showToast.success('Verified', 'Your email has been verified'),
  passwordResetSent: () =>
    showToast.success('Reset link sent', 'Check your email to reset your password'),
  passwordResetSuccess: () =>
    showToast.success('Password reset', 'You can now login with your new password'),

  // Notification actions
  notificationsCleared: () =>
    showToast.success('Notifications cleared', 'All notifications have been marked as read'),
  notificationSettingsUpdated: () =>
    showToast.success('Settings updated', 'Your notification preferences have been saved'),

  // Privacy/Settings actions
  settingsSaved: () => showToast.success('Settings saved', 'Your preferences have been updated'),
  accountPrivate: () =>
    showToast.success('Account is private', 'Only approved followers can see your content'),
  accountPublic: () => showToast.success('Account is public', 'Anyone can see your content'),

  // Media actions
  imageUploaded: () => showToast.success('Image uploaded', ''),
  videoUploaded: () => showToast.success('Video uploaded', ''),
  mediaDownloaded: () => showToast.success('Downloaded', 'Media saved to your device'),
  clipboardCopied: () => showToast.success('Copied', 'Link copied to clipboard'),

  // Search actions
  searchCleared: () => showToast.info('Search cleared', 'Your search history has been cleared'),

  // Error toasts
  error: (message?: string) =>
    showToast.error('Something went wrong', message || 'Please try again later'),
  networkError: () => showToast.error('Network error', 'Please check your internet connection'),
  uploadError: () => showToast.error('Upload failed', 'Please try again'),
  deleteError: () => showToast.error('Delete failed', 'Please try again'),
  saveError: () => showToast.error('Save failed', 'Please try again'),
  authError: () => showToast.error('Authentication failed', 'Please login again'),
  permissionError: () =>
    showToast.error('Permission denied', "You don't have access to this resource"),
  notFoundError: () => showToast.error('Not found', "The content you're looking for doesn't exist"),
  fileTooLarge: () => showToast.error('File too large', 'Please select a smaller file'),
  invalidFormat: () => showToast.error('Invalid format', 'Please use a supported file format'),
  rateLimited: () => showToast.warning('Slow down', 'Too many requests. Please wait a moment.'),
  sessionExpired: () => showToast.warning('Session expired', 'Please login again to continue'),
  maintenanceMode: () =>
    showToast.warning('Under maintenance', "We'll be back shortly. Please try again later."),

  // Action required toasts
  verifyEmail: () =>
    showToast.warning('Email not verified', 'Please verify your email to access all features'),
  completeProfile: () =>
    showToast.info('Complete your profile', 'Add more details to help others find you'),
  updateApp: () =>
    showToast.info('Update available', 'A new version is available. Please refresh.'),
};
