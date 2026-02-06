import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from './api-config';

let socket: Socket | null = null;
let isConnecting = false;
let currentToken: string | null = null;

// Function to refresh token silently
const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    const response = await fetch(`${API_CONFIG.BASE_URL}/users/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data?.accessToken) {
        localStorage.setItem('accessToken', data.data.accessToken);
        if (data.data.refreshToken) {
          localStorage.setItem('refreshToken', data.data.refreshToken);
        }
        console.log('🔄 Token refreshed successfully');
        return data.data.accessToken;
      }
    }
    return null;
  } catch (error) {
    console.error('🔄 Token refresh failed:', error);
    return null;
  }
};

// Force reconnect with new token
export const reconnectSocket = async (): Promise<Socket | null> => {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;

  // Disconnect existing socket
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  isConnecting = false;
  return initSocket(token);
};

export const initSocket = (token: string) => {
  // If socket exists and is connected, return it
  if (socket?.connected) {
    return socket;
  }

  // If socket exists and is still connecting, wait for it
  if (socket && isConnecting) {
    return socket;
  }

  // If socket exists but is truly disconnected (not connecting), create new one
  if (socket && !socket.connected && !isConnecting) {
    socket.disconnect();
    socket = null;
  }

  isConnecting = true;
  currentToken = token;

  socket = io(API_CONFIG.SOCKET_URL, {
    auth: {
      token: token, // Backend expects token without 'Bearer' prefix
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity, // Keep trying to reconnect
    timeout: 20000, // Connection timeout
    forceNew: false,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected! Socket ID:', socket?.id);
    isConnecting = false;
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected. Reason:', reason);
    isConnecting = false;
    // If the server closed the connection, try to reconnect
    if (reason === 'io server disconnect') {
      isConnecting = true;
      socket?.connect();
    }
  });

  socket.on('connect_error', async (error) => {
    // Only log in development and avoid noisy errors during reconnection
    if (process.env.NODE_ENV === 'development') {
      console.warn('🔌 Socket connection error:', error.message);
    }
    isConnecting = false;

    // If authentication error, try refreshing token
    if (error.message.includes('Authentication') || error.message.includes('Invalid token')) {
      console.log('🔄 Attempting token refresh due to auth error...');
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Reconnect with new token
        setTimeout(() => {
          reconnectSocket();
        }, 1000);
      }
    }
  });

  // Handle general socket errors silently (websocket errors during reconnection)
  socket.on('error', (error) => {
    // Suppress noisy websocket errors that occur during reconnection
    if (process.env.NODE_ENV === 'development') {
      console.warn('🔌 Socket error (suppressed):', error);
    }
  });

  socket.on('reconnect', (attemptNumber: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔌 Socket reconnected after', attemptNumber, 'attempts');
    }
    isConnecting = false;
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('🔌 Socket reconnection attempt:', attemptNumber);
    isConnecting = true;
  });

  socket.on('reconnect_error', (error) => {
    console.error('🔌 Socket reconnection error:', error.message);
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

// Check if socket is healthy
export const isSocketConnected = (): boolean => {
  return socket?.connected ?? false;
};

export const disconnectSocket = () => {
  if (socket) {
    isConnecting = false;
    socket.disconnect();
    socket = null;
  }
};

// Socket event handlers
export const onNewMessage = (callback: (data: any) => void) => {
  socket?.on('newMessage', callback);
};

export const onMessageStatus = (callback: (data: any) => void) => {
  socket?.on('messageStatus', callback);
};

export const onTyping = (callback: (data: any) => void) => {
  // Filter for isTyping === true
  socket?.on('userTyping', (data: any) => {
    if (data.isTyping === true) {
      callback(data);
    }
  });
};

export const onStopTyping = (callback: (data: any) => void) => {
  // Filter for isTyping === false
  socket?.on('userTyping', (data: any) => {
    if (data.isTyping === false) {
      callback(data);
    }
  });
};

export const offNewMessage = (callback: (data: any) => void) => {
  socket?.off('newMessage', callback);
};

export const offMessageStatus = (callback: (data: any) => void) => {
  socket?.off('messageStatus', callback);
};

export const offTyping = (callback: (data: any) => void) => {
  socket?.off('userTyping');
};

export const offStopTyping = (callback: (data: any) => void) => {
  socket?.off('userTyping');
};

export const onNewThread = (callback: (data: any) => void) => {
  socket?.on('newThread', callback);
};

export const offNewThread = (callback: (data: any) => void) => {
  socket?.off('newThread', callback);
};

// Emit events
export const joinThread = (threadId: string) => {
  socket?.emit('joinThread', threadId);
};

export const emitTyping = (threadId: string, receiverId: string) => {
  socket?.emit('typing', { threadId, receiverId });
};

export const emitStopTyping = (threadId: string, receiverId: string) => {
  socket?.emit('stopTyping', { threadId, receiverId });
};

export const emitMessageDelivered = (messageId: string) => {
  socket?.emit('messageDelivered', { messageId });
};

// Online status handlers
export const onUserOnline = (callback: (data: any) => void) => {
  socket?.on('userOnline', callback);
};

export const offUserOnline = (callback: (data: any) => void) => {
  socket?.off('userOnline', callback);
};

export const onUserOffline = (callback: (data: any) => void) => {
  socket?.on('userOffline', callback);
};

export const offUserOffline = (callback: (data: any) => void) => {
  socket?.off('userOffline', callback);
};

// User online/offline emit functions
export const emitUserOnline = (userId?: string) => {
  if (userId) {
    socket?.emit('userOnline', { userId });
  } else {
    socket?.emit('userOnline');
  }
};

export const emitUserOffline = (userId?: string) => {
  if (userId) {
    socket?.emit('userOffline', { userId });
  } else {
    socket?.emit('userOffline');
  }
};

// export const emitMessageDelivered = (messageId: string) => {
//   socket?.emit('messageDelivered', { messageId });
// };

// Voice call events
export const onIncomingCall = (callback: (data: any) => void) => {
  socket?.on('incomingCall', callback);
};

export const offIncomingCall = (callback: (data: any) => void) => {
  socket?.off('incomingCall', callback);
};

export const onCallAccepted = (callback: (data: any) => void) => {
  socket?.on('callAccepted', callback);
};

export const offCallAccepted = (callback: (data: any) => void) => {
  socket?.off('callAccepted', callback);
};

export const onCallRejected = (callback: (data: any) => void) => {
  socket?.on('callRejected', callback);
};

export const offCallRejected = (callback: (data: any) => void) => {
  socket?.off('callRejected', callback);
};

export const onCallEnded = (callback: (data: any) => void) => {
  socket?.on('callEnded', callback);
};

export const offCallEnded = (callback: (data: any) => void) => {
  socket?.off('callEnded', callback);
};

// Call failed event (user offline or error)
export const onCallFailed = (callback: (data: any) => void) => {
  socket?.on('callFailed', callback);
};

export const offCallFailed = (callback: (data: any) => void) => {
  socket?.off('callFailed', callback);
};

// WebRTC signaling events
export const onOffer = (callback: (data: any) => void) => {
  socket?.on('offer', callback);
};

export const offOffer = (callback: (data: any) => void) => {
  socket?.off('offer', callback);
};

export const onAnswer = (callback: (data: any) => void) => {
  socket?.on('answer', callback);
};

export const offAnswer = (callback: (data: any) => void) => {
  socket?.off('answer', callback);
};

export const onIceCandidate = (callback: (data: any) => void) => {
  socket?.on('iceCandidate', callback);
};

export const offIceCandidate = (callback: (data: any) => void) => {
  socket?.off('iceCandidate', callback);
};

// Emit call events
export const emitInitiateCall = (
  recipientId: string,
  threadId: string,
  callType: 'voice' | 'video' = 'voice'
) => {
  socket?.emit('initiateCall', {
    recipientId,
    threadId,
    callType,
  });
};

// Emit group call event - notifies all online group members
export const emitInitiateGroupCall = (groupId: string, callType: 'voice' | 'video' = 'voice') => {
  socket?.emit('initiateGroupCall', {
    groupId,
    callType,
  });
};

export const emitAcceptCall = (callerId: string, threadId: string) => {
  socket?.emit('acceptCall', {
    callerId,
    threadId,
  });
};

export const emitRejectCall = (callerId: string, threadId: string) => {
  socket?.emit('rejectCall', {
    callerId,
    threadId,
  });
};

export const emitEndCall = (recipientId: string, threadId: string) => {
  socket?.emit('endCall', {
    recipientId,
    threadId,
  });
};

export const emitOffer = (recipientId: string, offer: any) => {
  socket?.emit('offer', {
    recipientId,
    offer: offer, // Send full RTCSessionDescription object
  });
};

export const emitAnswer = (callerId: string, answer: any) => {
  socket?.emit('answer', {
    recipientId: callerId, // Send to the caller
    answer: answer, // Send full RTCSessionDescription object
  });
};

export const emitIceCandidate = (recipientId: string, candidate: RTCIceCandidate) => {
  socket?.emit('iceCandidate', {
    recipientId,
    candidate: {
      candidate: candidate.candidate,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
    },
  });
};

// Group Chat Events

// Listen for group events
export const onGroupCreated = (callback: (data: any) => void) => {
  socket?.on('groupCreated', callback);
};

export const offGroupCreated = (callback: (data: any) => void) => {
  socket?.off('groupCreated', callback);
};

export const onGroupUpdated = (callback: (data: any) => void) => {
  socket?.on('groupUpdated', callback);
};

export const offGroupUpdated = (callback: (data: any) => void) => {
  socket?.off('groupUpdated', callback);
};

export const onMemberAdded = (callback: (data: any) => void) => {
  socket?.on('memberAdded', callback);
};

export const offMemberAdded = (callback: (data: any) => void) => {
  socket?.off('memberAdded', callback);
};

export const onMemberRemoved = (callback: (data: any) => void) => {
  socket?.on('memberRemoved', callback);
};

export const offMemberRemoved = (callback: (data: any) => void) => {
  socket?.off('memberRemoved', callback);
};

export const onMemberLeft = (callback: (data: any) => void) => {
  socket?.on('memberLeft', callback);
};

export const offMemberLeft = (callback: (data: any) => void) => {
  socket?.off('memberLeft', callback);
};

export const onAdminChanged = (callback: (data: any) => void) => {
  socket?.on('adminChanged', callback);
};

export const offAdminChanged = (callback: (data: any) => void) => {
  socket?.off('adminChanged', callback);
};

// Listen for group message events
export const onGroupMessage = (callback: (data: any) => void) => {
  socket?.on('groupMessage', callback);
};

export const offGroupMessage = (callback: (data: any) => void) => {
  socket?.off('groupMessage', callback);
};

export const onGroupMessageNotification = (callback: (data: any) => void) => {
  socket?.on('groupMessageNotification', callback);
};

export const offGroupMessageNotification = (callback: (data: any) => void) => {
  socket?.off('groupMessageNotification', callback);
};

// Emit group events
export const emitJoinGroup = (groupId: string) => {
  socket?.emit('joinGroup', groupId);
};

export const emitLeaveGroupRoom = (groupId: string) => {
  socket?.emit('leaveGroup', groupId);
};

// ==================== LIVE STREAMING EVENTS ====================

// Listen for live stream events
export const onLiveStreamStarted = (callback: (data: any) => void) => {
  socket?.on('liveStreamStarted', callback);
};

export const offLiveStreamStarted = (callback: (data: any) => void) => {
  socket?.off('liveStreamStarted', callback);
};

export const onLiveStreamEnded = (callback: (data: any) => void) => {
  socket?.on('liveStreamEnded', callback);
};

export const offLiveStreamEnded = (callback: (data: any) => void) => {
  socket?.off('liveStreamEnded', callback);
};

export const onViewerJoined = (callback: (data: any) => void) => {
  socket?.on('viewerJoined', callback);
};

export const offViewerJoined = (callback: (data: any) => void) => {
  socket?.off('viewerJoined', callback);
};

export const onViewerLeft = (callback: (data: any) => void) => {
  socket?.on('viewerLeft', callback);
};

export const offViewerLeft = (callback: (data: any) => void) => {
  socket?.off('viewerLeft', callback);
};

export const onViewerCountUpdate = (callback: (data: any) => void) => {
  socket?.on('viewerCountUpdate', callback);
};

export const offViewerCountUpdate = (callback: (data: any) => void) => {
  socket?.off('viewerCountUpdate', callback);
};

export const onLiveComment = (callback: (data: any) => void) => {
  socket?.on('newLiveComment', callback);
};

export const offLiveComment = (callback: (data: any) => void) => {
  socket?.off('newLiveComment', callback);
};

// Live stream WebRTC signaling events
export const onLiveStreamOffer = (callback: (data: any) => void) => {
  socket?.on('liveStreamOffer', callback);
};

export const offLiveStreamOffer = (callback: (data: any) => void) => {
  socket?.off('liveStreamOffer', callback);
};

export const onLiveStreamAnswer = (callback: (data: any) => void) => {
  socket?.on('liveStreamAnswer', callback);
};

export const offLiveStreamAnswer = (callback: (data: any) => void) => {
  socket?.off('liveStreamAnswer', callback);
};

export const onLiveStreamIceCandidate = (callback: (data: any) => void) => {
  socket?.on('liveStreamIceCandidate', callback);
};

export const offLiveStreamIceCandidate = (callback: (data: any) => void) => {
  socket?.off('liveStreamIceCandidate', callback);
};

// Emit live stream events
export const emitStartLiveStream = (streamId: string, title: string, description?: string) => {
  socket?.emit('startLiveStream', {
    streamId,
    title,
    description,
  });
};

export const emitEndLiveStream = (streamId: string) => {
  socket?.emit('endLiveStream', { streamId });
};

export const emitJoinLiveStream = (streamId: string) => {
  if (!socket?.connected) {
    console.warn('⚠️ Socket not connected, cannot join live stream');
    return;
  }
  console.log('📤 Emitting joinLiveStream for:', streamId);
  socket.emit('joinLiveStream', { streamId });
};

export const emitLeaveLiveStream = (streamId: string) => {
  socket?.emit('leaveLiveStream', { streamId });
};

export const emitLiveComment = (streamId: string, text: string) => {
  socket?.emit('liveComment', {
    streamId,
    text,
  });
};

export const emitLiveStreamOffer = (streamId: string, viewerId: string, offer: any) => {
  console.log('📤 Emitting liveStreamOffer to viewer:', viewerId);
  socket?.emit('liveStreamOffer', {
    streamId,
    viewerId,
    offer,
  });
};

export const emitLiveStreamAnswer = (streamId: string, broadcasterId: string, answer: any) => {
  console.log('📤 Emitting liveStreamAnswer to broadcaster:', broadcasterId);
  socket?.emit('liveStreamAnswer', {
    streamId,
    broadcasterId,
    answer,
  });
};

export const emitLiveStreamIceCandidate = (
  streamId: string,
  targetId: string,
  candidate: RTCIceCandidate
) => {
  socket?.emit('liveStreamIceCandidate', {
    streamId,
    targetId,
    candidate: {
      candidate: candidate.candidate,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
    },
  });
};

// ==================== LIVE REACTIONS (Hearts) ====================

/**
 * Send a reaction (heart) during a live stream
 * These create floating heart animations for all viewers
 */
export const emitLiveReaction = (
  streamId: string,
  type: 'heart' | 'like' | 'fire' | 'clap' = 'heart',
  color?: string
) => {
  socket?.emit('liveReaction', {
    streamId,
    type,
    color,
  });
};

/**
 * Listen for reactions from other viewers
 */
export const onLiveReaction = (callback: (data: any) => void) => {
  socket?.on('liveReaction', callback);
};

export const offLiveReaction = (callback: (data: any) => void) => {
  socket?.off('liveReaction', callback);
};

// ==================== PINNED COMMENTS ====================

/**
 * Pin a comment (broadcaster only)
 */
export const emitPinComment = (streamId: string, commentId: string) => {
  socket?.emit('pinLiveComment', {
    streamId,
    commentId,
  });
};

/**
 * Unpin the currently pinned comment (broadcaster only)
 */
export const emitUnpinComment = (streamId: string) => {
  socket?.emit('unpinLiveComment', { streamId });
};

/**
 * Listen for comment pinned events
 */
export const onCommentPinned = (callback: (data: any) => void) => {
  socket?.on('commentPinned', callback);
};

export const offCommentPinned = (callback: (data: any) => void) => {
  socket?.off('commentPinned', callback);
};

/**
 * Listen for comment unpinned events
 */
export const onCommentUnpinned = (callback: (data: any) => void) => {
  socket?.on('commentUnpinned', callback);
};

export const offCommentUnpinned = (callback: (data: any) => void) => {
  socket?.off('commentUnpinned', callback);
};

// ==================== NOTIFICATION EVENTS ====================

/**
 * Listen for new notification events
 */
export const onNewNotification = (callback: (data: any) => void) => {
  socket?.on('newNotification', callback);
};

export const offNewNotification = (callback: (data: any) => void) => {
  socket?.off('newNotification', callback);
};

/**
 * Listen for notification read events
 */
export const onNotificationRead = (callback: (data: any) => void) => {
  socket?.on('notificationRead', callback);
};

export const offNotificationRead = (callback: (data: any) => void) => {
  socket?.off('notificationRead', callback);
};

/**
 * Listen for all notifications marked as read
 */
export const onAllNotificationsRead = (callback: (data: any) => void) => {
  socket?.on('allNotificationsRead', callback);
};

export const offAllNotificationsRead = (callback: (data: any) => void) => {
  socket?.off('allNotificationsRead', callback);
};
