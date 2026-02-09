'use client';

/**
 * ============================================================================
 * INSTAGRAM-LIKE LIVE STREAMS PAGE
 * ============================================================================
 *
 * This is the main Live Streams discovery page - the central hub for all
 * live streaming activity. It mirrors Instagram's Live feature with:
 *
 * FEATURES:
 * ---------
 * 1. Following Section: Live streams from people you follow (prioritized)
 * 2. Discover Section: Popular/trending live streams from other users
 * 3. Real-time Updates: Auto-updates when streams start/end
 * 4. Search: Find specific live streams
 * 5. Go Live Button: Quick access to start broadcasting
 *
 * ARCHITECTURE OVERVIEW:
 * ----------------------
 * The live streaming system uses a three-tier architecture:
 *
 * 1. REST API Layer (HTTP):
 *    - Create/manage stream metadata
 *    - Fetch stream lists
 *    - Join/leave stream tracking
 *    - Handle thumbnails and stream info
 *
 * 2. WebSocket Layer (Socket.io):
 *    - Real-time notifications (stream started/ended)
 *    - Live comments
 *    - Viewer count updates
 *    - Reactions/hearts
 *    - WebRTC signaling (offer/answer/ICE candidates)
 *
 * 3. WebRTC Layer:
 *    - Peer-to-peer video/audio streaming
 *    - Broadcaster → Multiple Viewers (1-to-N topology)
 *    - STUN/TURN servers for NAT traversal
 *
 * DATA FLOW FOR GOING LIVE:
 * -------------------------
 * 1. User clicks "Go Live" → navigates to /live/create
 * 2. User fills stream details → POST /api/v1/live/create
 * 3. Backend creates LiveStream doc with status: 'waiting'
 * 4. User navigates to /live/broadcast/[streamId]
 * 5. Browser requests camera/mic access
 * 6. User clicks "Start" → POST /api/v1/live/start/:streamId
 * 7. Socket emits 'startLiveStream' → notifies all followers
 * 8. When viewer joins → WebRTC peer connection established
 *
 * DATA FLOW FOR WATCHING:
 * -----------------------
 * 1. Viewer clicks on stream card → navigates to /live/watch/[streamId]
 * 2. GET /api/v1/live/:streamId → fetch stream details
 * 3. POST /api/v1/live/join/:streamId → register as viewer
 * 4. Socket emits 'joinLiveStream' → join stream room
 * 5. Broadcaster receives 'viewerJoined' event
 * 6. Broadcaster creates RTCPeerConnection for new viewer
 * 7. Broadcaster sends WebRTC offer via socket
 * 8. Viewer receives offer → creates answer → sends back
 * 9. ICE candidates exchanged → connection established
 * 10. Video stream flows via WebRTC
 *
 * ============================================================================
 */

