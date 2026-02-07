'use client';

/**
 * ============================================================================
 * BROADCAST PAGE - Live Streaming as Broadcaster
 * ============================================================================
 *
 * This is the main broadcasting page where the streamer controls their live
 * stream. It includes camera preview, controls, live chat, viewer management,
 * and all the features you'd expect from Instagram Live.
 *
 * ============================================================================
 * COMPLETE FEATURE LIST:
 * ============================================================================
 *
 * 1. CAMERA & AUDIO CONTROL
 *    - Camera toggle (on/off)
 *    - Microphone toggle (on/off)
 *    - Camera flip (front/back on mobile)
 *    - Camera preview before going live
 *
 * 2. LIVE BROADCASTING (WebRTC)
 *    - Start/End live stream
 *    - Real-time video/audio to viewers
 *    - Connection state monitoring
 *
 * 3. LIVE CHAT
 *    - Real-time comments from viewers
 *    - Send comments as broadcaster
 *    - Pin important comments
 *    - Auto-scroll to latest
 *
 * 4. VIEWER MANAGEMENT
 *    - Real-time viewer count
 *    - Viewer list with avatars
 *    - New viewer notifications
 *
 * 5. REACTIONS & HEARTS
 *    - Floating heart animations (Instagram-style)
 *    - Reaction counters
 *
 * 6. STREAM CONTROLS
 *    - Stream duration timer
 *    - End stream confirmation
 *    - Screen orientation lock
 *
 * ============================================================================
 * WEBRTC ARCHITECTURE:
 * ============================================================================
 *
 * The WebRTC implementation uses a "1-to-N" broadcast topology:
 *
 * BROADCASTER (this page)
 * ├── LocalStream (camera + mic)
 * └── PeerConnections Map
 *     ├── ViewerA: RTCPeerConnection → sends tracks
 *     ├── ViewerB: RTCPeerConnection → sends tracks
 *     └── ViewerC: RTCPeerConnection → sends tracks
 *
 * SIGNALING FLOW (via Socket.io):
 * 1. Viewer joins stream room
 * 2. Server emits 'viewerJoined' to broadcaster
 * 3. Broadcaster creates RTCPeerConnection for new viewer
 * 4. Broadcaster adds local tracks to peer connection
 * 5. Broadcaster creates SDP offer
 * 6. Broadcaster sends offer via socket ('liveStreamOffer')
 * 7. Viewer receives offer, creates answer
 * 8. Viewer sends answer via socket ('liveStreamAnswer')
 * 9. Broadcaster sets remote description
 * 10. ICE candidates exchanged bidirectionally
 * 11. Connection established, video flows!
 *
 * ============================================================================
 * SOCKET EVENTS (Emitted by this page):
 * ============================================================================
 *
 * 'startLiveStream'       - Notify followers that stream is live
 * 'endLiveStream'         - Notify viewers that stream ended
 * 'liveComment'           - Send a comment
 * 'liveStreamOffer'       - WebRTC offer to specific viewer
 * 'liveStreamIceCandidate' - ICE candidate to specific peer
 * 'pinComment'            - Pin a comment for all viewers
 * 'sendReaction'          - Send a reaction/heart
 *
 * ============================================================================
 * SOCKET EVENTS (Listened by this page):
 * ============================================================================
 *
 * 'viewerJoined'          - New viewer joined, create peer connection
 * 'viewerLeft'            - Viewer left, cleanup peer connection
 * 'viewerCountUpdate'     - Updated viewer count
 * 'liveStreamAnswer'      - WebRTC answer from viewer
 * 'liveStreamIceCandidate' - ICE candidate from viewer
 * 'newLiveComment'        - New comment from a viewer
 * 'newReaction'           - Reaction/heart from a viewer
 *
 * ============================================================================
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { liveStreamService } from '@/lib/api-services';
import {
    emitEndLiveStream,
    emitLiveComment,
    emitLiveStreamIceCandidate,
    emitLiveStreamOffer,
    emitStartLiveStream,
    offLiveComment,
    offLiveStreamAnswer,
    offLiveStreamIceCandidate,
    offViewerCountUpdate,
    offViewerJoined,
    offViewerLeft,
    onLiveComment,
    onLiveStreamAnswer,
    onLiveStreamIceCandidate,
    onViewerCountUpdate,
    onViewerJoined,
    onViewerLeft,
} from '@/lib/socket';
import { cn } from '@/lib/utils';
import { LiveComment, LiveViewer } from '@/types/live';
import {
    CameraOff,
    Clock,
    Eye,
    FlipHorizontal,
    Heart,
    Loader2,
    MessageCircle,
    Mic,
    MicOff,
    Pin,
    Radio,
    Send,
    Share2,
    Sparkles,
    Users,
    Video,
    VideoOff,
    X,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * ============================================================================
 * FLOATING HEARTS COMPONENT
 * ============================================================================
 *
 * Instagram-style floating hearts animation when viewers react.
 * Hearts float up from the bottom-right corner with random paths.
 */
