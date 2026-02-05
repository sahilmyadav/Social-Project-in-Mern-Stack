'use client';

import { Button } from '@/components/ui/button';
import { getMediaUrl } from '@/lib/media-utils';
import {
    emitAcceptCall,
    emitAnswer,
    emitEndCall,
    emitIceCandidate,
    emitOffer,
    emitRejectCall,
    offAnswer,
    offCallAccepted,
    offCallEnded,
    offCallFailed,
    offIceCandidate,
    offOffer,
    onAnswer,
    onCallAccepted,
    onCallEnded,
    onCallFailed,
    onIceCandidate,
    onOffer
} from '@/lib/socket';
import { Mic, MicOff, PhoneOff, User, Video, VideoOff, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  isIncoming?: boolean;
  callId?: string;
  callerId?: string;
  threadId?: string;
}

export default function VideoCallModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  recipientAvatar,
  isIncoming = false,
  callId,
  callerId,
  threadId = '',
}: VideoCallModalProps) {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'active' | 'ended'>(
    isIncoming ? 'ringing' : 'connecting'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [currentCallId, setCurrentCallId] = useState(callId || '');
  const [callFailedReason, setCallFailedReason] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);
  const remoteDescriptionSet = useRef(false);
  const isEndingCall = useRef(false);
  const pendingOffer = useRef<any>(null);

  // Store handlers for cleanup
  const handlersRef = useRef<{
    offer?: (data: any) => void;
    answer?: (data: any) => void;
    iceCandidate?: (data: any) => void;
    callAccepted?: (data: any) => void;
    callEnded?: (data: any) => void;
    callFailed?: (data: any) => void;
  }>({});

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize peer connection
  const initializePeerConnection = () => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ],
    };

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const targetId = isIncoming ? callerId || recipientId : recipientId;
        emitIceCandidate(targetId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') {
        setCallStatus('active');
      } else if (
        pc.iceConnectionState === 'disconnected' ||
        pc.iceConnectionState === 'failed' ||
        pc.iceConnectionState === 'closed'
      ) {
        handleEndCall();
      }
    };

    return pc;
  };

  // Get local media stream
  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      alert('Could not access camera/microphone. Please check permissions.');
      handleEndCall();
      return null;
    }
  };

  // Start outgoing call
  const startCall = async () => {
    const stream = await getLocalStream();
    if (!stream) return;

    const pc = initializePeerConnection();
    peerConnectionRef.current = pc;

    // Add local stream tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    setCallStatus('ringing');
  };

  // Handle incoming call acceptance
  const handleAcceptCall = async () => {
    setCallStatus('connecting');

    try {
      // Set up offer handler BEFORE notifying caller to avoid race condition
      const processOffer = async (offerData: any, pc: RTCPeerConnection) => {
        try {
          // Check if we're in the correct state to receive an offer
          if (pc.signalingState !== 'stable') {
            return;
          }

          // Backend sends offer directly
          const offer = new RTCSessionDescription(offerData.offer);
          await pc.setRemoteDescription(offer);
          remoteDescriptionSet.current = true;

          // Create and send answer
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // Send answer to caller
          emitAnswer(callerId || '', answer as any);

          // Process queued ICE candidates
          for (const candidate of iceCandidatesQueue.current) {
            try {
              await pc.addIceCandidate(candidate);
            } catch (err) {
              console.error('❌ Error adding queued candidate:', err);
            }
          }
          iceCandidatesQueue.current = [];

          setCallStatus('active');
        } catch (error) {
          console.error('❌ Error processing offer:', error);
        }
      };

      const handleOffer = async (offerData: any) => {
        // If peer connection doesn't exist yet, store offer for later
        if (!peerConnectionRef.current) {
          pendingOffer.current = offerData;
          return;
        }

        // Process offer immediately if peer connection is ready
        await processOffer(offerData, peerConnectionRef.current);
      };

      const handleCandidate = async (candidateData: any) => {
        try {
          // Skip if peer connection is closed or not ready
          if (
            !peerConnectionRef.current ||
            peerConnectionRef.current.connectionState === 'closed'
          ) {
            return;
          }

          if (candidateData.candidate && candidateData.candidate.candidate) {
            const candidate = new RTCIceCandidate({
              candidate: candidateData.candidate.candidate,
              sdpMLineIndex: candidateData.candidate.sdpMLineIndex,
              sdpMid: candidateData.candidate.sdpMid,
            });

            // Queue candidates if remote description not set yet
            if (!remoteDescriptionSet.current) {
              iceCandidatesQueue.current.push(candidate);
            } else {
              await peerConnectionRef.current.addIceCandidate(candidate);
            }
          }
        } catch (error) {
          console.error('❌ Error adding ICE candidate:', error);
        }
      };

      // Unregister old handlers before registering new ones
      if (handlersRef.current.offer) {
        offOffer(handlersRef.current.offer);
      }
      if (handlersRef.current.iceCandidate) {
        offIceCandidate(handlersRef.current.iceCandidate);
      }

      handlersRef.current.offer = handleOffer;
      handlersRef.current.iceCandidate = handleCandidate;
      onOffer(handleOffer);
      onIceCandidate(handleCandidate);

      // Get local stream and create peer connection FIRST before notifying caller
      const stream = await getLocalStream();
      if (!stream) return;

      const pc = initializePeerConnection();
      peerConnectionRef.current = pc;

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // NOW notify caller that we accepted (peer connection is ready)
      if (callerId && threadId) {
        emitAcceptCall(callerId, threadId);
      }

      // Process pending offer if one arrived while we were setting up
      if (pendingOffer.current) {
        await processOffer(pendingOffer.current, pc);
        pendingOffer.current = null;
      } else {
      }
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      setCallStatus('ended');
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // End call
  const handleEndCall = () => {
    // Prevent multiple calls to endCall
    if (isEndingCall.current) {
      return;
    }

    isEndingCall.current = true;

    // Clean up all event listeners
    if (handlersRef.current.offer) {
      offOffer(handlersRef.current.offer);
      handlersRef.current.offer = undefined;
    }
    if (handlersRef.current.answer) {
      offAnswer(handlersRef.current.answer);
      handlersRef.current.answer = undefined;
    }
    if (handlersRef.current.iceCandidate) {
      offIceCandidate(handlersRef.current.iceCandidate);
      handlersRef.current.iceCandidate = undefined;
    }
    if (handlersRef.current.callAccepted) {
      offCallAccepted(handlersRef.current.callAccepted);
      handlersRef.current.callAccepted = undefined;
    }
    if (handlersRef.current.callEnded) {
      offCallEnded(handlersRef.current.callEnded);
      handlersRef.current.callEnded = undefined;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Clear timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    // Reset state
    remoteDescriptionSet.current = false;
    iceCandidatesQueue.current = [];

    // Emit end call event
    if (recipientId || callerId) {
      emitEndCall(recipientId || callerId || '', threadId);
    }

    setCallStatus('ended');

    setTimeout(() => {
      onClose();
    }, 1500);
  };

  // Handle reject call
  const handleRejectCall = () => {
    if (callerId && threadId) {
      emitRejectCall(callerId, threadId);
    }
    handleEndCall();
  };

  // Initialize call on mount
  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setCallDuration(0);
      setCallStatus(isIncoming ? 'ringing' : 'connecting');
      setCallFailedReason(null);
      remoteDescriptionSet.current = false;
      iceCandidatesQueue.current = [];
      isEndingCall.current = false;

      // Listen for call ended from remote user
      const handleCallEndedByRemote = () => {
        handleEndCall();
      };
      handlersRef.current.callEnded = handleCallEndedByRemote;
      onCallEnded(handleCallEndedByRemote);

      // Listen for call failed (user offline or error)
      const handleCallFailedEvent = (data: any) => {
        console.log('📞 Video call failed:', data);
        setCallFailedReason(data.reason || 'Call failed');
        setCallStatus('ended');
        // Auto close after showing the error
        setTimeout(() => {
          onClose();
        }, 2000);
      };
      handlersRef.current.callFailed = handleCallFailedEvent;
      onCallFailed(handleCallFailedEvent);

      // For outgoing calls, listen for when other user accepts
      if (!isIncoming) {
        startCall();

        const handleCallAccepted = async (data: any) => {
          setCallStatus('connecting');

          // Now initiate WebRTC connection
          try {
            const pc = peerConnectionRef.current;
            if (!pc) return;

            // Create and send offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            emitOffer(recipientId, offer as any);

            // Set up answer handler
            const handleAnswer = async (answerData: any) => {
              try {
                // Only block if connection is actually closed or failed
                if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
                  return;
                }

                // Check if we're in the correct state to receive an answer
                if (pc.signalingState !== 'have-local-offer') {
                  return;
                }

                // Backend sends answer directly
                const answer = new RTCSessionDescription(answerData.answer);
                await pc.setRemoteDescription(answer);
                remoteDescriptionSet.current = true;

                // Process queued ICE candidates
                for (const candidate of iceCandidatesQueue.current) {
                  try {
                    await pc.addIceCandidate(candidate);
                  } catch (err) {
                    console.error('❌ Error adding queued candidate:', err);
                  }
                }
                iceCandidatesQueue.current = [];

                setCallStatus('active');
              } catch (error) {
                console.error('❌ Error setting remote description:', error);
              }
            };

            const handleCandidate = async (candidateData: any) => {
              try {
                // Skip if peer connection is closed or not ready
                if (!pc || pc.connectionState === 'closed') {
                  return;
                }

                if (candidateData.candidate && candidateData.candidate.candidate) {
                  const candidate = new RTCIceCandidate({
                    candidate: candidateData.candidate.candidate,
                    sdpMLineIndex: candidateData.candidate.sdpMLineIndex,
                    sdpMid: candidateData.candidate.sdpMid,
                  });

                  // Queue candidates if remote description not set yet
                  if (!remoteDescriptionSet.current) {
                    iceCandidatesQueue.current.push(candidate);
                  } else {
                    await pc.addIceCandidate(candidate);
                  }
                }
              } catch (error) {
                console.error('❌ Error adding ICE candidate:', error);
              }
            };

            // Unregister old handlers before registering new ones
            if (handlersRef.current.answer) {
              offAnswer(handlersRef.current.answer);
            }
            if (handlersRef.current.iceCandidate) {
              offIceCandidate(handlersRef.current.iceCandidate);
            }

            handlersRef.current.answer = handleAnswer;
            handlersRef.current.iceCandidate = handleCandidate;
            onAnswer(handleAnswer);
            onIceCandidate(handleCandidate);
          } catch (error) {
            console.error('❌ Error setting up call after acceptance:', error);
            setCallStatus('ended');
          }
        };

        handlersRef.current.callAccepted = handleCallAccepted;
        onCallAccepted(handleCallAccepted);
      }

      // Cleanup function
      return () => {
        if (handlersRef.current.callAccepted) {
          offCallAccepted(handlersRef.current.callAccepted);
        }
        if (handlersRef.current.callEnded) {
          offCallEnded(handlersRef.current.callEnded);
        }
        if (handlersRef.current.callFailed) {
          offCallFailed(handlersRef.current.callFailed);
        }
      };
    }
  }, [isOpen, isIncoming, recipientId]);

  // Start timer when call becomes active
  useEffect(() => {
    if (callStatus === 'active') {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callStatus]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Remote video (full screen) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Show avatar if no remote video or call not active */}
      {callStatus !== 'active' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
          <div className="text-center">
            <div className="relative inline-block mb-8">
              {/* Pulsing rings animation */}
              {callStatus === 'ringing' && (
                <>
                  <div className="absolute inset-0 rounded-full bg-blue-500 opacity-20 animate-ping" />
                  <div
                    className="absolute inset-0 rounded-full bg-blue-500 opacity-20 animate-ping"
                    style={{ animationDelay: '0.5s' }}
                  />
                </>
              )}
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white/20 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500">
                {recipientAvatar?.startsWith('http') || recipientAvatar?.startsWith('/') || recipientAvatar?.startsWith('uploads') ? (
                  <img
                    src={getMediaUrl(recipientAvatar)}
                    alt={recipientName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User size={48} className="text-white" />
                  </div>
                )}
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">{recipientName}</h2>
            <p className="text-gray-300">
              {callStatus === 'ringing' && !isIncoming && 'Calling...'}
              {callStatus === 'ringing' && isIncoming && 'Incoming video call'}
              {callStatus === 'connecting' && 'Connecting...'}
              {callStatus === 'ended' && (callFailedReason || 'Call ended')}
            </p>
          </div>
        </div>
      )}

      {/* Local video (small overlay - bottom right) */}
      <div className="absolute bottom-24 right-6 w-32 h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-gray-900">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <VideoOff className="w-8 h-8 text-white" />
          </div>
        )}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            {callStatus === 'active' && (
              <p className="text-white font-medium">{formatDuration(callDuration)}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleEndCall}
            className="text-white hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/60 to-transparent">
        {isIncoming && callStatus === 'ringing' ? (
          // Incoming call buttons
          <div className="flex items-center justify-center gap-6">
            <Button
              onClick={handleRejectCall}
              size="lg"
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
            <Button
              onClick={handleAcceptCall}
              size="lg"
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg"
            >
              <Video className="w-6 h-6" />
            </Button>
          </div>
        ) : (
          // Active call controls
          <div className="flex items-center justify-center gap-6">
            <Button
              onClick={toggleVideo}
              size="lg"
              variant={isVideoOff ? 'destructive' : 'secondary'}
              className="w-14 h-14 rounded-full shadow-lg"
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>
            <Button
              onClick={handleEndCall}
              size="lg"
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
            <Button
              onClick={toggleMute}
              size="lg"
              variant={isMuted ? 'destructive' : 'secondary'}
              className="w-14 h-14 rounded-full shadow-lg"
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
