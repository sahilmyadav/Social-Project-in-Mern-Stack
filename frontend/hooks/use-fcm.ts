'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getFCMToken, onForegroundMessage } from '@/lib/firebase';
import { api } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/lib/api-config';

/**
 * Hook to manage FCM token registration and foreground message handling.
 * Call this once in a top-level component (e.g., GlobalSocketHandler).
 */
export function useFCM(
  isLoggedIn: boolean,
  onForegroundNotification?: (payload: any) => void
) {
  const tokenRegistered = useRef(false);
  const swConfigSent = useRef(false);

  // Send Firebase config to the service worker
  const sendConfigToSW = useCallback(async () => {
    if (swConfigSent.current) return;
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    if (!config.apiKey) return;

    const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (reg?.active) {
      reg.active.postMessage({ type: 'FIREBASE_CONFIG', config });
      swConfigSent.current = true;
    }
  }, []);

  // Register FCM token with the backend
  const registerToken = useCallback(async () => {
    if (tokenRegistered.current) return;
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return;

    try {
      const token = await getFCMToken();
      if (!token) return;

      await api.post(API_ENDPOINTS.NOTIFICATIONS.REGISTER_FCM_TOKEN, {
        token,
        device_type: 'web',
        device_id: getDeviceId(),
      });

      tokenRegistered.current = true;

      // Send config to service worker after token is obtained
      sendConfigToSW();
    } catch (error) {
      console.error('[FCM] Token registration failed:', error);
    }
  }, [sendConfigToSW]);

  // Unregister token on logout
  const unregisterToken = useCallback(async () => {
    if (!tokenRegistered.current) return;
    // Mark immediately to prevent duplicate calls during re-renders
    tokenRegistered.current = false;

    try {
      // Only call API if auth token still exists (logout may have cleared it already)
      const authToken = typeof window !== 'undefined' && localStorage.getItem('accessToken');
      if (!authToken) return;

      const token = await getFCMToken();
      if (token) {
        await api.delete(API_ENDPOINTS.NOTIFICATIONS.UNREGISTER_FCM_TOKEN, { token });
      }
    } catch {
      // Ignore — user is logging out anyway
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      if (tokenRegistered.current) {
        unregisterToken();
      }
      return;
    }

    // Small delay to let the auth token settle
    const timeout = setTimeout(() => registerToken(), 2000);

    // Listen for foreground messages
    if (onForegroundNotification) {
      onForegroundMessage(onForegroundNotification);
    }

    // Handle clicks from service worker
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const url = event.data.url;
        if (url && typeof window !== 'undefined') {
          window.location.href = url;
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      clearTimeout(timeout);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [isLoggedIn, registerToken, unregisterToken, onForegroundNotification]);

  return { registerToken, unregisterToken };
}

/** Generate a stable device ID for this browser */
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'unknown';

  let deviceId = localStorage.getItem('fcm_device_id');
  if (!deviceId) {
    deviceId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('fcm_device_id', deviceId);
  }
  return deviceId;
}
