'use client';

import { useCallState } from '@/contexts/call-context';
import { getMediaUrl } from '@/lib/media-utils';
import { getSocket } from '@/lib/socket';
import {
  adaptVideoQuality,
  applyAudioBitrateCap,
  applyBitrateCap,
  attemptIceRestart,
  AUDIO_CONSTRAINTS,
  BITRATE_LIMITS,
  formatCallDuration,
  getCallQualityStats,
  getIceServers,
  ICE_RECONNECT_TIMEOUT_MS,
  registerBeforeUnloadCleanup,
  RING_TIMEOUT_MS,
  VIDEO_CONSTRAINTS_GROUP,
} from '@/lib/webrtc';
import { Mic, MicOff, PhoneOff, Users, Video, VideoOff, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Participant {
  userId: string;
  userName: string;
  userAvatar: string;
  isMuted: boolean;
  isVideoOff: boolean;
  stream?: MediaStream;
  joinedAt: Date;
}

interface GroupVideoCallModalProps {
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

export default function GroupVideoCallModal({
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
}: GroupVideoCallModalProps) {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'active' | 'ended'>(
    isIncomingCall ? 'ringing' : 'connecting'
  );
  const { acquireCall, releaseCall } = useCallState();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const [hasUserAccepted, setHasUserAccepted] = useState(!isIncomingCall);
  const hasUserAcceptedRef = useRef(!isIncomingCall);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const negotiatingRef = useRef<Set<string>>(new Set());
  const isSettingUpRef = useRef(false);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceRestartTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const qualityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beforeUnloadCleanupRef = useRef<(() => void) | null>(null);

  const getGridClass = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  const createPeerConnection = useCallback((participantId: string, participantInfo?: unknown) => {
    // Reuse existing connection if still usable (supports rollback on glare)
    if (peerConnectionsRef.current.has(participantId)) {
      const existingPc = peerConnectionsRef.current.get(participantId)!;
      if (existingPc.connectionState !== 'closed' && existingPc.connectionState !== 'failed') {
        return existingPc;
      }
      existingPc.close();
      peerConnectionsRef.current.delete(participantId);
    }

    const pc = new RTCPeerConnection(getIceServers());
    peerConnectionsRef.current.set(participantId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      remoteStreamsRef.current.set(participantId, remoteStream);

      setParticipants((prev) =>
        prev.map((p) => (p.userId === participantId ? { ...p, stream: remoteStream } : p))
      );
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit('iceCandidate', {
          recipientId: participantId,
          candidate: event.candidate.toJSON(),
          callType: 'group-video',
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallStatus('active');
        // Apply bitrate caps once connected
        applyBitrateCap(pc, BITRATE_LIMITS.videoGroup).catch(() => {});
        applyAudioBitrateCap(pc).catch(() => {});
      } else if (pc.connectionState === 'failed') {
        console.warn(`[GroupVideoCall] Peer ${participantId} connection failed`);
      } else if (pc.connectionState === 'disconnected') {
        console.warn(`[GroupVideoCall] Peer ${participantId} disconnected`);
      }
    };

    // ICE restart for group calls — auto-recover from network changes
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      if (iceState === 'disconnected') {
        console.warn(
          `[GroupVideoCall] ICE disconnected for peer ${participantId}, scheduling restart`
        );
        const timer = setTimeout(async () => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            const offer = await attemptIceRestart(pc);
            if (offer) {
              const s = getSocket();
              s?.emit('offer', {
                recipientId: participantId,
                offer,
                callType: 'group-video',
              });
            }
          }
          iceRestartTimersRef.current.delete(participantId);
        }, ICE_RECONNECT_TIMEOUT_MS);
        iceRestartTimersRef.current.set(participantId, timer);
      } else if (iceState === 'connected' || iceState === 'completed') {
        const timer = iceRestartTimersRef.current.get(participantId);
        if (timer) {
          clearTimeout(timer);
          iceRestartTimersRef.current.delete(participantId);
        }
      } else if (iceState === 'failed') {
        console.warn(`[GroupVideoCall] ICE failed for peer ${participantId}`);
      }
    };

    return pc;
  }, []);

  const handleOffer = useCallback(
    async (data: {
      callerId: string;
      offer: RTCSessionDescriptionInit;
      callerInfo?: any;
      callType?: string;
    }) => {
      if (data.callType && data.callType !== 'group-video') {
        return;
      }

      // Gate: do NOT process offers until user has explicitly accepted the call
      if (!hasUserAcceptedRef.current) {
        return;
      }

      if (data.callerInfo) {
        const callerUserId = data.callerInfo.userId || data.callerId;
        setParticipants((prev) => {
          if (prev.some((p) => p.userId === callerUserId)) return prev;
          return [
            ...prev,
            {
              userId: callerUserId,
              userName: data.callerInfo.userName || data.callerInfo.name || 'Unknown',
              userAvatar: data.callerInfo.userAvatar || data.callerInfo.avatar || '',
              isMuted: false,
              isVideoOff: false,
              joinedAt: new Date(),
            },
          ];
        });
      }

      // Per-peer negotiation guard — prevent concurrent offer processing
      if (negotiatingRef.current.has(data.callerId)) {
        console.warn('[GroupVideoCall] Skipping duplicate offer from', data.callerId);
        return;
      }
      negotiatingRef.current.add(data.callerId);

      const pc = createPeerConnection(data.callerId, data.callerInfo);

      try {
        const isPolite = currentUserId < data.callerId;

        if (pc.signalingState !== 'stable') {
          if (!isPolite) {
            negotiatingRef.current.delete(data.callerId);
            return;
          }

          // Sequential rollback — Promise.all can race and corrupt state
          await pc.setLocalDescription({ type: 'rollback' });
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const socket = getSocket();
        socket?.emit('answer', {
          recipientId: data.callerId,
          answer: answer,
          callType: 'group-video',
        });

        const pending = pendingCandidatesRef.current.get(data.callerId) || [];
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn(
              '[GroupVideoCall] Failed to add pending ICE candidate:',
              (err as Error).message
            );
          }
        }
        pendingCandidatesRef.current.delete(data.callerId);
      } catch (err) {
        console.warn('[GroupVideoCall] Failed to handle offer:', (err as Error).message);
      } finally {
        negotiatingRef.current.delete(data.callerId);
      }
    },
    [createPeerConnection, currentUserId]
  );

  const handleAnswer = useCallback(
    async (data: {
      recipientId: string;
      answer: RTCSessionDescriptionInit;
      answererInfo?: any;
      callType?: string;
    }) => {
      if (data.callType && data.callType !== 'group-video') {
        return;
      }

      if (data.answererInfo) {
        const answererUserId = data.answererInfo.userId || data.recipientId;
        setParticipants((prev) => {
          if (prev.some((p) => p.userId === answererUserId)) return prev;
          return [
            ...prev,
            {
              userId: answererUserId,
              userName: data.answererInfo.userName || data.answererInfo.name || 'Unknown',
              userAvatar: data.answererInfo.userAvatar || data.answererInfo.avatar || '',
              isMuted: false,
              isVideoOff: false,
              joinedAt: new Date(),
            },
          ];
        });
      }

      const pc = peerConnectionsRef.current.get(data.recipientId);
      if (pc) {
        if (pc.signalingState !== 'have-local-offer') {
          return;
        }
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

          const pending = pendingCandidatesRef.current.get(data.recipientId) || [];
          for (const candidate of pending) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.warn(
                '[GroupVideoCall] Failed to add ICE candidate for answer:',
                (err as Error).message
              );
            }
          }
          pendingCandidatesRef.current.delete(data.recipientId);
        } catch (err) {
          console.warn('[GroupVideoCall] Failed to handle answer:', (err as Error).message);
        }
      }
    },
    []
  );

  const handleIceCandidate = useCallback(
    async (data: { senderId: string; candidate: RTCIceCandidateInit; callType?: string }) => {
      if (data.callType && data.callType !== 'group-video') {
        return;
      }

      const pc = peerConnectionsRef.current.get(data.senderId);

      if (!pc || !pc.remoteDescription || pc.remoteDescription.type === null) {
        const pending = pendingCandidatesRef.current.get(data.senderId) || [];
        pending.push(data.candidate);
        pendingCandidatesRef.current.set(data.senderId, pending);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.warn('[GroupVideoCall] Failed to add ICE candidate:', (err as Error).message);
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    if (isSettingUpRef.current) return;

    // Acquire global call lock — bail if busy
    const acquired = acquireCall('group-video', {
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
    setLocalStreamReady(false);
    setHasUserAccepted(!isIncomingCall);
    hasUserAcceptedRef.current = !isIncomingCall;
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidatesRef.current.clear();
    negotiatingRef.current.clear();
    videoElementsRef.current.clear();
    localStreamRef.current = null;

    const setupMedia = async () => {
      if (isIncomingCall) {
        setLocalStreamReady(false);
        setParticipants([
          {
            userId: currentUserId,
            userName: currentUserName || 'You',
            userAvatar: currentUserAvatar,
            isMuted: false,
            isVideoOff: true,
            stream: undefined,
            joinedAt: new Date(),
          },
        ]);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_CONSTRAINTS,
          video: VIDEO_CONSTRAINTS_GROUP,
        });
        localStreamRef.current = stream;
        setLocalStreamReady(true);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setParticipants([
          {
            userId: currentUserId,
            userName: currentUserName || 'You',
            userAvatar: currentUserAvatar,
            isMuted: false,
            isVideoOff: false,
            stream: stream,
            joinedAt: new Date(),
          },
        ]);

        socket.emit('joinGroupCall', { groupId, callType: 'video' });
        setCallStatus('connecting');
      } catch (error) {
        console.warn('[GroupVideoCall] Failed to setup media:', (error as Error).message);
        setCallStatus('ended');
      }
    };

    setupMedia();

    const handleParticipantJoined = async (data: {
      userId?: string;
      userName?: string;
      userAvatar?: string;
      avatar?: string;
      existingParticipants?: Array<{
        userId?: string;
        userName?: string;
        userAvatar?: string;
        avatar?: string;
      }>;
    }) => {
      const participantId = data.userId || '';
      const participantName = data.userName || 'Unknown';
      const participantAvatar = data.userAvatar || data.avatar || '';

      setParticipants((prev) => {
        if (prev.some((p) => p.userId === participantId)) return prev;
        return [
          ...prev,
          {
            userId: participantId,
            userName: participantName,
            userAvatar: participantAvatar,
            isMuted: false,
            isVideoOff: false,
            joinedAt: new Date(),
          },
        ];
      });

      if (data.existingParticipants && data.existingParticipants.length > 0) {
        setParticipants((prev) => {
          const newParticipants = data
            .existingParticipants!.map((ep) => ({
              userId: ep.userId || '',
              userName: ep.userName || 'Unknown',
              userAvatar: ep.userAvatar || ep.avatar || '',
            }))
            .filter((ep) => ep.userId && !prev.some((p) => p.userId === ep.userId));
          return [
            ...prev,
            ...newParticipants.map((ep) => ({
              userId: ep.userId,
              userName: ep.userName,
              userAvatar: ep.userAvatar,
              isMuted: false,
              isVideoOff: false,
              joinedAt: new Date(),
            })),
          ];
        });

        // Only create peer connections for existing participants — do NOT send offers.
        // Existing participants will send us offers when they see us join,
        // preventing WebRTC glare (both sides sending offers simultaneously).
        for (const participant of data.existingParticipants) {
          const epId = participant.userId || '';
          if (epId && epId !== currentUserId) {
            createPeerConnection(epId, participant);
          }
        }
      }

      if (localStreamRef.current && participantId && participantId !== currentUserId) {
        const pc = createPeerConnection(participantId, data);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', {
            recipientId: participantId,
            offer: offer,
            callType: 'group-video',
          });
        } catch (err) {
          console.warn(
            '[GroupVideoCall] Failed to create offer for new participant:',
            (err as Error).message
          );
        }
      }

      setCallStatus('active');
    };

    const handleParticipantLeft = (data: { userId?: string }) => {
      const participantId = data.userId || '';
      setParticipants((prev) => prev.filter((p) => p.userId !== participantId));

      const pc = peerConnectionsRef.current.get(participantId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(participantId);
      }

      remoteStreamsRef.current.delete(participantId);
    };

    const handleGroupCallEnded = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      isSettingUpRef.current = false;
      setCallStatus('ended');
      releaseCall();
      setTimeout(() => onClose(), 500);
    };

    const handleParticipantMuted = (data: { userId?: string; isMuted: boolean }) => {
      const participantId = data.userId || '';
      setParticipants((prev) =>
        prev.map((p) => (p.userId === participantId ? { ...p, isMuted: data.isMuted } : p))
      );
    };

    const handleParticipantVideoToggle = (data: { userId?: string; isVideoOff: boolean }) => {
      const participantId = data.userId || '';
      setParticipants((prev) =>
        prev.map((p) => (p.userId === participantId ? { ...p, isVideoOff: data.isVideoOff } : p))
      );
    };

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('iceCandidate', handleIceCandidate);

    socket.on('groupCallParticipantJoined', handleParticipantJoined);
    socket.on('groupCallParticipantLeft', handleParticipantLeft);
    socket.on('groupCallEnded', handleGroupCallEnded);
    socket.on('groupCallParticipantMuted', handleParticipantMuted);
    socket.on('groupCallParticipantVideoToggle', handleParticipantVideoToggle);

    // beforeunload: ensure we clean up on tab close/refresh
    beforeUnloadCleanupRef.current = registerBeforeUnloadCleanup(() => {
      const s = getSocket();
      if (s) s.emit('leaveGroupCall', { groupId });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
    });

    // Quality monitoring + adaptive bitrate — poll every 5s
    qualityIntervalRef.current = setInterval(async () => {
      for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
        const stats = await getCallQualityStats(pc);
        if (stats) {
          if (stats.packetLossPercent > 2 || stats.roundTripTime > 150) {
            await adaptVideoQuality(pc, stats, true);
          }
          if (stats.packetLossPercent > 5) {
            console.warn(
              `[GroupVideoCall] Poor quality for peer ${peerId}: ${stats.packetLossPercent.toFixed(1)}% loss, RTT ${stats.roundTripTime.toFixed(0)}ms`
            );
          }
        }
      }
    }, 5000);

    return () => {
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
      socket.off('groupCallParticipantVideoToggle', handleParticipantVideoToggle);

      isSettingUpRef.current = false;

      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      remoteStreamsRef.current.clear();
      videoElementsRef.current.clear();
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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
        video: VIDEO_CONSTRAINTS_GROUP,
      });
      localStreamRef.current = stream;
      setLocalStreamReady(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

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
        prev.map((p) =>
          p.userId === currentUserId
            ? { ...p, stream: stream, isVideoOff: false, isMuted: false }
            : p
        )
      );

      socket.emit('acceptGroupCall', { groupId, callerId });
      // Also join the group call room on the server
      socket.emit('joinGroupCall', { groupId, callType: 'video' });
      setCallStatus('active');
    } catch (error) {
      console.warn('[GroupVideoCall] Failed to accept call:', (error as Error).message);
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

  const endCall = () => {
    const socket = getSocket();
    if (socket) {
      // Leave the call (don't end for everyone)
      socket.emit('leaveGroupCall', { groupId });
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStreamReady(false);

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    isSettingUpRef.current = false;

    setCallStatus('ended');
    releaseCall();
    setTimeout(() => onClose(), 500);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) {
      return;
    }

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);

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

  const toggleVideo = () => {
    if (!localStreamRef.current) {
      return;
    }

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);

      const socket = getSocket();
      if (socket) {
        socket.emit('groupCallVideoToggle', { groupId, isVideoOff: !videoTrack.enabled });
      }

      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === currentUserId ? { ...p, isVideoOff: !videoTrack.enabled } : p
        )
      );
    } else {
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <div className="relative w-full h-full flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-green-400" />
              <div>
                <h2 className="text-white font-semibold">{groupName}</h2>
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
            </div>
            <button
              onClick={endCall}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
            >
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-4 pt-20 pb-24 overflow-hidden">
          <div className={`grid ${getGridClass(participants.length)} gap-2 h-full auto-rows-fr`}>
            {participants.map((participant, index) => {
              const isLocalUser = participant.userId === currentUserId;
              const hasVideo = isLocalUser
                ? !participant.isVideoOff && localStreamReady && localStreamRef.current
                : !participant.isVideoOff && participant.stream;

              const avatarUrl = participant.userAvatar ? getMediaUrl(participant.userAvatar) : null;
              const isValidAvatar =
                avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('/'));

              return (
                <div
                  key={participant.userId || `participant-${index}`}
                  className="relative rounded-xl overflow-hidden bg-gray-800"
                >
                  {!hasVideo ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                      {isValidAvatar ? (
                        <div className="relative w-20 h-20 md:w-24 md:h-24">
                          <img
                            src={avatarUrl}
                            alt={participant.userName}
                            className="w-full h-full rounded-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <span className="text-white text-3xl font-medium">
                            {participant.userName?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : isLocalUser ? (
                    <video
                      ref={(el) => {
                        if (
                          el &&
                          localStreamRef.current &&
                          el.srcObject !== localStreamRef.current
                        ) {
                          el.srcObject = localStreamRef.current;
                        }
                        localVideoRef.current = el;
                      }}
                      autoPlay
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover mirror"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  ) : (
                    <video
                      ref={(el) => {
                        if (el && participant.stream && el.srcObject !== participant.stream) {
                          el.srcObject = participant.stream;
                          videoElementsRef.current.set(participant.userId, el);
                        }
                      }}
                      autoPlay
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium truncate">
                        {participant.userId === currentUserId ? 'You' : participant.userName}
                      </span>
                      <div className="flex items-center gap-1">
                        {participant.isMuted && (
                          <div className="p-1 rounded-full bg-red-500/80">
                            <MicOff size={12} className="text-white" />
                          </div>
                        )}
                        {participant.isVideoOff && (
                          <div className="p-1 rounded-full bg-yellow-500/80">
                            <VideoOff size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
          <div className="flex items-center justify-center gap-4">
            {callStatus === 'ringing' && isIncomingCall ? (
              <>
                <button
                  onClick={acceptCall}
                  className="p-4 rounded-full bg-green-500 hover:bg-green-600 transition shadow-lg"
                >
                  <Video size={28} className="text-white" />
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
                  onClick={toggleMute}
                  className={`p-4 rounded-full transition shadow-lg ${
                    !isMuted ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {!isMuted ? (
                    <Mic size={24} className="text-white" />
                  ) : (
                    <MicOff size={24} className="text-white" />
                  )}
                </button>

                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-full transition shadow-lg ${
                    !isVideoOff
                      ? 'bg-white/20 hover:bg-white/30'
                      : 'bg-yellow-500 hover:bg-yellow-600'
                  }`}
                >
                  {!isVideoOff ? (
                    <Video size={24} className="text-white" />
                  ) : (
                    <VideoOff size={24} className="text-white" />
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
    </div>
  );
}
