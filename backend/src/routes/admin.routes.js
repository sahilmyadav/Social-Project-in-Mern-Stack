import { Router } from "express";
import {
  adminLogin,
  getAdminDashboard,
  getUsers,
  verifyUser,
  banUser,
  deleteUser,
  getContent,
  removeContent,
  getReports,
  resolveReport,
  sendGlobalNotification,
  getAnalytics,
} from "../controllers/admin.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";

const router = Router();

// Public route (no auth)
router.route("/login").post(adminLogin);

// All other routes require authentication and admin role
const adminAuth = [verifyJwt, (req, res, next) => {

  if (req.user.userType !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }
  next();
}];

// Dashboard & Analytics
router.route("/dashboard").get(adminAuth, getAdminDashboard);
router.route("/analytics").get(adminAuth, getAnalytics);

// User Management
router.route("/users").get(adminAuth, getUsers);
router.route("/user/verify/:userId").put(adminAuth, verifyUser);
router.route("/user/ban/:userId").put(adminAuth, banUser);
router.route("/user/delete/:userId").delete(adminAuth, deleteUser);

// Content Moderation
router.route("/content").get(adminAuth, getContent);
router.route("/content/remove/:contentId").delete(adminAuth, removeContent);

// Reports Management
router.route("/reports").get(adminAuth, getReports);
router.route("/reports/resolve/:reportId").put(adminAuth, resolveReport);

// Notifications
router.route("/notification/send-global").post(adminAuth, sendGlobalNotification);

export default router;
