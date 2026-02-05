'use client';

/**
 * ============================================================================
 * WATCH LIVE STREAM PAGE - Viewer Experience
 * ============================================================================
 *
 * This page provides the complete viewing experience for live streams.
 * It handles WebRTC connection to receive the broadcaster's video/audio,
 * real-time chat, reactions, and all viewer interactions.
 *
 * ============================================================================
 * COMPLETE FEATURE LIST:
 * ============================================================================
 *
 * 1. VIDEO PLAYBACK
 *    - Receive broadcaster's video via WebRTC
 *    - Full-screen mode
 *    - Connection state indicator
 *    - Volume/mute control
 *
 * 2. REAL-TIME CHAT
 *    - View all comments
 *    - Send comments
 *    - See comment authors with avatars
 *    - Auto-scroll to latest
 *
 * 3. REACTIONS
 *    - Send floating hearts (Instagram-style)
 *    - See others' reactions
 *    - Reaction animations
 *
 * 4. STREAM INFO
 *    - Broadcaster info (name, avatar)
 *    - Stream title and description
 *    - Viewer count
 *    - Stream duration
 *
 * 5. VIEWER CONTROLS
 *    - Leave stream
 *    - Mute/unmute audio
 *    - Full-screen toggle
 *    - Share stream
 *
 * ============================================================================
 * WEBRTC VIEWER ARCHITECTURE:
 * ============================================================================
 *
 * As a viewer, we RECEIVE tracks (not send). The flow is:
 *
 * VIEWER (this page)
 * └── RTCPeerConnection
 *     ├── ontrack → receives broadcaster's video/audio
 *     ├── Remote stream → attached to video element
 *     └── ICE candidates → exchanged via socket
 *
 * SIGNALING FLOW (Viewer Perspective):
 * 1. Join stream room via socket
 * 2. Receive 'liveStreamOffer' from broadcaster
 * 3. Set offer as remote description
 * 4. Create SDP answer
 * 5. Send answer to broadcaster via socket
 * 6. Exchange ICE candidates
 * 7. Connection established → video plays!
 *
 * ============================================================================
 * SOCKET EVENTS (Emitted by this page):
 * ============================================================================
 *
 * 'joinLiveStream'         - Join the stream room
 * 'leaveLiveStream'        - Leave the stream room
 * 'liveComment'            - Send a comment
 * 'liveStreamAnswer'       - WebRTC answer to broadcaster
 * 'liveStreamIceCandidate' - ICE candidate to broadcaster
 * 'liveReaction'           - Send a reaction/heart
 *
 * ============================================================================
 * SOCKET EVENTS (Listened by this page):
 * ============================================================================
 *
 * 'liveStreamOffer'        - WebRTC offer from broadcaster
 * 'liveStreamIceCandidate' - ICE candidate from broadcaster
 * 'liveStreamEnded'        - Stream has ended
 * 'newLiveComment'         - New comment from any user
 * 'viewerCountUpdate'      - Updated viewer count
 * 'newReaction'            - Reaction from another viewer
 * 'commentPinned'          - A comment was pinned
 *
 * ============================================================================
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { liveStreamService } from '@/lib/api-services';
import {
    emitJoinLiveStream,
    emitLeaveLiveStream,
    emitLiveComment,
    emitLiveReaction,
    emitLiveStreamAnswer,
    emitLiveStreamIceCandidate,
    offLiveComment,
    offLiveStreamEnded,
    offLiveStreamIceCandidate,
    offLiveStreamOffer,
    offViewerCountUpdate,
    onLiveComment,
    onLiveStreamEnded,
    onLiveStreamIceCandidate,
    onLiveStreamOffer,
    onViewerCountUpdate,
} from '@/lib/socket';
import { cn } from '@/lib/utils';
import { LiveComment, LiveStream } from '@/types/live';
import {
    ArrowLeft,
    Clock,
    Eye,
    Heart,
    Loader2,
    Maximize2,
    MessageCircle,
    Minimize2,
    Pin,
    Send,
    Share2,
    Volume2,
    VolumeX,
    Wifi,
    WifiOff,
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
 * Display animated hearts floating up when reactions are sent.
 * Hearts have random colors and horizontal positions for variety.
 */
