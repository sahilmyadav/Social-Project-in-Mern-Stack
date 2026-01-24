import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Reel } from "../models/reel.model.js";
import { Story } from "../models/story.model.js";
import { Report } from "../models/report.model.js";
import { AdminLog } from "../models/adminLog.model.js";
import { Notification } from "../models/notification.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { sendPushNotification } from "../services/firebase.service.js";
import { getIO } from "../socket/socket.js";

// Helper: Log admin actions
const logAdminAction = async (adminId, action, targetType, targetId, details, req) => {
  try {
    await AdminLog.create({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      user_agent: req.headers["user-agent"],
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
};

// POST /admin/login - Admin authentication
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // Find user with admin role
  const admin = await User.findOne({ email, userType: "admin" }).select("+password");

  if (!admin) {
    throw new ApiError(401, "Invalid admin credentials");
  }

  // Verify password
  const isPasswordValid = await admin.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid admin credentials");
  }

  // Check if admin account is active
  if (admin.status !== "active") {
    throw new ApiError(403, "Admin account is suspended");
  }

  // Generate tokens
  const accessToken = await admin.generateAccessToken();
  const refreshToken = await admin.generateRefreshToken();

  // Save refresh token
  admin.refreshToken = refreshToken;
  await admin.save({ validateBeforeSave: false });

  // Remove sensitive data
  admin.password = undefined;
  admin.refreshToken = undefined;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        admin,
        accessToken,
        refreshToken,
      },
      "Admin logged in successfully"
    )
  );
});

// GET /admin/dashboard - Admin overview
export const getAdminDashboard = asyncHandler(async (req, res) => {
  // Total users
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ status: "active" });
  const bannedUsers = await User.countDocuments({ status: "banned" });
  const verifiedUsers = await User.countDocuments({ isVerified: true });

  // Today's new users
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });

  // Content stats
  const totalPosts = await Post.countDocuments({ is_deleted: false });
  const totalReels = await Reel.countDocuments({ is_deleted: false });
  const totalStories = await Story.countDocuments({
    expires_at: { $gte: new Date() },
  });

  // Reports
  const pendingReports = await Report.countDocuments({ status: "pending" });
  const resolvedReports = await Report.countDocuments({ status: "resolved" });

  // Recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentUsers = await User.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
  });

  const recentPosts = await Post.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
    is_deleted: false,
  });

  // Storage (estimate)
  const storageStats = {
    total_uploads: totalPosts + totalReels + totalStories,
    estimated_size: "Calculate from Cloudinary or storage service",
  };

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        users: {
          total: totalUsers,
          active: activeUsers,
          banned: bannedUsers,
          verified: verifiedUsers,
          new_today: newUsersToday,
          new_this_week: recentUsers,
        },
        content: {
          posts: totalPosts,
          reels: totalReels,
          active_stories: totalStories,
          recent_posts: recentPosts,
        },
        reports: {
          pending: pendingReports,
          resolved: resolvedReports,
        },
        storage: storageStats,
      },
      "Dashboard data fetched successfully"
    )
  );
});

// GET /admin/users - Paginated user list with filters
export const getUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    isVerified,
    search,
    sort = "-createdAt",
  } = req.query;

  // Build query
  const query = {};

  if (status) {
    query.status = status;
  }

  if (isVerified !== undefined) {
    query.isVerified = isVerified === "true";
  }

  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { username: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const users = await User.find(query)
    .select("-password -refreshToken")
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const totalUsers = await User.countDocuments(query);
  const totalPages = Math.ceil(totalUsers / parseInt(limit));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        users,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_users: totalUsers,
          per_page: parseInt(limit),
          has_more: parseInt(page) < totalPages,
        },
      },
      "Users fetched successfully"
    )
  );
});

// PUT /admin/user/verify/:userId - Verify user
export const verifyUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const adminId = req.user._id;

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.isVerified = true;
  await user.save();

  // Log action
  await logAdminAction(adminId, "user_verify", "User", userId, {
    user_email: user.email,
    username: user.username,
  }, req);

  return res.status(200).json(
    new ApiResponse(
      200,
      { user },
      "User verified successfully"
    )
  );
});

