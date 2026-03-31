import admin from 'firebase-admin';
import { NotificationSettings } from '../models/notificationSettings.model.js';
import logger from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════
//  Firebase Admin SDK — Advanced FCM for Web + Android + iOS
// ═══════════════════════════════════════════════════════════════════

let firebaseApp;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Option 1: Explicit service account JSON from environment
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info('[FCM] Firebase Admin SDK initialized with service account key');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT) {
    // Option 2: Application Default Credentials (ADC)
    // Works with: gcloud auth application-default login, GCE metadata, Workload Identity
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
    });
    logger.info('[FCM] Firebase Admin SDK initialized with Application Default Credentials');
  } else {
    logger.warn('[FCM] Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS. Push notifications disabled.');
  }
} catch (error) {
  logger.error('[FCM] Firebase initialization error:', { error: error.message });
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Get user's FCM tokens and settings.
 * Returns { settings, allTokens, mobileTokens, webTokens } or null.
 */
async function getUserTokens(userId) {
  const settings = await NotificationSettings.findOne({ user_id: userId }).lean();
  if (!settings?.fcm_tokens?.length) return null;

  const allTokens = settings.fcm_tokens.map((t) => t.token);
  const mobileTokens = settings.fcm_tokens
    .filter((t) => t.device_type === 'android' || t.device_type === 'ios')
    .map((t) => t.token);
  const webTokens = settings.fcm_tokens
    .filter((t) => t.device_type === 'web')
    .map((t) => t.token);

  return { settings, allTokens, mobileTokens, webTokens };
}

/**
 * Check Do Not Disturb status.
 * @returns {boolean} true if DND is active (should NOT send)
 */
function isDNDActive(settings) {
  if (!settings.do_not_disturb?.enabled) return false;
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const { start_time, end_time } = settings.do_not_disturb;
  if (!start_time || !end_time) return false;

  if (start_time < end_time) {
    return currentTime >= start_time && currentTime <= end_time;
  }
  // Overnight range (e.g., 22:00 - 08:00)
  return currentTime >= start_time || currentTime <= end_time;
}

/**
 * Send FCM multicast and auto-clean invalid tokens.
 * @param {string} userId
 * @param {object} message - FCM message with `tokens` array
 * @returns {object|null} response
 */
async function sendMulticast(userId, message) {
  if (!firebaseApp || !message.tokens?.length) return null;

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          // Only remove tokens that are permanently invalid
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(message.tokens[idx]);
          }
          logger.warn(`[FCM] Token failed for ${userId}:`, {
            code,
            error: resp.error?.message,
          });
        }
      });

      if (failedTokens.length > 0) {
        await NotificationSettings.updateOne(
          { user_id: userId },
          { $pull: { fcm_tokens: { token: { $in: failedTokens } } } }
        );
        logger.info(`[FCM] Removed ${failedTokens.length} invalid tokens for ${userId}`);
      }
    }

    logger.info(`[FCM] Sent to ${userId}: ${response.successCount}/${message.tokens.length} success`);
    return response;
  } catch (error) {
    logger.error(`[FCM] Multicast error for ${userId}:`, { error: error.message });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  1. GENERAL PUSH NOTIFICATION (all platforms — likes, comments, follows, etc.)
// ═══════════════════════════════════════════════════════════════════

/**
 * Send push notification to ALL user devices (web + mobile).
 * Used for social notifications: likes, comments, shares, follows, etc.
 */
export const sendPushNotification = async (userId, notification) => {
  try {
    if (!firebaseApp) return null;

    const tokenData = await getUserTokens(userId);
    if (!tokenData) return null;

    const { settings, allTokens } = tokenData;

    // Check push preference
    if (!settings.preferences?.push?.enabled) return null;

    // Check type-specific preference
    const notificationType = notification.type;
    const typePreference =
      settings.preferences.push[notificationType + 's'] ??
      settings.preferences.push[notificationType];
    if (typePreference === false) return null;

    // Check DND (skip for calls — those bypass DND)
    if (isDNDActive(settings)) return null;

    const message = {
      notification: {
        title: notification.title,
        body: notification.message,
        imageUrl: notification.thumbnail || undefined,
      },
      data: {
        type: notification.type || '',
        reference_id: notification.reference_id?.toString() || '',
        action_url: notification.action_url || '',
        sender_id: notification.sender_id?.toString() || '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        notification: {
          sound: settings.preferences?.in_app?.sound ? 'default' : undefined,
          channelId: 'social_notifications',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          tag: `${notification.type}_${notification.reference_id || ''}`,
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            sound: settings.preferences?.in_app?.sound ? 'default' : undefined,
            badge: 1,
            'mutable-content': 1,
            'thread-id': notification.type,
          },
        },
      },
      webpush: {
        notification: {
          title: notification.title,
          body: notification.message,
          icon: notification.thumbnail || '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: `${notification.type}_${notification.reference_id || ''}`,
          renotify: true,
          requireInteraction: false,
          data: {
            url: notification.action_url || '/',
          },
        },
        fcmOptions: {
          link: notification.action_url || '/',
        },
      },
      tokens: allTokens,
    };

    return await sendMulticast(userId, message);
  } catch (error) {
    logger.error('[FCM] Error sending push notification:', { error: error.message });
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════
//  2. INCOMING CALL PUSH (DATA-only — high priority, all platforms)
// ═══════════════════════════════════════════════════════════════════

/**
 * Send incoming call notification to ALL devices.
 * - Mobile (Android/iOS): DATA-only message → handled by onBackgroundMessage
 *   → show full-screen incoming call UI (flutter_callkit_incoming)
 * - Web: notification + data → shows browser notification with accept/reject actions
 *
 * IMPORTANT: Calls bypass DND — always delivered immediately.
 */
export const sendCallPushNotification = async (userId, callData) => {
  try {
    if (!firebaseApp) return null;

    const tokenData = await getUserTokens(userId);
    if (!tokenData) return null;

    const { allTokens, mobileTokens, webTokens } = tokenData;
    const results = [];

    const callTypeLabel = callData.callType === 'video' ? 'Video Call' : 'Voice Call';
    const groupLabel = callData.isGroupCall ? ` (${callData.groupName})` : '';

    const dataPayload = {
      type: 'incoming_call',
      caller_id: callData.callerId?.toString() || '',
      caller_name: callData.callerName || 'Unknown',
      caller_avatar: callData.callerAvatar || '',
      call_type: callData.callType || 'audio',
      call_id: callData.callId || '',
      thread_id: callData.threadId?.toString() || '',
      is_group_call: callData.isGroupCall ? 'true' : 'false',
      group_id: callData.groupId?.toString() || '',
      group_name: callData.groupName || '',
      navigation_screen: 'incoming_call',
      uuid: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    // ── Mobile: DATA-only (no notification key) so Flutter handles background ──
    if (mobileTokens.length > 0) {
      const mobileMsg = {
        data: dataPayload,
        android: {
          priority: 'high',
          ttl: 30000,
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-expiration': String(Math.floor(Date.now() / 1000) + 30),
          },
          payload: {
            aps: {
              'content-available': 1,
              sound: 'ringtone.caf',
            },
          },
        },
        tokens: mobileTokens,
      };
      results.push(sendMulticast(userId, mobileMsg));
    }

    // ── Web: notification + data so browser shows call notification ──
    if (webTokens.length > 0) {
      const webMsg = {
        data: dataPayload,
        webpush: {
          notification: {
            title: `${callTypeLabel} from ${callData.callerName}${groupLabel}`,
            body: callData.isGroupCall
              ? `${callData.callerName} is calling in ${callData.groupName}`
              : `${callData.callerName} is calling you`,
            icon: callData.callerAvatar || '/icon-192x192.png',
            badge: '/badge-72x72.png',
            tag: `call_${callData.callerId}`,
            renotify: true,
            requireInteraction: true,
            actions: [
              { action: 'accept', title: 'Accept' },
              { action: 'reject', title: 'Reject' },
            ],
            vibrate: [200, 100, 200, 100, 200],
            data: {
              url: `/calls?callerId=${callData.callerId}&threadId=${callData.threadId || ''}`,
            },
          },
          fcmOptions: {
            link: `/calls?callerId=${callData.callerId}`,
          },
        },
        tokens: webTokens,
      };
      results.push(sendMulticast(userId, webMsg));
    }

    const responses = await Promise.all(results);
    return responses.filter(Boolean);
  } catch (error) {
    logger.error('[FCM] Error sending call push:', { error: error.message });
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════
//  3. GROUP CALL PUSH
// ═══════════════════════════════════════════════════════════════════

/**
 * Send group call notification to all group members except the caller.
 *
 * @param {string[]} memberUserIds   - All group member user IDs
 * @param {string}   callerUserId    - The user who started the call (excluded)
 * @param {object}   callData        - { callerId, callerName, callerAvatar, callType, groupId, groupName, threadId }
 */
export const sendGroupCallPushNotification = async (memberUserIds, callerUserId, callData) => {
  const results = await Promise.allSettled(
    memberUserIds
      .filter((uid) => uid.toString() !== callerUserId.toString())
      .map((uid) =>
        sendCallPushNotification(uid.toString(), {
          ...callData,
          isGroupCall: true,
        })
      )
  );

  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  const failCount = results.filter((r) => r.status === 'rejected').length;
  logger.info(`[FCM] Group call push: ${successCount} sent, ${failCount} failed, caller excluded`);

  return results;
};

// ═══════════════════════════════════════════════════════════════════
//  4. CALL EVENT PUSH (end, reject, missed — dismiss call UI)
// ═══════════════════════════════════════════════════════════════════

/**
 * Send call event to ALL devices to dismiss the incoming call UI.
 * @param {string} userId
 * @param {string} callerId
 * @param {string} event - 'call_rejected', 'call_ended', 'call_missed', 'call_accepted'
 */
export const sendCallEventPush = async (userId, callerId, event) => {
  try {
    if (!firebaseApp) return null;

    const tokenData = await getUserTokens(userId);
    if (!tokenData) return null;

    const { allTokens } = tokenData;

    const message = {
      data: {
        type: event,
        caller_id: callerId?.toString() || '',
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        ttl: 15000,
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { 'content-available': 1 } },
      },
      webpush: {
        notification: {
          // Close the existing call notification tag
          tag: `call_${callerId}`,
          // Using empty silent notification to dismiss
          silent: true,
        },
        data: {
          type: event,
          caller_id: callerId?.toString() || '',
        },
      },
      tokens: allTokens,
    };

    return await sendMulticast(userId, message);
  } catch (error) {
    logger.error(`[FCM] Error sending ${event}:`, { error: error.message });
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════
//  5. CHAT MESSAGE PUSH
//
//  FIX: Mobile now sends DATA-ONLY (no notification{} key).
//
//  WHY THIS MATTERS:
//  When a message has BOTH notification{} and data{} keys:
//  - Background: Android shows the notification automatically ✓
//    but does NOT wake the Dart isolate → background handler never fires
//  - Killed: Android shows notification automatically ✓
//    but Dart isolate is NEVER started → background handler never fires
//
//  With DATA-ONLY on mobile:
//  - Background: Android wakes the Dart isolate → background handler fires
//    → _showMessageNotification() shows the notification ✓
//  - Killed: Android wakes the Dart isolate → background handler fires ✓
//    AND the native ClickMeFirebaseMessagingService.kt also fires as backup ✓
//
//  Web still gets notification + data (browsers require it for visibility).
// ═══════════════════════════════════════════════════════════════════

export const sendMessagePushNotification = async (userId, msgData) => {
  try {
    if (!firebaseApp) return null;
    const tokenData = await getUserTokens(userId);
    if (!tokenData) return null;
    const { settings, mobileTokens, webTokens } = tokenData;

    if (!settings.preferences?.push?.enabled) return null;
    if (settings.preferences?.push?.messages === false) return null;
    if (isDNDActive(settings)) return null;

    const title = msgData.isGroupMessage
      ? `${msgData.senderName} in ${msgData.groupName}`
      : msgData.senderName || 'New Message';

    const body =
      msgData.messageType === 'image' ? '📷 Photo' :
        msgData.messageType === 'video' ? '🎥 Video' :
          msgData.messageType === 'audio' ? '🎵 Voice message' :
            msgData.messageType === 'file' ? '📎 File' :
              msgData.messageType === 'location' ? '📍 Location' :
                msgData.messageType === 'sticker' ? '🎨 Sticker' :
                  msgData.messagePreview || 'New message';

    const threadId = msgData.threadId?.toString() || '';
    const chatUrl = msgData.isGroupMessage ? `/chat/group/${threadId}` : `/chat/${threadId}`;

    const dataPayload = {
      type: 'chat_message',
      sender_id: msgData.senderId?.toString() || '',
      sender_name: msgData.senderName || '',
      sender_avatar: msgData.senderAvatar || '',
      thread_id: threadId,
      message_preview: body,
      message_type: msgData.messageType || 'text',
      is_group_message: msgData.isGroupMessage ? 'true' : 'false',
      group_name: msgData.groupName || '',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      timestamp: new Date().toISOString(),
    };

    const results = [];

    // ── Mobile: DATA-ONLY ─────────────────────────────────────────────────
    // No notification{} key AND no android.notification{} — both would make
    // FCM treat this as a notification message, preventing the Dart isolate
    // from starting in killed state. Channel and tag are passed via data{}
    // so the Flutter background handler can use them when showing the
    // notification manually via flutter_local_notifications.
    if (mobileTokens.length > 0) {
      results.push(sendMulticast(userId, {
        data: {
          ...dataPayload,
          channel_id: 'chat_messages',
          tag: `chat_${threadId}`,
        },
        android: {
          priority: 'high',
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'background',
          },
          payload: {
            aps: {
              'content-available': 1,
              sound: settings.preferences?.in_app?.sound ? 'default' : undefined,
              badge: 1,
              'mutable-content': 1,
              'thread-id': `chat_${threadId}`,
            },
          },
        },
        tokens: mobileTokens,
      }));
    }

    // ── Web: notification + data (browser requires notification key) ──────
    if (webTokens.length > 0) {
      results.push(sendMulticast(userId, {
        data: dataPayload,
        notification: { title, body },
        webpush: {
          notification: {
            title,
            body,
            icon: msgData.senderAvatar || '/icon-192x192.png',
            badge: '/badge-72x72.png',
            tag: `chat_${threadId}`,
            renotify: true,
            data: { url: chatUrl },
          },
          fcmOptions: { link: chatUrl },
        },
        tokens: webTokens,
      }));
    }

    const responses = await Promise.all(results);
    return responses.filter(Boolean);
  } catch (error) {
    logger.error('[FCM] Error sending message push:', { error: error.message });
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════
//  6. LIVE STREAM PUSH
// ═══════════════════════════════════════════════════════════════════

/**
 * Send live stream started notification to a follower.
 * @param {string} userId - Follower to notify
 * @param {object} streamData
 */
export const sendLiveStreamPush = async (userId, streamData) => {
  try {
    if (!firebaseApp) return null;

    const tokenData = await getUserTokens(userId);
    if (!tokenData) return null;

    const { settings, allTokens } = tokenData;

    if (!settings.preferences?.push?.enabled) return null;
    if (isDNDActive(settings)) return null;

    const title = 'Live Video';
    const body = `${streamData.streamerName} started a live video`;
    const liveUrl = `/live/watch/${streamData.streamId}`;

    const message = {
      notification: { title, body, imageUrl: streamData.thumbnail || undefined },
      data: {
        type: 'live_started',
        stream_id: streamData.streamId?.toString() || '',
        streamer_id: streamData.streamerId?.toString() || '',
        streamer_name: streamData.streamerName || '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'live_streams',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          tag: `live_${streamData.streamerId}`,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'thread-id': 'live_streams',
          },
        },
      },
      webpush: {
        notification: {
          title,
          body,
          icon: streamData.streamerAvatar || '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: `live_${streamData.streamerId}`,
          requireInteraction: true,
          data: { url: liveUrl },
        },
        fcmOptions: { link: liveUrl },
      },
      tokens: allTokens,
    };

    return await sendMulticast(userId, message);
  } catch (error) {
    logger.error('[FCM] Error sending live stream push:', { error: error.message });
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════
//  7. TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Register FCM token for a user device.
 * Updates existing token if device_id matches, otherwise adds new.
 */
export const registerFCMToken = async (userId, token, deviceType, deviceId) => {
  try {
    let settings = await NotificationSettings.findOne({ user_id: userId });

    if (!settings) {
      settings = await NotificationSettings.create({
        user_id: userId,
        fcm_tokens: [{ token, device_type: deviceType, device_id: deviceId }],
      });
    } else {
      // If same device_id exists, update its token (device reinstall / token refresh)
      const existingIdx = settings.fcm_tokens.findIndex(
        (t) => t.device_id && t.device_id === deviceId
      );

      if (existingIdx >= 0) {
        settings.fcm_tokens[existingIdx].token = token;
        settings.fcm_tokens[existingIdx].device_type = deviceType;
        settings.fcm_tokens[existingIdx].created_at = new Date();
      } else {
        // Check if token already exists (same token from different device_id)
        const tokenExists = settings.fcm_tokens.some((t) => t.token === token);
        if (!tokenExists) {
          settings.fcm_tokens.push({ token, device_type: deviceType, device_id: deviceId });
        }
      }
      await settings.save();
    }

    // Subscribe to user-specific topic for broadcast notifications
    if (firebaseApp) {
      try {
        await admin.messaging().subscribeToTopic([token], `user_${userId}`);
      } catch (e) {
        // Non-critical — topic subscription failure shouldn't block registration
      }
    }

    logger.info(`[FCM] Token registered for ${userId} (${deviceType})`);
    return settings;
  } catch (error) {
    logger.error('[FCM] Error registering token:', { error: error.message });
    throw error;
  }
};

/**
 * Unregister FCM token.
 */
export const unregisterFCMToken = async (userId, token) => {
  try {
    await NotificationSettings.updateOne(
      { user_id: userId },
      { $pull: { fcm_tokens: { token } } }
    );

    // Unsubscribe from user topic
    if (firebaseApp) {
      try {
        await admin.messaging().unsubscribeFromTopic([token], `user_${userId}`);
      } catch (e) {
        // Non-critical
      }
    }

    logger.info(`[FCM] Token unregistered for ${userId}`);
  } catch (error) {
    logger.error('[FCM] Error unregistering token:', { error: error.message });
    throw error;
  }
};

/**
 * Send a topic-based broadcast (e.g., app-wide announcements).
 * @param {string} topic - Topic name (e.g., 'all_users', 'user_{id}')
 * @param {object} notification - { title, body, imageUrl }
 * @param {object} data - Optional data payload
 */
export const sendTopicNotification = async (topic, notification, data = {}) => {
  try {
    if (!firebaseApp) return null;

    const message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl || undefined,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        notification: { channelId: 'announcements', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.imageUrl || '/icon-192x192.png',
          requireInteraction: true,
        },
      },
    };

    const response = await admin.messaging().send(message);
    logger.info(`[FCM] Topic message sent to ${topic}:`, response);
    return response;
  } catch (error) {
    logger.error(`[FCM] Error sending topic notification:`, { error: error.message });
    return null;
  }
};
