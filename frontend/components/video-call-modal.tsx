'use client';

import { Button } from '@/components/ui/button';
import { useCallState } from '@/contexts/call-context';
import { getMediaUrl } from '@/lib/media-utils';
import { Ringtone } from '@/lib/ringtone';
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
  offCallRejected,
  offIceCandidate,
  offOffer,
  onAnswer,
  onCallAccepted,
  onCallEnded,
  onCallFailed,
  onCallRejected,
  onIceCandidate,
  onOffer,
} from '@/lib/socket';
import { showToast } from '@/lib/toast';
import {
  AUDIO_CONSTRAINTS,
  BITRATE_LIMITS,
  ICE_RECONNECT_TIMEOUT_MS,
  RING_TIMEOUT_MS,
  VIDEO_CONSTRAINTS_1to1,
  adaptVideoQuality,
  applyAudioBitrateCap,
  applyBitrateCap,
  attemptIceRestart,
  cleanupMediaStream,
  cleanupPeerConnection,
  formatCallDuration,
  getCallQualityStats,
  getIceServers,
  isGroupCallSignal,
  registerBeforeUnloadCleanup,
} from '@/lib/webrtc';
import {
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  User,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  currentUserId?: string;
  isIncoming?: boolean;
  isIncomingCall?: boolean;
  callId?: string;
  callerId?: string;
  threadId?: string;
  onCallEnd?: () => void;
}