// PUT /admin/user/ban/:userId - Ban user
export const banUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason, duration } = req.body; // duration in days
  const adminId = req.user._id;

  if (!reason) {
    throw new ApiError(400, "Ban reason is required");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === "admin") {
    throw new ApiError(403, "Cannot ban admin users");
  }

  user.status = "banned";
  user.banReason = reason;

  if (duration) {
    const banUntil = new Date();
    banUntil.setDate(banUntil.getDate() + parseInt(duration));
    user.banUntil = banUntil;
  }

  await user.save();

  // Log action
  await logAdminAction(adminId, "user_ban", "User", userId, {
    reason,
    duration,
    user_email: user.email,
  }, req);

  return res.status(200).json(
    new ApiResponse(
      200,
      { user },
      "User banned successfully"
    )
  );
});

// DELETE /admin/user/delete/:userId - Permanently delete user
export const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const adminId = req.user._id;

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === "admin") {
    throw new ApiError(403, "Cannot delete admin users");
  }

  // Delete user's content
  await Post.deleteMany({ user_id: userId });
  await Reel.deleteMany({ user_id: userId });
  await Story.deleteMany({ user_id: userId });
  await Report.deleteMany({ user_id: userId });
  await Notification.deleteMany({ $or: [{ recipient_id: userId }, { sender_id: userId }] });

  // Log action before deletion
  await logAdminAction(adminId, "user_delete", "User", userId, {
    user_email: user.email,
    username: user.username,
  }, req);

  // Delete user
  await User.findByIdAndDelete(userId);

  return res.status(200).json(
    new ApiResponse(
      200,
      null,
      "User and associated data deleted permanently"
    )
  );
});

// GET /admin/content - List all content for moderation
export const getContent = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type = "post", // post, reel, story
    status,
    reported,
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  let content = [];
  let total = 0;

  const query = {};
  if (status === "deleted") {
    query.is_deleted = true;
  } else {
    query.is_deleted = false;
  }

  if (type === "post") {
    content = await Post.find(query)
      .populate("user_id", "firstName lastName username email")
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit));
    total = await Post.countDocuments(query);
  } else if (type === "reel") {
    content = await Reel.find(query)
      .populate("user_id", "firstName lastName username email")
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit));
    total = await Reel.countDocuments(query);
  } else if (type === "story") {
    content = await Story.find(query)
      .populate("user_id", "firstName lastName username email")
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit));
    total = await Story.countDocuments(query);
  }

  const totalPages = Math.ceil(total / parseInt(limit));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        content,
        type,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_items: total,
          per_page: parseInt(limit),
        },
      },
      "Content fetched successfully"
    )
  );
});

// DELETE /admin/content/remove/:contentId - Remove content
export const removeContent = asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { type, reason } = req.body; // type: post, reel, story
  const adminId = req.user._id;

  if (!type) {
    throw new ApiError(400, "Content type is required");
  }

  let content;

  if (type === "post") {
    content = await Post.findById(contentId);
    if (content) {
      content.is_deleted = true;
      await content.save();
    }
  } else if (type === "reel") {
    content = await Reel.findById(contentId);
    if (content) {
      content.is_deleted = true;
      await content.save();
    }
  } else if (type === "story") {
    content = await Story.findByIdAndDelete(contentId);
  }

  if (!content) {
    throw new ApiError(404, "Content not found");
  }

  // Log action
  await logAdminAction(adminId, "content_remove", type === "post" ? "Post" : type === "reel" ? "Reel" : "Story", contentId, {
    reason,
    content_type: type,
  }, req);

  return res.status(200).json(
    new ApiResponse(
      200,
      null,
      "Content removed successfully"
    )
  );
});

// GET /admin/reports - View reports
export const getReports = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
  } = req.query;

  const query = {};

  if (status) {
    query.status = status;
  }

  if (type) {
    query.target_type = type;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const reports = await Report.find(query)
    .populate("user_id", "firstName lastName username email")
    .populate("target_id")
    .sort("-createdAt")
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Report.countDocuments(query);
  const totalPages = Math.ceil(total / parseInt(limit));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        reports,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_reports: total,
          per_page: parseInt(limit),
        },
      },
      "Reports fetched successfully"
    )
  );
});

