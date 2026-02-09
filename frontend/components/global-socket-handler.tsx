'use client';

import { getAccessToken, isTokenExpiring, redirectToLogin, refreshAccessToken } from '@/lib/auth';
import {
  disconnectSocket,
  emitUserOffline,
  emitUserOnline,
  getSocket,
  initSocket,
  isSocketConnected,
  reconnectSocket,
} from '@/lib/socket';
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

    if (!isSocketConnected()) {
      reconnectAttempts.current += 1;

      if (reconnectAttempts.current <= 5) {
        const freshToken = localStorage.getItem('accessToken');
        if (freshToken) {
          await reconnectSocket();
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

    socket?.on('connect', () => {
      emitUserOnline(user._id);
      reconnectAttempts.current = 0;
      socket?.emit('getOnlineUsers');
    });

    socket?.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') {
        setTimeout(() => performHealthCheck(), 2000);
      }
    });

    socket?.on('newMessage', (data) => {
      const isOnChatPage = pathname?.startsWith('/chat');
      if (!isOnChatPage) {
        const senderName = data.sender?.firstName
          ? `${data.sender.firstName} ${data.sender.lastName || ''}`.trim()
          : data.sender?.username || 'Someone';

        toast.message(`New message from ${senderName}`, {
          description: data.content?.substring(0, 50) || 'Sent you a message',
          action: { label: 'View', onClick: () => router.push(`/chat?thread=${data.threadId}`) },
          duration: 5000,
        });

        showBrowserNotification(`${senderName}`, {
          body: data.content?.substring(0, 100) || 'Sent you a message',
          tag: `message-${data.threadId}`,
          onClick: () => router.push(`/chat?thread=${data.threadId}`),
        });
      }
    });

    socket?.on('incomingCall', (data) => {
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
    });

    socket?.on('liveStreamStarted', (data) => {
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
    });

    socket?.on('newNotification', (data) => {
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
    });

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
      socket?.off('liveStreamStarted');
      socket?.off('newMessage');
      socket?.off('incomingCall');
      socket?.off('newNotification');
      socket?.off('connect');
      socket?.off('disconnect');
      const currentToken = localStorage.getItem('accessToken');
      if (!currentToken) {
        emitUserOffline(user._id);
        disconnectSocket();
      }
    };
  }, [isLoggedIn, pathname, performHealthCheck, emitOnlineStatus, router]);

  return null;
}