import Navigation from '@/components/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { authService, liveStreamService } from '@/lib/api-services';
import {
  offLiveStreamEnded,
  offLiveStreamStarted,
  onLiveStreamEnded,
  onLiveStreamStarted,
} from '@/lib/socket';
import { cn } from '@/lib/utils';
import { LiveStream } from '@/types/live';
import { formatDistanceToNow } from 'date-fns';
import { Clock, Eye, Flame, Heart, Radio, Search, Sparkles, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

/**
 * ============================================================================
 * LIVE STREAM CARD COMPONENT
 * ============================================================================
 *
 * A visually rich card that displays a single live stream with Instagram-like
 * styling. This component is responsible for:
 *
 * Visual Elements:
 * - Thumbnail/preview with gradient overlay
 * - Live badge with pulse animation (red dot)
 * - Viewer count with eye icon
 * - Stream duration
 * - Streamer avatar with gradient ring (Instagram's signature style)
 * - Stream title and streamer info
 *
 * Interactions:
 * - Hover: Scale up animation, show "Watch Now" overlay
 * - Click: Navigate to watch page
 *
 * Props:
 * - stream: LiveStream object with all stream data
 * - onClick: Function to call when card is clicked
 * - variant: 'default' | 'featured' | 'compact' for different sizes
 */
interface LiveStreamCardProps {
  stream: LiveStream;
  onClick: () => void;
  variant?: 'default' | 'featured' | 'compact';
}

const LiveStreamCard = ({ stream, onClick, variant = 'default' }: LiveStreamCardProps) => {
  const isFeatured = variant === 'featured';
  const isCompact = variant === 'compact';

  return (
    <div
      onClick={onClick}
      className={cn(
        'group cursor-pointer transition-all duration-300',
        isFeatured && 'md:col-span-2 md:row-span-2'
      )}
    >
      <Card
        className={cn(
          'overflow-hidden border-border bg-card',
          'hover:ring-2 hover:ring-primary/50 hover:shadow-xl hover:shadow-primary/10',
          'transition-all duration-300 transform hover:scale-[1.02]'
        )}
      >
        <div
          className={cn(
            'relative overflow-hidden',
            isFeatured ? 'aspect-[16/10]' : isCompact ? 'aspect-square' : 'aspect-video'
          )}
        >
          {stream.thumbnail ? (
            <img
              src={stream.thumbnail}
              alt={stream.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-pink-900/50">
              <Video className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute top-3 left-3 flex items-center gap-2">
            <Badge className="bg-gradient-to-r from-red-600 to-pink-600 text-white border-0 px-3 py-1 shadow-lg">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              LIVE
            </Badge>
          </div>

          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-white/10">
            <Eye className="h-3.5 w-3.5" />
            {formatViewerCount(stream.viewerCount || 0)}
          </div>

          {stream.startedAt && (
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-white/10">
              <Clock className="h-3.5 w-3.5" />
              {formatDistanceToNow(new Date(stream.startedAt), { addSuffix: false })}
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Button className="bg-white text-black hover:bg-white/90 gap-2 shadow-2xl">
              <Radio className="h-4 w-4" />
              Watch Now
            </Button>
          </div>
        </div>

        <CardContent className="p-4 bg-card">
          <div className="flex items-start gap-3">
            {/*
             * Streamer Avatar with Instagram-style Gradient Ring
             * The ring indicates the user is live
             */}
            <div className="relative flex-shrink-0">
              <div className="p-0.5 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
                {stream.streamer?.profilePicture ? (
                  <img
                    src={stream.streamer.profilePicture}
                    alt={stream.streamer.username}
                    className="w-10 h-10 rounded-full border-2 border-background object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-background flex items-center justify-center text-white text-sm font-bold">
                    {stream.streamer?.fullName?.[0] || 'U'}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                {stream.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">{stream.streamer?.fullName}</p>
              <p className="text-xs text-muted-foreground/70">@{stream.streamer?.username}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Format viewer count for compact display
 *
 * @param count - Raw viewer count number
 * @returns Formatted string (e.g., "1.5K", "2.3M")
 *
 * Examples:
 * - 999 → "999"
 * - 1500 → "1.5K"
 * - 1500000 → "1.5M"
 */
function formatViewerCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace('.0', '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace('.0', '') + 'K';
  }
  return count.toString();
}

/**
 * ============================================================================
 * MAIN LIVE PAGE COMPONENT
 * ============================================================================
 *
 * The primary component for the Live Streams discovery page.
 *
 * STATE MANAGEMENT:
 * -----------------
 * - user: Current authenticated user
 * - activeLiveStreams: Streams from followed users (priority display)
 * - allLiveStreams: All public live streams for discovery
 * - loading: Initial load state
 * - searchQuery: For filtering streams
 *
 * REAL-TIME UPDATES:
 * ------------------
 * - 'liveStreamStarted': Fired when a followed user goes live
 *   → Triggers refetch to add new stream
 * - 'liveStreamEnded': Fired when any stream ends
 *   → Removes stream from both lists
 * - Auto-refresh: Every 30 seconds to catch any missed updates
 *
 * SOCKET ROOM MEMBERSHIP:
 * -----------------------
 * When user is authenticated, they automatically join their user ID room.
 * This allows receiving notifications for followed users going live.
 */
export default function LivePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeLiveStreams, setActiveLiveStreams] = useState<LiveStream[]>([]);
  const [allLiveStreams, setAllLiveStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Fetch all live streams from the API
   * -----------------------------------
   * Makes two parallel requests:
   *
   * 1. getActiveLiveStreams:
   *    GET /api/v1/live/active
   *    Returns only streams from users the current user follows
   *    Backend query: { streamerId: { $in: followingIds }, status: 'live' }
   *
   * 2. getAllLiveStreams:
   *    GET /api/v1/live/all
   *    Returns all public live streams sorted by viewer count
   *    Used for the "Discover" section
   */
  const fetchLiveStreams = useCallback(async () => {
    try {
      const [followedResponse, allResponse] = await Promise.all([
        liveStreamService.getActiveLiveStreams({ limit: 20 }),
        liveStreamService.getAllLiveStreams({ limit: 50 }),
      ]);

      if (followedResponse.success) {
        const validStreams = (followedResponse.data || []).filter((s: LiveStream) => s.streamer);
        setActiveLiveStreams(validStreams);
      }

      if (allResponse.success) {
        const liveStreams = allResponse.data?.liveStreams || allResponse.data || [];
        const validStreams = liveStreams.filter((s: LiveStream) => s.streamer);
        setAllLiveStreams(validStreams);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Handle real-time notification when a followed user starts streaming
   *
   * Socket Event: 'liveStreamStarted'
   * Payload: { streamId, streamerId, streamerName, title, thumbnail }
   *
   * Action: Refetch streams to get complete stream data with populated fields
   */
  const handleStreamStarted = useCallback(
    (data: any) => {
      fetchLiveStreams();
    },
    [fetchLiveStreams]
  );

  /**
   * Handle real-time notification when a stream ends
   *
   * Socket Event: 'liveStreamEnded'
   * Payload: { streamId, endedAt, reason? }
   *
   * Action: Remove the stream from both lists immediately
   */
  const handleStreamEnded = useCallback((data: any) => {
    const { streamId } = data;
    setActiveLiveStreams((prev) => prev.filter((s) => s._id !== streamId));
    setAllLiveStreams((prev) => prev.filter((s) => s._id !== streamId));
  }, []);

  /**
   * Initialize component and setup real-time listeners
   *
   * Lifecycle:
   * 1. Check authentication (redirect to login if not authenticated)
   * 2. Parse user data from localStorage
   * 3. Initial fetch of live streams
   * 4. Setup socket event listeners
   * 5. Setup 30-second refresh interval
   *
   * Cleanup:
   * - Remove socket listeners
   * - Clear refresh interval
   */
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userData));
    fetchLiveStreams();

    onLiveStreamStarted(handleStreamStarted);
    onLiveStreamEnded(handleStreamEnded);

    const refreshInterval = setInterval(fetchLiveStreams, 30000);

    return () => {
      offLiveStreamStarted(handleStreamStarted);
      offLiveStreamEnded(handleStreamEnded);
      clearInterval(refreshInterval);
    };
  }, [router, fetchLiveStreams, handleStreamStarted, handleStreamEnded]);

  /**
   * Handle user logout
   * Clears all auth data and redirects to login
   */
  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (err) {
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.push('/login');
    }
  };

  /**
   * Navigate to Go Live setup page
   * This takes user through the pre-live flow:
   * 1. Enter stream title/description
   * 2. Optionally upload thumbnail
   * 3. Create stream (status: 'waiting')
   * 4. Navigate to broadcast page for camera preview
   */
  const handleGoLive = () => {
    router.push('/live/create');
  };

  /**
   * Navigate to watch a specific stream
   * @param streamId - The ID of the stream to watch
   */
  const handleJoinStream = (streamId: string) => {
    router.push(`/live/watch/${streamId}`);
  };

  const filteredAllStreams = allLiveStreams.filter(
    (stream) =>
      stream.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stream.streamer?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stream.streamer?.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) return null;

  return (
    <main className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        <section className="lg:col-span-3 pb-20 lg:pb-0">
          <div className="container mx-auto px-4 py-6 max-w-4xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3 text-foreground">
                  <div className="relative">
                    <Radio className="h-8 w-8 text-red-500" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                  </div>
                  Live
                </h1>
                <p className="text-muted-foreground mt-1">
                  Watch live broadcasts from people you follow
                </p>
              </div>

              <Button
                onClick={handleGoLive}
                size="lg"
                className="gap-2 bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 hover:from-red-700 hover:via-pink-700 hover:to-purple-700 shadow-lg shadow-red-500/25 transition-all duration-300 hover:shadow-red-500/40 hover:scale-105"
              >
                <Video className="h-5 w-5" />
                Go Live
              </Button>
            </div>

            <div className="relative mb-8">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search live streams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted border-border focus:border-primary/50 h-11"
              />
            </div>

            {loading ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i} className="overflow-hidden bg-card border-border">
                      <Skeleton className="aspect-video bg-muted" />
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-10 h-10 rounded-full bg-muted" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4 bg-muted" />
                            <Skeleton className="h-3 w-1/2 bg-muted" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {/*
                 * FOLLOWING SECTION
                 * Shows streams from users the current user follows
                 * Displayed as a horizontal scroll for quick access
                 */}
                {activeLiveStreams.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Heart className="h-5 w-5 text-red-500" />
                      <h2 className="text-xl font-semibold">Following</h2>
                      <Badge variant="secondary" className="bg-red-500/20 text-red-400 border-0">
                        {activeLiveStreams.length} Live
                      </Badge>
                    </div>

                    <ScrollArea className="w-full whitespace-nowrap pb-4">
                      <div className="flex gap-4">
                        {activeLiveStreams.map((stream, index) => (
                          <div key={stream._id} className="w-[300px] flex-shrink-0">
                            <LiveStreamCard
                              stream={stream}
                              onClick={() => handleJoinStream(stream._id)}
                              variant={index === 0 ? 'featured' : 'default'}
                            />
                          </div>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </section>
                )}

                {/*
                 * DISCOVER SECTION
                 * Shows all public live streams for discovery
                 * Displayed in a grid layout
                 */}
                {filteredAllStreams.length > 0 ? (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Flame className="h-5 w-5 text-orange-500" />
                      <h2 className="text-xl font-semibold">Discover</h2>
                      <Badge
                        variant="secondary"
                        className="bg-orange-500/20 text-orange-400 border-0"
                      >
                        {filteredAllStreams.length} Streaming
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredAllStreams.map((stream) => (
                        <LiveStreamCard
                          key={stream._id}
                          stream={stream}
                          onClick={() => handleJoinStream(stream._id)}
                        />
                      ))}
                    </div>
                  </section>
                ) : (
                  <Card className="text-center py-16 bg-card border-border border-dashed">
                    <CardContent>
                      <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Radio className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <h3 className="text-2xl font-bold mb-2 text-foreground">No Live Streams</h3>
                      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        {searchQuery
                          ? `No live streams found for "${searchQuery}"`
                          : 'No one is currently live. Be the first to start streaming and connect with your audience!'}
                      </p>
                      <Button
                        onClick={handleGoLive}
                        size="lg"
                        className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      >
                        <Sparkles className="h-5 w-5" />
                        Start Your Live Stream
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <Navigation user={user} onLogout={handleLogout} isMobile={true} />
    </main>
  );
}
