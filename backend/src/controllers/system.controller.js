import { SystemConfig } from "../models/systemConfig.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import os from "os";

// GET /system/app-update - Get latest app version info
export const getAppUpdate = asyncHandler(async (req, res) => {
  const { platform, current_version } = req.query;

  // Get app version config from database
  let appVersionConfig = await SystemConfig.findOne({ key: "app_version" });

  // Default config if not found
  if (!appVersionConfig) {
    appVersionConfig = await SystemConfig.create({
      key: "app_version",
      value: {
        ios: {
          latest_version: "1.0.0",
          minimum_version: "1.0.0",
          force_update: false,
          update_url: "https://apps.apple.com/app/your-app",
          release_notes: "Initial release",
        },
        android: {
          latest_version: "1.0.0",
          minimum_version: "1.0.0",
          force_update: false,
          update_url: "https://play.google.com/store/apps/details?id=com.yourapp",
          release_notes: "Initial release",
        },
        web: {
          latest_version: "1.0.0",
          minimum_version: "1.0.0",
          force_update: false,
          release_notes: "Initial release",
        },
      },
      description: "App version configuration",
    });
  }

  const versionData = appVersionConfig.value;

  // If platform specified, return only that platform's data
  if (platform) {
    const platformData = versionData[platform.toLowerCase()];
    
    if (!platformData) {
      throw new ApiError(400, `Invalid platform: ${platform}`);
    }

    // Check if force update is required
    let updateRequired = false;
    let forceUpdate = platformData.force_update;

    if (current_version) {
      // Compare versions
      const currentVer = current_version.split(".").map(Number);
      const minimumVer = platformData.minimum_version.split(".").map(Number);
      const latestVer = platformData.latest_version.split(".").map(Number);

      // Check if current version is below minimum (force update)
      for (let i = 0; i < 3; i++) {
        if ((currentVer[i] || 0) < (minimumVer[i] || 0)) {
          forceUpdate = true;
          updateRequired = true;
          break;
        } else if ((currentVer[i] || 0) > (minimumVer[i] || 0)) {
          break;
        }
      }

      // Check if update is available
      for (let i = 0; i < 3; i++) {
        if ((currentVer[i] || 0) < (latestVer[i] || 0)) {
          updateRequired = true;
          break;
        } else if ((currentVer[i] || 0) > (latestVer[i] || 0)) {
          break;
        }
      }
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          platform: platform.toLowerCase(),
          latest_version: platformData.latest_version,
          minimum_version: platformData.minimum_version,
          current_version: current_version || null,
          update_available: updateRequired,
          force_update: forceUpdate,
          update_url: platformData.update_url,
          release_notes: platformData.release_notes,
        },
        "App version info fetched successfully"
      )
    );
  }

  // Return all platforms data
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        platforms: versionData,
        last_updated: appVersionConfig.updatedAt,
      },
      "App version info fetched successfully"
    )
  );
});

// GET /system/server-health - Server health check
export const getServerHealth = asyncHandler(async (req, res) => {
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    server: {
      platform: os.platform(),
      architecture: os.arch(),
      cpus: os.cpus().length,
      total_memory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      free_memory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      memory_usage: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        heap_total: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heap_used: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      },
      node_version: process.version,
    },
    services: {},
  };

  // Check database connection
  try {
    const dbState = mongoose.connection.readyState;
    const dbStates = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    healthData.services.database = {
      status: dbState === 1 ? "healthy" : "unhealthy",
      state: dbStates[dbState],
      name: mongoose.connection.name || "unknown",
      host: mongoose.connection.host || "unknown",
    };

    // Get database stats if connected
    if (dbState === 1) {
      const dbStats = await mongoose.connection.db.stats();
      healthData.services.database.stats = {
        collections: dbStats.collections,
        data_size: `${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`,
        index_size: `${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`,
      };
    }
  } catch (error) {
    healthData.services.database = {
      status: "unhealthy",
      error: error.message,
    };
    healthData.status = "degraded";
  }

  // Check storage (uploads directory)
  try {
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const uploadsDir = path.join(__dirname, "../../uploads");

    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      healthData.services.storage = {
        status: "healthy",
        uploads_directory: uploadsDir,
        files_count: files.length,
      };
    } else {
      healthData.services.storage = {
        status: "warning",
        message: "Uploads directory not found",
      };
    }
  } catch (error) {
    healthData.services.storage = {
      status: "unhealthy",
      error: error.message,
    };
  }

  // Check if any service is unhealthy
  const hasUnhealthyService = Object.values(healthData.services).some(
    (service) => service.status === "unhealthy"
  );

  if (hasUnhealthyService) {
    healthData.status = "unhealthy";
  }

  const statusCode = healthData.status === "healthy" ? 200 : 503;

  return res.status(statusCode).json(
    new ApiResponse(
      statusCode,
      healthData,
      `Server is ${healthData.status}`
    )
  );
});

