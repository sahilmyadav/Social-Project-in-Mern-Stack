'use client';

import { getMediaUrl } from '@/lib/media-utils';
import { getSocket } from '@/lib/socket';
import { Mic, MicOff, PhoneOff, Users, Video, VideoOff, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Participant {
  odgoId: string;
  odgoName: string;
  odgoAvatar: string;
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

// STUN/TURN servers for WebRTC
import { ICE_SERVERS } from '@/lib/webrtc-config';

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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const [hasUserAccepted, setHasUserAccepted] = useState(!isIncomingCall); // Track if user accepted
  const hasUserAcceptedRef = useRef(!isIncomingCall); // Ref version for callbacks
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingOffersRef = useRef<Array<{ callerId: string; offer: RTCSessionDescriptionInit; callerInfo?: any; callType?: string }>>([]); // Queue offers while ringing
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
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

  // Calculate grid layout based on participant count
  const getGridClass = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  // Create peer connection for a participant
  const createPeerConnection = useCallback((participantId: string, participantInfo: any) => {
    console.log('[GroupVideoCall] Creating peer connection for:', participantId);

    // Clean up existing connection if any
    if (peerConnectionsRef.current.has(participantId)) {
      const existingPc = peerConnectionsRef.current.get(participantId);
      existingPc?.close();
      peerConnectionsRef.current.delete(participantId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(participantId, pc);

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      console.log('[GroupVideoCall] Adding', tracks.length, 'local tracks to peer:', participantId);
      tracks.forEach((track) => {
        console.log('[GroupVideoCall] Adding local track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
        pc.addTrack(track, localStreamRef.current!);
      });
    } else {
      console.warn('[GroupVideoCall] NO LOCAL STREAM when creating peer connection for:', participantId);
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('[GroupVideoCall] Received remote track from:', participantId, 'kind:', event.track.kind, 'readyState:', event.track.readyState);

      // Get or create a single MediaStream for this participant
      let remoteStream = remoteStreamsRef.current.get(participantId);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteStreamsRef.current.set(participantId, remoteStream);
      }

      // Add the track if not already present
      const existingTrack = remoteStream.getTracks().find(t => t.id === event.track.id);
      if (!existingTrack) {
        remoteStream.addTrack(event.track);
        console.log('[GroupVideoCall] Added track to remote stream. Total tracks:', remoteStream.getTracks().length,
          'Audio:', remoteStream.getAudioTracks().length, 'Video:', remoteStream.getVideoTracks().length);
      }

      // Force update the video element by creating a new stream with all tracks
      // This ensures React detects the change
      const updatedStream = new MediaStream(remoteStream.getTracks());
      remoteStreamsRef.current.set(participantId, updatedStream);

      // Update participants with the new stream reference
      setParticipants((prev) =>
        prev.map((p) => (p.odgoId === participantId ? { ...p, stream: updatedStream } : p))
      );

      // Also directly update video element if it exists
      const videoEl = videoElementsRef.current.get(participantId);
      if (videoEl && videoEl.srcObject !== updatedStream) {
        console.log('[GroupVideoCall] Directly updating video element for:', participantId);
        videoEl.srcObject = updatedStream;
        videoEl.play().catch(e => console.warn('Video play failed:', e));
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[GroupVideoCall] Sending ICE candidate to:', participantId);
        const socket = getSocket();
        socket?.emit('iceCandidate', {
          recipientId: participantId,
          candidate: event.candidate.toJSON(),
          callType: 'group-video',
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[GroupVideoCall] Connection state for', participantId, ':', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallStatus('active');
      } else if (pc.connectionState === 'failed') {
        console.warn('[GroupVideoCall] Connection failed for:', participantId);
        // Try ICE restart
        const socket = getSocket();
        if (socket && pc.signalingState === 'stable') {
          pc.createOffer({ iceRestart: true }).then(offer => {
            pc.setLocalDescription(offer).then(() => {
              socket.emit('offer', {
                recipientId: participantId,
                offer: offer,
                callType: 'group-video',
              });
              console.log('[GroupVideoCall] Sent ICE restart offer to:', participantId);
            });
          }).catch(err => console.error('[GroupVideoCall] ICE restart failed:', err));
        }
      }
    };

    // Handle negotiation needed (triggered when tracks are added/removed)
    pc.onnegotiationneeded = async () => {
      // Only renegotiate when in stable state to avoid interfering with active negotiation
      if (pc.signalingState !== 'stable') {
        console.log('[GroupVideoCall] Skipping negotiation - not stable:', pc.signalingState);
        return;
      }
      console.log('[GroupVideoCall] Negotiation needed for:', participantId);
      const socket = getSocket();
      if (!socket) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', {
          recipientId: participantId,
          offer: offer,
          callType: 'group-video',
        });
        console.log('[GroupVideoCall] Sent renegotiation offer to:', participantId);
      } catch (err) {
        console.error('[GroupVideoCall] Renegotiation failed:', err);
      }
    };

    return pc;
  }, []);

  // Handle incoming offer
  const handleOffer = useCallback(
    async (data: {
      callerId: string;
      offer: RTCSessionDescriptionInit;
      callerInfo?: any;
      callType?: string;
    }) => {
      // Only handle group-video call offers (reject 1-to-1 or other types)
      if (data.callType !== 'group-video') {
        console.log(`📹 [GroupVideo] Ignoring offer with callType: ${data.callType}`);
        return;
      }

      console.log(
        '[GroupVideoCall] Received offer from:',
        data.callerId,
        'callerInfo:',
        data.callerInfo,
        'hasAccepted:',
        hasUserAcceptedRef.current
      );

      // If user hasn't accepted yet, queue the offer for later
      if (!hasUserAcceptedRef.current) {
        console.log('[GroupVideoCall] Queuing offer - user has not accepted yet');
        pendingOffersRef.current.push(data);

        // Still add the caller as a participant to show in UI
        if (data.callerInfo) {
          const callerOdgoId = data.callerInfo.odgoId || data.callerId;
          setParticipants((prev) => {
            if (prev.some((p) => p.odgoId === callerOdgoId)) return prev;
            return [
              ...prev,
              {
                odgoId: callerOdgoId,
                odgoName: data.callerInfo.odgoName || data.callerInfo.name || 'Unknown',
                odgoAvatar: data.callerInfo.odgoAvatar || data.callerInfo.avatar || '',
                isMuted: false,
                isVideoOff: false,
                joinedAt: new Date(),
              },
            ];
          });
        }
        return;
      }

      // Add the caller as a participant if not already present
      if (data.callerInfo) {
        const callerOdgoId = data.callerInfo.odgoId || data.callerId;
        setParticipants((prev) => {
          if (prev.some((p) => p.odgoId === callerOdgoId)) return prev;
          return [
            ...prev,
            {
              odgoId: callerOdgoId,
              odgoName: data.callerInfo.odgoName || data.callerInfo.name || 'Unknown',
              odgoAvatar: data.callerInfo.odgoAvatar || data.callerInfo.avatar || '',
              isMuted: false,
              isVideoOff: false,
              joinedAt: new Date(),
            },
          ];
        });
      }

      // Reuse existing peer connection if available (don't destroy a working PC)
      let pc = peerConnectionsRef.current.get(data.callerId);
      if (!pc || pc.connectionState === 'closed') {
        pc = createPeerConnection(data.callerId, data.callerInfo);
      } else {
        // Existing PC - make sure local tracks are added
        if (localStreamRef.current) {
          const senders = pc.getSenders();
          const existingTrackIds = new Set(senders.map(s => s.track?.id).filter(Boolean));
          localStreamRef.current.getTracks().forEach((track) => {
            if (!existingTrackIds.has(track.id)) {
              pc!.addTrack(track, localStreamRef.current!);
            }
          });
        }
        console.log('[GroupVideoCall] Reusing existing peer connection for:', data.callerId);
      }

      try {
        // Implement "polite peer" protocol to handle glare (simultaneous offers)
        // The peer with the LOWER user ID is "polite" and will rollback
        const isPolite = currentUserId < data.callerId;

        if (pc.signalingState !== 'stable') {
          // Glare condition detected
          console.log(`[GroupVideoCall] Glare detected! State: ${pc.signalingState}, isPolite: ${isPolite}`);

          if (!isPolite) {
            // We're impolite - ignore the incoming offer, keep our offer
            console.log(`[GroupVideoCall] Impolite peer - ignoring incoming offer`);
            return;
          }

          // We're polite - rollback our offer and accept the incoming one
          console.log(`[GroupVideoCall] Polite peer - rolling back to accept incoming offer`);
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(new RTCSessionDescription(data.offer))
          ]);
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
        console.log('[GroupVideoCall] Sent answer to:', data.callerId);

        // Process any pending ICE candidates
        const pending = pendingCandidatesRef.current.get(data.callerId) || [];
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('[GroupVideoCall] Error adding pending ICE candidate:', err);
          }
        }
        pendingCandidatesRef.current.delete(data.callerId);
      } catch (err) {
        console.error('[GroupVideoCall] Error handling offer:', err);
      }
    },
    [createPeerConnection, currentUserId]
  );

  // Handle incoming answer
  const handleAnswer = useCallback(
    async (data: {
      recipientId: string;
      answer: RTCSessionDescriptionInit;
      answererInfo?: any;
      callType?: string;
    }) => {
      // Only handle group-video call answers
      if (data.callType !== 'group-video') {
        console.log(`📹 [GroupVideo] Ignoring answer with callType: ${data.callType}`);
        return;
      }

      console.log(
        '[GroupVideoCall] Received answer from:',
        data.recipientId,
        'answererInfo:',
        data.answererInfo
      );

      // Add the answerer as a participant if not already present
      if (data.answererInfo) {
        const answererOdgoId = data.answererInfo.odgoId || data.recipientId;
        setParticipants((prev) => {
          if (prev.some((p) => p.odgoId === answererOdgoId)) return prev;
          return [
            ...prev,
            {
              odgoId: answererOdgoId,
              odgoName: data.answererInfo.odgoName || data.answererInfo.name || 'Unknown',
              odgoAvatar: data.answererInfo.odgoAvatar || data.answererInfo.avatar || '',
              isMuted: false,
              isVideoOff: false,
              joinedAt: new Date(),
            },
          ];
        });
      }

      const pc = peerConnectionsRef.current.get(data.recipientId);
      if (pc) {
        // Only set remote description if we're in the correct state (have-local-offer)
        if (pc.signalingState !== 'have-local-offer') {
          console.log('[GroupVideoCall] Ignoring answer - wrong state:', pc.signalingState);
          return;
        }
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log('[GroupVideoCall] Set remote description for:', data.recipientId);

          // Process any pending ICE candidates now that remote description is set
          const pending = pendingCandidatesRef.current.get(data.recipientId) || [];
          for (const candidate of pending) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
              console.log('[GroupVideoCall] Added pending ICE candidate for:', data.recipientId);
            } catch (err) {
              console.error('[GroupVideoCall] Error adding pending ICE candidate:', err);
            }
          }
          pendingCandidatesRef.current.delete(data.recipientId);
        } catch (err) {
          console.error('[GroupVideoCall] Error setting remote description:', err);
        }
      }
    },
    []
  );

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(
    async (data: { senderId: string; candidate: RTCIceCandidateInit; callType?: string }) => {
      // Filter by call type - only handle group-video
      if (data.callType !== 'group-video') {
        return;
      }

      console.log('[GroupVideoCall] Received ICE candidate from:', data.senderId);

      const pc = peerConnectionsRef.current.get(data.senderId);

      // Queue candidate if no peer connection or remote description not set
      if (!pc || !pc.remoteDescription || pc.remoteDescription.type === null) {
        console.log('[GroupVideoCall] Queueing ICE candidate for:', data.senderId);
        const pending = pendingCandidatesRef.current.get(data.senderId) || [];
        pending.push(data.candidate);
        pendingCandidatesRef.current.set(data.senderId, pending);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('[GroupVideoCall] Added ICE candidate from:', data.senderId);
      } catch (err) {
        console.error('[GroupVideoCall] Error adding ICE candidate:', err);
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
    setLocalStreamReady(false);
    setHasUserAccepted(!isIncomingCall); // Reset accepted state
    hasUserAcceptedRef.current = !isIncomingCall;
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidatesRef.current.clear();
    pendingOffersRef.current = [];
    videoElementsRef.current.clear();
    localStreamRef.current = null; // Reset local stream

    // Get user media - only for OUTGOING calls
    // For incoming calls, media is obtained when user accepts
    const setupMedia = async () => {
      if (isIncomingCall) {
        // For incoming calls, add self as participant but without stream
        // Stream will be obtained when user accepts
        console.log('📹 Incoming call - waiting for user to accept...');
        setLocalStreamReady(false);
        setParticipants([
          {
            odgoId: currentUserId,
            odgoName: currentUserName || 'You',
            odgoAvatar: currentUserAvatar,
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
          audio: true,
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
        });
        localStreamRef.current = stream;
        setLocalStreamReady(true);

        // Show local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Add self as first participant
        setParticipants([
          {
            odgoId: currentUserId,
            odgoName: currentUserName || 'You',
            odgoAvatar: currentUserAvatar,
            isMuted: false,
            isVideoOff: false,
            stream: stream,
            joinedAt: new Date(),
          },
        ]);

        // For outgoing calls, join the group call room
        socket.emit('joinGroupCall', { groupId, callType: 'video' });
        setCallStatus('connecting');
      } catch (error) {
        console.error('Error getting video:', error);
        setCallStatus('ended');
      }
    };

    setupMedia();

    // Listen for participants joining
    const handleParticipantJoined = async (data: {
      odgoId?: string;
      userId?: string;
      odgoName?: string;
      userName?: string;
      odgoAvatar?: string;
      avatar?: string;
      existingParticipants?: Array<{
        odgoId?: string;
        userId?: string;
        odgoName?: string;
        userName?: string;
        odgoAvatar?: string;
        avatar?: string;
      }>;
    }) => {
      // Normalize field names - backend may send userId/userName/avatar OR odgoId/odgoName/odgoAvatar
      const participantId = data.odgoId || data.userId || '';
      const participantName = data.odgoName || data.userName || 'Unknown';
      const participantAvatar = data.odgoAvatar || data.avatar || '';

      console.log('📹 Participant joined:', { participantId, participantName, participantAvatar });

      // Add new participant
      setParticipants((prev) => {
        if (prev.some((p) => p.odgoId === participantId)) return prev;
        return [
          ...prev,
          {
            odgoId: participantId,
            odgoName: participantName,
            odgoAvatar: participantAvatar,
            isMuted: false,
            isVideoOff: false,
            joinedAt: new Date(),
          },
        ];
      });

      // Add existing participants if provided
      if (data.existingParticipants && data.existingParticipants.length > 0) {
        console.log('📹 Adding existing participants:', data.existingParticipants);
        setParticipants((prev) => {
          const newParticipants = data
            .existingParticipants!.map((ep) => ({
              odgoId: ep.odgoId || ep.userId || '',
              odgoName: ep.odgoName || ep.userName || 'Unknown',
              odgoAvatar: ep.odgoAvatar || ep.avatar || '',
            }))
            .filter((ep) => ep.odgoId && !prev.some((p) => p.odgoId === ep.odgoId));
          return [
            ...prev,
            ...newParticipants.map((ep) => ({
              odgoId: ep.odgoId,
              odgoName: ep.odgoName,
              odgoAvatar: ep.odgoAvatar,
              isMuted: false,
              isVideoOff: false,
              joinedAt: new Date(),
            })),
          ];
        });

        // Create peer connections and send offers to existing participants
        // Only the user with the HIGHER ID creates the offer (deterministic offerer)
        // This prevents both sides from sending offers simultaneously (glare)
        if (localStreamRef.current) {
          const offeredTo = new Set<string>();
          for (const participant of data.existingParticipants) {
            const epId = participant.odgoId || participant.userId || '';
            if (epId && epId !== currentUserId && !offeredTo.has(epId) && currentUserId > epId) {
              offeredTo.add(epId);
              console.log('📹 Creating offer for existing participant:', epId);
              const pc = createPeerConnection(epId, participant);
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('offer', {
                  recipientId: epId,
                  offer: offer,
                  callType: 'group-video',
                });
                console.log('📹 Sent offer to:', epId);
              } catch (err) {
                console.error('📹 Error creating offer:', err);
              }
            }
          }

          // Also send offer to the new joiner if not already covered
          if (participantId && participantId !== currentUserId && !offeredTo.has(participantId) && currentUserId > participantId) {
            console.log('📹 Creating offer for new participant:', participantId);
            const pc = createPeerConnection(participantId, data);
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit('offer', {
                recipientId: participantId,
                offer: offer,
                callType: 'group-video',
              });
              console.log('📹 Sent offer to new participant:', participantId);
            } catch (err) {
              console.error('📹 Error creating offer for new participant:', err);
            }
          }
        }
      }

      // If we have a local stream and this is a new participant (no existingParticipants list)
      // Only create offer if our userId > participantId (deterministic offerer prevents glare)
      if (localStreamRef.current && participantId && participantId !== currentUserId && currentUserId > participantId && (!data.existingParticipants || data.existingParticipants.length === 0)) {
        console.log('📹 Creating peer connection for new participant (we are offerer):', participantId);
        const pc = createPeerConnection(participantId, data);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', {
            recipientId: participantId,
            offer: offer,
            callType: 'group-video',
          });
          console.log('📹 Sent offer to new participant:', participantId);
        } catch (err) {
          console.error('📹 Error creating offer for new participant:', err);
        }
      } else if (localStreamRef.current && participantId && participantId !== currentUserId && currentUserId < participantId && (!data.existingParticipants || data.existingParticipants.length === 0)) {
        console.log('📹 Waiting for offer from participant (they are offerer):', participantId);
      }

      setCallStatus('active');
    };

    // Listen for participants leaving
    const handleParticipantLeft = (data: { odgoId?: string; userId?: string }) => {
      const participantId = data.odgoId || data.userId || '';
      console.log('📹 Participant left:', participantId);
      setParticipants((prev) => prev.filter((p) => p.odgoId !== participantId));

      // Clean up peer connection for this participant
      const pc = peerConnectionsRef.current.get(participantId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(participantId);
      }

      // Clean up remote stream
      remoteStreamsRef.current.delete(participantId);
    };

    // Listen for call ended by another participant
    const handleGroupCallEnded = () => {
      console.log('📹 Group call ended by another participant');
      // Clean up without emitting another endGroupCall event
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      isSettingUpRef.current = false;
      setCallStatus('ended');
      setTimeout(() => onClose(), 500);
    };

    // Listen for participant mute/video toggle
    const handleParticipantMuted = (data: {
      odgoId?: string;
      userId?: string;
      isMuted: boolean;
    }) => {
      const participantId = data.odgoId || data.userId || '';
      setParticipants((prev) =>
        prev.map((p) => (p.odgoId === participantId ? { ...p, isMuted: data.isMuted } : p))
      );
    };

    const handleParticipantVideoToggle = (data: {
      odgoId?: string;
      userId?: string;
      isVideoOff: boolean;
    }) => {
      const participantId = data.odgoId || data.userId || '';
      setParticipants((prev) =>
        prev.map((p) => (p.odgoId === participantId ? { ...p, isVideoOff: data.isVideoOff } : p))
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
    socket.on('groupCallParticipantVideoToggle', handleParticipantVideoToggle);

    return () => {
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('iceCandidate', handleIceCandidate);
      socket.off('groupCallParticipantJoined', handleParticipantJoined);
      socket.off('groupCallParticipantLeft', handleParticipantLeft);
      socket.off('groupCallEnded', handleGroupCallEnded);
      socket.off('groupCallParticipantMuted', handleParticipantMuted);
      socket.off('groupCallParticipantVideoToggle', handleParticipantVideoToggle);

      // Reset setup ref
      isSettingUpRef.current = false;

      // Clean up peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      // Clean up remote streams
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
      console.log('📹 [Video] User accepting call...');
      setHasUserAccepted(true);
      hasUserAcceptedRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });
      localStreamRef.current = stream;
      setLocalStreamReady(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Update self participant with stream
      setParticipants((prev) =>
        prev.map((p) =>
          p.odgoId === currentUserId
            ? { ...p, stream: stream, isVideoOff: false, isMuted: false }
            : p
        )
      );

      // Accept the group call (joins the room on backend)
      socket.emit('acceptGroupCall', { groupId, callerId });
      setCallStatus('connecting');
      console.log('📹 [Video] Call accepted, processing queued offers...');

      // Process any queued offers that arrived while ringing
      const queuedOffers = [...pendingOffersRef.current];
      pendingOffersRef.current = [];

      for (const queuedOffer of queuedOffers) {
        console.log('📹 [Video] Processing queued offer from:', queuedOffer.callerId);
        await handleOffer(queuedOffer);
      }

      // If no queued offers, the joinGroupCall response will trigger participant joined
      // which will handle creating peer connections
      if (queuedOffers.length > 0) {
        setCallStatus('active');
      }

      console.log('📹 [Video] Call accepted successfully');
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

  const endCall = () => {
    const socket = getSocket();
    if (socket) {
      // End call for everyone in the group
      socket.emit('endGroupCall', { groupId });
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStreamReady(false);

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    // Reset setup ref
    isSettingUpRef.current = false;

    setCallStatus('ended');
    setTimeout(() => onClose(), 500);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) {
      console.warn('📹 [Video] Cannot toggle mute - no local stream');
      return;
    }

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);

      // Notify others about mute status
      const socket = getSocket();
      if (socket) {
        socket.emit('groupCallMuteToggle', { groupId, isMuted: !audioTrack.enabled });
      }

      // Update self in participants
      setParticipants((prev) =>
        prev.map((p) => (p.odgoId === currentUserId ? { ...p, isMuted: !audioTrack.enabled } : p))
      );
      console.log(`📹 [Video] Mute toggled: ${!audioTrack.enabled}`);
    } else {
      console.warn('📹 [Video] No audio track found');
    }
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) {
      console.warn('📹 [Video] Cannot toggle video - no local stream');
      return;
    }

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);

      // Notify others about video status
      const socket = getSocket();
      if (socket) {
        socket.emit('groupCallVideoToggle', { groupId, isVideoOff: !videoTrack.enabled });
      }

      // Update self in participants
      setParticipants((prev) =>
        prev.map((p) =>
          p.odgoId === currentUserId ? { ...p, isVideoOff: !videoTrack.enabled } : p
        )
      );
      console.log(`📹 [Video] Video toggled: ${!videoTrack.enabled}`);
    } else {
      console.warn('📹 [Video] No video track found');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
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
                      {formatDuration(callDuration)}
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

        {/* Video Grid */}
        <div className="flex-1 p-4 pt-20 pb-24 overflow-hidden">
          <div className={`grid ${getGridClass(participants.length)} gap-2 h-full auto-rows-fr`}>
            {participants.map((participant, index) => {
              // Check if this is the local user
              const isLocalUser = participant.odgoId === currentUserId;
              // For local user, check localStreamReady state, for remote users check participant.stream
              const hasVideo = isLocalUser
                ? !participant.isVideoOff && localStreamReady && localStreamRef.current
                : !participant.isVideoOff && participant.stream;

              // Get valid avatar URL
              const avatarUrl = participant.odgoAvatar ? getMediaUrl(participant.odgoAvatar) : null;
              const isValidAvatar =
                avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('/'));

              return (
                <div
                  key={participant.odgoId || `participant-${index}`}
                  className="relative rounded-xl overflow-hidden bg-gray-800"
                >
                  {/* Video or Avatar */}
                  {!hasVideo ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                      {isValidAvatar ? (
                        <div className="relative w-20 h-20 md:w-24 md:h-24">
                          <img
                            src={avatarUrl}
                            alt={participant.odgoName}
                            className="w-full h-full rounded-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <span className="text-white text-3xl font-medium">
                            {participant.odgoName?.charAt(0)?.toUpperCase() || '?'}
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
                        if (el) {
                          videoElementsRef.current.set(participant.odgoId, el);
                          if (participant.stream && el.srcObject !== participant.stream) {
                            console.log('[GroupVideoCall] Setting video srcObject for:', participant.odgoId,
                              'tracks:', participant.stream.getTracks().map(t => t.kind).join(','));
                            el.srcObject = participant.stream;
                            el.play().catch(e => console.warn('Video autoplay failed:', e));
                          }
                        }
                      }}
                      autoPlay
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}

                  {/* Name and status overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium truncate">
                        {participant.odgoId === currentUserId ? 'You' : participant.odgoName}
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

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
          <div className="flex items-center justify-center gap-4">
            {callStatus === 'ringing' && isIncomingCall ? (
              <>
                {/* Accept call */}
                <button
                  onClick={acceptCall}
                  className="p-4 rounded-full bg-green-500 hover:bg-green-600 transition shadow-lg"
                >
                  <Video size={28} className="text-white" />
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

                {/* Toggle video */}
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
    </div>
  );
}
