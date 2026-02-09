import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from './api-config';
import { getAccessToken, refreshAccessToken } from './auth';

let socket: Socket | null = null;
let isConnecting = false;

const typingCallbacks = new WeakMap<(data: unknown) => void, (data: unknown) => void>();
const stopTypingCallbacks = new WeakMap<(data: unknown) => void, (data: unknown) => void>();

export const reconnectSocket = async (): Promise<Socket | null> => {
  const token = getAccessToken();
  if (!token) return null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  isConnecting = false;
  return initSocket(token);
};

export const initSocket = (token: string) => {
  if (socket?.connected) return socket;
  if (socket && isConnecting) return socket;
  if (socket && !socket.connected && !isConnecting) {
    socket.disconnect();
    socket = null;
  }

  isConnecting = true;

  socket = io(API_CONFIG.SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    forceNew: false,
  });

  socket.on('connect', () => {
    isConnecting = false;
  });

  socket.on('disconnect', (reason) => {
    isConnecting = false;
    if (reason === 'io server disconnect') {
      isConnecting = true;
      socket?.connect();
    }
  });

  socket.on('connect_error', async (error) => {
    isConnecting = false;
    if (error.message.includes('Authentication') || error.message.includes('Invalid token')) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        setTimeout(() => {
          reconnectSocket();
        }, 1000);
      }
    }
  });

  socket.on('error', () => {});
  socket.on('reconnect', () => {
    isConnecting = false;
  });
  socket.on('reconnect_attempt', () => {
    isConnecting = true;
  });
  socket.on('reconnect_error', () => {});

  return socket;
};

export const getSocket = () => socket;
export const isSocketConnected = (): boolean => socket?.connected ?? false;

export const disconnectSocket = () => {
  if (socket) {
    isConnecting = false;
    socket.disconnect();
    socket = null;
  }
};

type CB = (data: any) => void;
const on = (event: string, cb: CB) => {
  socket?.on(event, cb);
};
const off = (event: string, cb: CB) => {
  socket?.off(event, cb);
};
const emit = (event: string, data?: unknown) => {
  socket?.emit(event, data);
};

export const onNewMessage = (cb: CB) => on('newMessage', cb);
export const offNewMessage = (cb: CB) => off('newMessage', cb);
export const onMessageStatus = (cb: CB) => on('messageStatus', cb);
export const offMessageStatus = (cb: CB) => off('messageStatus', cb);

export const onTyping = (cb: CB) => {
  const wrapped = (data: unknown) => {
    if ((data as Record<string, unknown>).isTyping === true) cb(data);
  };
  typingCallbacks.set(cb, wrapped);
  socket?.on('userTyping', wrapped);
};

export const onStopTyping = (cb: CB) => {
  const wrapped = (data: unknown) => {
    if ((data as Record<string, unknown>).isTyping === false) cb(data);
  };
  stopTypingCallbacks.set(cb, wrapped);
  socket?.on('userTyping', wrapped);
};

export const offTyping = (cb: CB) => {
  const wrapped = typingCallbacks.get(cb);
  if (wrapped) {
    socket?.off('userTyping', wrapped);
    typingCallbacks.delete(cb);
  }
};

export const offStopTyping = (cb: CB) => {
  const wrapped = stopTypingCallbacks.get(cb);
  if (wrapped) {
    socket?.off('userTyping', wrapped);
    stopTypingCallbacks.delete(cb);
  }
};

export const onNewThread = (cb: CB) => on('newThread', cb);
export const offNewThread = (cb: CB) => off('newThread', cb);

export const joinThread = (threadId: string) => emit('joinThread', threadId);
export const emitTyping = (threadId: string, receiverId: string) =>
  emit('typing', { threadId, receiverId });
export const emitStopTyping = (threadId: string, receiverId: string) =>
  emit('stopTyping', { threadId, receiverId });
export const emitMessageDelivered = (messageId: string) => emit('messageDelivered', { messageId });

export const onUserOnline = (cb: CB) => on('userOnline', cb);
export const offUserOnline = (cb: CB) => off('userOnline', cb);
export const onUserOffline = (cb: CB) => on('userOffline', cb);
export const offUserOffline = (cb: CB) => off('userOffline', cb);