// PUT /system/maintenance-mode - Toggle maintenance mode
export const setMaintenanceMode = asyncHandler(async (req, res) => {
  const { enabled, message, estimated_end_time, allowed_ips } = req.body;
  const userId = req.user?._id;

  // Check if user is admin
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Only admins can toggle maintenance mode");
  }

  // Get or create maintenance config
  let maintenanceConfig = await SystemConfig.findOne({
    key: "maintenance_mode",
  });

  const maintenanceData = {
    enabled: enabled !== undefined ? enabled : false,
    message:
      message ||
      "We're currently performing scheduled maintenance. Please check back soon!",
    estimated_end_time: estimated_end_time || null,
    allowed_ips: allowed_ips || [], // IPs that can bypass maintenance
    started_at: enabled ? new Date() : null,
    started_by: userId,
  };

  if (!maintenanceConfig) {
    maintenanceConfig = await SystemConfig.create({
      key: "maintenance_mode",
      value: maintenanceData,
      description: "Maintenance mode configuration",
      updated_by: userId,
    });
  } else {
    maintenanceConfig.value = maintenanceData;
    maintenanceConfig.updated_by = userId;
    await maintenanceConfig.save();
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        maintenance_mode: maintenanceConfig.value,
      },
      enabled
        ? "Maintenance mode enabled"
        : "Maintenance mode disabled"
    )
  );
});

// GET /system/maintenance-status - Check maintenance status (public)
export const getMaintenanceStatus = asyncHandler(async (req, res) => {
  const maintenanceConfig = await SystemConfig.findOne({
    key: "maintenance_mode",
  });

  if (!maintenanceConfig || !maintenanceConfig.value.enabled) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          maintenance_mode: false,
        },
        "System is operational"
      )
    );
  }

  return res.status(503).json(
    new ApiResponse(
      503,
      {
        maintenance_mode: true,
        message: maintenanceConfig.value.message,
        estimated_end_time: maintenanceConfig.value.estimated_end_time,
      },
      "System is under maintenance"
    )
  );
});

// PUT /system/app-version/update - Update app version config (Admin only)
export const updateAppVersion = asyncHandler(async (req, res) => {
  const { platform, latest_version, minimum_version, force_update, update_url, release_notes } = req.body;
  const userId = req.user?._id;

  // Check if user is admin
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Only admins can update app version");
  }

  if (!platform || !latest_version) {
    throw new ApiError(400, "Platform and latest_version are required");
  }

  const validPlatforms = ["ios", "android", "web"];
  if (!validPlatforms.includes(platform.toLowerCase())) {
    throw new ApiError(400, `Platform must be one of: ${validPlatforms.join(", ")}`);
  }

  // Get or create app version config
  let appVersionConfig = await SystemConfig.findOne({ key: "app_version" });

  if (!appVersionConfig) {
    appVersionConfig = await SystemConfig.create({
      key: "app_version",
      value: {},
      description: "App version configuration",
      updated_by: userId,
    });
  }

  // Update platform-specific data
  appVersionConfig.value[platform.toLowerCase()] = {
    latest_version,
    minimum_version: minimum_version || latest_version,
    force_update: force_update !== undefined ? force_update : false,
    update_url: update_url || appVersionConfig.value[platform.toLowerCase()]?.update_url,
    release_notes: release_notes || "Bug fixes and improvements",
  };

  appVersionConfig.updated_by = userId;
  appVersionConfig.markModified("value");
  await appVersionConfig.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        platform: platform.toLowerCase(),
        version_info: appVersionConfig.value[platform.toLowerCase()],
      },
      "App version updated successfully"
    )
  );
});
