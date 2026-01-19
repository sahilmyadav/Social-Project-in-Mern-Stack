import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from './api-config';

let socket: Socket | null = null;

export const initSocket = (token: string) => {
  if (socket?.connected) {
    return socket;
  }

  // Get socket URL - prefer NEXT_PUBLIC_SOCKET_URL, fallback to origin
  const socketUrl = API_CONFIG.SOCKET_URL;

  // In production with Cloudflare tunnels, use polling only to avoid WebSocket issues
  const isCloudflare =
    typeof window !== 'undefined' && window.location.hostname.includes('trycloudflare.com');

  socket = io(socketUrl, {
    auth: {
      token: token,
    },
    // Use polling only for Cloudflare tunnels, otherwise try WebSocket first
    transports: isCloudflare ? ['polling'] : ['polling', 'websocket'],
    upgrade: !isCloudflare, // Only try to upgrade to WebSocket if not on Cloudflare
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    path: '/socket.io/',
    withCredentials: true,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    try {
      if (typeof window !== 'undefined') {
        console.log('🔴 Socket connection error:', error);
      }
    } catch (e) {
      // Ignore logging errors
    }
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
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
  console.log(`📞 Emitting ${callType} call to recipient:`, recipientId, 'threadId:', threadId);
  console.log('📞 Socket connected:', socket?.connected, 'Socket ID:', socket?.id);
  socket?.emit('initiateCall', {
    recipientId,
    threadId,
    callType,
  });
};

export const emitAcceptCall = (callerId: string, threadId: string) => {
  console.log('✅ Accepting call from:', callerId);
  socket?.emit('acceptCall', {
    callerId,
    threadId,
  });
};

export const emitRejectCall = (callerId: string, threadId: string) => {
  console.log('❌ Rejecting call from:', callerId);
  socket?.emit('rejectCall', {
    callerId,
    threadId,
  });
};

export const emitEndCall = (recipientId: string, threadId: string) => {
  console.log('📞 Ending call with:', recipientId);
  socket?.emit('endCall', {
    recipientId,
    threadId,
  });
};

export const emitOffer = (recipientId: string, offer: any) => {
  console.log('📤 Sending offer to:', recipientId);
  socket?.emit('offer', {
    recipientId,
    offer: offer, // Send full RTCSessionDescription object
  });
};

export const emitAnswer = (callerId: string, answer: any) => {
  console.log('📥 Sending answer to:', callerId);
  socket?.emit('answer', {
    callerId,
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

// Emit group events
export const emitJoinGroup = (groupId: string) => {
  socket?.emit('joinGroup', { groupId });
};

export const emitLeaveGroupRoom = (groupId: string) => {
  socket?.emit('leaveGroup', { groupId });
};
