"use client";

import { useEffect, useRef, useState } from "react";
import { X, Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  emitOffer, 
  emitAnswer, 
  emitIceCandidate,
  emitAcceptCall,
  emitRejectCall,
  emitEndCall,
  onOffer,
  offOffer,
  onAnswer,
  offAnswer,
  onIceCandidate,
  offIceCandidate,
  onCallEnded,
  offCallEnded,
  onCallAccepted,
  offCallAccepted,
  getSocket,
} from "@/lib/socket";

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
  const [callStatus, setCallStatus] = useState<
    "ringing" | "connecting" | "active" | "ended"
  >(isIncoming ? "ringing" : "connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [currentCallId, setCurrentCallId] = useState(callId || "");

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
    offer?: (data: any) => void
    answer?: (data: any) => void
    iceCandidate?: (data: any) => void
    callAccepted?: (data: any) => void
    callEnded?: (data: any) => void
  }>({});

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Initialize peer connection
  const initializePeerConnection = () => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
      ],
    };

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("📤 Sending ICE candidate");
        const targetId = isIncoming ? (callerId || recipientId) : recipientId;
        emitIceCandidate(targetId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log("📹 Received remote stream");
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("🔗 ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected") {
        setCallStatus("active");
      } else if (
        pc.iceConnectionState === "disconnected" ||
        pc.iceConnectionState === "failed" ||
        pc.iceConnectionState === "closed"
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
      console.error("❌ Error accessing media devices:", error);
      alert("Could not access camera/microphone. Please check permissions.");
      handleEndCall();
      return null;
    }
  };

  // Start outgoing call
  const startCall = async () => {
    console.log("📞 Starting video call to:", recipientId);

    const stream = await getLocalStream();
    if (!stream) return;

    const pc = initializePeerConnection();
    peerConnectionRef.current = pc;

    // Add local stream tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    setCallStatus("ringing");
  };

  // Handle incoming call acceptance
  const handleAcceptCall = async () => {
    console.log("✅ Accepting video call");
    setCallStatus("connecting");

    try {
      // Set up offer handler BEFORE notifying caller to avoid race condition
      const processOffer = async (offerData: any, pc: RTCPeerConnection) => {
        try {
          console.log('📥 Processing offer from caller:', offerData);
          
          // Check if we're in the correct state to receive an offer
          if (pc.signalingState !== 'stable') {
            console.log('⚠️ Cannot process offer - signaling state is:', pc.signalingState);
            return;
          }
          
          // Backend sends offer directly
          const offer = new RTCSessionDescription(offerData.offer);
          await pc.setRemoteDescription(offer);
          remoteDescriptionSet.current = true;
          
          // Create and send answer
          console.log('📤 Creating answer...');
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          // Send answer to caller
          emitAnswer(callerId || '', answer as any);
          
          // Process queued ICE candidates
          console.log(`🧊 Processing ${iceCandidatesQueue.current.length} queued ICE candidates`);
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
        console.log('📥 Received offer from caller:', offerData);
        
        // If peer connection doesn't exist yet, store offer for later
        if (!peerConnectionRef.current) {
          console.log('📦 Storing offer - peer connection not ready yet');
          pendingOffer.current = offerData;
          return;
        }
        
        // Process offer immediately if peer connection is ready
        await processOffer(offerData, peerConnectionRef.current);
      };

      const handleCandidate = async (candidateData: any) => {
        try {
          // Skip if peer connection is closed or not ready
          if (!peerConnectionRef.current || peerConnectionRef.current.connectionState === 'closed') {
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
              console.log('🧊 Queuing ICE candidate (remote description not set yet)');
              iceCandidatesQueue.current.push(candidate);
            } else {
              await peerConnectionRef.current.addIceCandidate(candidate);
              console.log('🧊 Added ICE candidate');
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
      
      console.log('✅ Offer handler registered, creating peer connection first...');
      
      // Get local stream and create peer connection FIRST before notifying caller
      const stream = await getLocalStream();
      if (!stream) return;

      const pc = initializePeerConnection();
      peerConnectionRef.current = pc;

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
      
      console.log('✅ Peer connection ready, now notifying caller we accepted...');
      
      // NOW notify caller that we accepted (peer connection is ready)
      if (callerId && threadId) {
        emitAcceptCall(callerId, threadId);
      }
      
      // Process pending offer if one arrived while we were setting up
      if (pendingOffer.current) {
        console.log('📦 Processing pending offer now that peer connection is ready');
        await processOffer(pendingOffer.current, pc);
        pendingOffer.current = null;
      } else {
        console.log('✅ Waiting for offer from caller...');
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
      console.log('📞 Already ending call, skipping...');
      return;
    }
    
    isEndingCall.current = true;
    console.log("📴 Ending call");

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
        console.log('📹 Track stopped:', track.kind);
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

    setCallStatus("ended");
    
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  // Handle reject call
  const handleRejectCall = () => {
    console.log('❌ Rejecting call');
    if (callerId && threadId) {
      emitRejectCall(callerId, threadId);
    }
    handleEndCall();
  };

  // Initialize call on mount
  useEffect(() => {
    console.log('📹 VideoCallModal isOpen:', isOpen, 'isIncoming:', isIncoming);
    
    if (isOpen) {
      // Reset state when modal opens
      setCallDuration(0);
      setCallStatus(isIncoming ? 'ringing' : 'connecting');
      remoteDescriptionSet.current = false;
      iceCandidatesQueue.current = [];
      isEndingCall.current = false;
      
      // Listen for call ended from remote user
      const handleCallEndedByRemote = () => {
        console.log('📞 Call ended by remote user');
        handleEndCall();
      };
      handlersRef.current.callEnded = handleCallEndedByRemote;
      onCallEnded(handleCallEndedByRemote);
      
      // For outgoing calls, listen for when other user accepts
      if (!isIncoming) {
        startCall();
        
        const handleCallAccepted = async (data: any) => {
          console.log('✅ Call accepted by recipient:', data);
          setCallStatus('connecting');
          
          // Now initiate WebRTC connection
          try {
            const pc = peerConnectionRef.current;
            if (!pc) return;
            
            // Create and send offer
            console.log('📤 Creating offer after acceptance...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            emitOffer(recipientId, offer as any);

            // Set up answer handler
            const handleAnswer = async (answerData: any) => {
              try {
                console.log('📥 Received answer:', answerData);
                
                // Only block if connection is actually closed or failed
                if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
                  console.log('⚠️ Ignoring answer - connection is closed/failed:', pc?.connectionState);
                  return;
                }
                
                // Check if we're in the correct state to receive an answer
                if (pc.signalingState !== 'have-local-offer') {
                  console.log('⚠️ Ignoring answer - signaling state is:', pc.signalingState);
                  return;
                }
                
                // Backend sends answer directly
                const answer = new RTCSessionDescription(answerData.answer);
                await pc.setRemoteDescription(answer);
                remoteDescriptionSet.current = true;
                
                // Process queued ICE candidates
                console.log(`🧊 Processing ${iceCandidatesQueue.current.length} queued ICE candidates`);
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
                    console.log('🧊 Queuing ICE candidate (remote description not set yet)');
                    iceCandidatesQueue.current.push(candidate);
                  } else {
                    await pc.addIceCandidate(candidate);
                    console.log('🧊 Added ICE candidate');
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
  }, [isOpen, isIncoming, recipientId]);

  // Start timer when call becomes active
  useEffect(() => {
    if (callStatus === "active") {
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
      {callStatus !== "active" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
          <div className="text-center">
            <div className="relative inline-block mb-8">
              {/* Pulsing rings animation */}
              {callStatus === "ringing" && (
                <>
                  <div className="absolute inset-0 rounded-full bg-blue-500 opacity-20 animate-ping" />
                  <div
                    className="absolute inset-0 rounded-full bg-blue-500 opacity-20 animate-ping"
                    style={{ animationDelay: "0.5s" }}
                  />
                </>
              )}
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white/20">
                {recipientAvatar ? (
                  <img
                    src={recipientAvatar}
                    alt={recipientName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-4xl font-bold text-white">
                    {recipientName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {recipientName}
            </h2>
            <p className="text-gray-300">
              {callStatus === "ringing" && !isIncoming && "Calling..."}
              {callStatus === "ringing" && isIncoming && "Incoming video call"}
              {callStatus === "connecting" && "Connecting..."}
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
            {callStatus === "active" && (
              <p className="text-white font-medium">
                {formatDuration(callDuration)}
              </p>
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
        {isIncoming && callStatus === "ringing" ? (
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
              variant={isVideoOff ? "destructive" : "secondary"}
              className="w-14 h-14 rounded-full shadow-lg"
            >
              {isVideoOff ? (
                <VideoOff className="w-5 h-5" />
              ) : (
                <Video className="w-5 h-5" />
              )}
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
              variant={isMuted ? "destructive" : "secondary"}
              className="w-14 h-14 rounded-full shadow-lg"
            >
              {isMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
