'use client';

import { endActiveCall, useCallStore } from '@/lib/call-store';
import { emitRejectCall, getSocket, initSocket } from '@/lib/socket';
import { showToast } from '@/lib/toast';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import GroupVideoCallModal from './group-video-call-modal';
import GroupVoiceCallModal from './group-voice-call-modal';
import IncomingCallNotification from './incoming-call-notification';
import IncomingVideoCallNotification from './incoming-video-call-notification';
import VideoCallModal from './video-call-modal';
import VoiceCallModal from './voice-call-modal';

interface IncomingCall {
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  threadId: string;
  callType?: 'voice' | 'video';
  isGroupCall?: boolean;
  groupInfo?: {
    groupId: string;
    groupName: string;
    groupAvatar: string | null;
  };
}

export default function GlobalCallHandler() {
  const pathname = usePathname();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [isGroupVoiceCallOpen, setIsGroupVoiceCallOpen] = useState(false);
  const [isGroupVideoCallOpen, setIsGroupVideoCallOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('');
  const listenersAttached = useRef(false);

  // Skip handling when on chat page - the chat page has its own call handlers
  const isOnChatPage = pathname?.startsWith('/chat');

  // Global call store — when any component calls endActiveCall(), all modals close
  const callStoreState = useCallStore();
  useEffect(() => {
    if (!callStoreState.isCallModalOpen) {
      if (isVoiceCallOpen || isVideoCallOpen || isGroupVoiceCallOpen || isGroupVideoCallOpen) {
        setIsVoiceCallOpen(false);
        setIsVideoCallOpen(false);
        setIsGroupVoiceCallOpen(false);
        setIsGroupVideoCallOpen(false);
        setIncomingCall(null);
      }
    }
  }, [callStoreState.isCallModalOpen]);

  // Memoized handlers
  const handleIncomingCall = useCallback(
    (data: any) => {
      // Skip if on chat page - let chat page handle calls
      if (isOnChatPage) {
        console.log('📞 Global: Skipping - on chat page');
        return;
      }

      console.log('📞 Global: Incoming call received:', data);

      const callType = data.callType || 'voice';
      const isGroupCall = data.isGroupCall || false;
      const groupInfo = data.groupInfo;

      console.log('📞 Global: isGroupCall:', isGroupCall, 'groupInfo:', groupInfo);

      const callData: IncomingCall = {
        callerId: data.callerId,
        callerName: data.callerInfo?.name || data.name || 'Unknown',
        callerAvatar: data.callerInfo?.avatar || null,
        threadId: data.threadId,
        callType: callType,
        isGroupCall: isGroupCall,
        groupInfo: isGroupCall
          ? {
              groupId: groupInfo?.groupId || data.threadId,
              groupName: groupInfo?.groupName || 'Group Call',
              groupAvatar: groupInfo?.groupAvatar || null,
            }
          : undefined,
      };

      console.log('📞 Global: Setting incoming call:', callData);
      setIncomingCall(callData);
    },
    [isOnChatPage]
  );

  const handleCallRejected = useCallback((data: any) => {
    console.log('📞 Global: Call rejected:', data);
    setIncomingCall(null);
    setIsVoiceCallOpen(false);
    setIsVideoCallOpen(false);
    setIsGroupVoiceCallOpen(false);
    setIsGroupVideoCallOpen(false);
  }, []);

  const handleCallEnded = useCallback((data: any) => {
    console.log('📞 Global: Call ended by remote:', data);
    setIncomingCall(null);
    setIsVoiceCallOpen(false);
    setIsVideoCallOpen(false);
    setIsGroupVoiceCallOpen(false);
    setIsGroupVideoCallOpen(false);
    endActiveCall();
  }, []);

  const handleCallFailed = useCallback((data: any) => {
    console.log('📞 Global: Call failed:', data);
    showToast.error('Call Failed', data.reason || 'Unable to connect the call');
    setIncomingCall(null);
    setIsVoiceCallOpen(false);
    setIsVideoCallOpen(false);
    setIsGroupVoiceCallOpen(false);
    setIsGroupVideoCallOpen(false);
    endActiveCall();
  }, []);

  // Function to attach listeners
  const attachListeners = useCallback(
    (socket: any) => {
      if (!socket || listenersAttached.current) return;

      // Remove any existing listeners first
      socket.off('incomingCall', handleIncomingCall);
      socket.off('callRejected', handleCallRejected);
      socket.off('callEnded', handleCallEnded);
      socket.off('callFailed', handleCallFailed);

      // Attach fresh listeners
      socket.on('incomingCall', handleIncomingCall);
      socket.on('callRejected', handleCallRejected);
      socket.on('callEnded', handleCallEnded);
      socket.on('callFailed', handleCallFailed);

      listenersAttached.current = true;
    },
    [handleIncomingCall, handleCallRejected, handleCallEnded, handleCallFailed]
  );

  // Initialize socket and set up listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('accessToken');
    const userDataStr = localStorage.getItem('user');

    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        setCurrentUserId(userData._id || '');
        setCurrentUserName(
          userData.firstName
            ? `${userData.firstName} ${userData.lastName || ''}`
            : userData.username || ''
        );
        setCurrentUserAvatar(userData.avatar || userData.profilePicture || '');
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }

    if (!token) return;

    const socket = initSocket(token);
    if (!socket) return;

    // Attach listeners immediately if connected
    if (socket.connected) {
      attachListeners(socket);
    }

    // Re-attach listeners on connect/reconnect
    const onConnect = () => {
      listenersAttached.current = false;
      attachListeners(socket);
    };

    socket.on('connect', onConnect);

    // Also try to get existing socket and attach
    const existingSocket = getSocket();
    if (existingSocket?.connected) {
      attachListeners(existingSocket);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('incomingCall', handleIncomingCall);
      socket.off('callRejected', handleCallRejected);
      socket.off('callEnded', handleCallEnded);
      socket.off('callFailed', handleCallFailed);
      listenersAttached.current = false;
    };
  }, [attachListeners, handleIncomingCall, handleCallRejected, handleCallEnded, handleCallFailed]);

  // Re-check socket periodically to ensure listeners are attached
  useEffect(() => {
    const interval = setInterval(() => {
      const socket = getSocket();
      if (socket?.connected && !listenersAttached.current) {
        attachListeners(socket);
      }
    }, 5000); // Increased from 2000ms to reduce console noise

    return () => clearInterval(interval);
  }, [attachListeners]);

  const handleAcceptVoiceCall = () => {
    if (incomingCall?.isGroupCall) {
      setIsGroupVoiceCallOpen(true);
    } else {
      setIsVoiceCallOpen(true);
    }
  };

  const handleAcceptVideoCall = () => {
    if (incomingCall?.isGroupCall) {
      setIsGroupVideoCallOpen(true);
    } else {
      setIsVideoCallOpen(true);
    }
  };

  const handleReject = () => {
    if (incomingCall?.callerId && incomingCall?.threadId) {
      if (incomingCall.isGroupCall) {
        // For group calls, emit rejectGroupCall
        const socket = getSocket();
        socket?.emit('rejectGroupCall', {
          groupId: incomingCall.groupInfo?.groupId || incomingCall.threadId,
          callerId: incomingCall.callerId,
        });
      } else {
        emitRejectCall(incomingCall.callerId, incomingCall.threadId);
      }
    }
    setIncomingCall(null);
    setIsVoiceCallOpen(false);
    setIsVideoCallOpen(false);
    setIsGroupVoiceCallOpen(false);
    setIsGroupVideoCallOpen(false);
  };

  const handleCallEnd = () => {
    setIncomingCall(null);
    setIsGroupVoiceCallOpen(false);
    setIsGroupVideoCallOpen(false);
  };

  // Check if any call modal is open
  const isAnyCallModalOpen =
    isVoiceCallOpen || isVideoCallOpen || isGroupVoiceCallOpen || isGroupVideoCallOpen;

  return (
    <>
      {/* Incoming Call Notifications */}
      {incomingCall && !isAnyCallModalOpen && (
        <>
          {incomingCall.callType === 'video' ? (
            <IncomingVideoCallNotification
              callerName={
                incomingCall.isGroupCall
                  ? `${incomingCall.callerName} (${incomingCall.groupInfo?.groupName || 'Group'})`
                  : incomingCall.callerName
              }
              callerAvatar={incomingCall.callerAvatar || undefined}
              onAccept={handleAcceptVideoCall}
              onReject={handleReject}
            />
          ) : (
            <IncomingCallNotification
              isVisible={true}
              callerName={
                incomingCall.isGroupCall
                  ? `${incomingCall.callerName} (${incomingCall.groupInfo?.groupName || 'Group'})`
                  : incomingCall.callerName
              }
              callerAvatar={incomingCall.callerAvatar || ''}
              onAccept={handleAcceptVoiceCall}
              onReject={handleReject}
            />
          )}
        </>
      )}

      {/* 1-to-1 Voice Call Modal */}
      {incomingCall && incomingCall.callType === 'voice' && !incomingCall.isGroupCall && (
        <VoiceCallModal
          isOpen={isVoiceCallOpen}
          onClose={() => {
            setIsVoiceCallOpen(false);
            setIncomingCall(null);
          }}
          recipientName={incomingCall.callerName}
          recipientAvatar={incomingCall.callerAvatar || ''}
          recipientId={incomingCall.callerId}
          currentUserId={currentUserId}
          isIncomingCall={true}
          callerId={incomingCall.callerId}
          threadId={incomingCall.threadId}
          onCallEnd={handleCallEnd}
        />
      )}

      {/* 1-to-1 Video Call Modal */}
      {incomingCall && incomingCall.callType === 'video' && !incomingCall.isGroupCall && (
        <VideoCallModal
          isOpen={isVideoCallOpen}
          onClose={() => {
            setIsVideoCallOpen(false);
            setIncomingCall(null);
          }}
          recipientName={incomingCall.callerName}
          recipientAvatar={incomingCall.callerAvatar || ''}
          recipientId={incomingCall.callerId}
          isIncoming={true}
          callId={incomingCall.threadId}
          callerId={incomingCall.callerId}
          threadId={incomingCall.threadId}
        />
      )}

      {/* Group Voice Call Modal */}
      {incomingCall && incomingCall.callType === 'voice' && incomingCall.isGroupCall && (
        <GroupVoiceCallModal
          isOpen={isGroupVoiceCallOpen}
          onClose={() => {
            setIsGroupVoiceCallOpen(false);
            setIncomingCall(null);
          }}
          groupId={incomingCall.groupInfo?.groupId || incomingCall.threadId}
          groupName={incomingCall.groupInfo?.groupName || 'Group Call'}
          groupAvatar={incomingCall.groupInfo?.groupAvatar || ''}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          isIncomingCall={true}
          callerId={incomingCall.callerId}
          callerInfo={{ name: incomingCall.callerName, avatar: incomingCall.callerAvatar || '' }}
        />
      )}

      {/* Group Video Call Modal */}
      {incomingCall && incomingCall.callType === 'video' && incomingCall.isGroupCall && (
        <GroupVideoCallModal
          isOpen={isGroupVideoCallOpen}
          onClose={() => {
            setIsGroupVideoCallOpen(false);
            setIncomingCall(null);
          }}
          groupId={incomingCall.groupInfo?.groupId || incomingCall.threadId}
          groupName={incomingCall.groupInfo?.groupName || 'Group Call'}
          groupAvatar={incomingCall.groupInfo?.groupAvatar || ''}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          isIncomingCall={true}
          callerId={incomingCall.callerId}
          callerInfo={{ name: incomingCall.callerName, avatar: incomingCall.callerAvatar || '' }}
        />
      )}
    </>
  );
}
