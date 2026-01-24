import admin from "firebase-admin";
import { NotificationSettings } from "../models/notificationSettings.model.js";

// Initialize Firebase Admin SDK
let firebaseApp;

try {
  // Check if service account credentials are provided
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
  } else {
    console.warn("⚠️ Firebase service account not configured. Push notifications will be disabled.");
  }
} catch (error) {
  console.error("❌ Firebase initialization error:", error.message);
}

/**
 * Send push notification to user
 * @param {string} userId - Recipient user ID
 * @param {object} notification - Notification data
 */
export const sendPushNotification = async (userId, notification) => {
  try {
    if (!firebaseApp) {
      console.warn("Firebase not initialized. Skipping push notification.");
      return null;
    }

    // Get user's FCM tokens and preferences
    const settings = await NotificationSettings.findOne({ user_id: userId });
    
    if (!settings || !settings.fcm_tokens || settings.fcm_tokens.length === 0) {
      return null;
    }

    // Check if push notifications are enabled
    if (!settings.preferences.push.enabled) {
      return null;
    }

    // Check notification type preference
    const notificationType = notification.type;
    const typePreference = settings.preferences.push[notificationType + "s"] || 
                          settings.preferences.push[notificationType];
    
    if (typePreference === false) {
      return null;
    }

    // Check Do Not Disturb mode
    if (settings.do_not_disturb?.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      const { start_time, end_time } = settings.do_not_disturb;
      
      if (start_time && end_time) {
        if (start_time < end_time) {
          // Same day range (e.g., 09:00 - 22:00)
          if (currentTime >= start_time && currentTime <= end_time) {
            return null;
          }
        } else {
          // Overnight range (e.g., 22:00 - 08:00)
          if (currentTime >= start_time || currentTime <= end_time) {
            return null;
          }
        }
      }
    }

    // Prepare FCM message
    const tokens = settings.fcm_tokens.map((t) => t.token);
    
    const message = {
      notification: {
        title: notification.title,
        body: notification.message,
        imageUrl: notification.thumbnail || undefined,
      },
      data: {
        type: notification.type,
        reference_id: notification.reference_id?.toString() || "",
        action_url: notification.action_url || "",
        sender_id: notification.sender_id?.toString() || "",
      },
      android: {
        priority: "high",
        notification: {
          sound: settings.preferences.in_app.sound ? "default" : undefined,
          channelId: "social_media_notifications",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: settings.preferences.in_app.sound ? "default" : undefined,
            badge: 1,
          },
        },
      },
      tokens,
    };

    // Send multicast message
    const response = await admin.messaging().sendEachForMulticast(message);

    // Remove invalid tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          console.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
        }
      });

      // Remove failed tokens from database
      if (failedTokens.length > 0) {
        await NotificationSettings.updateOne(
          { user_id: userId },
          {
            $pull: {
              fcm_tokens: { token: { $in: failedTokens } },
            },
          }
        );
      }
    }

    
    return response;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return null;
  }
};

/**
 * Register FCM token for user
 */
export const registerFCMToken = async (userId, token, deviceType, deviceId) => {
  try {
    let settings = await NotificationSettings.findOne({ user_id: userId });

    if (!settings) {
      // Create default settings with token
      settings = await NotificationSettings.create({
        user_id: userId,
        fcm_tokens: [
          {
            token,
            device_type: deviceType,
            device_id: deviceId,
          },
        ],
      });
    } else {
      // Check if token already exists
      const existingToken = settings.fcm_tokens.find((t) => t.token === token);
      
      if (!existingToken) {
        settings.fcm_tokens.push({
          token,
          device_type: deviceType,
          device_id: deviceId,
        });
        await settings.save();
      }
    }

    return settings;
  } catch (error) {
    console.error("Error registering FCM token:", error);
    throw error;
  }
};

/**
 * Unregister FCM token
 */
export const unregisterFCMToken = async (userId, token) => {
  try {
    await NotificationSettings.updateOne(
      { user_id: userId },
      {
        $pull: {
          fcm_tokens: { token },
        },
      }
    );
  } catch (error) {
    console.error("Error unregistering FCM token:", error);
    throw error;
  }
};
