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
    Loader2,
    MessageCircle,
    Play,
    Send,
    Video,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  music?: {
    trackId?: string;
    trackName?: string;
    artistName?: string;
    albumArt?: string;
    previewUrl?: string;
    startTime?: number;
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
  const [readyReels, setReadyReels] = useState<Set<string>>(new Set());
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const audioRef = useRef<HTMLAudioElement>(null);
  const reelContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Only render video for current reel and 2 adjacent — preloads next for instant swipe
  const shouldRenderVideo = useCallback(
    (index: number) => index >= currentReelIndex - 1 && index <= currentReelIndex + 2,
    [currentReelIndex]
  );

  const setVideoRef = useCallback((index: number, el: HTMLVideoElement | null) => {
    if (el) {
      videoRefs.current.set(index, el);
    } else {
      videoRefs.current.delete(index);
    }
  }, []);

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
          const likedReelsFromAPI = response.data.reels
            .filter((reel: any) => reel.isLiked || reel.is_liked)
            .map((reel: any) => reel._id);
          setLikedReels(likedReelsFromAPI);
        } else {
          setError('Failed to load reels');
        }
      } catch (err) {
        setError('Error loading reels');
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchReels();
  }, [user]);

  // Play current, pause others
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (index === currentReelIndex) {
        video.muted = isMuted;
        if (isPlaying) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      } else {
        video.pause();
        video.muted = true;
        if (Math.abs(index - currentReelIndex) > 1) {
          video.currentTime = 0;
        }
      }
    });
  }, [isPlaying, currentReelIndex, isMuted]);

  // Scroll snap detection (debounced to avoid state thrashing during fast scrolls)
  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (!reelContainerRef.current) return;
        const scrollTop = reelContainerRef.current.scrollTop;
        const containerHeight = reelContainerRef.current.clientHeight;
        const newIndex = Math.round(scrollTop / containerHeight);
        if (newIndex !== currentReelIndex && newIndex >= 0 && newIndex < reels.length) {
          setCurrentReelIndex(newIndex);
          setIsPlaying(true);
        }
      }, 100); // 100ms debounce — fast enough to feel instant, prevents thrashing
    };
    const container = reelContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        container.removeEventListener('scroll', handleScroll);
        if (scrollTimer) clearTimeout(scrollTimer);
      };
    }
  }, [currentReelIndex, reels.length]);

  // Music sync
  useEffect(() => {
    const video = videoRefs.current.get(currentReelIndex);
    const audio = audioRef.current;
    if (!video || !audio) return;
    const currentReelData = reels[currentReelIndex];
    if (!currentReelData?.music?.previewUrl) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }
    audio.src = currentReelData.music.previewUrl;
    audio.currentTime = currentReelData.music.startTime || 0;
    let prevTime = 0;
    const onPlay = () => audio.play().catch(() => {});
    const onPause = () => audio.pause();
    const onTimeUpdate = () => {
      if (video.currentTime < prevTime - 1) {
        audio.currentTime = currentReelData.music?.startTime || 0;
      }
      prevTime = video.currentTime;
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    if (!video.paused) audio.play().catch(() => {});
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      audio.pause();
    };
  }, [currentReelIndex, reels]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted;
  }, [isMuted]);

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
    if (wasLiked) {
      setLikedReels(likedReels.filter((id) => id !== currentReel._id));
      setReels(reels.map((r) => (r._id === currentReel._id ? { ...r, likes_count: Math.max(0, (r.likes_count || 1) - 1) } : r)));
    } else {
      setLikedReels([...likedReels, currentReel._id]);
      setReels(reels.map((r) => (r._id === currentReel._id ? { ...r, likes_count: (r.likes_count || 0) + 1 } : r)));
    }
    try {
      const response = await reelService.toggleLikeReel(currentReel._id);
      if (response.success) {
        if (response.data.isLiked) {
          setLikedReels((prev) => (prev.includes(currentReel._id) ? prev : [...prev, currentReel._id]));
        } else {
          setLikedReels((prev) => prev.filter((id) => id !== currentReel._id));
        }
        setReels((prev) =>
          prev.map((r) =>
            r._id === currentReel._id
              ? { ...r, likes_count: response.data.likes_count ?? r.likes_count, isLiked: response.data.isLiked }
              : r
          )
        );
      } else {
        setLikedReels(previousLikedReels);
        setReels(previousReels);
      }
    } catch {
      setLikedReels(previousLikedReels);
      setReels(previousReels);
    } finally {
      setIsLiking(false);
    }
  };

  const scrollToIndex = (index: number) => {
    setCurrentReelIndex(index);
    setIsPlaying(true);
    if (reelContainerRef.current) {
      reelContainerRef.current.scrollTo({
        top: index * reelContainerRef.current.clientHeight,
        behavior: 'smooth',
      });
    }
  };

  const handlePrevious = () => scrollToIndex(currentReelIndex === 0 ? reels.length - 1 : currentReelIndex - 1);
  const handleNext = () => scrollToIndex(currentReelIndex === reels.length - 1 ? 0 : currentReelIndex + 1);
  const togglePlayPause = () => setIsPlaying(!isPlaying);
  const toggleMute = () => setIsMuted(!isMuted);

  const handleVideoReady = useCallback((reelId: string) => {
    setReadyReels((prev) => {
      const next = new Set(prev);
      next.add(reelId);
      return next;
    });
  }, []);

  // Safety timeout: if video doesn't become ready in 8s, show it anyway (poster/thumbnail visible)
  // Prevents infinite spinner when network is slow or video fails to buffer
  useEffect(() => {
    if (!currentReel || readyReels.has(currentReel._id)) return;
    const timeout = setTimeout(() => {
      handleVideoReady(currentReel._id);
    }, 8000);
    return () => clearTimeout(timeout);
  }, [currentReelIndex, currentReel?._id, readyReels, handleVideoReady]);

  // --- Loading ---
  if (loading) {
    return (
      <main className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading reels...</p>
        </div>
      </main>
    );
  }

  // --- Error / Empty ---
  if (error || reels.length === 0) {
    return (
      <main className="h-screen bg-background flex items-center justify-center">
        <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-sm mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Video className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No Reels Available</h2>
          <p className="text-muted-foreground mb-6 text-sm">{error || 'Check back later for new content'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!user || !currentReel) {
    return <div className="flex items-center justify-center h-screen bg-background text-foreground">Loading...</div>;
  }

  // --- Main Reels UI ---
  return (
    <main className="h-[100dvh] bg-background overflow-hidden">
      <div className="flex h-full">
        {/* Left sidebar — Navigation (desktop) */}
        <aside className="hidden lg:flex lg:flex-col w-[280px] bg-background border-r border-border h-full p-4 overflow-y-auto flex-shrink-0">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Center — Reels feed */}
        <div className="flex-1 flex items-center justify-center relative bg-black lg:bg-background lg:py-2">
          <div
            ref={reelContainerRef}
            className="h-full w-full max-w-full lg:max-w-[360px] lg:aspect-[9/16] lg:h-auto lg:max-h-[calc(100vh-1rem)] overflow-y-scroll snap-y snap-mandatory scrollbar-hide lg:rounded-xl bg-black overflow-hidden"
          >
            {reels.map((reel, index) => {
              const isCurrent = index === currentReelIndex;
              const hasVideo = shouldRenderVideo(index);
              const isReady = readyReels.has(reel._id);

              return (
                <div
                  key={reel._id}
                  className="snap-start snap-always h-full w-full flex-shrink-0 relative bg-black"
                >
                  {/* Thumbnail — always visible as instant background, prevents black */}
                  <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{
                      backgroundImage: `url(${getMediaUrl(reel.media.thumbnail)})`,
                    }}
                  />

                  {/* Video — only for current + 1 adjacent */}
                  {hasVideo && (
                    <video
                      ref={(el) => setVideoRef(index, el)}
                      src={getMediaUrl(reel.media.url)}
                      poster={getMediaUrl(reel.media.thumbnail)}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
                        isCurrent && isReady ? 'opacity-100' : isCurrent ? 'opacity-0' : 'opacity-0'
                      }`}
                      style={{ zIndex: 1 }}
                      loop
                      playsInline
                      autoPlay={isCurrent}
                      muted={isCurrent ? isMuted : true}
                      preload={isCurrent ? 'auto' : 'metadata'}
                      onClick={isCurrent ? togglePlayPause : undefined}
                      onCanPlay={() => handleVideoReady(reel._id)}
                      onLoadedData={() => {
                        handleVideoReady(reel._id);
                        if (isCurrent) {
                          const v = videoRefs.current.get(index);
                          if (v && isPlaying) v.play().catch(() => {});
                        }
                      }}
                      onError={(e) => {
                        // If video fails to load, still mark as ready to remove spinner
                        // and show the thumbnail/poster instead of infinite loading
                        handleVideoReady(reel._id);
                      }}
                      onWaiting={() => {
                        // Video is buffering — could show a subtle indicator
                        // but don't block UI
                      }}
                      onPlaying={() => {
                        // Video resumed after buffering — ensure ready state
                        handleVideoReady(reel._id);
                      }}
                    />
                  )}

                  {/* Loading spinner — current reel only */}
                  {isCurrent && hasVideo && !isReady && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
                      <Loader2 className="w-12 h-12 text-white animate-spin" />
                    </div>
                  )}

                  {/* Pause overlay */}
                  {isCurrent && !isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30" style={{ zIndex: 3 }}>
                      <button onClick={togglePlayPause} className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition text-white">
                        <Play size={48} fill="white" />
                      </button>
                    </div>
                  )}

                  {/* Mute button */}
                  {isCurrent && (
                    <button
                      onClick={toggleMute}
                      className="absolute top-6 right-4 p-2.5 rounded-full bg-black/50 hover:bg-black/70 transition text-white backdrop-blur-sm"
                      style={{ zIndex: 10 }}
                    >
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                  )}

                  {/* Bottom gradient */}
                  <div className="absolute bottom-0 left-0 right-0 h-64 lg:h-44 bg-gradient-to-t from-black/80 to-transparent" style={{ zIndex: 2 }} />

                  {/* User info + caption — bottom left */}
                  <div className="absolute bottom-20 lg:bottom-6 left-4 right-20" style={{ zIndex: 10 }}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white flex-shrink-0">
                        <UserAvatar user={reel.user_id} size="lg" />
                      </div>
                      <div className="text-white min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {reel.user_id.firstName} {reel.user_id.lastName}
                        </p>
                      </div>
                      {user?._id !== reel.user_id._id && (
                        <button className="ml-1 px-3 py-1 border border-white/80 rounded text-white text-xs font-medium hover:bg-white/20 transition flex-shrink-0">
                          Follow
                        </button>
                      )}
                    </div>
                    {reel.caption && <p className="text-white text-sm line-clamp-2">{reel.caption}</p>}
                    {reel.music?.trackName && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-sm animate-pulse">🎵</span>
                        <p className="text-white/80 text-xs truncate">
                          {reel.music.trackName}
                          {reel.music.artistName ? ` · ${reel.music.artistName}` : ''}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right-side action buttons */}
                  <div className="absolute right-3 bottom-44 lg:bottom-28 flex flex-col items-center gap-5" style={{ zIndex: 10 }}>
                    <button onClick={isCurrent ? handleLike : undefined} className="flex flex-col items-center">
                      <Heart
                        size={28}
                        className={isLiked && isCurrent ? 'text-red-500' : 'text-white'}
                        fill={isLiked && isCurrent ? 'currentColor' : 'none'}
                      />
                      <span className="text-white text-[11px] mt-1">{reel.likes_count}</span>
                    </button>

                    <button onClick={() => isCurrent && setShowComments(true)} className="flex flex-col items-center">
                      <MessageCircle size={28} className="text-white" />
                      <span className="text-white text-[11px] mt-1">{reel.comments_count}</span>
                    </button>

                    <button onClick={() => isCurrent && setShowShare(true)} className="flex flex-col items-center">
                      <Send size={26} className="text-white" />
                    </button>

                    <button
                      onClick={() => {
                        if (!isCurrent) return;
                        const isSaved = savedReels.includes(reel._id);
                        if (isSaved) {
                          setSavedReels(savedReels.filter((id) => id !== reel._id));
                          reelService.unsaveReel(reel._id).catch(() => {});
                        } else {
                          setSavedReels([...savedReels, reel._id]);
                          reelService.saveReel(reel._id).catch(() => {});
                        }
                      }}
                      className="flex flex-col items-center"
                    >
                      <Bookmark size={28} className="text-white" fill={savedReels.includes(reel._id) ? 'currentColor' : 'none'} />
                    </button>

                    <div className="w-8 h-8 rounded-md border-2 border-white overflow-hidden">
                      <UserAvatar user={reel.user_id} size="sm" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Up/Down nav buttons */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex-col gap-2 z-20 hidden lg:flex">
            <button
              onClick={handlePrevious}
              className="p-2.5 rounded-full bg-card hover:bg-muted backdrop-blur-sm transition text-foreground border border-border shadow-md"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="p-2.5 rounded-full bg-card hover:bg-muted backdrop-blur-sm transition text-foreground border border-border shadow-md"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Progress dots */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {reels.slice(0, 10).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === currentReelIndex ? 'bg-primary w-5' : 'bg-muted-foreground/40 w-1.5'}`}
              />
            ))}
            {reels.length > 10 && <span className="text-muted-foreground text-[10px] ml-1">+{reels.length - 10}</span>}
          </div>
        </div>

        {/* Right sidebar (xl screens only) */}
        <aside className="hidden xl:flex xl:flex-col w-[320px] bg-background border-l border-border h-full p-4 overflow-y-auto flex-shrink-0">
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
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">{creator.avatar}</div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm truncate max-w-[120px]">{creator.name}</span>
                      <span className="text-xs text-muted-foreground">{creator.followers} followers</span>
                    </div>
                  </div>
                  <button className="text-primary text-xs font-bold hover:underline">Follow</button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="font-bold text-lg mb-4">Trending Sounds</h3>
            <div className="space-y-3">
              {['Summer Vibes - 12K reels', 'Dance Mix - 8K reels', 'Chill Beats - 5K reels'].map((sound, i) => (
                <div key={i} className="p-3 hover:bg-muted rounded-lg cursor-pointer transition">
                  <p className="text-primary font-semibold">🎵 {sound.split(' - ')[0]}</p>
                  <p className="text-sm text-muted-foreground">{sound.split(' - ')[1]}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile bottom navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      <audio ref={audioRef} loop preload="auto" />

      <ReelCommentsModal
        open={showComments}
        onOpenChange={setShowComments}
        reelId={currentReel._id}
        commentsCount={currentReel.comments_count}
        currentUserId={user._id}
      />

      <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} contentType="reel" contentId={currentReel._id} />

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}
