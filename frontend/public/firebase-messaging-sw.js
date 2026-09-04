/* eslint-disable no-restricted-globals */
// Firebase Messaging Service Worker
// Handles background push notifications when the app is not focused
//
// CRITICAL: All event handlers (push, notificationclick, pushsubscriptionchange)
// MUST be registered synchronously at the top level during initial evaluation.
// Registering them inside callbacks or conditionals causes Chrome to reject them.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const FALLBACK_ICON = '/logo.png';

// Firebase config — received from main thread via postMessage
let firebaseConfig = null;

function ensureFirebaseInit() {
  if (firebase.apps.length) return true;
  if (firebaseConfig?.apiKey) {
    firebase.initializeApp(firebaseConfig);
    return true;
  }
  return false;
}

// Receive config from the main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    ensureFirebaseInit();
  }
});

// ─── PUSH handler (registered at top level) ────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  // If Firebase is initialized, let its SDK handle via onBackgroundMessage
  // (it hooks into the push event internally and will call our callback).
  // But if Firebase hasn't initialised yet we must show the notification ourselves.
  if (firebase.apps.length) {
    // Firebase SDK will handle this push event via its own internal listener.
    // We still need to process it ourselves because the SDK's onBackgroundMessage
    // may not have been registered yet (it requires firebase.messaging() first).
    // So we handle it directly here.
  }

  const data = payload.data || {};
  const notification = payload.notification || {};
  const type = data.type || '';

  // Skip if this is a foreground message (the app will handle it)
  // The FCM SDK sets this flag when the page is visible
  if (payload.isFirebaseMessaging && payload.messageType === 'push-received') {
    // This is an FCM-managed push. Show notification ourselves since
    // onBackgroundMessage may not be wired yet.
  }

  let notificationPromise;

  // ── Incoming call ──
  if (type === 'incoming_call' || type === 'incoming_group_call') {
    const callerName = data.caller_name || 'Someone';
    const callType = data.call_type === 'video' ? 'Video Call' : 'Voice Call';

    notificationPromise = self.registration.showNotification(
      `${callType} from ${callerName}`,
      {
        body: `${callerName} is calling you...`,
        icon: data.caller_avatar || FALLBACK_ICON,
        badge: FALLBACK_ICON,
        tag: `call_${data.thread_id || Date.now()}`,
        requireInteraction: true,
        actions: [
          { action: 'accept', title: 'Accept' },
          { action: 'reject', title: 'Reject' },
        ],
        data: { ...data, url: '/' },
        vibrate: [300, 100, 300, 100, 300],
      }
    );
  }
  // ── Call events — dismiss call notification ──
  else if (
    type === 'call_accepted' ||
    type === 'call_rejected' ||
    type === 'call_ended' ||
    type === 'call_missed'
  ) {
    notificationPromise = self.registration
      .getNotifications({ tag: `call_${data.thread_id}` })
      .then((notifications) => {
        notifications.forEach((n) => n.close());
        if (type === 'call_missed') {
          return self.registration.showNotification('Missed Call', {
            body: `You missed a call from ${data.caller_name || 'someone'}`,
            icon: FALLBACK_ICON,
            tag: `missed_call_${data.thread_id || Date.now()}`,
            data: { url: '/calls' },
          });
        }
      });
  }
  // ── Chat message ──
  else if (type === 'chat_message') {
    const senderName = data.sender_name || 'New Message';
    const isGroup = data.is_group_message === 'true';
    const title = isGroup
      ? `${senderName} in ${data.group_name || 'Group'}`
      : senderName;
    const chatUrl = isGroup
      ? `/chat/group/${data.thread_id}`
      : `/chat?thread=${data.thread_id}`;

    notificationPromise = self.registration.showNotification(title, {
      body: data.message_preview || 'Sent you a message',
      icon: data.sender_avatar || FALLBACK_ICON,
      badge: FALLBACK_ICON,
      tag: `chat_${data.thread_id}`,
      renotify: true,
      data: { url: chatUrl },
    });
  }
  // ── Live stream ──
  else if (type === 'live_started') {
    notificationPromise = self.registration.showNotification(
      notification.title || 'Live Video',
      {
        body: notification.body || 'Someone started a live video',
        icon: notification.image || FALLBACK_ICON,
        badge: FALLBACK_ICON,
        tag: `live_${data.stream_id}`,
        data: { url: `/live/watch/${data.stream_id}` },
      }
    );
  }
  // ── Generic social notification ──
  else if (notification.title) {
    notificationPromise = self.registration.showNotification(notification.title, {
      body: notification.body || '',
      icon: notification.image || FALLBACK_ICON,
      badge: FALLBACK_ICON,
      tag: `${data.type}_${data.reference_id || Date.now()}`,
      data: { url: data.action_url || '/notifications' },
    });
  }

  if (notificationPromise) {
    event.waitUntil(notificationPromise);
  }
});

// ─── Notification click handler (registered at top level) ──────────
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const data = event.notification.data || {};

  event.notification.close();

  if (action === 'reject') {
    // Just close — reject is handled via socket
    return;
  }

  const urlToOpen = data.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              action,
              data,
              url: urlToOpen,
            });
            return;
          }
        }
        return self.clients.openWindow(urlToOpen);
      })
  );
});

// ─── Push subscription change (registered at top level) ────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  // Token has changed — notify clients so they can re-register
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
      });
    })
  );
});
