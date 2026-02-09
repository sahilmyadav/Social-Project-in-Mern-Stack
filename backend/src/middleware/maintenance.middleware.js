import { SystemConfig } from '../models/systemConfig.model.js';
import logger from '../utils/logger.js';
import redis from '../utils/redis.config.js';

const MAINTENANCE_CACHE_KEY = 'system:maintenance_mode';
const MAINTENANCE_CACHE_TTL = 30; // 30 seconds

/**
 * Middleware to check if system is in maintenance mode.
 * Caches the maintenance state in Redis to avoid a DB query on every request.
 */
export const checkMaintenanceMode = async (req, res, next) => {
  try {
    // Skip check for certain routes
    const allowedRoutes = [
      '/api/v1/system/maintenance-status',
      '/api/v1/system/maintenance-mode',
      '/api/v1/system/app-update',
      '/health',
    ];

    if (allowedRoutes.some((route) => req.path.startsWith(route))) {
      return next();
    }

    // Try Redis cache first
    let maintenanceData = null;
    try {
      const cached = await redis.get(MAINTENANCE_CACHE_KEY);
      if (cached) {
        maintenanceData = JSON.parse(cached);
      }
    } catch (_cacheErr) {
      // Redis unavailable — fall through to DB
    }

    // Cache miss — query DB and cache the result
    if (maintenanceData === null) {
      const maintenanceConfig = await SystemConfig.findOne({
        key: 'maintenance_mode',
      });

      maintenanceData = maintenanceConfig?.value || { enabled: false };

      // Cache in Redis (short TTL so changes are picked up quickly)
      try {
        await redis.set(
          MAINTENANCE_CACHE_KEY,
          JSON.stringify(maintenanceData),
          'EX',
          MAINTENANCE_CACHE_TTL
        );
      } catch (_cacheErr) {
        // Non-critical — proceed without cache
      }
    }

    if (!maintenanceData.enabled) {
      return next();
    }

    // Check if IP is allowed to bypass
    const clientIp =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;

    const allowedIps = maintenanceData.allowed_ips || [];
    if (allowedIps.includes(clientIp)) {
      return next();
    }

    // System is in maintenance mode
    return res.status(503).json({
      success: false,
      statusCode: 503,
      message: maintenanceData.message || 'System is under maintenance',
      data: {
        maintenance_mode: true,
        estimated_end_time: maintenanceData.estimated_end_time,
      },
    });
  } catch (error) {
    logger.error('Maintenance mode check error', { error: error.message });
    next();
  }
};
