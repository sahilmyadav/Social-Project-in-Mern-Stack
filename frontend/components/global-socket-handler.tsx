'use client';

import { disconnectSocket, emitUserOffline, emitUserOnline, initSocket } from '@/lib/socket';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

// Request browser notification permission
const requestNotificationPermission = async () => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
};

// Show browser notification
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

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    return notification;
  }
  return null;
};

export default function GlobalSocketHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check login status periodically
    const checkLoginStatus = () => {
      const token = localStorage.getItem('accessToken');
      const userData = localStorage.getItem('user');

      if (token && userData) {
        if (!isLoggedIn) {
          // User just logged in!
          setIsLoggedIn(true);
        }
      } else {
        if (isLoggedIn) {
          // User just logged out!
          setIsLoggedIn(false);
        }
      }
    };

    // Check immediately
    checkLoginStatus();

    // Check every 500ms for login/logout
    const interval = setInterval(checkLoginStatus, 500);

    return () => clearInterval(interval);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      return;
    }

    // Check if token is expired before connecting
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && Date.now() > payload.exp * 1000) {
          console.warn('🔌 Token expired, clearing storage...');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
      }
    } catch (e) {
      console.error('🔌 Error parsing token:', e);
    }

    const user = JSON.parse(userData);

    // Request notification permission
    requestNotificationPermission();

    // Initialize socket connection
    const socket = initSocket(token);

    // Emit online status when socket connects
    if (socket?.connected) {
      emitUserOnline(user._id);
    } else {
      socket?.once('connect', () => {
        emitUserOnline(user._id);
      });
    }

    // Handle reconnection
    socket?.on('connect', () => {
      emitUserOnline(user._id);
    });

    // Listen for new messages (only show notification if not on chat page)
    socket?.on('newMessage', (data) => {
      const isOnChatPage = pathname?.startsWith('/chat');

      if (!isOnChatPage) {
        const senderName = data.sender?.firstName
          ? `${data.sender.firstName} ${data.sender.lastName || ''}`.trim()
          : data.sender?.username || 'Someone';

        // Show toast notification
        toast.message(`💬 New message from ${senderName}`, {
          description: data.content?.substring(0, 50) || 'Sent you a message',
          action: {
            label: 'View',
            onClick: () => router.push(`/chat?thread=${data.threadId}`),
          },
          duration: 5000,
        });

        // Show browser notification
        showBrowserNotification(`💬 ${senderName}`, {
          body: data.content?.substring(0, 100) || 'Sent you a message',
          tag: `message-${data.threadId}`,
          onClick: () => router.push(`/chat?thread=${data.threadId}`),
        });
      }
    });

    // Listen for incoming voice/video calls
    socket?.on('incomingCall', (data) => {
      const callerName = data.callerInfo?.name || 'Someone';
      const callType = data.callType || 'voice';

      // Show browser notification for calls
      showBrowserNotification(
        callType === 'video' ? `📹 Video call from ${callerName}` : `📞 Call from ${callerName}`,
        {
          body: `${callerName} is calling you...`,
          tag: `call-${data.threadId}`,
          requireInteraction: true,
        }
      );
    });

    // Listen for Live Stream Start
    socket?.on('liveStreamStarted', (data) => {
      const { streamId, title, streamerName, streamerUsername } = data;
      const displayName = streamerName || streamerUsername || 'Someone you follow';
      toast.message(`${displayName} is now Live! 🔴`, {
        description: title || 'Tap to watch the live video',
        action: {
          label: 'Watch Now',
          onClick: () => router.push(`/live/watch/${streamId}`),
        },
        duration: 15000,
      });

      // Show browser notification for live stream
      showBrowserNotification(`🔴 ${displayName} is now Live!`, {
        body: title || 'Tap to watch the live video',
        tag: `live-${streamId}`,
        onClick: () => router.push(`/live/watch/${streamId}`),
      });
    });

    // Emit offline status before page unload (tab close, refresh, etc.)
    const handleBeforeUnload = () => {
      emitUserOffline(user._id);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup on unmount or logout
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socket?.off('liveStreamStarted');
      socket?.off('newMessage');
      socket?.off('incomingCall');
      socket?.off('connect');

      // If user logged out, emit offline and disconnect
      const currentToken = localStorage.getItem('accessToken');
      if (!currentToken) {
        emitUserOffline(user._id);
        disconnectSocket();
      }
    };
  }, [isLoggedIn, pathname]); // Re-run when login status or pathname changes!

  return null;
}