export const emitUserOnline = (userId?: string) => {
  userId ? socket?.emit('userOnline', { userId }) : socket?.emit('userOnline');
};
export const emitUserOffline = (userId?: string) => {
  userId ? socket?.emit('userOffline', { userId }) : socket?.emit('userOffline');
};

export const onIncomingCall = (cb: CB) => on('incomingCall', cb);
export const offIncomingCall = (cb: CB) => off('incomingCall', cb);
export const onCallAccepted = (cb: CB) => on('callAccepted', cb);
export const offCallAccepted = (cb: CB) => off('callAccepted', cb);
export const onCallRejected = (cb: CB) => on('callRejected', cb);
export const offCallRejected = (cb: CB) => off('callRejected', cb);
export const onCallEnded = (cb: CB) => on('callEnded', cb);
export const offCallEnded = (cb: CB) => off('callEnded', cb);
export const onCallFailed = (cb: CB) => on('callFailed', cb);
export const offCallFailed = (cb: CB) => off('callFailed', cb);
export const onOffer = (cb: CB) => on('offer', cb);
export const offOffer = (cb: CB) => off('offer', cb);
export const onAnswer = (cb: CB) => on('answer', cb);
export const offAnswer = (cb: CB) => off('answer', cb);
export const onIceCandidate = (cb: CB) => on('iceCandidate', cb);
export const offIceCandidate = (cb: CB) => off('iceCandidate', cb);

export const emitInitiateCall = (
  recipientId: string,
  threadId: string,
  callType: 'voice' | 'video' = 'voice'
) => {
  emit('initiateCall', { recipientId, threadId, callType });
};

export const emitInitiateGroupCall = (groupId: string, callType: 'voice' | 'video' = 'voice') => {
  emit('initiateGroupCall', { groupId, callType });
};

export const emitAcceptCall = (callerId: string, threadId: string) => {
  emit('acceptCall', { callerId, threadId });
};

export const emitRejectCall = (callerId: string, threadId: string) => {
  emit('rejectCall', { callerId, threadId });
};

export const emitEndCall = (recipientId: string, threadId: string) => {
  emit('endCall', { recipientId, threadId });
};

export const emitOffer = (recipientId: string, offer: RTCSessionDescriptionInit) => {
  emit('offer', { recipientId, offer });
};

export const emitAnswer = (callerId: string, answer: RTCSessionDescriptionInit) => {
  emit('answer', { recipientId: callerId, answer });
};

export const emitIceCandidate = (recipientId: string, candidate: RTCIceCandidate) => {
  emit('iceCandidate', {
    recipientId,
    candidate: {
      candidate: candidate.candidate,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
    },
  });
};

export const onGroupCreated = (cb: CB) => on('groupCreated', cb);
export const offGroupCreated = (cb: CB) => off('groupCreated', cb);
export const onGroupUpdated = (cb: CB) => on('groupUpdated', cb);
export const offGroupUpdated = (cb: CB) => off('groupUpdated', cb);
export const onMemberAdded = (cb: CB) => on('memberAdded', cb);
export const offMemberAdded = (cb: CB) => off('memberAdded', cb);
export const onMemberRemoved = (cb: CB) => on('memberRemoved', cb);
export const offMemberRemoved = (cb: CB) => off('memberRemoved', cb);
export const onMemberLeft = (cb: CB) => on('memberLeft', cb);
export const offMemberLeft = (cb: CB) => off('memberLeft', cb);
export const onAdminChanged = (cb: CB) => on('adminChanged', cb);
export const offAdminChanged = (cb: CB) => off('adminChanged', cb);
export const onGroupMessage = (cb: CB) => on('groupMessage', cb);
export const offGroupMessage = (cb: CB) => off('groupMessage', cb);
export const onGroupMessageNotification = (cb: CB) => on('groupMessageNotification', cb);
export const offGroupMessageNotification = (cb: CB) => off('groupMessageNotification', cb);

export const emitJoinGroup = (groupId: string) => emit('joinGroup', groupId);
export const emitLeaveGroupRoom = (groupId: string) => emit('leaveGroup', groupId);

