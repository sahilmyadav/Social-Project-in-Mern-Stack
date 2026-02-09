'use client';

import { useCallState } from '@/contexts/call-context';
import { getMediaUrl } from '@/lib/media-utils';
import { getSocket } from '@/lib/socket';
import {
  AUDIO_CONSTRAINTS,
  ICE_RECONNECT_TIMEOUT_MS,
  RING_TIMEOUT_MS,
  applyAudioBitrateCap,
  attemptIceRestart,
  formatCallDuration,
  getCallQualityStats,
  getIceServers,
  registerBeforeUnloadCleanup,
} from '@/lib/webrtc';
import { Mic, MicOff, Phone, PhoneOff, Users, Volume2, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Participant {
  userId: string;
  userName: string;
  avatar: string;
  isMuted: boolean;
  isSpeaking: boolean;
  joinedAt: Date;
}

interface GroupVoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  groupAvatar: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  isIncomingCall?: boolean;
  callerId?: string;
  callerInfo?: {
    name: string;
    avatar: string;
  };
}

export default function GroupVoiceCallModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  groupAvatar,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isIncomingCall = false,
  callerId,
  callerInfo,
}: GroupVoiceCallModalProps) {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'active' | 'ended'>(
    isIncomingCall ? 'ringing' : 'connecting'
  );
  const { acquireCall, releaseCall } = useCallState();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [hasUserAccepted, setHasUserAccepted] = useState(!isIncomingCall);
  const hasUserAcceptedRef = useRef(!isIncomingCall);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const isSettingUpRef = useRef(false);
  const isSpeakerOnRef = useRef(true);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceRestartTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const qualityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beforeUnloadCleanupRef = useRef<(() => void) | null>(null);
  const createPeerConnection = useCallback(
    (peerId: string, isInitiator: boolean) => {
      const socket = getSocket();
      if (!socket || !localStreamRef.current) {
        return null;
      }

      if (peerConnectionsRef.current.has(peerId)) {
        return peerConnectionsRef.current.get(peerId);
      }

      const pc = new RTCPeerConnection(getIceServers());
      peerConnectionsRef.current.set(peerId, pc);

      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('iceCandidate', {
            recipientId: peerId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallStatus('active');
          // Apply audio bitrate cap once connected
          applyAudioBitrateCap(pc).catch(() => {});
        } else if (pc.connectionState === 'failed') {
          console.warn(`[GroupVoiceCall] Peer ${peerId} connection failed`);
        } else if (pc.connectionState === 'disconnected') {
          console.warn(`[GroupVoiceCall] Peer ${peerId} disconnected`);
        }
      };

      // ICE restart for group calls — mirrors 1:1 call behavior
      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        if (iceState === 'disconnected') {
          console.warn(`[GroupVoiceCall] ICE disconnected for peer ${peerId}, scheduling restart`);
          const timer = setTimeout(async () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
              const offer = await attemptIceRestart(pc);
              if (offer && socket) {
                socket.emit('offer', {
                  recipientId: peerId,
                  offer,
                  callType: 'group-voice',
                });
              }
            }
            iceRestartTimersRef.current.delete(peerId);
          }, ICE_RECONNECT_TIMEOUT_MS);
          iceRestartTimersRef.current.set(peerId, timer);
        } else if (iceState === 'connected' || iceState === 'completed') {
          // Clear any pending ICE restart timer
          const timer = iceRestartTimersRef.current.get(peerId);
          if (timer) {
            clearTimeout(timer);
            iceRestartTimersRef.current.delete(peerId);
          }
        } else if (iceState === 'failed') {
          console.warn(`[GroupVoiceCall] ICE failed for peer ${peerId}`);
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;

        let audioElement = audioElementsRef.current.get(peerId);
        if (!audioElement) {
          audioElement = new Audio();
          audioElement.autoplay = true;
          (audioElement as any).playsInline = true;
          audioElementsRef.current.set(peerId, audioElement);
        }

        audioElement.srcObject = remoteStream;
        audioElement.muted = !isSpeakerOnRef.current;

        audioElement.play().catch((err) => {
          console.warn('[GroupVoiceCall] Audio playback failed:', err.message);
        });
      };

      if (isInitiator) {
        pc.createOffer()
          .then((offer) => {
            return pc.setLocalDescription(offer);
          })
          .then(() => {
            socket.emit('offer', {
              recipientId: peerId,
              offer: pc.localDescription,
              callType: 'group-voice',
            });
          });
      }

      return pc;
    },
    [] // No deps — uses refs only, stable across re-renders
  );

  const handleOffer = useCallback(
    async (data: { callerId: string; offer: RTCSessionDescriptionInit; callType?: string }) => {
      if (data.callType && data.callType !== 'group-voice') {
        return;
      }

      // Gate: do NOT process offers until user has explicitly accepted the call
      if (!hasUserAcceptedRef.current) {
        return;
      }

      const { callerId: offererUserId, offer } = data;

      const socket = getSocket();
      if (!socket || !localStreamRef.current) {
        return;
      }

      let pc = peerConnectionsRef.current.get(offererUserId);
      if (!pc) {
        const newPc = createPeerConnection(offererUserId, false);
        if (!newPc) return;
        pc = newPc;
      }

      try {
        const isPolite = currentUserId < offererUserId;

        if (pc.signalingState !== 'stable') {
          if (!isPolite) {
            return;
          }

          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(new RTCSessionDescription(offer)),
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('answer', {
          recipientId: offererUserId,
          answer: pc.localDescription,
          callType: 'group-voice',
        });

        const pending = pendingCandidatesRef.current.get(offererUserId) || [];
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn(
              '[GroupVoiceCall] Failed to add pending ICE candidate:',
              (err as Error).message
            );
          }
        }
        pendingCandidatesRef.current.delete(offererUserId);
      } catch (err) {
        console.warn('[GroupVoiceCall] Failed to handle offer:', (err as Error).message);
      }
    },
    [createPeerConnection, currentUserId]
  );

  const handleAnswer = useCallback(
    async (data: {
      receiverId?: string;
      recipientId?: string;
      answer: RTCSessionDescriptionInit;
      callType?: string;
    }) => {
      if (data.callType && data.callType !== 'group-voice') {
        return;
      }

      const receiverId = data.receiverId || data.recipientId || '';
      const { answer } = data;

      const pc = peerConnectionsRef.current.get(receiverId);
      if (!pc) {
        return;
      }

      if (pc.signalingState !== 'have-local-offer') {
        return;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        const pending = pendingCandidatesRef.current.get(receiverId) || [];
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn(
              '[GroupVoiceCall] Failed to add ICE candidate for answer:',
              (err as Error).message
            );
          }
        }
        pendingCandidatesRef.current.delete(receiverId);
      } catch (err) {
        console.warn('[GroupVoiceCall] Failed to handle answer:', (err as Error).message);
      }
    },
    []
  );

  const handleIceCandidate = useCallback(
    async (data: { senderId: string; candidate: RTCIceCandidateInit; callType?: string }) => {
      if (data.callType && data.callType !== 'group-voice') {
        return;
      }

      const { senderId, candidate } = data;

      const pc = peerConnectionsRef.current.get(senderId);

      if (!pc || !pc.remoteDescription || pc.remoteDescription.type === null) {
        const pending = pendingCandidatesRef.current.get(senderId) || [];
        pending.push(candidate);
        pendingCandidatesRef.current.set(senderId, pending);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[GroupVoiceCall] Failed to add ICE candidate:', (err as Error).message);
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    if (isSettingUpRef.current) return;

    // Acquire global call lock — bail if busy
    const acquired = acquireCall('group-voice', {
      groupId,
      isIncoming: isIncomingCall,
    });
    if (!acquired) {
      onClose();
      return;
    }

    isSettingUpRef.current = true;

    const socket = getSocket();
    if (!socket) return;

    setCallDuration(0);
    setCallStatus(isIncomingCall ? 'ringing' : 'connecting');
    setParticipants([]);
    setHasUserAccepted(!isIncomingCall);
    hasUserAcceptedRef.current = !isIncomingCall;
    peerConnectionsRef.current.clear();
    audioElementsRef.current.clear();
    pendingCandidatesRef.current.clear();
    localStreamRef.current = null;

    setParticipants([
      {
        userId: currentUserId,
        userName: currentUserName || 'You',
        avatar: currentUserAvatar,
        isMuted: false,
        isSpeaking: false,
        joinedAt: new Date(),
      },
    ]);

    const setupMedia = async () => {
      if (isIncomingCall) {
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        localStreamRef.current = stream;

        socket.emit('joinGroupCall', { groupId, callType: 'voice' });
        setCallStatus('connecting');
      } catch (error) {
        setCallStatus('ended');
      }
    };

    setupMedia();

    const handleParticipantJoined = (data: {
      userId: string;
      userName: string;
      avatar: string;
    }) => {
      if (data.userId === currentUserId) return;

      setParticipants((prev) => {
        if (prev.some((p) => p.userId === data.userId)) return prev;
        return [
          ...prev,
          {
            userId: data.userId,
            userName: data.userName,
            avatar: data.avatar,
            isMuted: false,
            isSpeaking: false,
            joinedAt: new Date(),
          },
        ];
      });

      setTimeout(() => {
        if (localStreamRef.current) {
          createPeerConnection(data.userId, true);
        }
      }, 500);

      setCallStatus('active');
    };

    const handleParticipantLeft = (data: { userId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));

      const pc = peerConnectionsRef.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.userId);
      }

      const audio = audioElementsRef.current.get(data.userId);
      if (audio) {
        audio.srcObject = null;
        audioElementsRef.current.delete(data.userId);
      }
    };

    const handleGroupCallEnded = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      audioElementsRef.current.forEach((audio) => {
        audio.srcObject = null;
      });
      audioElementsRef.current.clear();

      isSettingUpRef.current = false;
      setCallStatus('ended');
      releaseCall();
      setTimeout(() => onClose(), 500);
    };

    const handleParticipantMuted = (data: { userId: string; isMuted: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.userId === data.userId ? { ...p, isMuted: data.isMuted } : p))
      );
    };

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('iceCandidate', handleIceCandidate);

    socket.on('groupCallParticipantJoined', handleParticipantJoined);
    socket.on('groupCallParticipantLeft', handleParticipantLeft);
    socket.on('groupCallEnded', handleGroupCallEnded);
    socket.on('groupCallParticipantMuted', handleParticipantMuted);

    // beforeunload: ensure we clean up on tab close/refresh
    beforeUnloadCleanupRef.current = registerBeforeUnloadCleanup(() => {
      const s = getSocket();
      if (s) s.emit('leaveGroupCall', { groupId });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
    });

    // Quality monitoring — poll every 5s
    qualityIntervalRef.current = setInterval(async () => {
      for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
        const stats = await getCallQualityStats(pc);
        if (stats && stats.packetLossPercent > 5) {
          console.warn(
            `[GroupVoiceCall] Poor quality for peer ${peerId}: ${stats.packetLossPercent.toFixed(1)}% loss, RTT ${stats.roundTripTime.toFixed(0)}ms`
          );
        }
      }
    }, 5000);

    return () => {
      isSettingUpRef.current = false;

      // Clean up beforeunload listener
      if (beforeUnloadCleanupRef.current) {
        beforeUnloadCleanupRef.current();
        beforeUnloadCleanupRef.current = null;
      }

      // Stop quality monitoring
      if (qualityIntervalRef.current) {
        clearInterval(qualityIntervalRef.current);
        qualityIntervalRef.current = null;
      }

      // Clear ICE restart timers
      iceRestartTimersRef.current.forEach((timer) => clearTimeout(timer));
      iceRestartTimersRef.current.clear();

      // Notify server we're leaving (not ending for everyone)
      const cleanupSocket = getSocket();
      if (cleanupSocket) {
        cleanupSocket.emit('leaveGroupCall', { groupId });
      }

      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('iceCandidate', handleIceCandidate);
      socket.off('groupCallParticipantJoined', handleParticipantJoined);
      socket.off('groupCallParticipantLeft', handleParticipantLeft);
      socket.off('groupCallEnded', handleGroupCallEnded);
      socket.off('groupCallParticipantMuted', handleParticipantMuted);

      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      audioElementsRef.current.forEach((audio) => {
        audio.srcObject = null;
      });
      audioElementsRef.current.clear();
    };
  }, [
    isOpen,
    groupId,
    currentUserId,
    currentUserName,
    currentUserAvatar,
    isIncomingCall,
    createPeerConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
  ]);

  // Ring timeout: auto-fail if no answer within RING_TIMEOUT_MS
  useEffect(() => {
    if (!isOpen || callStatus !== 'ringing') {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      return;
    }
    ringTimeoutRef.current = setTimeout(() => {
      setCallStatus('ended');
      releaseCall();
      setTimeout(() => onClose(), 2000);
    }, RING_TIMEOUT_MS);
    return () => {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
    };
  }, [isOpen, callStatus, onClose]);

  useEffect(() => {
    if (callStatus !== 'active') return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  const acceptCall = async () => {
    const socket = getSocket();
    if (!socket) return;

    try {
      setHasUserAccepted(true);
      hasUserAcceptedRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
      localStreamRef.current = stream;

      peerConnectionsRef.current.forEach((pc, userId) => {
        stream.getTracks().forEach((track) => {
          const senders = pc.getSenders();
          const existingSender = senders.find((s) => s.track?.kind === track.kind);
          if (!existingSender) {
            pc.addTrack(track, stream);
          }
        });
      });

      setParticipants((prev) =>
        prev.map((p) => (p.userId === currentUserId ? { ...p, isMuted: false } : p))
      );

      socket.emit('acceptGroupCall', { groupId, callerId });
      // Also join the group call room on the server
      socket.emit('joinGroupCall', { groupId, callType: 'voice' });
      setCallStatus('active');
    } catch (error) {
      console.warn('[GroupVoiceCall] Failed to accept call:', (error as Error).message);
      setHasUserAccepted(false);
      hasUserAcceptedRef.current = false;
    }
  };

  const rejectCall = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('rejectGroupCall', { groupId, callerId });
    isSettingUpRef.current = false;
    releaseCall();
    onClose();
  };

  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    audioElementsRef.current.forEach((audio) => {
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    isSettingUpRef.current = false;
    setCallStatus('ended');
    releaseCall();
    setTimeout(() => onClose(), 500);
  };

  const endCall = () => {
    const socket = getSocket();
    if (socket) {
      // Leave the call (don't end for everyone)
      socket.emit('leaveGroupCall', { groupId });
    }
    cleanupCall();
  };

  const toggleMic = () => {
    if (!localStreamRef.current) {
      return;
    }

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);

      const socket = getSocket();
      if (socket) {
        socket.emit('groupCallMuteToggle', { groupId, isMuted: !audioTrack.enabled });
      }

      setParticipants((prev) =>
        prev.map((p) => (p.userId === currentUserId ? { ...p, isMuted: !audioTrack.enabled } : p))
      );
    } else {
    }
  };

  const toggleSpeaker = () => {
    const newSpeakerState = !isSpeakerOn;
    setIsSpeakerOn(newSpeakerState);
    isSpeakerOnRef.current = newSpeakerState;

    audioElementsRef.current.forEach((audio) => {
      audio.muted = !newSpeakerState;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90">
      <div className="relative w-full max-w-lg mx-4 bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl overflow-hidden shadow-2xl">
        <button
          onClick={endCall}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
        >
          <X size={20} className="text-white" />
        </button>

        <div className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users size={20} className="text-green-400" />
            <span className="text-green-400 text-sm font-medium">Group Voice Call</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-1">{groupName}</h2>
          <p className="text-gray-400 text-sm">
            {callStatus === 'ringing' && isIncomingCall && (
              <>Incoming call from {callerInfo?.name || 'Unknown'}...</>
            )}
            {callStatus === 'connecting' && 'Connecting...'}
            {callStatus === 'active' && (
              <>
                {participants.length} participant{participants.length !== 1 ? 's' : ''} •{' '}
                {formatCallDuration(callDuration)}
              </>
            )}
            {callStatus === 'ended' && 'Call ended'}
          </p>
        </div>

        <div className="px-6 pb-4">
          <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
            {participants.map((participant) => {
              const avatarUrl = participant.avatar ? getMediaUrl(participant.avatar) : null;
              const isValidAvatar =
                avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('/'));

              return (
                <div
                  key={participant.userId}
                  className={`relative flex flex-col items-center p-3 rounded-xl transition ${
                    participant.isSpeaking ? 'bg-green-500/20 ring-2 ring-green-400' : 'bg-white/5'
                  }`}
                >
                  <div className="relative w-14 h-14 mb-2">
                    {isValidAvatar ? (
                      <img
                        src={avatarUrl}
                        alt={participant.userName}
                        className="w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white text-lg font-medium">
                          {participant.userName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}

                    {participant.isMuted && (
                      <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-red-500">
                        <MicOff size={10} className="text-white" />
                      </div>
                    )}
                  </div>

                  <span className="text-white text-xs font-medium text-center truncate w-full">
                    {participant.userId === currentUserId ? 'You' : participant.userName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 flex items-center justify-center gap-4">
          {callStatus === 'ringing' && isIncomingCall ? (
            <>
              <button
                onClick={acceptCall}
                className="p-4 rounded-full bg-green-500 hover:bg-green-600 transition shadow-lg"
              >
                <Phone size={28} className="text-white" />
              </button>
              <button
                onClick={rejectCall}
                className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition shadow-lg"
              >
                <PhoneOff size={28} className="text-white" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={toggleMic}
                className={`p-4 rounded-full transition shadow-lg ${
                  isMicOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {isMicOn ? (
                  <Mic size={24} className="text-white" />
                ) : (
                  <MicOff size={24} className="text-white" />
                )}
              </button>

              <button
                onClick={toggleSpeaker}
                className={`p-4 rounded-full transition shadow-lg ${
                  isSpeakerOn
                    ? 'bg-white/20 hover:bg-white/30'
                    : 'bg-yellow-500 hover:bg-yellow-600'
                }`}
              >
                {isSpeakerOn ? (
                  <Volume2 size={24} className="text-white" />
                ) : (
                  <VolumeX size={24} className="text-white" />
                )}
              </button>

              <button
                onClick={endCall}
                className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition shadow-lg"
              >
                <PhoneOff size={28} className="text-white" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
