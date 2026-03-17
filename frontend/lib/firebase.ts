import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!firebaseConfig.apiKey) return null;

  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messaging) return messaging;

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  const supported = await isSupported();
  if (!supported) return null;

  messaging = getMessaging(firebaseApp);
  return messaging;
}

/**
 * Request notification permission and get FCM token.
 * Returns the token string or null if denied/unavailable.
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const msg = await getFirebaseMessaging();
    if (!msg) return null;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[FCM] VAPID key not configured');
      return null;
    }

    // Ensure service worker is registered AND active before subscribing
    let swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!swReg) {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }

    // Wait for the service worker to activate if it hasn't yet
    if (!swReg.active) {
      await new Promise<void>((resolve) => {
        const sw = swReg!.installing || swReg!.waiting;
        if (!sw) { resolve(); return; }
        sw.addEventListener('statechange', function handler() {
          if (sw.state === 'activated') {
            sw.removeEventListener('statechange', handler);
            resolve();
          }
        });
      });
    }

    const token = await getToken(msg, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });

    return token || null;
  } catch (error) {
    console.error('[FCM] Error getting token:', error);
    return null;
  }
}

/**
 * Listen for foreground FCM messages.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  getFirebaseMessaging().then((msg) => {
    if (msg) {
      onMessage(msg, callback);
    }
  });
  // Firebase onMessage doesn't return an unsubscribe in older versions,
  // but the listener lives as long as the messaging instance
  return null;
}
