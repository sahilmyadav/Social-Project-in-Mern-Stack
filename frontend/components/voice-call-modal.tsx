'use client';

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
  ICE_RECONNECT_TIMEOUT_MS,
  RING_TIMEOUT_MS,
  attemptIceRestart,
  cleanupMediaStream,
  cleanupPeerConnection,
  formatCallDuration,
  getCallQualityStats,
  getIceServers,
  isGroupCallSignal,
  registerBeforeUnloadCleanup,
} from '@/lib/webrtc';
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
  const { acquireCall, releaseCall } = useCallState();
  const [callFailedReason, setCallFailedReason] = useState<string | null>(null);
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

  useEffect(() => {
    if (isOpen) {
      // Acquire global call lock — bail if busy
      const acquired = acquireCall('voice', {
        remoteUserId: recipientId,
        callId: threadId,
        isIncoming: isIncomingCall,
      });
      console.log('[VoiceCall] ========== CALL STARTED ==========');
      console.log('[VoiceCall] isIncomingCall:', isIncomingCall);
      console.log('[VoiceCall] recipientId:', recipientId);
      console.log('[VoiceCall] callerId:', callerId);
      console.log('[VoiceCall] threadId:', threadId);
      console.log('[VoiceCall] currentUserId:', currentUserId);
      console.log('[VoiceCall] acquireCall result:', acquired);
      if (!acquired) {
        console.log('[VoiceCall] BLOCKED - already in a call, closing');
        hasAcquiredLockRef.current = false;
        onClose();
        return;
      }
      hasAcquiredLockRef.current = true;

      setCallDuration(0);
      setCallStatus('ringing');
      setCallFailedReason(null);
      remoteDescriptionSet.current = false;
      iceCandidatesQueue.current = [];
      isEndingCall.current = false;
      endedByRemoteRef.current = false;

      const handleCallEndedByRemote = () => {
        console.log('[VoiceCall] Remote party ended the call');
        endedByRemoteRef.current = true;
        endCall();
      };
      handlersRef.current.callEnded = handleCallEndedByRemote;
      onCallEnded(handleCallEndedByRemote);

      const handleCallFailedEvent = (data: any) => {
        console.log('[VoiceCall] CALL FAILED event:', data?.reason);
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

      if (!isIncomingCall) {
        // Handle rejection — callee clicked Reject
        const handleCallRejectedEvent = () => {
          console.log('[VoiceCall] Call REJECTED by recipient');
          setCallFailedReason('Call declined');
          setCallStatus('ended');
          releaseCall();
          hasAcquiredLockRef.current = false;
          setTimeout(() => onClose(), 2000);
        };
        handlersRef.current.callRejected = handleCallRejectedEvent;
        onCallRejected(handleCallRejectedEvent);

        const handleCallAccepted = async (data: any) => {
          console.log('[VoiceCall] CALL ACCEPTED by recipient:', data);
          setCallStatus('connecting');

          try {
            const peerConnection = await createPeerConnection();

            const handleAnswer = async (answerData: any) => {
              try {
                // Skip group call signals — prevent cross-talk
                if (isGroupCallSignal(answerData)) return;

                if (
                  !peerConnection ||
                  peerConnection.connectionState === 'closed' ||
                  peerConnection.connectionState === 'failed'
                ) {
                  return;
                }

                if (peerConnection.signalingState !== 'have-local-offer') {
                  return;
                }

                console.log('[VoiceCall] Processing answer from callee');
                const answer = new RTCSessionDescription(answerData.answer);
                await peerConnection.setRemoteDescription(answer);
                remoteDescriptionSet.current = true;

                // Ensure remote audio is attached after remote description is set
                if (remoteAudioRef.current && !remoteAudioRef.current.srcObject) {
                  const receivers = peerConnection.getReceivers();
                  const audioReceiver = receivers.find((r) => r.track?.kind === 'audio');
                  if (audioReceiver?.track) {
                    console.log('[VoiceCall] Attaching remote audio from receiver (fallback)');
                    remoteAudioRef.current.srcObject = new MediaStream([audioReceiver.track]);
                    remoteAudioRef.current.play().catch(() => { });
                  }
                }

                for (const candidate of iceCandidatesQueue.current) {
                  try {
                    await peerConnection.addIceCandidate(candidate);
                  } catch (err) {
                    console.warn(
                      '[VoiceCall] Failed to add queued ICE candidate:',
                      (err as Error).message
                    );
                  }
                }
                iceCandidatesQueue.current = [];

                setCallStatus('active');
              } catch (error) {
                console.warn('[VoiceCall] Failed to handle answer:', (error as Error).message);
              }
            };

            const handleCandidate = async (candidateData: any) => {
              try {
                // Skip group call signals — prevent cross-talk
                if (isGroupCallSignal(candidateData)) return;

                if (!peerConnection || peerConnection.connectionState === 'closed') {
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
                    await peerConnection.addIceCandidate(candidate);
                  }
                }
              } catch (error) {
                console.warn(
                  '[VoiceCall] Failed to handle ICE candidate (caller):',
                  (error as Error).message
                );
              }
            };

            // Register answer/ICE handlers BEFORE sending offer to avoid race
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

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            emitOffer(recipientId, offer as any);
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
  }, [isOpen, isIncomingCall, recipientId]);

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
    if (isOpen && callStatus === 'ringing' && !isIncomingCall) {
      Ringtone.play('outgoing');
    } else {
      Ringtone.stop();
    }
    return () => {
      Ringtone.stop();
    };
  }, [isOpen, callStatus, isIncomingCall]);

  useEffect(() => {
    if (callStatus !== 'active') return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
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

  // Quality monitoring — poll getStats every 5s during active call
  useEffect(() => {
    if (callStatus !== 'active') return;
    const interval = setInterval(async () => {
      if (peerConnectionRef.current) {
        const stats = await getCallQualityStats(peerConnectionRef.current);
        if (stats && stats.packetLossPercent > 5) {
          console.warn(
            `[VoiceCall] Poor quality: ${stats.packetLossPercent.toFixed(1)}% loss, RTT ${stats.roundTripTime.toFixed(0)}ms`
          );
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [callStatus]);
  useEffect(() => {
    return () => {
      cleanupPeerConnection(peerConnectionRef.current);
      cleanupMediaStream(localStreamRef.current);
      // Only release lock on unmount if THIS instance acquired it
      if (hasAcquiredLockRef.current) {
        releaseCall();
        hasAcquiredLockRef.current = false;
      }
    };
  }, []);

  const createPeerConnection = async () => {
    try {
      const iceConfig = getIceServers();
      console.log(
        '[VoiceCall] Creating PeerConnection with ICE servers:',
        JSON.stringify(
          iceConfig.iceServers?.map((s) => (typeof s === 'string' ? s : (s as any).urls))
        )
      );
      const peerConnection = new RTCPeerConnection(iceConfig);
      peerConnectionRef.current = peerConnection;

      console.log('[VoiceCall] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
      console.log('[VoiceCall] Microphone acquired, tracks:', stream.getTracks().length);
      localStreamRef.current = stream;

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      peerConnection.ontrack = (event) => {
        console.log('[VoiceCall] ontrack:', event.track.kind, 'streams:', event.streams.length, 'track.enabled:', event.track.enabled, 'track.readyState:', event.track.readyState);
        if (!remoteAudioRef.current) {
          console.warn('[VoiceCall] ontrack: remoteAudioRef not ready');
          return;
        }
        // Use event stream or create one from the track (Unified Plan can send empty streams)
        const stream = event.streams[0] || new MediaStream([event.track]);
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch((err) => {
          console.warn('[VoiceCall] Audio play blocked, retrying on user gesture:', err.message);
          // Retry once after a short delay (autoplay policy may resolve)
          setTimeout(() => {
            remoteAudioRef.current?.play().catch(() => { });
          }, 500);
        });
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(
            '[VoiceCall] ICE candidate:',
            event.candidate.type,
            event.candidate.protocol,
            event.candidate.address
          );
          emitIceCandidate(recipientId || callerId || '', event.candidate);
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log('[VoiceCall] ICE connection state:', peerConnection.iceConnectionState);
        if (
          peerConnection.iceConnectionState === 'connected' ||
          peerConnection.iceConnectionState === 'completed'
        ) {
          setCallStatus('active');
          if (iceRestartTimeoutRef.current) {
            clearTimeout(iceRestartTimeoutRef.current);
            iceRestartTimeoutRef.current = null;
          }
        } else if (peerConnection.iceConnectionState === 'disconnected') {
          // Grace period — attempt ICE restart before giving up
          iceRestartTimeoutRef.current = setTimeout(async () => {
            if (peerConnection.iceConnectionState === 'disconnected') {
              const restartOffer = await attemptIceRestart(peerConnection);
              if (restartOffer) {
                emitOffer(recipientId || callerId || '', restartOffer as any);
              }
            }
          }, ICE_RECONNECT_TIMEOUT_MS);
        } else if (peerConnection.iceConnectionState === 'failed') {
          // Attempt ICE restart before giving up
          console.log('[VoiceCall] ICE failed — attempting restart before ending call');
          iceRestartTimeoutRef.current = setTimeout(async () => {
            if (peerConnection.iceConnectionState === 'failed') {
              try {
                const restartOffer = await attemptIceRestart(peerConnection);
                if (restartOffer) {
                  emitOffer(recipientId || callerId || '', restartOffer as any);
                  // Give the restart 10s to work
                  setTimeout(() => {
                    if (peerConnection.iceConnectionState === 'failed') {
                      console.log('[VoiceCall] ICE restart failed — ending call');
                      endCall();
                    }
                  }, 10000);
                } else {
                  endCall();
                }
              } catch {
                endCall();
              }
            }
          }, 2000);
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log('[VoiceCall] Connection state:', peerConnection.connectionState);
        // Don't immediately end on 'failed' — let ICE restart handler manage it
        if (
          peerConnection.connectionState === 'failed' &&
          peerConnection.iceConnectionState === 'closed'
        ) {
          endCall();
        }
      };

      return peerConnection;
    } catch (error) {
      showToast.error('Unable to access microphone. Please check permissions.');
      setCallStatus('ended');
      throw error;
    }
  };

  const handleAcceptCall = async () => {
    console.log('[VoiceCall] Accepting incoming call from:', callerId);
    setCallStatus('connecting');

    try {
      const processOffer = async (offerData: any, peerConnection: RTCPeerConnection) => {
        try {
          if (peerConnection.signalingState !== 'stable') {
            return;
          }

          const offer = new RTCSessionDescription(offerData.offer);
          await peerConnection.setRemoteDescription(offer);
          remoteDescriptionSet.current = true;

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          emitAnswer(callerId || '', answer as any);

          for (const candidate of iceCandidatesQueue.current) {
            try {
              await peerConnection.addIceCandidate(candidate);
            } catch (err) {
              console.warn(
                '[VoiceCall] Failed to add queued ICE candidate:',
                (err as Error).message
              );
            }
          }
          iceCandidatesQueue.current = [];

          setCallStatus('active');
        } catch (error) {
          console.warn('[VoiceCall] Failed to process offer:', (error as Error).message);
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
            '[VoiceCall] Failed to handle ICE candidate (callee):',
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

      const peerConnection = await createPeerConnection();

      if (callerId && threadId) {
        console.log(
          '[VoiceCall] Emitting acceptCall to server, callerId:',
          callerId,
          'threadId:',
          threadId
        );
        emitAcceptCall(callerId, threadId);
      }

      if (pendingOffer.current) {
        console.log('[VoiceCall] Processing pending offer');
        await processOffer(pendingOffer.current, peerConnection);
        pendingOffer.current = null;
      } else {
      }
    } catch (error) {
      setCallStatus('ended');
    }
  };

  const handleRejectCall = () => {
    if (callerId && threadId) {
      emitRejectCall(callerId, threadId);
    }
    endCall();
  };

  const endCall = () => {
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

  const toggleMic = () => {
    if (peerConnectionRef.current && localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMicOn;
      });
    }
    setIsMicOn(!isMicOn);
  };

  const toggleSpeaker = () => {
    const newSpeakerState = !isSpeakerOn;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !newSpeakerState;
    }
    setIsSpeakerOn(newSpeakerState);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-black to-black pointer-events-none" />

      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 transition z-50 cursor-pointer"
        title="Close call"
      >
        <X size={24} className="text-white" />
      </button>

      <div className="relative flex flex-col items-center justify-center w-full h-full max-w-md">
        <div className="flex flex-col items-center mb-12">
          <div className="relative mb-8">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-7xl shadow-2xl border-4 border-white/10">
              {recipientAvatar?.startsWith('http') ||
                recipientAvatar?.startsWith('/') ||
                recipientAvatar?.startsWith('uploads') ? (
                <img
                  src={getMediaUrl(recipientAvatar)}
                  alt={recipientName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User size={48} className="text-white" />
              )}
            </div>

            <div
              className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center ${callStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                }`}
            />
          </div>

          <h2 className="text-4xl font-bold text-white mb-4 text-center">{recipientName}</h2>

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
              <p className="font-mono text-3xl tracking-widest">
                {formatCallDuration(callDuration)}
              </p>
            )}

            {callStatus === 'ended' && (
              <p className="text-lg">{callFailedReason || 'Call ended'}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-8 mt-auto mb-16">
          <div className="flex items-center justify-center gap-6">
            {callStatus === 'ringing' && isIncomingCall && (
              <>
                <button
                  onClick={handleRejectCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center transition transform shadow-xl hover:shadow-red-500/50 cursor-pointer"
                  title="Reject call"
                >
                  <PhoneOff size={32} className="text-white" />
                </button>

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
                <button
                  onClick={toggleMic}
                  className={`w-14 h-14 rounded-full transition transform active:scale-95 shadow-lg flex items-center justify-center ${isMicOn
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

                <button
                  onClick={toggleSpeaker}
                  className={`w-14 h-14 rounded-full transition transform active:scale-95 shadow-lg flex items-center justify-center ${isSpeakerOn
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

          {callStatus === 'active' && (
            <div className="text-center text-gray-400 text-sm">
              <p>Tap to toggle microphone and speaker</p>
            </div>
          )}
        </div>
      </div>

      <audio ref={localAudioRef} muted playsInline />
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  );
}