export const onLiveStreamStarted = (cb: CB) => on('liveStreamStarted', cb);
export const offLiveStreamStarted = (cb: CB) => off('liveStreamStarted', cb);
export const onLiveStreamEnded = (cb: CB) => on('liveStreamEnded', cb);
export const offLiveStreamEnded = (cb: CB) => off('liveStreamEnded', cb);
export const onViewerJoined = (cb: CB) => on('viewerJoined', cb);
export const offViewerJoined = (cb: CB) => off('viewerJoined', cb);
export const onViewerLeft = (cb: CB) => on('viewerLeft', cb);
export const offViewerLeft = (cb: CB) => off('viewerLeft', cb);
export const onViewerCountUpdate = (cb: CB) => on('viewerCountUpdate', cb);
export const offViewerCountUpdate = (cb: CB) => off('viewerCountUpdate', cb);
export const onLiveComment = (cb: CB) => on('newLiveComment', cb);
export const offLiveComment = (cb: CB) => off('newLiveComment', cb);
export const onLiveStreamOffer = (cb: CB) => on('liveStreamOffer', cb);
export const offLiveStreamOffer = (cb: CB) => off('liveStreamOffer', cb);
export const onLiveStreamAnswer = (cb: CB) => on('liveStreamAnswer', cb);
export const offLiveStreamAnswer = (cb: CB) => off('liveStreamAnswer', cb);
export const onLiveStreamIceCandidate = (cb: CB) => on('liveStreamIceCandidate', cb);
export const offLiveStreamIceCandidate = (cb: CB) => off('liveStreamIceCandidate', cb);

export const emitStartLiveStream = (streamId: string, title: string, description?: string) => {
  emit('startLiveStream', { streamId, title, description });
};

export const emitEndLiveStream = (streamId: string) => emit('endLiveStream', { streamId });

export const emitJoinLiveStream = (streamId: string) => {
  if (!socket?.connected) return;
  socket.emit('joinLiveStream', { streamId });
};

export const emitLeaveLiveStream = (streamId: string) => emit('leaveLiveStream', { streamId });

export const emitLiveComment = (streamId: string, text: string) => {
  emit('liveComment', { streamId, text });
};

export const emitLiveStreamOffer = (
  streamId: string,
  viewerId: string,
  offer: RTCSessionDescriptionInit
) => {
  emit('liveStreamOffer', { streamId, viewerId, offer });
};

export const emitLiveStreamAnswer = (
  streamId: string,
  broadcasterId: string,
  answer: RTCSessionDescriptionInit
) => {
  emit('liveStreamAnswer', { streamId, broadcasterId, answer });
};

export const emitLiveStreamIceCandidate = (
  streamId: string,
  targetId: string,
  candidate: RTCIceCandidate
) => {
  emit('liveStreamIceCandidate', {
    streamId,
    targetId,
    candidate: {
      candidate: candidate.candidate,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
    },
  });
};

export const emitLiveReaction = (
  streamId: string,
  type: 'heart' | 'like' | 'fire' | 'clap' = 'heart',
  color?: string
) => {
  emit('liveReaction', { streamId, type, color });
};

export const onLiveReaction = (cb: CB) => on('liveReaction', cb);
export const offLiveReaction = (cb: CB) => off('liveReaction', cb);

export const emitPinComment = (streamId: string, commentId: string) => {
  emit('pinLiveComment', { streamId, commentId });
};
export const emitUnpinComment = (streamId: string) => emit('unpinLiveComment', { streamId });
export const onCommentPinned = (cb: CB) => on('commentPinned', cb);
export const offCommentPinned = (cb: CB) => off('commentPinned', cb);
export const onCommentUnpinned = (cb: CB) => on('commentUnpinned', cb);
export const offCommentUnpinned = (cb: CB) => off('commentUnpinned', cb);

export const onNewNotification = (cb: CB) => on('newNotification', cb);
export const offNewNotification = (cb: CB) => off('newNotification', cb);
export const onNotificationRead = (cb: CB) => on('notificationRead', cb);
export const offNotificationRead = (cb: CB) => off('notificationRead', cb);
export const onAllNotificationsRead = (cb: CB) => on('allNotificationsRead', cb);
export const offAllNotificationsRead = (cb: CB) => off('allNotificationsRead', cb);
