'use client';

import { getMediaUrl } from '@/lib/media-utils';
import { getSocket } from '@/lib/socket';
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

// STUN/TURN servers for WebRTC
import { ICE_SERVERS } from '@/lib/webrtc-config';

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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [hasUserAccepted, setHasUserAccepted] = useState(!isIncomingCall); // Track if user accepted
  const hasUserAcceptedRef = useRef(!isIncomingCall); // Ref version for callbacks
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingOffersRef = useRef<Array<{ callerId: string; offer: RTCSessionDescriptionInit; callType?: string }>>([]); // Queue offers while ringing
  const isSettingUpRef = useRef(false);

  // Format duration as mm:ss or hh:mm:ss
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Create a peer connection for a specific user
  const createPeerConnection = useCallback(
    (peerId: string, isInitiator: boolean) => {
      const socket = getSocket();
      if (!socket || !localStreamRef.current) {
        console.error('❌ Cannot create peer connection: missing socket or local stream');
        return null;
      }

      // Check if we already have a connection
      if (peerConnectionsRef.current.has(peerId)) {
        console.log(`📞 Peer connection already exists for ${peerId}`);
        return peerConnectionsRef.current.get(peerId);
      }

      console.log(`📞 Creating peer connection for ${peerId}, isInitiator: ${isInitiator}`);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(peerId, pc);

      // Add local audio track to peer connection
      localStreamRef.current.getTracks().forEach((track) => {
        console.log(`📞 Adding local track to peer connection for ${peerId}`);
        pc.addTrack(track, localStreamRef.current!);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`🧊 Sending ICE candidate to ${peerId}`);
          socket.emit('iceCandidate', {
            recipientId: peerId,
            candidate: event.candidate,
            callType: 'group-voice',
          });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`📞 Connection state for ${peerId}: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
          setCallStatus('active');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.log(`❌ Connection ${pc.connectionState} for ${peerId}`);
        }
      };

      // Handle incoming remote tracks
      pc.ontrack = (event) => {
        console.log(`📞 Received remote track from ${peerId}`);
        const [remoteStream] = event.streams;

        // Create or get audio element for this peer
        let audioElement = audioElementsRef.current.get(peerId);
        if (!audioElement) {
          audioElement = new Audio();
          audioElement.autoplay = true;
          // @ts-ignore - playsInline is valid for audio elements in browsers
          audioElement.playsInline = true;
          audioElementsRef.current.set(peerId, audioElement);
        }

        audioElement.srcObject = remoteStream;
        audioElement.muted = !isSpeakerOn;

        // Try to play (might need user interaction)
        audioElement.play().catch((err) => {
          console.warn('Audio playback failed:', err);
        });
      };

      // If we're the initiator, create and send an offer
      if (isInitiator) {
        pc.createOffer()
          .then((offer) => {
            console.log(`📞 [Voice] Created offer for ${peerId}`);
            return pc.setLocalDescription(offer);
          })
          .then(() => {
            console.log(`📞 [Voice] Sending offer to ${peerId}`);
            socket.emit('offer', {
              recipientId: peerId,
              offer: pc.localDescription,
              callType: 'group-voice',
            });
          })
          .catch((err) => console.error('Error creating offer:', err));
      }

      // Note: Pending ICE candidates will be processed after remote description is set
      // in handleOffer or handleAnswer

      return pc;
    },
    [isSpeakerOn]
  );

  // Handle incoming WebRTC offer
  const handleOffer = useCallback(
    async (data: { callerId: string; offer: RTCSessionDescriptionInit; callType?: string }) => {
      // Only handle group-voice call offers (reject 1-to-1 or other types)
      if (data.callType !== 'group-voice') {
        console.log(`📞 [GroupVoice] Ignoring offer with callType: ${data.callType}`);
        return;
      }

      const { callerId: offererUserId, offer } = data;
      console.log(`📞 [Voice] Received offer from ${offererUserId}, hasAccepted:`, hasUserAcceptedRef.current);

      // If user hasn't accepted yet, queue the offer
      if (!hasUserAcceptedRef.current) {
        console.log('📞 [Voice] Queuing offer - user has not accepted yet');
        pendingOffersRef.current.push(data);
        return;
      }

      const socket = getSocket();
      if (!socket || !localStreamRef.current) {
        console.error('❌ Cannot handle offer: missing socket or local stream');
        return;
      }

      let pc = peerConnectionsRef.current.get(offererUserId);
      if (!pc) {
        const newPc = createPeerConnection(offererUserId, false);
        if (!newPc) return;
        pc = newPc;
      }

      try {
        // Implement "polite peer" protocol to handle glare (simultaneous offers)
        // The peer with the LOWER user ID is "polite" and will rollback
        const isPolite = currentUserId < offererUserId;

        if (pc.signalingState !== 'stable') {
          // Glare condition detected
          console.log(`📞 [Voice] Glare detected! State: ${pc.signalingState}, isPolite: ${isPolite}`);

          if (!isPolite) {
            // We're impolite - ignore the incoming offer, keep our offer
            console.log(`📞 [Voice] Impolite peer - ignoring incoming offer`);
            return;
          }

          // We're polite - rollback our offer and accept the incoming one
          console.log(`📞 [Voice] Polite peer - rolling back to accept incoming offer`);
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(new RTCSessionDescription(offer))
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
        }

        console.log(`📞 [Voice] Set remote description from ${offererUserId}`);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`📞 [Voice] Sending answer to ${offererUserId}`);

        socket.emit('answer', {
          recipientId: offererUserId,
          answer: pc.localDescription,
          callType: 'group-voice',
        });

        // Process any pending ICE candidates
        const pending = pendingCandidatesRef.current.get(offererUserId) || [];
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log(`🧊 Added pending ICE candidate for ${offererUserId}`);
          } catch (err) {
            console.error('Error adding pending ICE candidate:', err);
          }
        }
        pendingCandidatesRef.current.delete(offererUserId);
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    },
    [createPeerConnection, currentUserId]
  );

  // Handle incoming WebRTC answer
  const handleAnswer = useCallback(
    async (data: {
      receiverId?: string;
      recipientId?: string;
      answer: RTCSessionDescriptionInit;
      callType?: string;
    }) => {
      // Only handle group-voice call answers
      if (data.callType !== 'group-voice') {
        console.log(`📞 [GroupVoice] Ignoring answer with callType: ${data.callType}`);
        return;
      }

      const receiverId = data.receiverId || data.recipientId || '';
      const { answer } = data;
      console.log(`📞 [Voice] Received answer from ${receiverId}`);

      const pc = peerConnectionsRef.current.get(receiverId);
      if (!pc) {
        console.error(`❌ No peer connection found for ${receiverId}`);
        return;
      }

      // Only set remote description if we're in the correct state (have-local-offer)
      if (pc.signalingState !== 'have-local-offer') {
        console.log(`📞 [Voice] Ignoring answer - wrong state: ${pc.signalingState}`);
        return;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`📞 [Voice] Set remote description from answer for ${receiverId}`);

        // Process any pending ICE candidates now that remote description is set
        const pending = pendingCandidatesRef.current.get(receiverId) || [];
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log(`🧊 Added pending ICE candidate for ${receiverId}`);
          } catch (err) {
            console.error('Error adding pending ICE candidate:', err);
          }
        }
        pendingCandidatesRef.current.delete(receiverId);
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    },
    []
  );

  // Handle incoming ICE candidates
  const handleIceCandidate = useCallback(
    async (data: { senderId: string; candidate: RTCIceCandidateInit; callType?: string }) => {
      // Filter by call type - only handle group-voice
      if (data.callType !== 'group-voice') {
        return;
      }

      const { senderId, candidate } = data;
      console.log(`🧊 [Voice] Received ICE candidate from ${senderId}`);

      const pc = peerConnectionsRef.current.get(senderId);

      // Queue candidate if no peer connection or remote description not set
      if (!pc || !pc.remoteDescription || pc.remoteDescription.type === null) {
        console.log(`🧊 [Voice] Queueing ICE candidate for ${senderId}`);
        const pending = pendingCandidatesRef.current.get(senderId) || [];
        pending.push(candidate);
        pendingCandidatesRef.current.set(senderId, pending);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`🧊 [Voice] Added ICE candidate from ${senderId}`);
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    if (isSettingUpRef.current) return;
    isSettingUpRef.current = true;

    const socket = getSocket();
    if (!socket) return;

    // Reset state
    setCallDuration(0);
    setCallStatus(isIncomingCall ? 'ringing' : 'connecting');
    setParticipants([]);
    setHasUserAccepted(!isIncomingCall); // Reset accepted state
    hasUserAcceptedRef.current = !isIncomingCall;
    peerConnectionsRef.current.clear();
    audioElementsRef.current.clear();
    pendingCandidatesRef.current.clear();
    pendingOffersRef.current = [];
    localStreamRef.current = null; // Reset local stream

    // Add self as first participant
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

    // Get user media - only for OUTGOING calls
    // For incoming calls, media is obtained when user accepts
    const setupMedia = async () => {
      if (isIncomingCall) {
        // For incoming calls, just wait - media will be obtained when user accepts
        console.log('📞 Incoming call - waiting for user to accept...');
        return;
      }

      try {
        console.log('📞 Getting user media...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        console.log('📞 Got local audio stream');

        // For outgoing calls, join the group call room
        console.log('📞 Joining group call room...');
        socket.emit('joinGroupCall', { groupId, callType: 'voice' });
        setCallStatus('connecting');
      } catch (error) {
        console.error('Error getting audio:', error);
        setCallStatus('ended');
      }
    };

    setupMedia();

    // Listen for participants joining - create peer connections with them
    const handleParticipantJoined = (data: {
      userId: string;
      userName: string;
      avatar: string;
    }) => {
      console.log('📞 Participant joined:', data);

      // Don't add ourselves
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

      // Create peer connection and send offer to the new participant
      setTimeout(() => {
        if (localStreamRef.current) {
          createPeerConnection(data.userId, true);
        }
      }, 500);

      setCallStatus('active');
    };

    // Listen for participants leaving
    const handleParticipantLeft = (data: { userId: string }) => {
      console.log('📞 Participant left:', data);
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));

      // Clean up peer connection for this participant
      const pc = peerConnectionsRef.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.userId);
      }

      // Clean up audio element
      const audio = audioElementsRef.current.get(data.userId);
      if (audio) {
        audio.srcObject = null;
        audioElementsRef.current.delete(data.userId);
      }
    };

    // Listen for call ended by another participant
    const handleGroupCallEnded = () => {
      console.log('📞 Group call ended by another participant');
      // Clean up without emitting another endGroupCall event
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      // Clear audio elements
      audioElementsRef.current.forEach((audio) => {
        audio.srcObject = null;
      });
      audioElementsRef.current.clear();

      isSettingUpRef.current = false;
      setCallStatus('ended');
      setTimeout(() => onClose(), 500);
    };

    // Listen for participant mute/unmute
    const handleParticipantMuted = (data: { userId: string; isMuted: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.userId === data.userId ? { ...p, isMuted: data.isMuted } : p))
      );
    };

    // WebRTC signaling handlers
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('iceCandidate', handleIceCandidate);

    socket.on('groupCallParticipantJoined', handleParticipantJoined);
    socket.on('groupCallParticipantLeft', handleParticipantLeft);
    socket.on('groupCallEnded', handleGroupCallEnded);
    socket.on('groupCallParticipantMuted', handleParticipantMuted);

    return () => {
      isSettingUpRef.current = false;

      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('iceCandidate', handleIceCandidate);
      socket.off('groupCallParticipantJoined', handleParticipantJoined);
      socket.off('groupCallParticipantLeft', handleParticipantLeft);
      socket.off('groupCallEnded', handleGroupCallEnded);
      socket.off('groupCallParticipantMuted', handleParticipantMuted);

      // Clean up peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      // Clean up audio elements
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

  // Timer effect
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
      console.log('📞 [Voice] User accepting call...');
      setHasUserAccepted(true);
      hasUserAcceptedRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // Update self participant
      setParticipants((prev) =>
        prev.map((p) => (p.userId === currentUserId ? { ...p, isMuted: false } : p))
      );

      // Accept the group call (joins the room on backend)
      socket.emit('acceptGroupCall', { groupId, callerId });
      setCallStatus('connecting');
      console.log('📞 [Voice] Call accepted, processing queued offers...');

      // Process any queued offers that arrived while ringing
      const queuedOffers = [...pendingOffersRef.current];
      pendingOffersRef.current = [];

      for (const queuedOffer of queuedOffers) {
        console.log('📞 [Voice] Processing queued offer from:', queuedOffer.callerId);
        await handleOffer(queuedOffer);
      }

      if (queuedOffers.length > 0) {
        setCallStatus('active');
      }

      console.log('📞 [Voice] Call accepted successfully');
    } catch (error) {
      console.error('Error accepting call:', error);
      setHasUserAccepted(false);
      hasUserAcceptedRef.current = false;
    }
  };

  const rejectCall = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('rejectGroupCall', { groupId, callerId });
    isSettingUpRef.current = false;
    onClose();
  };

  // Cleanup function - used when call ends (either by self or remote)
  const cleanupCall = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    // Clear audio elements
    audioElementsRef.current.forEach((audio) => {
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    isSettingUpRef.current = false;
    setCallStatus('ended');
    setTimeout(() => onClose(), 500);
  };

  // End call - called when user clicks end call button
  const endCall = () => {
    const socket = getSocket();
    if (socket) {
      // End call for everyone in the group
      socket.emit('endGroupCall', { groupId });
    }
    cleanupCall();
  };

  const toggleMic = () => {
    if (!localStreamRef.current) {
      console.warn('📞 [Voice] Cannot toggle mic - no local stream');
      return;
    }

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);

      // Notify others about mute status
      const socket = getSocket();
      if (socket) {
        socket.emit('groupCallMuteToggle', { groupId, isMuted: !audioTrack.enabled });
      }

      // Update our own participant status
      setParticipants((prev) =>
        prev.map((p) => (p.userId === currentUserId ? { ...p, isMuted: !audioTrack.enabled } : p))
      );
      console.log(`📞 [Voice] Mic toggled: ${audioTrack.enabled}`);
    } else {
      console.warn('📞 [Voice] No audio track found');
    }
  };

  const toggleSpeaker = () => {
    const newSpeakerState = !isSpeakerOn;
    setIsSpeakerOn(newSpeakerState);

    // Mute/unmute all remote audio elements
    audioElementsRef.current.forEach((audio) => {
      audio.muted = !newSpeakerState;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90">
      <div className="relative w-full max-w-lg mx-4 bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl overflow-hidden shadow-2xl">
        {/* Close button */}
        <button
          onClick={endCall}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
        >
          <X size={20} className="text-white" />
        </button>

        {/* Header */}
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
                {formatDuration(callDuration)}
              </>
            )}
            {callStatus === 'ended' && 'Call ended'}
          </p>
        </div>

        {/* Participants Grid */}
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
                  {/* Avatar */}
                  <div className="relative w-14 h-14 mb-2">
                    {isValidAvatar ? (
                      <img
                        src={avatarUrl}
                        alt={participant.userName}
                        className="w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          // Hide image on error and show fallback
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

                    {/* Muted indicator */}
                    {participant.isMuted && (
                      <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-red-500">
                        <MicOff size={10} className="text-white" />
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <span className="text-white text-xs font-medium text-center truncate w-full">
                    {participant.userId === currentUserId ? 'You' : participant.userName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 flex items-center justify-center gap-4">
          {callStatus === 'ringing' && isIncomingCall ? (
            <>
              {/* Accept call */}
              <button
                onClick={acceptCall}
                className="p-4 rounded-full bg-green-500 hover:bg-green-600 transition shadow-lg"
              >
                <Phone size={28} className="text-white" />
              </button>
              {/* Reject call */}
              <button
                onClick={rejectCall}
                className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition shadow-lg"
              >
                <PhoneOff size={28} className="text-white" />
              </button>
            </>
          ) : (
            <>
              {/* Toggle mic */}
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

              {/* Toggle speaker */}
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

              {/* End call */}
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