interface FloatingHeart {
  id: number;
  x: number;
  color: string;
}

const HEART_COLORS = [
  '#ef4444', // red
  '#ec4899', // pink
  '#f97316', // orange
  '#eab308', // yellow
  '#8b5cf6', // purple
];

const FloatingHearts = ({ hearts }: { hearts: FloatingHeart[] }) => {
  return (
    <div className="absolute bottom-24 right-4 pointer-events-none">
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute animate-float-up"
          style={{
            right: `${heart.x}px`,
            bottom: 0,
          }}
        >
          <Heart className="w-8 h-8 fill-current drop-shadow-lg" style={{ color: heart.color }} />
        </div>
      ))}
    </div>
  );
};

/**
 * ============================================================================
 * CONNECTION STATUS INDICATOR
 * ============================================================================
 *
 * Shows the current WebRTC connection state to the user
 */
const ConnectionStatus = ({ state }: { state: RTCPeerConnectionState }) => {
  const statusConfig: Record<RTCPeerConnectionState, { icon: any; text: string; color: string }> = {
    new: { icon: Wifi, text: 'Connecting...', color: 'text-yellow-500' },
    connecting: { icon: Wifi, text: 'Connecting...', color: 'text-yellow-500' },
    connected: { icon: Wifi, text: 'Connected', color: 'text-green-500' },
    disconnected: { icon: WifiOff, text: 'Reconnecting...', color: 'text-yellow-500' },
    failed: { icon: WifiOff, text: 'Connection failed', color: 'text-red-500' },
    closed: { icon: WifiOff, text: 'Disconnected', color: 'text-muted-foreground' },
  };

  const config = statusConfig[state] || statusConfig['new'];
  const Icon = config.icon;

  if (state === 'connected') return null; // Hide when connected

  return (
    <div
      className={cn(
        'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'bg-black/80 backdrop-blur-sm rounded-lg px-6 py-4',
        'flex items-center gap-3'
      )}
    >
      {state === 'connecting' || state === 'new' ? (
        <Loader2 className={cn('h-6 w-6 animate-spin', config.color)} />
      ) : (
        <Icon className={cn('h-6 w-6', config.color)} />
      )}
      <span className={cn('font-medium', config.color)}>{config.text}</span>
    </div>
  );
};

/**
 * ============================================================================
 * STREAM DURATION COMPONENT
 * ============================================================================
 */
const StreamDuration = ({ startedAt }: { startedAt: Date | string | null | undefined }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startedAt) return;

    const updateTimer = () => {
      const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
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
  }, [startedAt]);

  if (!elapsed) return null;

  return (
    <div className="flex items-center gap-1.5 text-sm text-white/80">
      <Clock className="h-3.5 w-3.5" />
      <span className="font-mono">{elapsed}</span>
    </div>
  );
};

/**
 * ============================================================================
 * MAIN WATCH PAGE COMPONENT
 * ============================================================================
 */
