'use client';

import { useCallState } from '@/contexts/call-context';
import { useAuth } from '@/hooks/useAuth';
import { getAccessToken } from '@/lib/auth';
import { emitRejectCall, getSocket, initSocket } from '@/lib/socket';
import { showToast } from '@/lib/toast';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

const VoiceCallModal = dynamic(() => import('./voice-call-modal'), { ssr: false });
const VideoCallModal = dynamic(() => import('./video-call-modal'), { ssr: false });
const GroupVoiceCallModal = dynamic(() => import('./group-voice-call-modal'), { ssr: false });
const GroupVideoCallModal = dynamic(() => import('./group-video-call-modal'), { ssr: false });
const IncomingCallNotification = dynamic(() => import('./incoming-call-notification'), {
  ssr: false,
});
const IncomingVideoCallNotification = dynamic(() => import('./incoming-video-call-notification'), {
  ssr: false,
});

interface IncomingCall {
  callerId: string;
  callerName: string;
  callerAvatar: string;
  threadId: string;
  callType?: 'voice' | 'video';
  isGroupCall?: boolean;
  groupInfo?: {
    groupId: string;
    groupName: string;
    groupAvatar: string;
  };
}

export default function GlobalCallHandler() {
  const { user } = useAuth();
  const { isInCall, releaseCall } = useCallState();
  const isInCallRef = useRef(isInCall);
  isInCallRef.current = isInCall;
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [isGroupVoiceCallOpen, setIsGroupVoiceCallOpen] = useState(false);
  const [isGroupVideoCallOpen, setIsGroupVideoCallOpen] = useState(false);
  const listenersAttached = useRef(false);

  // Track whether any call modal is currently open (via ref for non-stale reads in callbacks)
  const isAnyModalOpenRef = useRef(false);

  // Keep the ref in sync with modal open states (avoids stale closure in callbacks)
  const isAnyCallModalOpen =
    isVoiceCallOpen || isVideoCallOpen || isGroupVoiceCallOpen || isGroupVideoCallOpen;
  isAnyModalOpenRef.current = isAnyCallModalOpen;

  const currentUserId = user?._id || '';
  const currentUserName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`
    : user?.username || '';
  const currentUserAvatar = user?.avatar || user?.profileImage || '';

  const resetCallState = useCallback(() => {
    setIncomingCall(null);
    setIsVoiceCallOpen(false);
    setIsVideoCallOpen(false);
    setIsGroupVoiceCallOpen(false);
    setIsGroupVideoCallOpen(false);
    // Release the global call lock so user can make a new call
    releaseCall();
  }, [releaseCall]);

  const handleIncomingCall = useCallback(
    (data: unknown) => {
      const d = data as Record<string, unknown>;
      const callerInfo = d.callerInfo as Record<string, string> | undefined;
      const groupInfo = d.groupInfo as Record<string, string> | undefined;
      const isGroupCall = !!d.isGroupCall;

      console.log('[CallHandler] ====== INCOMING CALL ======');
      console.log('[CallHandler] callerId:', d.callerId);
      console.log('[CallHandler] callType:', d.callType);
      console.log('[CallHandler] threadId:', d.threadId);
      console.log('[CallHandler] callerName:', callerInfo?.name || d.name);
      console.log('[CallHandler] isGroupCall:', isGroupCall);
      console.log('[CallHandler] isInCall:', isInCall);

      // Busy signal — reject if already in a call (use ref for latest value)
      if (isInCallRef.current) {
        console.log('[CallHandler] BUSY - rejecting call, already in a call');
        const socket = getSocket();
        if (socket) {
          socket.emit('callBusy', {
            callerId: d.callerId as string,
            threadId: d.threadId as string,
          });
        }
        return;
      }

      const callData: IncomingCall = {
        callerId: d.callerId as string,
        callerName: callerInfo?.name || (d.name as string) || 'Unknown',
        callerAvatar: callerInfo?.avatar || '👤',
        threadId: d.threadId as string,
        callType: (d.callType as 'voice' | 'video') || 'voice',
        isGroupCall,
        groupInfo: isGroupCall
          ? {
              groupId: groupInfo?.groupId || (d.threadId as string),
              groupName: groupInfo?.groupName || 'Group Call',
              groupAvatar: groupInfo?.groupAvatar || '👥',
            }
          : undefined,
      };

      setIncomingCall(callData);
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
    // isInCall read via ref — callback identity stays stable
  );

  const handleCallRejected = useCallback(() => {
    // Only handle at the global level if no modal is open.
    // If a modal IS open, the modal's own handler takes care of cleanup.
    if (isAnyModalOpenRef.current) return;
    resetCallState();
  }, [resetCallState]);

  const handleCallEnded = useCallback(() => {
    // When a modal is active the modal manages its own callEnded handler
    // (shows "Call ended", cleans up PC, then closes after 1.5s).
    // Resetting here would yank the modal out from under it.
    if (isAnyModalOpenRef.current) return;
    resetCallState();
  }, [resetCallState]);

  const handleCallFailed = useCallback(
    (data: unknown) => {
      // When a modal is active, let the modal display the failure reason.
      if (isAnyModalOpenRef.current) return;
      const d = data as Record<string, string>;
      console.log('[CallHandler] CALL FAILED:', d.reason);
      showToast.error('Call Failed', d.reason || 'Unable to connect the call');
      // Do NOT emit endCall here — the server already cleaned up when it sent
      // callFailed. Emitting endCall would kill any EXISTING active call
      // (e.g. if this callFailed was for a duplicate initiateCall attempt).
      resetCallState();
    },
    [resetCallState]
  );

  // Store handler refs so we can properly remove them
  const handlersMapRef = useRef<{
    incomingCall?: (data: unknown) => void;
    callRejected?: () => void;
    callEnded?: () => void;
    callFailed?: (data: unknown) => void;
  }>({});

  const attachListeners = useCallback(
    (socket: ReturnType<typeof getSocket>) => {
      if (!socket) return;

      // Always remove OLD handlers first (using stored refs)
      if (handlersMapRef.current.incomingCall) {
        socket.off('incomingCall', handlersMapRef.current.incomingCall);
      }
      if (handlersMapRef.current.callRejected) {
        socket.off('callRejected', handlersMapRef.current.callRejected);
      }
      if (handlersMapRef.current.callEnded) {
        socket.off('callEnded', handlersMapRef.current.callEnded);
      }
      if (handlersMapRef.current.callFailed) {
        socket.off('callFailed', handlersMapRef.current.callFailed);
      }

      // Store new handler refs and attach
      handlersMapRef.current = {
        incomingCall: handleIncomingCall,
        callRejected: handleCallRejected,
        callEnded: handleCallEnded,
        callFailed: handleCallFailed,
      };

      socket.on('incomingCall', handleIncomingCall);
      socket.on('callRejected', handleCallRejected);
      socket.on('callEnded', handleCallEnded);
      socket.on('callFailed', handleCallFailed);
      listenersAttached.current = true;
      console.log('[CallHandler] Listeners attached, socket connected:', socket.connected);
    },
    [handleIncomingCall, handleCallRejected, handleCallEnded, handleCallFailed]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) {
      console.log('[CallHandler] No token, skipping socket init');
      return;
    }

    console.log('[CallHandler] Initializing socket for call handling');
    const socket = initSocket(token);
    if (!socket) {
      console.log('[CallHandler] Socket init returned null');
      return;
    }

    if (socket.connected) {
      console.log('[CallHandler] Socket already connected, attaching listeners');
      attachListeners(socket);
    }

    const onConnect = () => {
      console.log('[CallHandler] Socket connected event, re-attaching listeners');
      listenersAttached.current = false;
      attachListeners(socket);
    };
    socket.on('connect', onConnect);

    const existingSocket = getSocket();
    if (existingSocket?.connected && existingSocket !== socket) {
      console.log('[CallHandler] Existing socket found, attaching listeners');
      attachListeners(existingSocket);
    }

    return () => {
      socket.off('connect', onConnect);
      // Remove using stored refs
      if (handlersMapRef.current.incomingCall) {
        socket.off('incomingCall', handlersMapRef.current.incomingCall);
      }
      if (handlersMapRef.current.callRejected) {
        socket.off('callRejected', handlersMapRef.current.callRejected);
      }
      if (handlersMapRef.current.callEnded) {
        socket.off('callEnded', handlersMapRef.current.callEnded);
      }
      if (handlersMapRef.current.callFailed) {
        socket.off('callFailed', handlersMapRef.current.callFailed);
      }
      handlersMapRef.current = {};
      listenersAttached.current = false;
    };
    // Only re-run when attachListeners changes (handler refs update internally)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachListeners]);

  useEffect(() => {
    const interval = setInterval(() => {
      const socket = getSocket();
      if (socket?.connected && !listenersAttached.current) attachListeners(socket);
    }, 5000);
    return () => clearInterval(interval);
  }, [attachListeners]);

  const handleAcceptVoiceCall = () => {
    if (incomingCall?.isGroupCall) setIsGroupVoiceCallOpen(true);
    else setIsVoiceCallOpen(true);
  };

  const handleAcceptVideoCall = () => {
    if (incomingCall?.isGroupCall) setIsGroupVideoCallOpen(true);
    else setIsVideoCallOpen(true);
  };

  const handleReject = () => {
    if (incomingCall?.callerId && incomingCall?.threadId) {
      if (incomingCall.isGroupCall) {
        const socket = getSocket();
        socket?.emit('rejectGroupCall', {
          groupId: incomingCall.groupInfo?.groupId || incomingCall.threadId,
          callerId: incomingCall.callerId,
        });
      } else {
        emitRejectCall(incomingCall.callerId, incomingCall.threadId);
      }
    }
    resetCallState();
  };

  const handleCallEnd = () => {
    setIncomingCall(null);
    setIsVoiceCallOpen(false);
    setIsVideoCallOpen(false);
    setIsGroupVoiceCallOpen(false);
    setIsGroupVideoCallOpen(false);
    releaseCall();
  };

  return (
    <>
      {incomingCall && !isAnyCallModalOpen && (
        <>
          {incomingCall.callType === 'video' ? (
            <IncomingVideoCallNotification
              callerName={
                incomingCall.isGroupCall
                  ? `${incomingCall.callerName} (${incomingCall.groupInfo?.groupName || 'Group'})`
                  : incomingCall.callerName
              }
              callerAvatar={incomingCall.callerAvatar}
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
              callerAvatar={incomingCall.callerAvatar}
              onAccept={handleAcceptVoiceCall}
              onReject={handleReject}
            />
          )}
        </>
      )}

      {incomingCall && incomingCall.callType === 'voice' && !incomingCall.isGroupCall && (
        <VoiceCallModal
          isOpen={isVoiceCallOpen}
          onClose={() => {
            setIsVoiceCallOpen(false);
            setIncomingCall(null);
          }}
          recipientName={incomingCall.callerName}
          recipientAvatar={incomingCall.callerAvatar}
          recipientId={incomingCall.callerId}
          currentUserId={currentUserId}
          isIncomingCall={true}
          callerId={incomingCall.callerId}
          threadId={incomingCall.threadId}
          onCallEnd={handleCallEnd}
        />
      )}

      {incomingCall && incomingCall.callType === 'video' && !incomingCall.isGroupCall && (
        <VideoCallModal
          isOpen={isVideoCallOpen}
          onClose={() => {
            setIsVideoCallOpen(false);
            setIncomingCall(null);
          }}
          recipientName={incomingCall.callerName}
          recipientAvatar={incomingCall.callerAvatar}
          recipientId={incomingCall.callerId}
          isIncoming={true}
          callId={incomingCall.threadId}
          callerId={incomingCall.callerId}
          threadId={incomingCall.threadId}
          onCallEnd={handleCallEnd}
        />
      )}

      {incomingCall && incomingCall.callType === 'voice' && incomingCall.isGroupCall && (
        <GroupVoiceCallModal
          isOpen={isGroupVoiceCallOpen}
          onClose={() => {
            setIsGroupVoiceCallOpen(false);
            setIncomingCall(null);
          }}
          groupId={incomingCall.groupInfo?.groupId || incomingCall.threadId}
          groupName={incomingCall.groupInfo?.groupName || 'Group Call'}
          groupAvatar={incomingCall.groupInfo?.groupAvatar || '👥'}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          isIncomingCall={true}
          callerId={incomingCall.callerId}
          callerInfo={{ name: incomingCall.callerName, avatar: incomingCall.callerAvatar }}
        />
      )}

      {incomingCall && incomingCall.callType === 'video' && incomingCall.isGroupCall && (
        <GroupVideoCallModal
          isOpen={isGroupVideoCallOpen}
          onClose={() => {
            setIsGroupVideoCallOpen(false);
            setIncomingCall(null);
          }}
          groupId={incomingCall.groupInfo?.groupId || incomingCall.threadId}
          groupName={incomingCall.groupInfo?.groupName || 'Group Call'}
          groupAvatar={incomingCall.groupInfo?.groupAvatar || '👥'}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          isIncomingCall={true}
          callerId={incomingCall.callerId}
          callerInfo={{ name: incomingCall.callerName, avatar: incomingCall.callerAvatar }}
        />
      )}
    </>
  );
}
