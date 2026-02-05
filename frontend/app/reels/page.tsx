'use client';

import Navigation from '@/components/navigation';
import ReelCommentsModal from '@/components/reel-comments-modal';
import ShareModal from '@/components/share-modal';
import UserAvatar from '@/components/user-avatar';
import { feedService, reelService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Play,
  Send,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Reel {
  _id: string;
  media: {
    url: string;
    thumbnail: string;
    duration: number;
    width: number;
    height: number;
  };
  user_id: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  caption: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  isLiked?: boolean;
  is_deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ReelsPage() {
  const [user, setUser] = useState<any>(null);
  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [likedReels, setLikedReels] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [savedReels, setSavedReels] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reelContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
    } else {
      setUser(JSON.parse(userData));
    }
  }, [router]);

  useEffect(() => {
    const fetchReels = async () => {
      try {
        setLoading(true);
        const response = await feedService.getReelsFeed({ page: 1, limit: 20 });
        if (response.success && response.data) {
          setReels(response.data.reels || []);

          // Set initial liked state based on reel data (check both snake_case and camelCase)
          const likedReelsFromAPI = response.data.reels
            .filter((reel: any) => reel.isLiked || reel.is_liked)
            .map((reel: any) => reel._id);
          setLikedReels(likedReelsFromAPI);
        } else {
          setError('Failed to load reels');
        }
      } catch (err) {
        setError('Error loading reels');
        console.error('Error fetching reels:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchReels();
    }
  }, [user]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, currentReelIndex]);

  // Scroll snap functionality
  useEffect(() => {
    const handleScroll = () => {
      if (!reelContainerRef.current) return;

      const scrollTop = reelContainerRef.current.scrollTop;
      const containerHeight = reelContainerRef.current.clientHeight;
      const newIndex = Math.round(scrollTop / containerHeight);

      if (newIndex !== currentReelIndex && newIndex >= 0 && newIndex < reels.length) {
        setCurrentReelIndex(newIndex);
        setIsPlaying(true);
      }
    };

    const container = reelContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [currentReelIndex, reels.length]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  const currentReel = reels[currentReelIndex];
  const isLiked = likedReels.includes(currentReel?._id);
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async () => {
    if (!currentReel || isLiking) return;

    setIsLiking(true);
    const wasLiked = isLiked;
    const previousLikedReels = [...likedReels];
    const previousReels = [...reels];

    // Optimistic update
    if (wasLiked) {
      setLikedReels(likedReels.filter((id) => id !== currentReel._id));
      setReels(
        reels.map((reel) =>
          reel._id === currentReel._id
            ? { ...reel, likes_count: Math.max(0, (reel.likes_count || 1) - 1) }
            : reel
        )
      );
    } else {
      setLikedReels([...likedReels, currentReel._id]);
      setReels(
        reels.map((reel) =>
          reel._id === currentReel._id
            ? { ...reel, likes_count: (reel.likes_count || 0) + 1 }
            : reel
        )
      );
    }

    try {
      const response = await reelService.toggleLikeReel(currentReel._id);

      if (response.success) {
        // Use server response to sync state
        if (response.data.isLiked) {
          setLikedReels((prev) =>
            prev.includes(currentReel._id) ? prev : [...prev, currentReel._id]
          );
        } else {
          setLikedReels((prev) => prev.filter((id) => id !== currentReel._id));
        }
        // Update the reel's like count from server
        setReels((prev) =>
          prev.map((reel) =>
            reel._id === currentReel._id
              ? {
                  ...reel,
                  likes_count: response.data.likes_count ?? reel.likes_count,
                  isLiked: response.data.isLiked,
                }
              : reel
          )
        );
      } else {
        // Revert on failure
        setLikedReels(previousLikedReels);
        setReels(previousReels);
        console.error('API returned error:', response.message);
      }
    } catch (error) {
      // Revert on error
      setLikedReels(previousLikedReels);
      setReels(previousReels);
      console.error('Error toggling like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handlePrevious = () => {
    const newIndex = currentReelIndex === 0 ? reels.length - 1 : currentReelIndex - 1;
    setCurrentReelIndex(newIndex);
    setIsPlaying(true);

    // Scroll to the reel
    if (reelContainerRef.current) {
      reelContainerRef.current.scrollTo({
        top: newIndex * reelContainerRef.current.clientHeight,
        behavior: 'smooth',
      });
    }
  };

  const handleNext = () => {
    const newIndex = currentReelIndex === reels.length - 1 ? 0 : currentReelIndex + 1;
    setCurrentReelIndex(newIndex);
    setIsPlaying(true);

    // Scroll to the reel
    if (reelContainerRef.current) {
      reelContainerRef.current.scrollTo({
        top: newIndex * reelContainerRef.current.clientHeight,
        behavior: 'smooth',
      });
    }
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="grid grid-cols-1 lg:grid-cols-4">
          <aside className="hidden lg:block lg:col-span-1 sticky top-0 h-screen border-r border-border p-4 overflow-y-auto">
            {user && <Navigation user={user} onLogout={handleLogout} />}
          </aside>
          <section className="lg:col-span-2 flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading reels...</p>
            </div>
          </section>
          <aside className="hidden lg:block lg:col-span-1 h-screen sticky top-0 border-l border-border"></aside>
        </div>
        <Navigation user={user} onLogout={handleLogout} isMobile={true} />
      </main>
    );
  }

  if (error || reels.length === 0) {
    return (
      <main className="min-h-screen bg-background">
        <div className="grid grid-cols-1 lg:grid-cols-4">
          <aside className="hidden lg:block lg:col-span-1 sticky top-0 h-screen border-r border-border p-4 overflow-y-auto">
            {user && <Navigation user={user} onLogout={handleLogout} />}
          </aside>
          <section className="lg:col-span-2 flex items-center justify-center h-screen pb-24 lg:pb-0">
            <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-sm mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Video className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">No Reels Available</h2>
              <p className="text-muted-foreground mb-6 text-sm">
                {error || 'Check back later for new content'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          </section>
          <aside className="hidden lg:block lg:col-span-1 h-screen sticky top-0 border-l border-border"></aside>
        </div>
        <Navigation user={user} onLogout={handleLogout} isMobile={true} />
      </main>
    );
  }

  if (!user || !currentReel) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        <section className="lg:col-span-2 max-w-2xl mx-auto pb-20 lg:pb-0">
          <div className="bg-card rounded-2xl border border-border p-4 mb-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <Video className="w-6 h-6" />
              <h1 className="text-lg font-semibold">Reels</h1>
            </div>
          </div>

          <div
            ref={reelContainerRef}
            className="h-[calc(100vh-80px)] overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
          >
            {reels.map((reel, index) => (
              <div
                key={reel._id}
                className="snap-start snap-always h-[calc(100vh-80px)] flex items-center justify-center py-4"
              >
                <div className="max-w-sm w-full mx-auto px-4">
                  <div className="relative bg-black rounded-2xl overflow-hidden aspect-[9/16] max-h-[75vh] mx-auto shadow-xl">
                    {index === currentReelIndex && (
                      <video
                        ref={videoRef}
                        src={getMediaUrl(reel.media.url)}
                        poster={getMediaUrl(reel.media.thumbnail)}
                        className="w-full h-full object-cover"
                        loop
                        playsInline
                        autoPlay
                        muted={isMuted}
                        onClick={togglePlayPause}
                      />
                    )}

                    {index !== currentReelIndex && (
                      <div
                        className="w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${getMediaUrl(reel.media.thumbnail)})` }}
                      />
                    )}

                    {/* Play/Pause Overlay */}
                    {index === currentReelIndex && !isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <button
                          onClick={togglePlayPause}
                          className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition text-white"
                        >
                          <Play size={48} fill="white" />
                        </button>
                      </div>
                    )}

                    {/* Video Controls */}
                    {index === currentReelIndex && (
                      <button
                        onClick={toggleMute}
                        className="absolute top-4 right-4 p-2.5 rounded-full bg-black/40 hover:bg-black/60 transition text-white z-10 backdrop-blur-sm"
                      >
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                    )}

                    {/* Bottom gradient overlay */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />

                    <div className="absolute bottom-4 left-4 right-16 z-10">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white">
                          <UserAvatar user={reel.user_id} size="lg" />
                        </div>
                        <div className="text-white">
                          <p className="font-semibold text-sm">
                            {reel.user_id.firstName} {reel.user_id.lastName}
                          </p>
                        </div>
                        {user?._id !== reel.user_id._id && (
                          <button className="ml-2 px-3 py-1 border border-white/80 rounded text-white text-xs font-medium hover:bg-white/20 transition">
                            Follow
                          </button>
                        )}
                      </div>
                      {reel.caption && (
                        <p className="text-white text-sm line-clamp-2">{reel.caption}</p>
                      )}
                    </div>

                    <div className="absolute right-2 bottom-6 flex flex-col items-center gap-3 z-10">
                      <button
                        onClick={index === currentReelIndex ? handleLike : undefined}
                        className="flex flex-col items-center cursor-pointer"
                      >
                        <Heart
                          size={26}
                          className={
                            isLiked && index === currentReelIndex ? 'text-red-500' : 'text-white'
                          }
                          fill={isLiked && index === currentReelIndex ? 'currentColor' : 'none'}
                        />
                        <span className="text-white text-[11px] mt-0.5">{reel.likes_count}</span>
                      </button>

                      <button
                        onClick={() => {
                          if (index === currentReelIndex) {
                            setShowComments(true);
                          }
                        }}
                        className="flex flex-col items-center cursor-pointer"
                      >
                        <MessageCircle size={26} className="text-white" />
                        <span className="text-white text-[11px] mt-0.5">{reel.comments_count}</span>
                      </button>

                      <button
                        onClick={() => {
                          if (index === currentReelIndex) {
                            setShowShare(true);
                          }
                        }}
                        className="flex flex-col items-center cursor-pointer"
                      >
                        <Send size={24} className="text-white" />
                      </button>

                      <button
                        onClick={() => {
                          if (index === currentReelIndex) {
                            const isSaved = savedReels.includes(reel._id);
                            if (isSaved) {
                              setSavedReels(savedReels.filter((id) => id !== reel._id));
                              reelService.unsaveReel(reel._id).catch(() => {});
                            } else {
                              setSavedReels([...savedReels, reel._id]);
                              reelService.saveReel(reel._id).catch(() => {});
                            }
                          }
                        }}
                        className="flex flex-col items-center cursor-pointer"
                      >
                        <Bookmark
                          size={26}
                          className="text-white"
                          fill={savedReels.includes(reel._id) ? 'currentColor' : 'none'}
                        />
                      </button>

                      <div className="w-7 h-7 rounded border-2 border-white overflow-hidden mt-1">
                        <UserAvatar user={reel.user_id} size="sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Arrows */}
          <div className="fixed right-4 lg:right-auto lg:left-1/2 lg:-translate-x-1/2 lg:ml-64 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30">
            <button
              onClick={handlePrevious}
              className="p-3 rounded-full bg-card shadow-lg hover:scale-110 transition cursor-pointer border border-border"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 hover:bg-primary/90 transition cursor-pointer"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Dots */}
          <div className="fixed bottom-28 lg:bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 bg-black/30 rounded-full px-3 py-2">
            {reels.slice(0, 10).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentReelIndex ? 'bg-white w-6' : 'bg-white/50 w-1.5'
                }`}
              />
            ))}
            {reels.length > 10 && (
              <span className="text-white/70 text-xs ml-1">+{reels.length - 10}</span>
            )}
          </div>
        </section>

        {/* Right Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 border-l border-border p-4 h-screen sticky top-0 overflow-y-auto">
          <div className="bg-card rounded-2xl border border-border p-4 mb-4">
            <h3 className="font-bold text-lg mb-4">Suggested Creators</h3>
            <div className="space-y-4">
              {[
                { name: '@creative_hub', followers: '125K', avatar: '🎨' },
                { name: '@design_pro', followers: '89K', avatar: '✨' },
                { name: '@studio_art', followers: '67K', avatar: '🎬' },
                { name: '@videographer', followers: '45K', avatar: '📹' },
              ].map((creator, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 hover:opacity-80 transition cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                      {creator.avatar}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm truncate max-w-[100px]">
                        {creator.name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {creator.followers} followers
                      </span>
                    </div>
                  </div>
                  <button className="text-primary text-xs font-bold hover:underline">Follow</button>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Sounds */}
          <div className="bg-card rounded-2xl border border-border p-4 sticky top-0">
            <h3 className="font-bold text-lg mb-4">Trending Sounds</h3>
            <div className="space-y-3">
              {['Summer Vibes - 12K reels', 'Dance Mix - 8K reels', 'Chill Beats - 5K reels'].map(
                (sound, i) => (
                  <div key={i} className="p-3 hover:bg-muted rounded-lg cursor-pointer transition">
                    <p className="text-primary font-semibold">🎵 {sound.split(' - ')[0]}</p>
                    <p className="text-sm text-muted-foreground">{sound.split(' - ')[1]}</p>
                  </div>
                )
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      {/* Comment Modal */}
      <ReelCommentsModal
        open={showComments}
        onOpenChange={setShowComments}
        reelId={currentReel._id}
        commentsCount={currentReel.comments_count}
        currentUserId={user._id}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        contentType="reel"
        contentId={currentReel._id}
      />

      {/* Hide scrollbar */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </main>
  );
}