export default function WatchLivePage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.streamId as string;

  // ========================================================================
  // REFS
  // ========================================================================
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // ========================================================================
  // STATE
  // ========================================================================

  // Stream data
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Video state
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isProcessingOffer, setIsProcessingOffer] = useState(false);

  // Viewer count
  const [viewerCount, setViewerCount] = useState(0);

  // Comments
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [pinnedComment, setPinnedComment] = useState<LiveComment | null>(null);
  const [showComments, setShowComments] = useState(true);

  // Hearts/Reactions
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [heartCounter, setHeartCounter] = useState(0);

  // User
  const [currentUser, setCurrentUser] = useState<any>(null);

  // ========================================================================
  // WEBRTC CONFIGURATION
  // ========================================================================
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  // ========================================================================
  // FETCH STREAM DETAILS
  // ========================================================================
  const fetchStreamDetails = async (): Promise<boolean> => {
    try {
      const response = await liveStreamService.getLiveStreamDetails(streamId);

      if (response.success && response.data) {
        setStream(response.data);
        setViewerCount(response.data.viewerCount || 0);

        // Check if stream is still live
        if (response.data.status !== 'live') {
          setError('This stream has ended');
          toast.error('This stream has ended');
          setTimeout(() => router.push('/live'), 2000);
          return false;
        }
        return true; // Stream is live, proceed
      } else {
        setError('Live stream not found');
        toast.error('Live stream not found');
        setTimeout(() => router.push('/live'), 2000);
        return false;
      }
    } catch (error: any) {
      console.error('Error fetching stream:', error);
      setError('Failed to load live stream');
      toast.error('Failed to load live stream');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ========================================================================
  // JOIN LIVE STREAM
  // ========================================================================
  /**
   * Join the live stream as a viewer
   *
   * This:
   * 1. Calls the API to register as a viewer (updates DB)
   * 2. Emits socket event to join the stream room
   * 3. The socket event notifies the broadcaster, who then sends us an offer
   * 4. handleOffer() will create the peer connection when offer arrives
   */
  const joinStream = async () => {
    try {
      console.log('📺 Attempting to join stream:', streamId);
      // Register as viewer via API
      const response = await liveStreamService.joinLiveStream(streamId);
      console.log('📺 Join stream response:', response);

      if (response.success) {
        console.log('📺 Joined stream successfully, waiting for broadcaster offer...');

        // Join socket room - this notifies the broadcaster to send us an offer
        emitJoinLiveStream(streamId);

        // Set a timeout to detect if offer never arrives
        // This helps with debugging connection issues
        const offerTimeout = setTimeout(() => {
          if (!peerConnectionRef.current || peerConnectionRef.current.connectionState === 'new') {
            console.warn('⚠️ No offer received after 10 seconds. Possible issues:');
            console.warn('  - Broadcaster may not be live yet');
            console.warn('  - Socket connection may be broken');
            console.warn('  - Network/firewall issues');
            toast.error('Waiting for broadcaster... Make sure the stream is live.');
          }
        }, 10000);

        // Store timeout so we can clear it if offer arrives
        (window as any).__offerTimeout = offerTimeout;

        // Note: We don't create peer connection here.
        // When the broadcaster receives our join, they will send us an offer.
        // handleOffer() will create the peer connection when the offer arrives.
      } else {
        console.error('Join stream failed:', response);
        toast.error(response.message || 'Failed to join stream');
      }
    } catch (error: any) {
      console.error(
        'Error joining stream:',
        error?.message || error?.error || JSON.stringify(error)
      );
      toast.error(error?.message || error?.error || 'Failed to join stream');
    }
  };

  // ========================================================================
  // SETUP PEER CONNECTION
  // ========================================================================
  /**
   * Create RTCPeerConnection to receive broadcaster's stream
   *
   * Key difference from broadcaster:
   * - We don't add any tracks (we're only receiving)
   * - We set up ontrack handler to receive the remote stream
   *
   * @param broadcasterId - The streamer's user ID for ICE candidate routing
   */
  const setupPeerConnection = useCallback(
    (broadcasterId: string) => {
      console.log('🔧 Setting up peer connection for broadcaster:', broadcasterId);

      // Clean up any existing connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      // Handle incoming tracks (this is how we receive the video!)
      pc.ontrack = (event) => {
        console.log('📹 Received track:', event.track.kind);

        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);

        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          // Mute initially for autoplay policy compliance
          videoRef.current.muted = true;
          setIsMuted(true);
          // Try to play
          videoRef.current.play().catch((err) => {
            console.warn('Autoplay blocked even with muted:', err);
          });
        }
      };

      // Handle ICE candidates - send to broadcaster
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 Sending ICE candidate to broadcaster:', broadcasterId);
          emitLiveStreamIceCandidate(streamId, broadcasterId, event.candidate);
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`📡 Connection state: ${pc.connectionState}`);
        setConnectionState(pc.connectionState);

        if (pc.connectionState === 'connected') {
          toast.success('Connected to stream!');
        } else if (pc.connectionState === 'disconnected') {
          toast.warning('Connection interrupted, trying to reconnect...');
        } else if (pc.connectionState === 'failed') {
          toast.error('Connection failed');
        }
      };

      // Handle ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE state: ${pc.iceConnectionState}`);
      };

      return pc;
    },
    [streamId]
  );

  // ========================================================================
  // HANDLE WEBRTC OFFER FROM BROADCASTER
  // ========================================================================
  /**
   * Process offer from broadcaster and send answer
   *
   * Socket Event: 'liveStreamOffer'
   * Payload: { streamId, broadcasterId, offer }
   *
   * This is the key handler! When we receive an offer:
   * 1. Set up peer connection if not exists
   * 2. Set remote description from the offer
   * 3. Create and send answer
   */
  const handleOffer = useCallback(
    async (data: any) => {
      console.log('📨 Received offer from broadcaster:', data);

      // Clear the offer timeout since we received one
      if ((window as any).__offerTimeout) {
        clearTimeout((window as any).__offerTimeout);
        delete (window as any).__offerTimeout;
      }

      const { offer, broadcasterId } = data;

      // Check if we're already processing an offer or connected
      const pc = peerConnectionRef.current;
      if (pc) {
        const state = pc.signalingState;
        const connState = pc.connectionState;
        console.log('📡 Current signaling state:', state, 'connection state:', connState);

        // Skip if already connected or stable (already processed an offer)
        if (connState === 'connected' || connState === 'connecting') {
          console.log('⏭️ Already connected/connecting, ignoring duplicate offer');
          return;
        }
        if (state !== 'stable' && state !== 'closed') {
          console.log('⏭️ Signaling in progress, ignoring duplicate offer');
          return;
        }
      }

      // Setup peer connection when we receive the offer (with broadcaster ID)
      // This ensures the connection is ready and knows where to send ICE candidates
      let newPc = peerConnectionRef.current;
      if (!newPc || newPc.connectionState === 'closed' || newPc.connectionState === 'failed') {
        console.log('🔧 Creating new peer connection for broadcaster:', broadcasterId);
        newPc = setupPeerConnection(broadcasterId);
      }

      try {
        // Set the broadcaster's offer as our remote description
        await newPc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('✅ Remote description set');

        // Create our answer
        const answer = await newPc.createAnswer();
        await newPc.setLocalDescription(answer);
        console.log('✅ Local description set, sending answer to:', broadcasterId);

        // Send answer back to broadcaster
        emitLiveStreamAnswer(streamId, broadcasterId, answer);
      } catch (error) {
        console.error('Error handling offer:', error);
        toast.error('Failed to connect to stream');
      }
    },
    [streamId, setupPeerConnection]
  );

  // ========================================================================
  // HANDLE ICE CANDIDATE FROM BROADCASTER
  // ========================================================================
  /**
   * Add ICE candidate from broadcaster
   */
  const handleIceCandidate = useCallback(async (data: any) => {
    const { candidate } = data;
    const pc = peerConnectionRef.current;

    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('🧊 Added ICE candidate from broadcaster');
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }, []);

  // ========================================================================
  // HANDLE STREAM ENDED
  // ========================================================================
  const handleStreamEnded = useCallback(() => {
    console.log('📴 Stream ended');
    toast.info('The live stream has ended');

    // Cleanup
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    setTimeout(() => router.push('/live'), 2000);
  }, [router]);

  // ========================================================================
  // HANDLE NEW COMMENT
  // ========================================================================
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

      setComments((prev) => [...prev.slice(-99), formattedComment]);

      // Auto-scroll
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
    [streamId]
  );

  // ========================================================================
  // SEND COMMENT
  // ========================================================================
  const sendComment = () => {
    if (commentText.trim()) {
      emitLiveComment(streamId, commentText.trim());
      setCommentText('');
    }
  };

  // ========================================================================
  // SEND REACTION (HEART)
  // ========================================================================
  const sendReaction = () => {
    // Add local heart animation
    const id = heartCounter;
    setHeartCounter((prev) => prev + 1);

    const color = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
    const heart: FloatingHeart = {
      id,
      x: Math.random() * 40,
      color,
    };

    setFloatingHearts((prev) => [...prev, heart]);

    // Remove after animation
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 3000);

    // Emit socket event for others to see
    emitLiveReaction(streamId, 'heart', color);
  };

  // ========================================================================
  // MEDIA CONTROLS
  // ========================================================================
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  // ========================================================================
  // LEAVE STREAM
  // ========================================================================
  const leaveStream = () => {
    // Emit leave event
    emitLeaveLiveStream(streamId);

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    router.push('/live');
  };

  // ========================================================================
  // SHARE STREAM
  // ========================================================================
  const shareStream = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: stream?.title || 'Live Stream',
          text: `Watch ${stream?.streamer?.fullName}'s live stream!`,
          url,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      }
    } catch (error: any) {
      // If share was cancelled or clipboard failed, try alternative
      if (error.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Link copied to clipboard!');
        } catch {
          // Last resort: show the URL in a toast
          toast.info(`Share this link: ${url}`);
        }
      }
    }
  };

  // ========================================================================
  // SOCKET EVENT LISTENERS
  // ========================================================================
  useEffect(() => {
    onLiveStreamOffer(handleOffer);
    onLiveStreamIceCandidate(handleIceCandidate);
    onLiveStreamEnded(handleStreamEnded);
    onLiveComment(handleNewComment);
    onViewerCountUpdate((data) => setViewerCount(data.count || data.viewerCount || 0));

    return () => {
      offLiveStreamOffer(handleOffer);
      offLiveStreamIceCandidate(handleIceCandidate);
      offLiveStreamEnded(handleStreamEnded);
      offLiveComment(handleNewComment);
      offViewerCountUpdate(() => {});
    };
  }, [handleOffer, handleIceCandidate, handleStreamEnded, handleNewComment]);

  // ========================================================================
  // INITIALIZE
  // ========================================================================
  useEffect(() => {
    // Check auth
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    setCurrentUser(JSON.parse(userData));

    // Load stream and join if it's live
    fetchStreamDetails().then((isLive) => {
      if (isLive) {
        joinStream();
      }
    });

    // Handle fullscreen change
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      // Cleanup
      emitLeaveLiveStream(streamId);
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [streamId]);

  // ========================================================================
  // LOADING STATE
  // ========================================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading stream...</p>
        </div>
      </div>
    );
  }

  // ========================================================================
  // ERROR STATE
  // ========================================================================
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-foreground">Oops!</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push('/live')}>Back to Live</Button>
        </div>
      </div>
    );
  }

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      <div className="h-screen flex flex-col lg:flex-row">
        {/* ============================================================
                    VIDEO SECTION
                    ============================================================ */}
        <div className="flex-1 relative flex flex-col">
          {/* Video Area */}
          <div className="flex-1 relative bg-black">
            {/* Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isMuted}
              className="w-full h-full object-cover"
              onClick={toggleMute}
            />

            {/* Connection Status Overlay */}
            <ConnectionStatus state={connectionState} />

            {/* Top Overlay - Back, Status, Viewers */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center justify-between">
                {/* Left - Back & Live Badge */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-black/40 hover:bg-black/60"
                    onClick={leaveStream}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>

                  <Badge className="bg-red-600 text-white border-0 px-3 py-1.5 animate-live-pulse animate-live-glow">
                    <span className="relative flex h-2.5 w-2.5 mr-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                    </span>
                    LIVE
                  </Badge>

                  <StreamDuration startedAt={stream?.startedAt} />
                </div>

                {/* Right - Viewers & Actions */}
                <div className="flex items-center gap-2">
                  <div className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span className="font-medium">{viewerCount}</span>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-black/40 hover:bg-black/60"
                    onClick={shareStream}
                  >
                    <Share2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Floating Hearts */}
            <FloatingHearts hearts={floatingHearts} />

            {/* Pinned Comment */}
            {pinnedComment && (
              <div className="absolute left-4 bottom-4 max-w-xs bg-black/70 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <Pin className="h-3 w-3 text-primary" />
                  <span className="text-xs text-primary font-medium">Pinned by host</span>
                </div>
                <p className="text-sm text-white">{pinnedComment.text}</p>
              </div>
            )}

            {/* Bottom Overlay - Streamer Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-end justify-between">
                {/* Streamer Info */}
                <div className="flex items-center gap-3">
                  {/* Avatar with Instagram-style live ring */}
                  <div className="p-[3px] rounded-full live-avatar-ring">
                    <div className="p-[2px] rounded-full bg-black">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={stream?.streamer?.profilePicture} />
                        <AvatarFallback>{stream?.streamer?.fullName?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-white">{stream?.title}</h2>
                    <p className="text-sm text-white/80">
                      {stream?.streamer?.fullName}
                      <span className="text-white/60 ml-2">@{stream?.streamer?.username}</span>
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* Heart/Reaction Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 hover:scale-110 transition-transform"
                    onClick={sendReaction}
                  >
                    <Heart className="h-6 w-6 text-red-500" />
                  </Button>

                  {/* Mute Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20"
                    onClick={toggleMute}
                  >
                    {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                  </Button>

                  {/* Fullscreen Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-6 w-6" />
                    ) : (
                      <Maximize2 className="h-6 w-6" />
                    )}
                  </Button>

                  {/* Toggle Comments */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-12 w-12 rounded-full lg:hidden',
                      showComments ? 'bg-primary/20' : 'bg-white/10'
                    )}
                    onClick={() => setShowComments(!showComments)}
                  >
                    <MessageCircle className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================
                    CHAT SECTION - Right Sidebar
                    ============================================================ */}
        {showComments && (
          <div
            className={cn(
              'w-full lg:w-96 bg-card border-l border-border flex flex-col',
              'fixed lg:relative bottom-0 left-0 right-0 lg:bottom-auto lg:left-auto lg:right-auto',
              'h-[50vh] lg:h-full',
              'rounded-t-2xl lg:rounded-none'
            )}
          >
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2 text-foreground">
                <MessageCircle className="h-5 w-5 text-primary" />
                Live Chat
                <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                  {comments.length}
                </Badge>
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
                    <p className="text-muted-foreground text-sm">No comments yet. Say hi!</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment._id} className="flex items-start gap-3 group">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={comment.user.profilePicture} />
                        <AvatarFallback className="text-xs">
                          {comment.user.fullName?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {comment.user.fullName}
                          </span>
                          {comment.userId === stream?.streamerId && (
                            <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0">
                              Host
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground break-words">{comment.text}</p>
                      </div>
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
                  placeholder="Say something..."
                  onKeyPress={(e) => e.key === 'Enter' && sendComment()}
                  className="bg-muted border-border focus:border-primary"
                />
                <Button
                  onClick={sendComment}
                  disabled={!commentText.trim()}
                  size="icon"
                  className="flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS for floating hearts animation */}
      <style jsx global>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(0deg);
          }
          25% {
            transform: translateY(-50px) scale(1.1) rotate(-10deg);
          }
          50% {
            transform: translateY(-100px) scale(1.2) rotate(10deg);
          }
          75% {
            opacity: 0.5;
            transform: translateY(-150px) scale(1) rotate(-5deg);
          }
          100% {
            opacity: 0;
            transform: translateY(-200px) scale(0.8) rotate(0deg);
          }
        }
        .animate-float-up {
          animation: float-up 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
