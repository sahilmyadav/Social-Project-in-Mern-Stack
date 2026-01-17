import { SystemConfig } from "../models/systemConfig.model.js";

/**
 * Middleware to check if system is in maintenance mode
 */
export const checkMaintenanceMode = async (req, res, next) => {
  try {
    // Skip check for certain routes
    const allowedRoutes = [
      "/api/v1/system/maintenance-status",
      "/api/v1/system/maintenance-mode",
      "/api/v1/system/app-update",
      "/health",
    ];

    if (allowedRoutes.some((route) => req.path.startsWith(route))) {
      return next();
    }

    // Check maintenance config
    const maintenanceConfig = await SystemConfig.findOne({
      key: "maintenance_mode",
    });

    if (!maintenanceConfig || !maintenanceConfig.value.enabled) {
      return next();
    }

    // Check if IP is allowed to bypass
    const clientIp =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress;

    const allowedIps = maintenanceConfig.value.allowed_ips || [];
    if (allowedIps.includes(clientIp)) {
      return next();
    }

    // System is in maintenance mode
    return res.status(503).json({
      success: false,
      statusCode: 503,
      message: maintenanceConfig.value.message || "System is under maintenance",
      data: {
        maintenance_mode: true,
        estimated_end_time: maintenanceConfig.value.estimated_end_time,
      },
    });
  } catch (error) {
    // If error checking maintenance mode, allow request to continue
    console.error("Maintenance mode check error:", error);
    next();
  }
};