// PUT /admin/reports/resolve/:reportId - Resolve report
export const resolveReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { action, notes } = req.body; // action: resolved, dismissed, escalated
  const adminId = req.user._id;

  const report = await Report.findById(reportId);

  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  report.status = action || "resolved";
  report.admin_notes = notes;
  report.resolved_by = adminId;
  report.resolved_at = new Date();
  await report.save();

  // Log action
  await logAdminAction(adminId, "report_resolve", "Report", reportId, {
    action,
    notes,
    report_type: report.reported_type,
  }, req);

  return res.status(200).json(
    new ApiResponse(
      200,
      { report },
      "Report resolved successfully"
    )
  );
});

// POST /admin/notification/send-global - Send global notification
export const sendGlobalNotification = asyncHandler(async (req, res) => {
  const { title, message, segment, action_url } = req.body;
  const adminId = req.user._id;

  if (!title || !message) {
    throw new ApiError(400, "Title and message are required");
  }

  // Build user query based on segment
  let userQuery = { status: "active" };

  if (segment === "verified") {
    userQuery.isVerified = true;
  } else if (segment === "new") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    userQuery.createdAt = { $gte: sevenDaysAgo };
  }

  // Get users
  const users = await User.find(userQuery).select("_id");
  const userIds = users.map(u => u._id);

  // Create notifications
  const notifications = userIds.map(userId => ({
    recipient_id: userId,
    sender_id: adminId,
    type: "mention", // Generic type for global notifications
    title,
    message,
    action_url: action_url || "/",
  }));

  await Notification.insertMany(notifications);

  // Send push notifications (in background)
  users.forEach(user => {
    sendPushNotification(user._id, {
      type: "mention",
      title,
      message,
      action_url: action_url || "/",
      sender_id: adminId,
    });
  });

  // Log action
  await logAdminAction(adminId, "global_notification", "System", null, {
    title,
    segment,
    user_count: userIds.length,
  }, req);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        sent_to: userIds.length,
        segment,
      },
      "Global notification sent successfully"
    )
  );
});

// GET /admin/analytics - Deep analytics
export const getAnalytics = asyncHandler(async (req, res) => {
  const { period = "7d" } = req.query; // 7d, 30d, 90d, 1y

  // Calculate date range
  const now = new Date();
  const periodMap = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };

  const daysAgo = periodMap[period] || 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysAgo);

  // User analytics
  const newUsers = await User.countDocuments({
    createdAt: { $gte: startDate },
  });

  const activeUsers = await User.countDocuments({
    status: "active",
    lastActive: { $gte: startDate },
  });

  // Content analytics
  const newPosts = await Post.countDocuments({
    createdAt: { $gte: startDate },
    is_deleted: false,
  });

  const newReels = await Reel.countDocuments({
    createdAt: { $gte: startDate },
    is_deleted: false,
  });

  // Engagement (approximate)
  const totalUsers = await User.countDocuments({ status: "active" });
  const dau = activeUsers; // Daily Active Users (approximate)
  const mau = await User.countDocuments({
    status: "active",
    lastActive: { $gte: new Date(now.setDate(now.getDate() - 30)) },
  });

  // Retention rate (simplified)
  const retentionRate = mau > 0 ? ((dau / mau) * 100).toFixed(2) : 0;

  // Admin activity
  const adminActions = await AdminLog.countDocuments({
    createdAt: { $gte: startDate },
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        period,
        date_range: {
          start: startDate,
          end: new Date(),
        },
        users: {
          new_users: newUsers,
          active_users: activeUsers,
          total_users: totalUsers,
          dau,
          mau,
          retention_rate: `${retentionRate}%`,
        },
        content: {
          new_posts: newPosts,
          new_reels: newReels,
          total_content: newPosts + newReels,
        },
        engagement: {
          posts_per_user: totalUsers > 0 ? (newPosts / totalUsers).toFixed(2) : 0,
          reels_per_user: totalUsers > 0 ? (newReels / totalUsers).toFixed(2) : 0,
        },
        admin: {
          total_actions: adminActions,
        },
      },
      "Analytics fetched successfully"
    )
  );
});
