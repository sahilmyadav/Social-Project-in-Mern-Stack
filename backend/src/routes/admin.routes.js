import { Router } from 'express';
import {
  adminLogin,
  banUser,
  deleteUser,
  getAdminDashboard,
  getAnalytics,
  getContent,
  getReports,
  getUsers,
  removeContent,
  resolveReport,
  sendGlobalNotification,
  verifyUser,
} from '../controllers/admin.controller.js';
import { requireAdmin } from '../middleware/adminAuth.middleware.js';
import { verifyJwt } from '../middleware/auth.middleware.js';
import { validateObjectId } from '../middleware/validate.js';

const router = Router();

// Public route (no auth)
router.route('/login').post(adminLogin);

// All other routes require authentication and admin role
const adminAuth = [verifyJwt, requireAdmin];

// Dashboard & Analytics
router.route('/dashboard').get(adminAuth, getAdminDashboard);
router.route('/analytics').get(adminAuth, getAnalytics);

// User Management
router.route('/users').get(adminAuth, getUsers);
router.route('/user/verify/:userId').put(adminAuth, validateObjectId('userId'), verifyUser);
router.route('/user/ban/:userId').put(adminAuth, validateObjectId('userId'), banUser);
router.route('/user/delete/:userId').delete(adminAuth, validateObjectId('userId'), deleteUser);

// Content Moderation
router.route('/content').get(adminAuth, getContent);
router
  .route('/content/remove/:contentId')
  .delete(adminAuth, validateObjectId('contentId'), removeContent);

// Reports Management
router.route('/reports').get(adminAuth, getReports);
router
  .route('/reports/resolve/:reportId')
  .put(adminAuth, validateObjectId('reportId'), resolveReport);

// Notifications
router.route('/notification/send-global').post(adminAuth, sendGlobalNotification);

export default router;
