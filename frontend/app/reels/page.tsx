'use client';

import Navigation from '@/components/navigation';
import ReelCommentsModal from '@/components/reel-comments-modal';
import UserAvatar from '@/components/user-avatar';
import { feedService, reelService } from '@/lib/api-services';
import {
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Plus,
  Share2,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Reel {
  _id: string;
  media: { url: string; thumbnail: string; duration: number };
  user_id: { _id: string; firstName: string; lastName: string; profilePicture?: string };
  caption: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  isLiked?: boolean;
}

export default function ReelsPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const [user, setUser] = useState<any>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [isMuted, setIsMuted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(userData));
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const loadReels = async () => {
      try {
        const res = await feedService.getReelsFeed({ page: 1, limit: 20 });
        if (res.success && res.data?.reels) {
          setReels(res.data.reels);
          const liked = new Set(
            res.data.reels.filter((r: Reel) => r.isLiked).map((r: Reel) => r._id)
          );
          setLikedReels(liked);
        }
      } catch (err) {
        console.error('Failed to load reels:', err);
      } finally {
        setLoading(false);
      }
    };

    loadReels();
  }, [user]);

  useEffect(() => {
    videoRefs.current.forEach((video, id) => {
      const index = reels.findIndex((r) => r._id === id);
      if (index === activeIndex) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [activeIndex, reels]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const itemHeight = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < reels.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, reels.length]);

  const scrollToReel = (index: number) => {
    if (!containerRef.current || index < 0 || index >= reels.length) return;
    containerRef.current.scrollTo({
      top: index * containerRef.current.clientHeight,
      behavior: 'smooth',
    });
  };

  const handleLike = async (reelId: string) => {
    try {
      const res = await reelService.toggleLikeReel(reelId);
      if (res.success) {
        setLikedReels((prev) => {
          const next = new Set(prev);
          res.data.isLiked ? next.add(reelId) : next.delete(reelId);
          return next;
        });
        setReels((prev) =>
          prev.map((r) => (r._id === reelId ? { ...r, likes_count: res.data.likes_count } : r))
        );
      }
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const formatCount = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex">
          <aside className="hidden lg:block w-64 border-r border-border h-screen sticky top-0 p-4">
            <Navigation user={user} onLogout={handleLogout} />
          </aside>
          <main className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                <Video className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No reels yet</h2>
              <p className="text-muted-foreground mb-6">
                Create your first reel and share it with the world
              </p>
              <button
                onClick={() => router.push('/create')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition"
              >
                <Plus className="w-5 h-5" />
                Create Reel
              </button>
            </div>
          </main>
        </div>
        <Navigation user={user} onLogout={handleLogout} isMobile />
      </div>
    );
  }

  const currentReel = reels[activeIndex];

  return (
    <div className="h-screen bg-black flex">
      <aside className="hidden lg:block w-64 bg-background border-r border-border h-screen p-4 overflow-y-auto">
        <Navigation user={user} onLogout={handleLogout} />
      </aside>

      <main className="flex-1 relative">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-screen overflow-y-scroll snap-y snap-mandatory"
          style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {reels.map((reel) => (
            <div
              key={reel._id}
              className="h-screen w-full snap-start snap-always relative flex items-center justify-center"
            >
              <video
                ref={(el) => {
                  if (el) videoRefs.current.set(reel._id, el);
                }}
                src={reel.media.url}
                poster={reel.media.thumbnail}
                className="h-full w-full object-contain bg-black lg:max-w-[400px] lg:rounded-xl"
                loop
                muted={isMuted}
                playsInline
                onClick={() => {
                  const video = videoRefs.current.get(reel._id);
                  if (video) video.paused ? video.play() : video.pause();
                }}
              />

              <div className="absolute inset-0 pointer-events-none lg:max-w-[400px] lg:left-1/2 lg:-translate-x-1/2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white pointer-events-auto"
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <div className="flex items-center gap-3 mb-3 pointer-events-auto">
                    <UserAvatar user={reel.user_id} size="md" />
                    <p className="text-white font-medium text-sm">
                      {reel.user_id.firstName} {reel.user_id.lastName}
                    </p>
                    <button className="ml-auto px-4 py-1.5 border border-white text-white text-sm rounded-lg hover:bg-white hover:text-black transition">
                      Follow
                    </button>
                  </div>
                  {reel.caption && (
                    <p className="text-white text-sm mb-4 line-clamp-2">{reel.caption}</p>
                  )}
                </div>

                <div className="absolute right-3 bottom-28 flex flex-col gap-5 pointer-events-auto">
                  <button
                    onClick={() => handleLike(reel._id)}
                    className="flex flex-col items-center"
                  >
                    <div
                      className={`p-2.5 rounded-full ${likedReels.has(reel._id) ? 'bg-red-500' : 'bg-black/40'}`}
                    >
                      <Heart
                        size={22}
                        className="text-white"
                        fill={likedReels.has(reel._id) ? 'white' : 'none'}
                      />
                    </div>
                    <span className="text-white text-xs mt-1">{formatCount(reel.likes_count)}</span>
                  </button>

                  <button
                    onClick={() => setShowComments(true)}
                    className="flex flex-col items-center"
                  >
                    <div className="p-2.5 rounded-full bg-black/40">
                      <MessageCircle size={22} className="text-white" />
                    </div>
                    <span className="text-white text-xs mt-1">
                      {formatCount(reel.comments_count)}
                    </span>
                  </button>

                  <button className="flex flex-col items-center">
                    <div className="p-2.5 rounded-full bg-black/40">
                      <Share2 size={22} className="text-white" />
                    </div>
                    <span className="text-white text-xs mt-1">Share</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-2">
          <button
            onClick={() => scrollToReel(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition"
          >
            <ChevronUp className="text-white" size={24} />
          </button>
          <button
            onClick={() => scrollToReel(activeIndex + 1)}
            disabled={activeIndex === reels.length - 1}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition"
          >
            <ChevronDown className="text-white" size={24} />
          </button>
        </div>

        <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-1.5">
          {reels.slice(0, 10).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToReel(i)}
              className={`w-1.5 rounded-full transition-all ${i === activeIndex ? 'h-6 bg-white' : 'h-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      </main>

      <Navigation user={user} onLogout={handleLogout} isMobile />

      {currentReel && (
        <ReelCommentsModal
          open={showComments}
          onOpenChange={setShowComments}
          reelId={currentReel._id}
          commentsCount={currentReel.comments_count}
          currentUserId={user?._id}
        />
      )}
    </div>
  );
}