export default function VideoCallModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  recipientAvatar,
  isIncoming = false,
  isIncomingCall,
  callId,
  callerId,
  threadId = '',
  onCallEnd,
}: VideoCallModalProps) {
  const incomingFlag = isIncomingCall ?? isIncoming;
  const { acquireCall, releaseCall } = useCallState();
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'active' | 'ended'>(
    incomingFlag ? 'ringing' : 'connecting'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
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
  const endedByRemoteRef = useRef(false);
  const hasAcquiredLockRef = useRef(false);
  const pendingOffer = useRef<any>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlersRef = useRef<{
    offer?: (data: any) => void;
    answer?: (data: any) => void;
    iceCandidate?: (data: any) => void;
    callAccepted?: (data: any) => void;
    callRejected?: (data: any) => void;
    callEnded?: (data: any) => void;
    callFailed?: (data: any) => void;
  }>({});

  const initializePeerConnection = () => {
    const iceConfig = getIceServers();
    console.log(
      '[VideoCall] Creating PeerConnection with ICE servers:',
      JSON.stringify(
        iceConfig.iceServers?.map((s) => (typeof s === 'string' ? s : (s as any).urls))
      )
    );
    const pc = new RTCPeerConnection(iceConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(
          '[VideoCall] ICE candidate:',
          event.candidate.type,
          event.candidate.protocol,
          event.candidate.address
        );
        const targetId = incomingFlag ? callerId || recipientId : recipientId;
        emitIceCandidate(targetId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log('[VideoCall] Remote track received:', event.track.kind);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[VideoCall] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallStatus('active');
        // Apply bitrate caps once connected
        applyBitrateCap(pc, BITRATE_LIMITS.video1to1).catch(() => { });
        applyAudioBitrateCap(pc).catch(() => { });
        if (iceRestartTimeoutRef.current) {
          clearTimeout(iceRestartTimeoutRef.current);
          iceRestartTimeoutRef.current = null;
        }
      } else if (pc.iceConnectionState === 'disconnected') {
        // Grace period - attempt ICE restart before giving up
        iceRestartTimeoutRef.current = setTimeout(async () => {
          if (pc.iceConnectionState === 'disconnected') {
            const targetId = incomingFlag ? callerId || recipientId : recipientId;
            const restartOffer = await attemptIceRestart(pc);
            if (restartOffer) {
              emitOffer(targetId, restartOffer as any);
            }
          }
        }, ICE_RECONNECT_TIMEOUT_MS);
      } else if (pc.iceConnectionState === 'failed') {
        // Attempt ICE restart before giving up
        console.log('[VideoCall] ICE failed - attempting restart before ending call');
        iceRestartTimeoutRef.current = setTimeout(async () => {
          if (pc.iceConnectionState === 'failed') {
            try {
              const targetId = incomingFlag ? callerId || recipientId : recipientId;
              const restartOffer = await attemptIceRestart(pc);
              if (restartOffer) {
                emitOffer(targetId, restartOffer as any);
                // Give the restart 10s to work
                setTimeout(() => {
                  if (pc.iceConnectionState === 'failed') {
                    console.log('[VideoCall] ICE restart failed - ending call');
                    handleEndCall();
                  }
                }, 10000);
              } else {
                handleEndCall();
              }
            } catch {
              handleEndCall();
            }
          }
        }, 2000);
      } else if (pc.iceConnectionState === 'closed') {
        handleEndCall();
      }
    };

    return pc;
  };

  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS_1to1,
        audio: AUDIO_CONSTRAINTS,
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      showToast.error('Could not access camera/microphone. Please check permissions.');
      handleEndCall();
      return null;
    }
  };

  const startCall = async () => {
    console.log('[VideoCall] ========== VIDEO CALL STARTED ==========');
    console.log('[VideoCall] recipientId:', recipientId);
    console.log('[VideoCall] callerId:', callerId);
    console.log('[VideoCall] threadId:', threadId);
    console.log('[VideoCall] isIncoming:', incomingFlag);
    const stream = await getLocalStream();
    if (!stream) return;
    console.log(
      '[VideoCall] Local stream acquired, tracks:',
      stream.getTracks().map((t) => t.kind)
    );

    const pc = initializePeerConnection();
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    setCallStatus('ringing');
  };

  const handleAcceptCall = async () => {
    console.log('[VideoCall] Accepting incoming video call from:', callerId);
    setCallStatus('connecting');

    try {
      const processOffer = async (offerData: any, pc: RTCPeerConnection) => {
        try {
          if (pc.signalingState !== 'stable') {
            return;
          }

          const offer = new RTCSessionDescription(offerData.offer);
          await pc.setRemoteDescription(offer);
          remoteDescriptionSet.current = true;

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          emitAnswer(callerId || '', answer as any);

          for (const candidate of iceCandidatesQueue.current) {
            try {
              await pc.addIceCandidate(candidate);
            } catch (err) {
              console.warn(
                '[VideoCall] Failed to add queued ICE candidate:',
                (err as Error).message
              );
            }
          }
          iceCandidatesQueue.current = [];

          setCallStatus('active');
        } catch (error) {
          console.warn('[VideoCall] Failed to process offer:', (error as Error).message);
        }
      };

      const handleOffer = async (offerData: any) => {
        // Skip group call signals — prevent cross-talk
        if (isGroupCallSignal(offerData)) return;

        if (!peerConnectionRef.current) {
          pendingOffer.current = offerData;
          return;
        }

        await processOffer(offerData, peerConnectionRef.current);
      };

      const handleCandidate = async (candidateData: any) => {
        try {
          // Skip group call signals — prevent cross-talk
          if (isGroupCallSignal(candidateData)) return;

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

            if (!remoteDescriptionSet.current) {
              iceCandidatesQueue.current.push(candidate);
            } else {
              await peerConnectionRef.current.addIceCandidate(candidate);
            }
          }
        } catch (error) {
          console.warn(
            '[VideoCall] Failed to handle ICE candidate (callee):',
            (error as Error).message
          );
        }
      };

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

      const stream = await getLocalStream();
      if (!stream) return;

      const pc = initializePeerConnection();
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      if (callerId && threadId) {
        emitAcceptCall(callerId, threadId);
      }

      if (pendingOffer.current) {
        await processOffer(pendingOffer.current, pc);
        pendingOffer.current = null;
      } else {
      }
    } catch (error) {
      setCallStatus('ended');
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => {
    const newSpeakerState = !isSpeakerOn;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !newSpeakerState;
    }
    setIsSpeakerOn(newSpeakerState);
  };

  const switchCamera = async () => {
    try {
      const newFacing = facingMode === 'user' ? 'environment' : 'user';
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { ...VIDEO_CONSTRAINTS_1to1, facingMode: newFacing },
        audio: AUDIO_CONSTRAINTS,
      });

      // Replace video track in peer connection
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (peerConnectionRef.current && newVideoTrack) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
      }

      // Stop old video track and replace in local stream
      if (localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) oldVideoTrack.stop();
        localStreamRef.current.removeTrack(oldVideoTrack);
        localStreamRef.current.addTrack(newVideoTrack);
      }

      // Stop unused audio track from new stream (we keep the original)
      newStream.getAudioTracks().forEach((t) => t.stop());

      // Update local video preview
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setFacingMode(newFacing);
    } catch (error) {
      showToast.error('Could not switch camera');
    }
  };

  const handleEndCall = () => {
    if (isEndingCall.current) {
      return;
    }

    isEndingCall.current = true;

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
    if (handlersRef.current.callRejected) {
      offCallRejected(handlersRef.current.callRejected);
      handlersRef.current.callRejected = undefined;
    }
    if (handlersRef.current.callEnded) {
      offCallEnded(handlersRef.current.callEnded);
      handlersRef.current.callEnded = undefined;
    }
    if (handlersRef.current.callFailed) {
      offCallFailed(handlersRef.current.callFailed);
      handlersRef.current.callFailed = undefined;
    }

    // Clear ring & ICE restart timers
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (iceRestartTimeoutRef.current) {
      clearTimeout(iceRestartTimeoutRef.current);
      iceRestartTimeoutRef.current = null;
    }

    cleanupPeerConnection(peerConnectionRef.current);
    peerConnectionRef.current = null;

    cleanupMediaStream(localStreamRef.current);
    localStreamRef.current = null;

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    remoteDescriptionSet.current = false;
    iceCandidatesQueue.current = [];

    if (!endedByRemoteRef.current && (recipientId || callerId)) {
      emitEndCall(recipientId || callerId || '', threadId);
    }

    setCallStatus('ended');
    releaseCall();
    hasAcquiredLockRef.current = false;

    onCallEnd?.();

    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleRejectCall = () => {
    if (callerId && threadId) {
      emitRejectCall(callerId, threadId);
    }
    handleEndCall();
  };

  useEffect(() => {
    if (isOpen) {
      // Acquire global call lock — bail if busy
      const acquired = acquireCall('video', {
        remoteUserId: recipientId,
        callId: threadId,
        isIncoming: incomingFlag,
      });
      console.log('[VideoCall] ========== VIDEO CALL MODAL OPENED ==========');
      console.log(
        '[VideoCall] isIncoming:',
        incomingFlag,
        'acquired:',
        acquired,
        'recipientId:',
        recipientId,
        'callerId:',
        callerId,
        'threadId:',
        threadId
      );
      if (!acquired) {
        console.log('[VideoCall] BLOCKED - already in a call');
        hasAcquiredLockRef.current = false;
        onClose();
        return;
      }
      hasAcquiredLockRef.current = true;

      setCallDuration(0);
      setCallStatus(incomingFlag ? 'ringing' : 'connecting');
      setCallFailedReason(null);
      remoteDescriptionSet.current = false;
      iceCandidatesQueue.current = [];
      isEndingCall.current = false;
      endedByRemoteRef.current = false;

      const handleCallEndedByRemote = () => {
        console.log('[VideoCall] Remote party ended the call');
        endedByRemoteRef.current = true;
        handleEndCall();
      };
      handlersRef.current.callEnded = handleCallEndedByRemote;
      onCallEnded(handleCallEndedByRemote);

      const handleCallFailedEvent = (data: any) => {
        console.log('[VideoCall] CALL FAILED:', data?.reason);
        setCallFailedReason(data.reason || 'Call failed');
        setCallStatus('ended');
        releaseCall();
        hasAcquiredLockRef.current = false;
        setTimeout(() => {
          onClose();
        }, 2000);
      };
      handlersRef.current.callFailed = handleCallFailedEvent;
      onCallFailed(handleCallFailedEvent);

      if (!incomingFlag) {
        // CRITICAL: Store the promise so handleCallAccepted can wait for it.
        // startCall() is async (getUserMedia can take time, especially on first
        // permission prompt). If the callee accepts before getUserMedia resolves,
        // peerConnectionRef.current is still null and the offer is never sent.
        const startCallPromise = startCall();

        // Handle rejection — callee clicked Reject
        const handleCallRejectedEvent = () => {
          console.log('[VideoCall] Call REJECTED by recipient');
          setCallFailedReason('Call declined');
          setCallStatus('ended');
          releaseCall();
          hasAcquiredLockRef.current = false;
          setTimeout(() => onClose(), 2000);
        };
        handlersRef.current.callRejected = handleCallRejectedEvent;
        onCallRejected(handleCallRejectedEvent);

        const handleCallAccepted = async (data: any) => {
          console.log('[VideoCall] CALL ACCEPTED by recipient:', data);
          setCallStatus('connecting');

          try {
            // Wait for startCall to finish (getUserMedia + PC creation)
            await startCallPromise;
            const pc = peerConnectionRef.current;
            if (!pc) return;

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            emitOffer(recipientId, offer as any);

            const handleAnswer = async (answerData: any) => {
              try {
                // Skip group call signals — prevent cross-talk
                if (isGroupCallSignal(answerData)) return;

                if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
                  return;
                }

                if (pc.signalingState !== 'have-local-offer') {
                  return;
                }

                const answer = new RTCSessionDescription(answerData.answer);
                await pc.setRemoteDescription(answer);
                remoteDescriptionSet.current = true;

                for (const candidate of iceCandidatesQueue.current) {
                  try {
                    await pc.addIceCandidate(candidate);
                  } catch (err) {
                    console.warn(
                      '[VideoCall] Failed to add queued ICE candidate:',
                      (err as Error).message
                    );
                  }
                }
                iceCandidatesQueue.current = [];

                setCallStatus('active');
              } catch (error) {
                console.warn('[VideoCall] Failed to handle answer:', (error as Error).message);
              }
            };

            const handleCandidate = async (candidateData: any) => {
              try {
                // Skip group call signals — prevent cross-talk
                if (isGroupCallSignal(candidateData)) return;

                if (!pc || pc.connectionState === 'closed') {
                  return;
                }

                if (candidateData.candidate && candidateData.candidate.candidate) {
                  const candidate = new RTCIceCandidate({
                    candidate: candidateData.candidate.candidate,
                    sdpMLineIndex: candidateData.candidate.sdpMLineIndex,
                    sdpMid: candidateData.candidate.sdpMid,
                  });

                  if (!remoteDescriptionSet.current) {
                    iceCandidatesQueue.current.push(candidate);
                  } else {
                    await pc.addIceCandidate(candidate);
                  }
                }
              } catch (error) {
                console.warn(
                  '[VideoCall] Failed to handle ICE candidate (caller):',
                  (error as Error).message
                );
              }
            };

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
            setCallStatus('ended');
          }
        };

        handlersRef.current.callAccepted = handleCallAccepted;
        onCallAccepted(handleCallAccepted);
      }

      return () => {
        if (handlersRef.current.callAccepted) {
          offCallAccepted(handlersRef.current.callAccepted);
        }
        if (handlersRef.current.callRejected) {
          offCallRejected(handlersRef.current.callRejected);
        }
        if (handlersRef.current.callEnded) {
          offCallEnded(handlersRef.current.callEnded);
        }
        if (handlersRef.current.callFailed) {
          offCallFailed(handlersRef.current.callFailed);
        }
      };
    }
  }, [isOpen, incomingFlag, recipientId]);

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
      setCallFailedReason('No answer');
      releaseCall();
      hasAcquiredLockRef.current = false;
      setTimeout(() => onClose(), 2000);
    }, RING_TIMEOUT_MS);
    return () => {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
    };
  }, [isOpen, callStatus, onClose]);

  // Outgoing ringtone: play ringback tone while waiting for recipient to answer
  useEffect(() => {
    if (isOpen && callStatus === 'ringing' && !incomingFlag) {
      Ringtone.play('outgoing');
    } else {
      Ringtone.stop();
    }
    return () => {
      Ringtone.stop();
    };
  }, [isOpen, callStatus, incomingFlag]);

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

  // beforeunload: ensure call cleanup on tab close/refresh
  useEffect(() => {
    if (!isOpen) return;
    const unregister = registerBeforeUnloadCleanup(() => {
      if (recipientId || callerId) {
        emitEndCall(recipientId || callerId || '', threadId);
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionRef.current?.close();
    });
    return unregister;
  }, [isOpen, recipientId, callerId, threadId]);

  // Quality monitoring + adaptive bitrate — poll every 5s during active call
  useEffect(() => {
    if (callStatus !== 'active') return;
    const interval = setInterval(async () => {
      if (peerConnectionRef.current) {
        const stats = await getCallQualityStats(peerConnectionRef.current);
        if (stats) {
          if (stats.packetLossPercent > 2 || stats.roundTripTime > 150) {
            await adaptVideoQuality(peerConnectionRef.current, stats, false);
          }
          if (stats.packetLossPercent > 5) {
            console.warn(
              `[VideoCall] Poor quality: ${stats.packetLossPercent.toFixed(1)}% loss, RTT ${stats.roundTripTime.toFixed(0)}ms`
            );
          }
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [callStatus]);

  // Final unmount cleanup — only release lock if THIS instance acquired it
  useEffect(() => {
    return () => {
      cleanupPeerConnection(peerConnectionRef.current);
      cleanupMediaStream(localStreamRef.current);
      if (hasAcquiredLockRef.current) {
        releaseCall();
        hasAcquiredLockRef.current = false;
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {callStatus !== 'active' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
          <div className="text-center">
            <div className="relative inline-block mb-8">
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
                {recipientAvatar?.startsWith('http') ||
                  recipientAvatar?.startsWith('/') ||
                  recipientAvatar?.startsWith('uploads') ? (
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
              {callStatus === 'ringing' && !incomingFlag && 'Calling...'}
              {callStatus === 'ringing' && incomingFlag && 'Incoming video call'}
              {callStatus === 'connecting' && 'Connecting...'}
              {callStatus === 'ended' && (callFailedReason || 'Call ended')}
            </p>
          </div>
        </div>
      )}

      <div className="absolute bottom-24 right-6 w-32 h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-gray-900">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />
        {isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <VideoOff className="w-8 h-8 text-white" />
          </div>
        )}
      </div>

      <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            {callStatus === 'active' && (
              <p className="text-white font-medium">{formatCallDuration(callDuration)}</p>
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

      <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/60 to-transparent">
        {incomingFlag && callStatus === 'ringing' ? (
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
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={toggleVideo}
              size="lg"
              variant={isVideoOff ? 'destructive' : 'secondary'}
              className="w-14 h-14 rounded-full shadow-lg"
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>
            <Button
              onClick={switchCamera}
              size="lg"
              variant="secondary"
              className="w-14 h-14 rounded-full shadow-lg"
              disabled={isVideoOff}
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button
              onClick={toggleSpeaker}
              size="lg"
              variant={isSpeakerOn ? 'secondary' : 'destructive'}
              className="w-14 h-14 rounded-full shadow-lg"
            >
              {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
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
