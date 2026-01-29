'use client';

import Navigation from '@/components/navigation';
import PostCard from '@/components/post-card';
import { feedService, reelService } from '@/lib/api-services';
import {
  Dumbbell,
  Gamepad2,
  Heart,
  Loader2,
  Music,
  Palette,
  Play,
  Sparkles,
  Trophy,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Only 5 main interest categories
const INTEREST_CATEGORIES: Record<string, { label: string; icon: any; color: string }> = {
  sports: { label: 'Sports', icon: Trophy, color: 'from-orange-500 to-amber-500' },
  music: { label: 'Music', icon: Music, color: 'from-purple-500 to-pink-500' },
  art: { label: 'Art & Design', icon: Palette, color: 'from-orange-500 to-red-500' },
  gaming: { label: 'Gaming', icon: Gamepad2, color: 'from-violet-500 to-purple-500' },
  fitness: { label: 'Fitness', icon: Dumbbell, color: 'from-green-500 to-emerald-500' },
};

export default function InterestsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.interests?.length > 0) {
      loadPersonalizedContent();
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) {
        router.push('/login');
        return;
      }
      setUser(JSON.parse(userData));
    } catch (error) {
      console.error('Failed to load user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadPersonalizedContent = async () => {
    setLoadingContent(true);
    try {
      const [postsResponse, reelsResponse] = await Promise.all([
        feedService.getHomeFeed({ limit: 12 }).catch(() => ({ success: false, data: null })),
        reelService.getReelsFeed({ limit: 12 }).catch(() => ({ success: false, data: null })),
      ]);

      if (postsResponse.success && postsResponse.data) {
        setPosts(postsResponse.data.posts || []);
      }

      if (reelsResponse.success && reelsResponse.data) {
        setReels(reelsResponse.data.reels || []);
      }
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const userInterests = user?.interests || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Navigation */}
      <aside className="hidden lg:block w-64 border-r border-border bg-card fixed left-0 top-0 h-screen overflow-y-auto p-6">
        <Navigation user={user} onLogout={handleLogout} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 px-4 py-6 sm:px-6 lg:px-8 pb-24 lg:pb-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-secondary">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">For You</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Content personalized based on your interests
          </p>
        </div>

        {/* User's Interests Pills */}
        {userInterests.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Your Interests</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {userInterests.map((interest: string) => {
                const category = INTEREST_CATEGORIES[interest.toLowerCase()];
                const Icon = category?.icon || Heart;
                return (
                  <div
                    key={interest}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    {category?.label || interest}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No Interests Message */}
        {userInterests.length === 0 && (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No interests set</h3>
            <p className="text-muted-foreground mb-4">
              Update your profile to add interests and see personalized content
            </p>
            <Link
              href="/account-settings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Go to Settings
            </Link>
          </div>
        )}

        {/* Loading State */}
        {loadingContent && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Content */}
        {!loadingContent && userInterests.length > 0 && (
          <div className="space-y-8">
            {/* Reels Section */}
            {reels.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-primary" />
                  Reels For You
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {reels.slice(0, 10).map((reel) => (
                    <Link
                      key={reel._id}
                      href={`/reel/${reel._id}`}
                      className="relative aspect-[9/16] rounded-xl overflow-hidden bg-muted group"
                    >
                      {/* Thumbnail */}
                      {reel.thumbnailUrl || reel.videoUrl ? (
                        <Image
                          src={reel.thumbnailUrl || reel.videoUrl}
                          alt=""
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20" />
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      {/* Play Icon */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-6 h-6 text-white fill-white" />
                        </div>
                      </div>

                      {/* Views */}
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs">
                        <Play className="w-3 h-3 fill-white" />
                        {reel.views || 0}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Posts Section */}
            {posts.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Posts For You
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {posts.slice(0, 6).map((post) => (
                    <PostCard key={post._id} post={post} currentUserId={user?._id} />
                  ))}
                </div>
              </div>
            )}

            {/* No Content */}
            {posts.length === 0 && reels.length === 0 && (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No content yet</h3>
                <p className="text-muted-foreground">
                  Follow more people to see personalized content here
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />
    </div>
  );
}
