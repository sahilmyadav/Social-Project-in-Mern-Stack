'use client';

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
    offIceCandidate,
    offOffer,
    onAnswer,
    onCallAccepted,
    onCallEnded,
    onIceCandidate,
    onOffer,
} from '@/lib/socket';
import { Mic, MicOff, Phone, PhoneOff, User, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  recipientAvatar: string;
  recipientId: string;
  currentUserId: string;
  onCallEnd?: () => void;
  isIncomingCall?: boolean;
  callerId?: string;
  threadId?: string;
}

export default function VoiceCallModal({
  isOpen,
  onClose,
  recipientName,
  recipientAvatar,
  recipientId,
  currentUserId,
  onCallEnd,
  isIncomingCall = false,
  callerId,
  threadId = '',
}: VoiceCallModalProps) {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'active' | 'ended'>(
    'ringing'
  );
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
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
  }>({});

  useEffect(() => {
    console.log('📞 Voice Call Modal - isOpen:', isOpen, 'isIncomingCall:', isIncomingCall);

    if (isOpen) {
      // Reset state when modal opens
      setCallDuration(0);
      setCallStatus('ringing');
      remoteDescriptionSet.current = false;
      iceCandidatesQueue.current = [];
      isEndingCall.current = false;

      // Listen for call ended from remote user
      const handleCallEndedByRemote = () => {
        console.log('📞 Remote user ended the call');
        endCall();
      };
      handlersRef.current.callEnded = handleCallEndedByRemote;
      onCallEnded(handleCallEndedByRemote);

      // For outgoing calls, listen for when other user accepts
      if (!isIncomingCall) {
        const handleCallAccepted = async (data: any) => {
          setCallStatus('connecting');

          // Now initiate WebRTC connection
          try {
            const peerConnection = await createPeerConnection();

            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            emitOffer(recipientId, offer as any);

            // Set up answer handler
            const handleAnswer = async (answerData: any) => {
              try {
                // Only block if connection is actually closed or failed
                if (
                  !peerConnection ||
                  peerConnection.connectionState === 'closed' ||
                  peerConnection.connectionState === 'failed'
                ) {
                  return;
                }

                // Check if we're in the correct state to receive an answer
                if (peerConnection.signalingState !== 'have-local-offer') {
                  return;
                }

                // Backend sends answer directly, not nested
                const answer = new RTCSessionDescription(answerData.answer);
                await peerConnection.setRemoteDescription(answer);
                remoteDescriptionSet.current = true;

                // Process queued ICE candidates
                for (const candidate of iceCandidatesQueue.current) {
                  try {
                    await peerConnection.addIceCandidate(candidate);
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
                if (!peerConnection || peerConnection.connectionState === 'closed') {
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
                    await peerConnection.addIceCandidate(candidate);
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
      };
    }
  }, [isOpen, isIncomingCall, recipientId]);

  // Timer effect
  useEffect(() => {
    if (callStatus !== 'active') return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up peer connection and streams
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const createPeerConnection = async () => {
    try {
      const config = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ],
      };

      const peerConnection = new RTCPeerConnection(config);
      peerConnectionRef.current = peerConnection;

      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Set local audio
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          emitIceCandidate(recipientId || callerId || '', event.candidate);
        }
      };

      // Handle connection state
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed') {
          console.error('❌ Peer connection failed');
          endCall();
        }
      };

      return peerConnection;
    } catch (error) {
      console.error('❌ Error creating peer connection:', error);
      alert('Unable to access microphone. Please check permissions.');
      setCallStatus('ended');
      throw error;
    }
  };

  const handleAcceptCall = async () => {
    setCallStatus('connecting');

    try {
      // Set up offer handler BEFORE notifying caller to avoid race condition
      const processOffer = async (offerData: any, peerConnection: RTCPeerConnection) => {
        try {
          // Check if we're in the correct state to receive an offer
          if (peerConnection.signalingState !== 'stable') {
            return;
          }

          // Backend sends offer directly
          const offer = new RTCSessionDescription(offerData.offer);
          await peerConnection.setRemoteDescription(offer);
          remoteDescriptionSet.current = true;

          // Create and send answer
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          // Send answer to caller
          emitAnswer(callerId || '', answer as any);

          // Process queued ICE candidates
          for (const candidate of iceCandidatesQueue.current) {
            try {
              await peerConnection.addIceCandidate(candidate);
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

      // Create peer connection FIRST before notifying caller
      const peerConnection = await createPeerConnection();
      peerConnectionRef.current = peerConnection;

      // NOW notify caller that we accepted (peer connection is ready)
      if (callerId && threadId) {
        emitAcceptCall(callerId, threadId);
      }

      // Process pending offer if one arrived while we were setting up
      if (pendingOffer.current) {
        await processOffer(pendingOffer.current, peerConnection);
        pendingOffer.current = null;
      } else {
      }
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      setCallStatus('ended');
    }
  };

  // No longer need handleInitiateCall - handled in useEffect

  const handleRejectCall = () => {
    if (callerId && threadId) {
      emitRejectCall(callerId, threadId);
    }
    endCall();
  };

  const endCall = () => {
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

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Reset state
    remoteDescriptionSet.current = false;
    iceCandidatesQueue.current = [];

    if (recipientId || callerId) {
      emitEndCall(recipientId || callerId || '', threadId);
    }

    setCallStatus('ended');
    onCallEnd?.();

    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const toggleMic = () => {
    if (peerConnectionRef.current && localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMicOn;
      });
    }
    setIsMicOn(!isMicOn);
  };

  const toggleSpeaker = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isSpeakerOn;
    }
    setIsSpeakerOn(!isSpeakerOn);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-black to-black pointer-events-none" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 transition z-50 cursor-pointer"
        title="Close call"
      >
        <X size={24} className="text-white" />
      </button>

      {/* Call container */}
      <div className="relative flex flex-col items-center justify-center w-full h-full max-w-md">
        {/* Profile section */}
        <div className="flex flex-col items-center mb-12">
          {/* Avatar */}
          <div className="relative mb-8">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-7xl shadow-2xl border-4 border-white/10">
              {recipientAvatar?.startsWith('http') || recipientAvatar?.startsWith('/') || recipientAvatar?.startsWith('uploads') ? (
                <img
                  src={getMediaUrl(recipientAvatar)}
                  alt={recipientName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User size={48} className="text-white" />
              )}
            </div>

            {/* Status indicator */}
            <div
              className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center ${
                callStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
              }`}
            />
          </div>

          {/* Name */}
          <h2 className="text-4xl font-bold text-white mb-4 text-center">{recipientName}</h2>

          {/* Status and duration */}
          <div className="text-xl text-gray-300 text-center font-light tracking-wide">
            {callStatus === 'ringing' && (
              <div className="space-y-2">
                <p>{isIncomingCall ? 'Incoming call...' : 'Waiting for answer...'}</p>
                <div className="flex justify-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}

            {callStatus === 'connecting' && (
              <div className="space-y-2">
                <p>Connecting...</p>
                <div className="flex justify-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full bg-green-500 animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-green-500 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-green-500 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}

            {callStatus === 'active' && (
              <p className="font-mono text-3xl tracking-widest">{formatDuration(callDuration)}</p>
            )}

            {callStatus === 'ended' && <p className="text-lg">Call ended</p>}
          </div>
        </div>

        {/* Controls section */}
        <div className="flex flex-col items-center gap-8 mt-auto mb-16">
          {/* Control buttons */}
          <div className="flex items-center justify-center gap-6">
            {callStatus === 'ringing' && isIncomingCall && (
              <>
                {/* Reject button */}
                <button
                  onClick={handleRejectCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center transition transform shadow-xl hover:shadow-red-500/50 cursor-pointer"
                  title="Reject call"
                >
                  <PhoneOff size={32} className="text-white" />
                </button>

                {/* Accept button */}
                <button
                  onClick={handleAcceptCall}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 flex items-center justify-center transition transform shadow-xl hover:shadow-green-500/50 cursor-pointer"
                  title="Accept call"
                >
                  <Phone size={32} className="text-white" />
                </button>
              </>
            )}

            {callStatus === 'ringing' && !isIncomingCall && (
              <button
                onClick={endCall}
                className="cursor-pointer w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center transition transform shadow-xl hover:shadow-red-500/50"
                title="Cancel call"
              >
                <PhoneOff size={32} className="text-white" />
              </button>
            )}

            {callStatus === 'connecting' && (
              <div className="text-center">
                <div className="inline-flex gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" />
                  <div
                    className="w-3 h-3 rounded-full bg-blue-500 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-3 h-3 rounded-full bg-blue-500 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}

            {callStatus === 'active' && (
              <>
                {/* Microphone toggle */}
                <button
                  onClick={toggleMic}
                  className={`w-14 h-14 rounded-full transition transform active:scale-95 shadow-lg flex items-center justify-center ${
                    isMicOn
                      ? 'bg-gray-700 hover:bg-gray-600 hover:shadow-gray-600/50'
                      : 'bg-red-500 hover:bg-red-600 hover:shadow-red-500/50'
                  }`}
                  title={isMicOn ? 'Mute' : 'Unmute'}
                >
                  {isMicOn ? (
                    <Mic size={28} className="text-white" />
                  ) : (
                    <MicOff size={28} className="text-white" />
                  )}
                </button>

                {/* Speaker toggle */}
                <button
                  onClick={toggleSpeaker}
                  className={`w-14 h-14 rounded-full transition transform active:scale-95 shadow-lg flex items-center justify-center ${
                    isSpeakerOn
                      ? 'bg-gray-700 hover:bg-gray-600 hover:shadow-gray-600/50'
                      : 'bg-yellow-500 hover:bg-yellow-600 hover:shadow-yellow-500/50'
                  }`}
                  title={isSpeakerOn ? 'Speaker on' : 'Speaker off'}
                >
                  {isSpeakerOn ? (
                    <Volume2 size={28} className="text-white" />
                  ) : (
                    <VolumeX size={28} className="text-white" />
                  )}
                </button>

                {/* End call button */}
                <button
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center transition transform shadow-xl hover:shadow-red-500/50"
                  title="End call"
                >
                  <PhoneOff size={32} className="text-white" />
                </button>
              </>
            )}

            {callStatus === 'ended' && (
              <button
                onClick={onClose}
                className="px-8 py-3 rounded-full bg-gray-700 hover:bg-gray-600 transition text-white font-semibold"
              >
                Close
              </button>
            )}
          </div>

          {/* Info text */}
          {callStatus === 'active' && (
            <div className="text-center text-gray-400 text-sm">
              <p>Tap to toggle microphone and speaker</p>
            </div>
          )}
        </div>
      </div>

      {/* Audio elements */}
      <audio ref={localAudioRef} muted />
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
}
