'use client';

import { getAccessToken, isTokenExpiring, redirectToLogin, refreshAccessToken } from '@/lib/auth';
import {
  disconnectSocket,
  emitUserOffline,
  emitUserOnline,
  getSocket,
  initSocket,
  isCallActive,
  isSocketConnected,
  reconnectSocket,
} from '@/lib/socket';
import { useFCM } from '@/hooks/use-fcm';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const requestNotificationPermission = async () => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
};

const showBrowserNotification = (
  title: string,
  options?: NotificationOptions & { onClick?: () => void }
) => {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    const notification = new Notification(title, {
      icon: '/logo.png',
      badge: '/logo.png',
      ...options,
    });

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }

    setTimeout(() => notification.close(), 5000);
    return notification;
  }
  return null;
};

const tryRefreshToken = async (): Promise<string | null> => {
  try {
    await refreshAccessToken();
    return getAccessToken();
  } catch {
    return null;
  }
};

export default function GlobalSocketHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const reconnectAttempts = useRef(0);
  const healthCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const onlineStatusInterval = useRef<NodeJS.Timeout | null>(null);

  // FCM push notification integration
  useFCM(isLoggedIn, (payload) => {
    // Foreground FCM messages — show toast (browser notif handled by onMessage)
    const data = payload.data || {};
    const notification = payload.notification;
    if (notification?.title && data.type !== 'incoming_call' && data.type !== 'incoming_group_call') {
      toast.message(notification.title, {
        description: notification.body,
        duration: 5000,
      });
    }
  });

  const performHealthCheck = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');

    if (!token || !userData) return;

    if (isTokenExpiring(token)) {
      const newToken = await tryRefreshToken();
      if (!newToken) {
        return;
      }
    }

    // Don't interfere during active calls
    if (isCallActive()) return;

    const socket = getSocket();

    if (!isSocketConnected()) {
      // If the socket exists and Socket.IO is auto-reconnecting, don't interfere
      // reconnectSocket() kills the socket and creates a new one, which disrupts
      // the built-in reconnection and causes rapid disconnect/reconnect loops.
      if (socket && (socket as any).io?.reconnecting) {
        return;
      }

      reconnectAttempts.current += 1;

      if (reconnectAttempts.current <= 5) {
        const freshToken = localStorage.getItem('accessToken');
        if (freshToken) {
          // Only force reconnect if socket is null/destroyed
          if (!socket) {
            await reconnectSocket();
          } else {
            // Socket exists but disconnected — let it auto-reconnect
            // or force a manual connect() without destroying it
            socket.connect();
          }
          const user = JSON.parse(userData);

          setTimeout(() => {
            if (isSocketConnected()) {
              emitUserOnline(user._id);
              reconnectAttempts.current = 0;
            }
          }, 1000);
        }
      } else {
        const newToken = await tryRefreshToken();
        if (newToken) {
          reconnectAttempts.current = 0;
          await reconnectSocket();
        }
      }
    } else {
      reconnectAttempts.current = 0;
    }
  }, []);

  const emitOnlineStatus = useCallback(() => {
    const userData = localStorage.getItem('user');
    if (userData && isSocketConnected()) {
      const user = JSON.parse(userData);
      emitUserOnline(user._id);
      const socket = getSocket();
      socket?.emit('getOnlineUsers');
    }
  }, []);

  useEffect(() => {
    const checkLoginStatus = () => {
      const token = localStorage.getItem('accessToken');
      const userData = localStorage.getItem('user');

      if (token && userData) {
        if (!isLoggedIn) setIsLoggedIn(true);
      } else {
        if (isLoggedIn) setIsLoggedIn(false);
      }
    };

    checkLoginStatus();
    const interval = setInterval(checkLoginStatus, 500);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      if (healthCheckInterval.current) clearInterval(healthCheckInterval.current);
      if (onlineStatusInterval.current) clearInterval(onlineStatusInterval.current);
      return;
    }

    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');

    if (!token || !userData) return;

    if (isTokenExpiring(token)) {
      tryRefreshToken().then((newToken) => {
        if (!newToken) {
          redirectToLogin();
        }
      });
      return;
    }

    const user = JSON.parse(userData);
    requestNotificationPermission();

    const socket = initSocket(token);

    if (socket?.connected) {
      emitUserOnline(user._id);
    } else {
      socket?.once('connect', () => emitUserOnline(user._id));
    }

    // ── Named handler functions so cleanup removes ONLY these, not all listeners ──
    // CRITICAL: socket.off('event') without a callback removes ALL listeners for
    // that event, which kills handlers registered by other components (e.g.
    // GlobalCallHandler's incomingCall listener). Always pass the exact function ref.

    const handleConnect = () => {
      emitUserOnline(user._id);
      reconnectAttempts.current = 0;
      socket?.emit('getOnlineUsers');
    };

    const handleDisconnect = (reason: string) => {
      if (reason !== 'io client disconnect') {
        setTimeout(() => performHealthCheck(), 2000);
      }
    };

    const handleNewMessage = (data: any) => {
      const isOnChatPage = pathname?.startsWith('/chat');
      if (!isOnChatPage) {
        // Backend emits { threadId, message: { senderId: { firstName, lastName, ... }, text } }
        const sender = data.message?.senderId || data.sender;
        const senderName = sender?.firstName
          ? `${sender.firstName} ${sender.lastName || ''}`.trim()
          : sender?.username || 'Someone';
        const content = data.message?.text || data.content || '';
        const threadId = data.threadId;

        toast.message(`New message from ${senderName}`, {
          description: content.substring(0, 50) || 'Sent you a message',
          action: { label: 'View', onClick: () => router.push(`/chat?thread=${threadId}`) },
          duration: 5000,
        });

        showBrowserNotification(`${senderName}`, {
          body: content.substring(0, 100) || 'Sent you a message',
          tag: `message-${threadId}`,
          onClick: () => router.push(`/chat?thread=${threadId}`),
        });
      }
    };

    const handleIncomingCallNotif = (data: any) => {
      const callerName = data.callerInfo?.name || 'Someone';
      const callType = data.callType || 'voice';
      showBrowserNotification(
        callType === 'video' ? `Video call from ${callerName}` : `Call from ${callerName}`,
        {
          body: `${callerName} is calling you...`,
          tag: `call-${data.threadId}`,
          requireInteraction: true,
        }
      );
    };

    const handleLiveStreamStarted = (data: any) => {
      const { streamId, title, streamerName, streamerUsername } = data;
      const displayName = streamerName || streamerUsername || 'Someone you follow';
      toast.message(`${displayName} is now Live!`, {
        description: title || 'Tap to watch the live video',
        action: { label: 'Watch Now', onClick: () => router.push(`/live/watch/${streamId}`) },
        duration: 15000,
      });
      showBrowserNotification(`${displayName} is now Live!`, {
        body: title || 'Tap to watch the live video',
        tag: `live-${streamId}`,
        onClick: () => router.push(`/live/watch/${streamId}`),
      });
    };

    const handleNewNotification = (data: any) => {
      const notification = data.notification;
      if (!notification) return;

      const isOnNotificationsPage = pathname?.startsWith('/notifications');

      const sender = notification.sender_id;
      const senderName = sender?.firstName
        ? `${sender.firstName} ${sender.lastName || ''}`.trim()
        : sender?.username || 'Someone';

      if (!isOnNotificationsPage) {
        toast.message(notification.title || 'New Notification', {
          description: notification.message || `${senderName} interacted with your content`,
          action: {
            label: 'View',
            onClick: () => router.push('/notifications'),
          },
          duration: 5000,
        });
      }

      showBrowserNotification(notification.title || 'New Notification', {
        body: notification.message || `${senderName} interacted with your content`,
        tag: `notification-${notification._id}`,
        onClick: () => router.push('/notifications'),
      });
    };

    socket?.on('connect', handleConnect);
    socket?.on('disconnect', handleDisconnect);
    socket?.on('newMessage', handleNewMessage);
    socket?.on('incomingCall', handleIncomingCallNotif);
    socket?.on('liveStreamStarted', handleLiveStreamStarted);
    socket?.on('newNotification', handleNewNotification);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performHealthCheck();
        emitOnlineStatus();
      }
    };

    const handleOnline = () => performHealthCheck();
    const handleFocus = () => emitOnlineStatus();
    const handleBeforeUnload = () => emitUserOffline(user._id);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    healthCheckInterval.current = setInterval(() => performHealthCheck(), 30000);
    onlineStatusInterval.current = setInterval(() => emitOnlineStatus(), 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (healthCheckInterval.current) clearInterval(healthCheckInterval.current);
      if (onlineStatusInterval.current) clearInterval(onlineStatusInterval.current);
      // IMPORTANT: Pass the exact handler ref so we only remove OUR listener,
      // not every listener registered by other components (e.g. GlobalCallHandler).
      socket?.off('liveStreamStarted', handleLiveStreamStarted);
      socket?.off('newMessage', handleNewMessage);
      socket?.off('incomingCall', handleIncomingCallNotif);
      socket?.off('newNotification', handleNewNotification);
      socket?.off('connect', handleConnect);
      socket?.off('disconnect', handleDisconnect);
      const currentToken = localStorage.getItem('accessToken');
      if (!currentToken) {
        emitUserOffline(user._id);
        disconnectSocket();
      }
    };
  }, [isLoggedIn, pathname, performHealthCheck, emitOnlineStatus, router]);

  return null;
}
