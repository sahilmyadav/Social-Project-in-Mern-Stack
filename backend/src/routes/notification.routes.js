import { Router } from "express";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  updateNotificationSettings,
  getNotificationSettings,
  registerDeviceToken,
  unregisterDeviceToken,
  createLikeNotification,
  createCommentNotification,
  createShareNotification,
  createReelNotification,
  createFollowNotification,
} from "../controllers/notification.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(verifyJwt);

// User-facing routes
router.route("/list").get(getNotifications);
router.route("/read/:notificationId").put(markNotificationAsRead);
router.route("/read-all").put(markAllNotificationsAsRead);
router.route("/unread-count").get(getUnreadCount);
router.route("/settings").get(getNotificationSettings);
router.route("/settings/update").put(updateNotificationSettings);
router.route("/register-token").post(registerDeviceToken);
router.route("/unregister-token").delete(unregisterDeviceToken);

// Internal routes (called by other services)
router.route("/like/:postId").post(createLikeNotification);
router.route("/comment/:postId").post(createCommentNotification);
router.route("/share/:postId").post(createShareNotification);
router.route("/reel/:reelId").post(createReelNotification);
router.route("/follow/:userId").post(createFollowNotification);

export default router;
