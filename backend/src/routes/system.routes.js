import { Router } from "express";
import {
  getAppUpdate,
  getServerHealth,
  setMaintenanceMode,
  getMaintenanceStatus,
  updateAppVersion,
} from "../controllers/system.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";

const router = Router();

// Public routes (no auth required)
router.route("/app-update").get(getAppUpdate);
router.route("/maintenance-status").get(getMaintenanceStatus);

// Protected routes (auth required)
router.route("/server-health").get(verifyJwt, getServerHealth);

// Admin-only routes
router.route("/maintenance-mode").put(verifyJwt, setMaintenanceMode);
router.route("/app-version/update").put(verifyJwt, updateAppVersion);

export default router;