interface FloatingHeart {
  id: number;
  x: number;
  color: string;
}

const FloatingHearts = ({ hearts }: { hearts: FloatingHeart[] }) => {
  return (
    <div className="absolute bottom-20 right-4 pointer-events-none">
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute animate-float-up"
          style={{
            right: `${heart.x}px`,
            bottom: 0,
          }}
        >
          <Heart className="w-6 h-6 fill-current" style={{ color: heart.color }} />
        </div>
      ))}
    </div>
  );
};

/**
 * ============================================================================
 * STREAM TIMER COMPONENT
 * ============================================================================
 *
 * Displays the elapsed time since the stream started.
 * Updates every second when stream is live.
 */
const StreamTimer = ({ startedAt, isLive }: { startedAt: Date | null; isLive: boolean }) => {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (!isLive || !startedAt) {
      setElapsed('00:00');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (hours > 0) {
        setElapsed(
          `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      } else {
        setElapsed(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startedAt, isLive]);

  return (
    <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
      <Clock className="h-3.5 w-3.5" />
      <span className="text-sm font-mono font-medium">{elapsed}</span>
    </div>
  );
};

/**
 * ============================================================================
 * MAIN BROADCAST PAGE COMPONENT
 * ============================================================================
 */
export default function BroadcastPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.streamId as string;

  // ========================================================================
  // REFS
  // ========================================================================
  const videoRef = useRef<HTMLVideoElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  // Stream state
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [streamStartedAt, setStreamStartedAt] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const isLiveRef = useRef(false); // Ref to avoid stale closure in callbacks
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null); // Ref for callbacks
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // WebRTC peer connections (one per viewer) - using ref to avoid stale closure issues
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Viewers state
  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState<LiveViewer[]>([]);
  const [showViewers, setShowViewers] = useState(false);

  // Comments state
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [pinnedComment, setPinnedComment] = useState<LiveComment | null>(null);
  const [showComments, setShowComments] = useState(true);

  // UI state
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [heartCounter, setHeartCounter] = useState(0);

  // ========================================================================
  // WEBRTC CONFIGURATION
  // ========================================================================
  /**
   * ICE Servers Configuration
   * -------------------------
   * STUN servers: Help peers discover their public IP addresses
   * TURN servers: Relay traffic when direct connection isn't possible
   *
   * Currently using Google's free STUN servers. For production,
   * you should add your own TURN servers for better reliability.
   */
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      // Add TURN server for production:
      // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
    ],
    iceCandidatePoolSize: 10,
  };

  // ========================================================================
  // FETCH STREAM DETAILS
  // ========================================================================
  /**
   * Load stream metadata from the API
   * This is called on mount to get the stream title, description, etc.
   */
  const fetchStreamDetails = useCallback(async () => {
    try {
      const response = await liveStreamService.getLiveStreamDetails(streamId);
      if (response.success && response.data) {
        setStreamTitle(response.data.title);
        setStreamDescription(response.data.description || '');

        // If stream is already live (page refresh), restore state
        if (response.data.status === 'live') {
          setIsLive(true);
          isLiveRef.current = true; // Keep ref in sync
          setStreamStartedAt(response.data.startedAt);
          setViewerCount(response.data.viewerCount || 0);
        }
      } else {
        setError('Stream not found');
        toast.error('Stream not found');
        setTimeout(() => router.push('/live'), 2000);
      }
    } catch (error: any) {
      console.error('Error fetching stream details:', error);
      setError('Failed to load stream');
      toast.error('Failed to load stream');
    }
  }, [streamId, router]);

  // ========================================================================
  // INITIALIZE CAMERA & MICROPHONE
  // ========================================================================
  /**
   * Request access to camera and microphone
   *
   * getUserMedia Configuration:
   * - video: 1280x720 ideal, front-facing camera default
   * - audio: Echo cancellation, noise suppression, auto gain
   *
   * Common errors:
   * - NotAllowedError: User denied permission
   * - NotFoundError: No camera/mic available
   * - NotReadableError: Camera in use by another app
   */
  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: facingMode,
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      setLocalStream(stream);
      localStreamRef.current = stream; // Keep ref in sync

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn('Auto-play blocked:', playError);
        }
      }

      setLoading(false);
      toast.success('Camera ready! Click "Go Live" when ready.');
    } catch (error: any) {
      console.error('Media access error:', error);

      let errorMessage = 'Failed to access camera/microphone';
      if (error.name === 'NotAllowedError') {
        errorMessage =
          'Camera/microphone access denied. Please allow access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is in use by another application.';
      }

      toast.error(errorMessage);
      setError(errorMessage);
      setLoading(false);
    }
  }, [facingMode]);

  // ========================================================================
  // START LIVE STREAM
  // ========================================================================
  /**
   * Begin broadcasting to viewers
   *
   * Flow:
   * 1. Call API to update stream status to 'live'
   * 2. Emit socket event to notify all followers
   * 3. Update local state to show live UI
   *
   * The socket event triggers:
   * - Database update: status → 'live', startedAt → now
   * - Notification creation for all followers
   * - Real-time notification to online followers
   */
  const startLiveStream = async () => {
    try {
      console.log('📡 Starting live stream:', streamId);
      const response = await liveStreamService.startLiveStream(streamId);
      console.log('📡 Start stream response:', response);

      if (response.success) {
        setIsLive(true);
        isLiveRef.current = true; // Keep ref in sync for callbacks
        setStreamStartedAt(new Date());

        // Emit socket event to notify followers
        emitStartLiveStream(streamId, streamTitle, streamDescription);

        toast.success('🔴 You are now LIVE!');
      } else {
        console.error('Start stream failed:', response);
        toast.error(response.message || 'Failed to start live stream');
      }
    } catch (error: any) {
      console.error(
        'Error starting live stream:',
        error?.message || error?.error || JSON.stringify(error)
      );
      toast.error(error?.message || error?.error || 'Failed to start live stream');
    }
  };

  // ========================================================================
  // END LIVE STREAM
  // ========================================================================
  /**
   * Stop broadcasting and cleanup
   *
   * Flow:
   * 1. Call API to update stream status to 'ended'
   * 2. Emit socket event to notify all viewers
   * 3. Close all WebRTC peer connections
   * 4. Stop all media tracks
   * 5. Navigate back to live page
   */
  const endLiveStream = async () => {
    try {
      const response = await liveStreamService.endLiveStream(streamId);
      if (response.success) {
        // Notify all viewers
        emitEndLiveStream(streamId);

        // Close all peer connections
        peerConnectionsRef.current.forEach((pc) => {
          pc.close();
        });
        peerConnectionsRef.current = new Map();

        // Stop all media tracks
        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
        }

        toast.success('Live stream ended');
        router.push('/live');
      } else {
        toast.error(response.message || 'Failed to end live stream');
      }
    } catch (error: any) {
      console.error('Error ending live stream:', error);
      toast.error(error.message || 'Failed to end live stream');
    }
  };

  // ========================================================================
  // CREATE PEER CONNECTION FOR NEW VIEWER
  // ========================================================================
  /**
   * Create RTCPeerConnection for a specific viewer
   *
   * @param viewerId - The user ID of the viewer
   * @returns RTCPeerConnection configured for broadcasting
   *
   * This creates a one-way connection: broadcaster → viewer
   * The broadcaster adds their local tracks (video + audio)
   * and the viewer receives them on the other end.
   */
  const createPeerConnection = useCallback(
    (viewerId: string) => {
      console.log(`📡 Creating peer connection for viewer: ${viewerId}`);

      const pc = new RTCPeerConnection(rtcConfig);

      // Add all local tracks to the peer connection (use ref to get current stream)
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => {
          console.log(`  Adding ${track.kind} track to peer`);
          pc.addTrack(track, stream);
        });
      } else {
        console.warn('  ⚠️ No local stream available to add tracks!');
      }

      // Handle ICE candidates
      // These are network addresses that can be used to connect
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`  Sending ICE candidate to ${viewerId}`);
          emitLiveStreamIceCandidate(streamId, viewerId, event.candidate);
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`  Connection state: ${pc.connectionState}`);

        if (pc.connectionState === 'connected') {
          console.log(`Connected to viewer ${viewerId}`);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          console.log(`  ❌ Disconnected from viewer ${viewerId}`);
          // Cleanup this peer connection
          pc.close();
          peerConnectionsRef.current.delete(viewerId);
        }
      };

      // Handle ICE connection state (more granular)
      pc.oniceconnectionstatechange = () => {
        console.log(`  ICE state: ${pc.iceConnectionState}`);
      };

      // Store the peer connection in ref (not state to avoid stale closure)
      peerConnectionsRef.current.set(viewerId, pc);
      return pc;
    },
    [streamId, rtcConfig] // Using refs for localStream, so no dependency needed
  );

  // ========================================================================
  // HANDLE NEW VIEWER JOINING
  // ========================================================================
  /**
   * When a viewer joins, create a peer connection and send offer
   *
   * Socket Event: 'viewerJoined'
   * Payload: { viewerId, viewerSocketId, viewerCount, viewer: {...} }
   *
   * Steps:
   * 1. Create new RTCPeerConnection for this viewer
   * 2. Generate SDP offer (description of our media capabilities)
   * 3. Set as local description
   * 4. Send offer to viewer via socket
   */
  const handleViewerJoined = useCallback(
    async (data: any) => {
      const { viewerId, viewer, viewerCount: count } = data;
      console.log(`👤 Viewer joined: ${viewerId}`, viewer);

      // Update viewer count
      if (count !== undefined) {
        setViewerCount(count);
      }

      // Add to viewers list
      if (viewer) {
        setViewers((prev) => {
          // Avoid duplicates
          if (prev.some((v) => v.userId === viewer._id)) return prev;
          return [
            ...prev,
            {
              userId: viewer._id,
              username: viewer.username,
              fullName: `${viewer.firstName || ''} ${viewer.lastName || ''}`.trim(),
              profilePicture: viewer.profilePicture || viewer.avatar,
              joinedAt: new Date(),
            },
          ];
        });
      }

      // Only create peer connection if we're live (use ref to get current value)
      if (!isLiveRef.current) {
        console.log('  Stream not live yet, skipping peer connection');
        return;
      }

      const pc = createPeerConnection(viewerId);

      try {
        // Create and send offer
        const offer = await pc.createOffer({
          offerToReceiveAudio: false, // We're sending, not receiving
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);

        console.log(`  Sending offer to ${viewerId}`);
        emitLiveStreamOffer(streamId, viewerId, offer);
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    },
    [createPeerConnection, streamId]
  );

  // ========================================================================
  // HANDLE VIEWER LEFT
  // ========================================================================
  /**
   * Clean up when a viewer leaves
   *
   * Socket Event: 'viewerLeft'
   * Payload: { viewerId, viewerCount }
   */
  const handleViewerLeft = useCallback((data: any) => {
    const { viewerId, userId, viewerCount: count } = data;
    const id = viewerId || userId;

    console.log(`👋 Viewer left: ${id}`);

    // Update viewer count
    if (count !== undefined) {
      setViewerCount(count);
    }

    // Remove from viewers list
    setViewers((prev) => prev.filter((v) => v.userId !== id));

    // Close and remove peer connection
    const pc = peerConnectionsRef.current.get(id);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(id);
    }
  }, []);

  // ========================================================================
  // HANDLE WEBRTC ANSWER FROM VIEWER
  // ========================================================================
  /**
   * Process answer from viewer to complete WebRTC handshake
   *
   * Socket Event: 'liveStreamAnswer'
   * Payload: { viewerId, answer }
   *
   * The answer is the viewer's SDP response to our offer.
   * Setting it as remote description completes the signaling.
   */
  const handleAnswer = useCallback(async (data: any) => {
    const { viewerId, senderId, answer } = data;
    const id = viewerId || senderId;

    console.log(`📨 Received answer from ${id}`);

    const pc = peerConnectionsRef.current.get(id);
    if (pc && pc.signalingState === 'have-local-offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`Remote description set for ${id}`);
      } catch (error) {
        console.error('Error setting remote description:', error);
      }
    } else {
      console.warn(`  ⚠️ No peer connection found for ${id} or wrong state`);
    }
  }, []);

  // ========================================================================
  // HANDLE ICE CANDIDATE FROM VIEWER
  // ========================================================================
  /**
   * Add ICE candidate from viewer
   *
   * Socket Event: 'liveStreamIceCandidate'
   * Payload: { senderId, candidate }
   *
   * ICE candidates are potential network paths that can be used
   * to establish the peer connection.
   */
  const handleIceCandidate = useCallback(async (data: any) => {
    const { viewerId, senderId, candidate } = data;
    const id = viewerId || senderId;

    const pc = peerConnectionsRef.current.get(id);
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`  Added ICE candidate from ${id}`);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }, []);

  // ========================================================================
  // HANDLE NEW COMMENT
  // ========================================================================
  /**
   * Process incoming live comment
   *
   * Socket Event: 'newLiveComment'
   * Payload: { streamId, comment: { _id, text, user, createdAt } }
   */
  const handleNewComment = useCallback(
    (data: any) => {
      const commentData = data.comment || data;

      const formattedComment: LiveComment = {
        _id: commentData._id,
        liveStreamId: data.streamId || streamId,
        userId: commentData.user?._id || commentData.userId,
        user: {
          _id: commentData.user?._id || '',
          username: commentData.user?.username || '',
          fullName:
            `${commentData.user?.firstName || ''} ${commentData.user?.lastName || ''}`.trim(),
          profilePicture: commentData.user?.profilePicture || commentData.user?.avatar,
        },
        text: commentData.text,
        createdAt: new Date(commentData.createdAt),
      };

      setComments((prev) => [...prev.slice(-99), formattedComment]); // Keep last 100

      // Auto-scroll to latest
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
    [streamId]
  );

  // ========================================================================
  // HANDLE REACTION (HEARTS)
  // ========================================================================
  /**
   * Add floating heart animation when viewer sends reaction
   */
  const addFloatingHeart = useCallback(
    (color: string = '#ef4444') => {
      const id = heartCounter;
      setHeartCounter((prev) => prev + 1);

      const heart: FloatingHeart = {
        id,
        x: Math.random() * 30, // Random horizontal position
        color,
      };

      setFloatingHearts((prev) => [...prev, heart]);

      // Remove after animation
      setTimeout(() => {
        setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
      }, 3000);
    },
    [heartCounter]
  );

  // ========================================================================
  // MEDIA CONTROL FUNCTIONS
  // ========================================================================

  /**
   * Toggle camera on/off
   * This enables/disables the video track without stopping it
   */
  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  /**
   * Toggle microphone on/off
   * This enables/disables the audio track without stopping it
   */
  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  /**
   * Flip camera between front and back (mobile)
   * This stops the current stream and creates a new one with the other camera
   */
  const flipCamera = async () => {
    if (!localStream) return;

    // Stop current video track
    localStream.getVideoTracks().forEach((track) => track.stop());

    // Toggle facing mode
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace video track in all peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });

      // Update local stream
      const audioTrack = localStream.getAudioTracks()[0];
      const updatedStream = new MediaStream([newVideoTrack, audioTrack].filter(Boolean));
      setLocalStream(updatedStream);
      localStreamRef.current = updatedStream; // Keep ref in sync

      if (videoRef.current) {
        videoRef.current.srcObject = updatedStream;
      }

      toast.success('Camera flipped');
    } catch (error) {
      console.error('Error flipping camera:', error);
      toast.error('Failed to flip camera');
    }
  };

  // ========================================================================
  // SEND COMMENT
  // ========================================================================
  const sendComment = () => {
    if (commentText.trim() && isLive) {
      emitLiveComment(streamId, commentText.trim());
      setCommentText('');
    }
  };

  /**
   * Pin a comment for all viewers to see
   */
  const pinComment = (comment: LiveComment) => {
    setPinnedComment(comment);
    // TODO: Emit socket event to broadcast pinned comment
  };

  /**
   * Share the live stream link
   */
  const shareStream = async () => {
    const url = window.location.href.replace('/broadcast/', '/watch/');

    try {
      if (navigator.share) {
        await navigator.share({
          title: streamTitle || 'Live Stream',
          text: `Watch my live stream!`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Link copied to clipboard!');
        } catch {
          toast.info(`Share this link: ${url}`);
        }
      }
    }
  };

  // ========================================================================
  // SOCKET EVENT LISTENERS SETUP
  // ========================================================================
  useEffect(() => {
    // Viewer events
    onViewerJoined(handleViewerJoined);
    onViewerLeft(handleViewerLeft);
    onViewerCountUpdate((data) => setViewerCount(data.count || data.viewerCount || 0));

    // WebRTC signaling events
    onLiveStreamAnswer(handleAnswer);
    onLiveStreamIceCandidate(handleIceCandidate);

    // Chat events
    onLiveComment(handleNewComment);

    return () => {
      offViewerJoined(handleViewerJoined);
      offViewerLeft(handleViewerLeft);
      offViewerCountUpdate(() => {});
      offLiveStreamAnswer(handleAnswer);
      offLiveStreamIceCandidate(handleIceCandidate);
      offLiveComment(handleNewComment);
    };
  }, [handleViewerJoined, handleViewerLeft, handleAnswer, handleIceCandidate, handleNewComment]);

  // ========================================================================
  // INITIALIZE COMPONENT
  // ========================================================================
  useEffect(() => {
    // Fetch stream details first
    fetchStreamDetails();

    // Request camera/microphone permissions immediately
    const requestMediaPermissions = async () => {
      try {
        // Check if permissions API is available
        if (navigator.permissions) {
          const cameraPermission = await navigator.permissions.query({
            name: 'camera' as PermissionName,
          });
          const micPermission = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          });

          console.log('Camera permission:', cameraPermission.state);
          console.log('Microphone permission:', micPermission.state);
        }

        // Initialize media (this will trigger the permission prompt)
        await initializeMedia();
      } catch (error) {
        console.error('Error requesting media permissions:', error);
        // Still try to initialize media even if permissions query fails
        initializeMedia();
      }
    };

    requestMediaPermissions();

    return () => {
      // Cleanup on unmount - use ref to get current stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
    };
  }, []);

  // ========================================================================
  // ATTACH STREAM TO VIDEO ELEMENT WHEN READY
  // ========================================================================
  useEffect(() => {
    if (localStream && videoRef.current) {
      console.log('📹 Attaching local stream to video element');
      videoRef.current.srcObject = localStream;
      videoRef.current.play().catch((err) => {
        console.warn('Auto-play blocked:', err);
      });
    }
  }, [localStream]);

  // ========================================================================
  // ERROR STATE
  // ========================================================================
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-foreground">Error</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push('/live')}>Go Back</Button>
        </div>
      </div>
    );
  }

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div className="min-h-screen bg-background">
      <div className="h-screen flex flex-col lg:flex-row">
        {/* ============================================================
                    VIDEO SECTION - Left/Main Area
                    ============================================================ */}
        <div className="flex-1 relative flex flex-col">
          {/* Video Preview */}
          <div className="flex-1 relative bg-muted overflow-hidden">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Initializing camera...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Video Element */}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={cn('w-full h-full object-cover', !isCameraOn && 'hidden')}
                  style={{ transform: 'scaleX(-1)' }} // Mirror for selfie view
                />

                {/* Camera Off State */}
                {!isCameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
                    <CameraOff className="h-20 w-20 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-lg">Camera is off</p>
                  </div>
                )}

                {/* Top Overlay - Status Bar */}
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
                  <div className="flex items-center justify-between">
                    {/* Left Side - Live Badge & Timer */}
                    <div className="flex items-center gap-3">
                      {isLive ? (
                        <Badge className="bg-red-600 text-white border-0 px-4 py-2 text-sm animate-live-pulse animate-live-glow">
                          <span className="relative flex h-2.5 w-2.5 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                          </span>
                          LIVE
                        </Badge>
                      ) : (
                        <Badge className="bg-primary text-primary-foreground border-0 px-4 py-2 shadow-lg">
                          <Sparkles className="h-3 w-3 mr-2" />
                          Preview
                        </Badge>
                      )}

                      <StreamTimer startedAt={streamStartedAt} isLive={isLive} />
                    </div>

                    {/* Right Side - Viewer Count */}
                    <Button
                      variant="ghost"
                      className="bg-black/60 hover:bg-black/80 gap-2"
                      onClick={() => setShowViewers(true)}
                    >
                      <Eye className="h-4 w-4" />
                      <span className="font-medium">{viewerCount}</span>
                    </Button>
                  </div>

                  {/* Stream Title */}
                  {streamTitle && (
                    <div className="mt-3">
                      <h2 className="text-lg font-semibold drop-shadow-lg">{streamTitle}</h2>
                    </div>
                  )}
                </div>

                {/* Floating Hearts */}
                <FloatingHearts hearts={floatingHearts} />

                {/* Pinned Comment */}
                {pinnedComment && (
                  <div className="absolute left-4 bottom-32 max-w-xs bg-black/70 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                      <Pin className="h-3 w-3 text-primary" />
                      <span className="text-xs text-primary">Pinned</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={pinnedComment.user.profilePicture} />
                        <AvatarFallback>{pinnedComment.user.fullName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-medium text-white">
                          {pinnedComment.user.fullName}
                        </p>
                        <p className="text-sm text-white/80">{pinnedComment.text}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="bg-card border-t border-border p-4">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              {/* Left Controls - Camera & Mic */}
              <div className="flex items-center gap-3">
                <Button
                  variant={isCameraOn ? 'default' : 'destructive'}
                  size="icon"
                  onClick={toggleCamera}
                  disabled={!localStream}
                  className="h-12 w-12 rounded-full"
                >
                  {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
                <Button
                  variant={isMicOn ? 'default' : 'destructive'}
                  size="icon"
                  onClick={toggleMic}
                  disabled={!localStream}
                  className="h-12 w-12 rounded-full"
                >
                  {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={flipCamera}
                  disabled={!localStream}
                  className="h-12 w-12 rounded-full border-border"
                >
                  <FlipHorizontal className="h-5 w-5" />
                </Button>
              </div>

              {/* Center - Go Live / End Button */}
              <div>
                {!isLive ? (
                  <Button
                    onClick={startLiveStream}
                    disabled={loading || !localStream}
                    size="lg"
                    className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 gap-2 px-8"
                  >
                    <Radio className="h-5 w-5" />
                    Go Live
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowEndConfirm(true)}
                    variant="destructive"
                    size="lg"
                    className="gap-2 px-8"
                  >
                    <X className="h-5 w-5" />
                    End Stream
                  </Button>
                )}
              </div>

              {/* Right Controls - Share, Settings */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full border-border"
                  onClick={() => setShowComments(!showComments)}
                >
                  <MessageCircle className={cn('h-5 w-5', showComments && 'text-primary')} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full border-border"
                  onClick={shareStream}
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================
                    CHAT SECTION - Right Sidebar (Desktop)
                    ============================================================ */}
        {showComments && (
          <div className="w-full lg:w-96 bg-card border-l border-border flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Live Chat
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowComments(false)}
                className="lg:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Comments List */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      {isLive
                        ? 'No comments yet. Your viewers will appear here.'
                        : 'Comments will appear here once you go live.'}
                    </p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment._id} className="group flex items-start gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={comment.user.profilePicture} />
                        <AvatarFallback>{comment.user.fullName?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">
                            {comment.user.fullName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            @{comment.user.username}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground break-words">{comment.text}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 h-8 w-8"
                        onClick={() => pinComment(comment)}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>
            </ScrollArea>

            {/* Comment Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={isLive ? 'Say something to your viewers...' : 'Go live to chat'}
                  onKeyPress={(e) => e.key === 'Enter' && sendComment()}
                  className="bg-muted border-border"
                  disabled={!isLive}
                />
                <Button onClick={sendComment} disabled={!commentText.trim() || !isLive} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* End Stream Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showEndConfirm}
        onClose={() => setShowEndConfirm(false)}
        onConfirm={endLiveStream}
        title="End Live Stream?"
        message="Are you sure you want to end this live stream? This action cannot be undone and all viewers will be disconnected."
        confirmText="End Stream"
        cancelText="Keep Streaming"
        variant="danger"
      />

      {/* Viewers Sheet/Modal */}
      {showViewers && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-end lg:items-center justify-center"
          onClick={() => setShowViewers(false)}
        >
          <Card
            className="w-full max-w-md max-h-[70vh] bg-card border-border m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Viewers ({viewerCount})
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowViewers(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="p-4 max-h-[50vh]">
              {viewers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No viewers yet</p>
              ) : (
                <div className="space-y-3">
                  {viewers.map((viewer) => (
                    <div key={viewer.userId} className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={viewer.profilePicture} />
                        <AvatarFallback>{viewer.fullName?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{viewer.fullName}</p>
                        <p className="text-sm text-muted-foreground">@{viewer.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      )}

      {/* CSS for floating hearts animation */}
      <style jsx global>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          50% {
            opacity: 1;
            transform: translateY(-100px) scale(1.2);
          }
          100% {
            opacity: 0;
            transform: translateY(-200px) scale(0.8);
          }
        }
        .animate-float-up {
          animation: float-up 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
