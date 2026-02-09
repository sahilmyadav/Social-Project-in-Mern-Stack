import { Router } from 'express';
import {
  getAppUpdate,
  getMaintenanceStatus,
  getServerHealth,
  setMaintenanceMode,
  updateAppVersion,
} from '../controllers/system.controller.js';
import { verifyJwt } from '../middleware/auth.middleware.js';

const router = Router();

// Inline admin check — matches the pattern in admin.routes.js.
// Checks `userType` field (used by admin controller) OR `role` field (used by system controller)
// to be safe across both code paths until field naming is unified in PR4.
const requireAdmin = (req, res, next) => {
  if (req.user?.userType !== 'admin' && req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }
  next();
};

// Public routes (no auth required)
router.route('/app-update').get(getAppUpdate);
router.route('/maintenance-status').get(getMaintenanceStatus);

// Protected routes (auth required)
router.route('/server-health').get(verifyJwt, getServerHealth);

// Admin-only routes — require both auth and admin role
router.route('/maintenance-mode').put(verifyJwt, requireAdmin, setMaintenanceMode);
router.route('/app-version/update').put(verifyJwt, requireAdmin, updateAppVersion);

export default router;
