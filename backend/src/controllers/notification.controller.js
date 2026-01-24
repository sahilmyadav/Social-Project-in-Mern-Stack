import { Notification } from "../models/notification.model.js";
import { NotificationSettings } from "../models/notificationSettings.model.js";
import { Post } from "../models/post.model.js";
import { Reel } from "../models/reel.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  notifyPostLike,
  notifyPostComment,
  notifyPostShare,
  notifyFollow,
  notifyReelLike,
  notifyReelComment,
} from "../services/notification.service.js";
import { registerFCMToken, unregisterFCMToken } from "../services/firebase.service.js";

// GET /notifications/list - Get user's notifications with pagination
// GET /notifications/list - Get user's notifications with pagination
export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { cursor, limit = 20, type } = req.query;

  // Build query
  const query = { recipient_id: userId };

  if (type) {
    query.type = type;
  }

  if (cursor) {
    query._id = { $lt: cursor };
  }

  // Get notifications
  const notifications = await Notification.find(query)
    .populate("sender_id", "firstName lastName username profileImage profilePicture avatar") // ✅ FIXED
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  // Get unread count
  const unreadCount = await Notification.countDocuments({
    recipient_id: userId,
    is_read: false,
  });

  const nextCursor =
    notifications.length > 0
      ? notifications[notifications.length - 1]._id
      : null;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        notifications,
        unreadCount,
        nextCursor,
        hasMore: notifications.length === parseInt(limit),
      },
      "Notifications fetched successfully"
    )
  );
});

// PUT /notifications/read/:notificationId - Mark single notification as read
export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user._id;

  const notification = await Notification.findOne({
    _id: notificationId,
    recipient_id: userId,
  });

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  if (!notification.is_read) {
    notification.is_read = true;
    notification.read_at = new Date();
    await notification.save();
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { notification }, "Notification marked as read")
    );
});

// PUT /notifications/read-all - Mark all notifications as read
export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await Notification.updateMany(
    {
      recipient_id: userId,
      is_read: false,
    },
    {
      $set: {
        is_read: true,
        read_at: new Date(),
      },
    }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { updated: result.modifiedCount },
        "All notifications marked as read"
      )
    );
});

// GET /notifications/unread-count - Get unread notification count
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const unreadCount = await Notification.countDocuments({
    recipient_id: userId,
    is_read: false,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { unreadCount },
        "Unread count retrieved successfully"
      )
    );
});

// PUT /notifications/settings/update - Update notification preferences
export const updateNotificationSettings = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { preferences, do_not_disturb } = req.body;

  let settings = await NotificationSettings.findOne({ user_id: userId });

  if (!settings) {
    settings = await NotificationSettings.create({
      user_id: userId,
      preferences: preferences || {},
      do_not_disturb: do_not_disturb || {},
    });
  } else {
    if (preferences) {
      settings.preferences = { ...settings.preferences, ...preferences };
    }
    if (do_not_disturb !== undefined) {
      settings.do_not_disturb = { ...settings.do_not_disturb, ...do_not_disturb };
    }
    await settings.save();
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { settings },
        "Notification settings updated successfully"
      )
    );
});

// GET /notifications/settings - Get notification settings
export const getNotificationSettings = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  let settings = await NotificationSettings.findOne({ user_id: userId });

  if (!settings) {
    // Create default settings
    settings = await NotificationSettings.create({
      user_id: userId,
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { settings }, "Settings fetched successfully")
    );
});

// POST /notifications/register-token - Register FCM token
export const registerDeviceToken = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { token, device_type, device_id } = req.body;

  if (!token) {
    throw new ApiError(400, "FCM token is required");
  }

  const settings = await registerFCMToken(
    userId,
    token,
    device_type || "web",
    device_id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, { settings }, "Device token registered successfully")
    );
});

// DELETE /notifications/unregister-token - Unregister FCM token
export const unregisterDeviceToken = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { token } = req.body;

  if (!token) {
    throw new ApiError(400, "FCM token is required");
  }

  await unregisterFCMToken(userId, token);

  return res
    .status(200)
    .json(
      new ApiResponse(200, null, "Device token unregistered successfully")
    );
});

// ===== INTERNAL ENDPOINTS (Called by other services) =====

// POST /notifications/like/:postId - Create notification for like
export const createLikeNotification = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const likerId = req.user._id;

  const post = await Post.findById(postId).select("user_id media");

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const thumbnail = post.media?.[0]?.url || null;

  await notifyPostLike(postId, post.user_id, likerId, thumbnail);

  return res
    .status(201)
    .json(new ApiResponse(201, null, "Like notification created"));
});

// POST /notifications/comment/:postId - Create notification for comment
export const createCommentNotification = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { commentText } = req.body;
  const commenterId = req.user._id;

  const post = await Post.findById(postId).select("user_id media");

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const thumbnail = post.media?.[0]?.url || null;

  await notifyPostComment(
    postId,
    post.user_id,
    commenterId,
    thumbnail,
    commentText
  );

  return res
    .status(201)
    .json(new ApiResponse(201, null, "Comment notification created"));
});

// POST /notifications/share/:postId - Create notification for share
export const createShareNotification = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const sharerId = req.user._id;

  const post = await Post.findById(postId).select("user_id media");

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  const thumbnail = post.media?.[0]?.url || null;

  await notifyPostShare(postId, post.user_id, sharerId, thumbnail);

  return res
    .status(201)
    .json(new ApiResponse(201, null, "Share notification created"));
});

// POST /notifications/reel/:reelId - Create notification for reel engagement
export const createReelNotification = asyncHandler(async (req, res) => {
  const { reelId } = req.params;
  const { action, commentText } = req.body; // action: 'like' or 'comment'
  const userId = req.user._id;

  const reel = await Reel.findById(reelId).select("user_id thumbnail_url");

  if (!reel) {
    throw new ApiError(404, "Reel not found");
  }

  if (action === "like") {
    await notifyReelLike(reelId, reel.user_id, userId, reel.thumbnail_url);
  } else if (action === "comment") {
    await notifyReelComment(
      reelId,
      reel.user_id,
      userId,
      reel.thumbnail_url,
      commentText
    );
  }

  return res
    .status(201)
    .json(new ApiResponse(201, null, "Reel notification created"));
});

// POST /notifications/follow/:userId - Create notification for follow
export const createFollowNotification = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const followerId = req.user._id;

  await notifyFollow(userId, followerId);

  return res
    .status(201)
    .json(new ApiResponse(201, null, "Follow notification created"));
});
