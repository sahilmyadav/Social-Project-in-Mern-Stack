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
  const { isInCall } = useCallState();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [isGroupVoiceCallOpen, setIsGroupVoiceCallOpen] = useState(false);
  const [isGroupVideoCallOpen, setIsGroupVideoCallOpen] = useState(false);
  const listenersAttached = useRef(false);

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
  }, []);

  const handleIncomingCall = useCallback(
    (data: unknown) => {
      const d = data as Record<string, unknown>;
      const callerInfo = d.callerInfo as Record<string, string> | undefined;
      const groupInfo = d.groupInfo as Record<string, string> | undefined;
      const isGroupCall = !!d.isGroupCall;

      // Busy signal — reject if already in a call
      if (isInCall) {
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
    [isInCall]
  );

  const handleCallRejected = useCallback(() => {
    resetCallState();
  }, [resetCallState]);
  const handleCallEnded = useCallback(() => {
    resetCallState();
  }, [resetCallState]);
  const handleCallFailed = useCallback(
    (data: unknown) => {
      const d = data as Record<string, string>;
      showToast.error('Call Failed', d.reason || 'Unable to connect the call');
      resetCallState();
    },
    [resetCallState]
  );

  const attachListeners = useCallback(
    (socket: ReturnType<typeof getSocket>) => {
      if (!socket || listenersAttached.current) return;
      socket.off('incomingCall', handleIncomingCall);
      socket.off('callRejected', handleCallRejected);
      socket.off('callEnded', handleCallEnded);
      socket.off('callFailed', handleCallFailed);
      socket.on('incomingCall', handleIncomingCall);
      socket.on('callRejected', handleCallRejected);
      socket.on('callEnded', handleCallEnded);
      socket.on('callFailed', handleCallFailed);
      listenersAttached.current = true;
    },
    [handleIncomingCall, handleCallRejected, handleCallEnded, handleCallFailed]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) return;

    const socket = initSocket(token);
    if (!socket) return;

    if (socket.connected) attachListeners(socket);

    const onConnect = () => {
      listenersAttached.current = false;
      attachListeners(socket);
    };
    socket.on('connect', onConnect);

    const existingSocket = getSocket();
    if (existingSocket?.connected) attachListeners(existingSocket);

    return () => {
      socket.off('connect', onConnect);
      socket.off('incomingCall', handleIncomingCall);
      socket.off('callRejected', handleCallRejected);
      socket.off('callEnded', handleCallEnded);
      socket.off('callFailed', handleCallFailed);
      listenersAttached.current = false;
    };
  }, [attachListeners, handleIncomingCall, handleCallRejected, handleCallEnded, handleCallFailed]);

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
    setIsGroupVoiceCallOpen(false);
    setIsGroupVideoCallOpen(false);
  };

  const isAnyCallModalOpen =
    isVoiceCallOpen || isVideoCallOpen || isGroupVoiceCallOpen || isGroupVideoCallOpen;

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
