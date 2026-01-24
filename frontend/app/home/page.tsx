'use client';

import Navigation from '@/components/navigation';
import PostCard from '@/components/post-card';
import ReelCard from '@/components/reel-card';
import ReelComments from '@/components/reel-comments';
import StoriesBar from '@/components/stories-bar';
import { feedService, followService, reelService, searchService } from '@/lib/api-services';
import { Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
const CreatePostModal = dynamic(() => import('@/components/create-post-modal'), { ssr: false });

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReel, setSelectedReel] = useState<any>(null);
  const [showReelComments, setShowReelComments] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
    } else {
      setUser(JSON.parse(userData));
    }
  }, [router]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768; // md breakpoint
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load home feed
  const loadFeed = async () => {
    try {
      setLoading(true);

      // Fetch posts, reels, suggestions, and trending concurrently
      const [postsResponse, reelsResponse, suggestionsResponse, trendingResponse] =
        await Promise.all([
          feedService.getHomeFeed({ limit: 10 }).catch((err) => {
            console.error('Posts API error:', err);
            return { success: false, data: null, error: err };
          }),
          reelService.getReelsFeed({ limit: 10 }).catch((err) => {
            console.error('Reels API error:', err);
            return { success: false, data: null, error: err };
          }),
          followService.getSuggestions({ limit: 5 }).catch((err) => {
            console.error('Suggestions API error:', err);
            return { success: false, data: null };
          }),
          searchService.getTrending({ limit: 5 }).catch((err) => {
            console.error('Trending API error:', err);
            return { success: false, data: null };
          }),
        ]);

      const postsData =
        postsResponse.success && postsResponse.data ? postsResponse.data.posts || [] : [];
      const reelsData =
        reelsResponse.success && reelsResponse.data ? reelsResponse.data.reels || [] : [];

      if (suggestionsResponse.success && suggestionsResponse.data) {
        setSuggestions(suggestionsResponse.data.suggestions || []);
      }

      if (trendingResponse.success && trendingResponse.data) {
        setTrending(trendingResponse.data.trending_topics || []);
      }

      // Mix posts and reels together
      const mixedFeed = [];
      const maxLength = Math.max(postsData.length, reelsData.length);

      for (let i = 0; i < maxLength; i++) {
        // Add post if available
        if (postsData[i]) {
          mixedFeed.push({ ...postsData[i], type: 'post' });
        }
        // Add reel if available
        if (reelsData[i]) {
          mixedFeed.push({ ...reelsData[i], type: 'reel' });
        }
      }

      setPosts(postsData);
      setReels(reelsData);
      setFeed(mixedFeed);
    } catch (error) {
      console.error('Error loading feed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUser = async (userId: string) => {
    try {
      const response = await followService.followUser(userId);
      if (response.success) {
        // Remove from suggestions
        setSuggestions((prev) => prev.filter((u) => u._id !== userId));
        // Optionally refresh feed
        // loadFeed()
      }
    } catch (error) {
      console.error('Failed to follow user:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadFeed();
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  };

  const handleOpenPostDetails = useCallback((post: any) => {
    setFeed((prevFeed) =>
      prevFeed.map((item) => {
        if (item.type === 'post' && (item._id === post._id || item.id === post._id)) {
          return { ...item, showComments: !item.showComments };
        }
        return item;
      })
    );
  }, []);

  const handleOpenReelComments = useCallback((reel: any) => {
    setSelectedReel(reel);
    setShowReelComments(true);
  }, []);

  const handleReelLikeUpdate = useCallback(
    (reelId: string, isLiked: boolean, likeCount: number) => {
      setFeed((prevFeed) =>
        prevFeed.map((item) => {
          if (item.type === 'reel' && (item._id === reelId || item.id === reelId)) {
            return {
              ...item,
              isLiked,
              likes_count: likeCount,
            };
          }
          return item;
        })
      );
    },
    []
  );

  const handlePostLikeUpdate = useCallback(
    (postId: string, isLiked: boolean, likeCount: number) => {
      setFeed((prevFeed) =>
        prevFeed.map((item) => {
          if (item.type === 'post' && (item._id === postId || item.id === postId)) {
            return {
              ...item,
              isLiked,
              likes_count: likeCount,
            };
          }
          return item;
        })
      );
    },
    []
  );

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Main Feed */}
        <section className="lg:col-span-2 max-w-2xl mx-auto pb-20 lg:pb-0">
          {/* Create Post Card */}
          <div className="bg-card rounded-2xl border border-border p-4 mb-6 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl overflow-hidden">
                {(user?.profileImage || user?.profilePicture || user?.avatar)?.startsWith?.(
                  'http'
                ) ? (
                  <img
                    src={user?.profileImage || user?.profilePicture || user?.avatar}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{user?.profileImage || user?.profilePicture || user?.avatar || '😊'}</span>
                )}
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex-1 bg-muted rounded-full px-4 py-2 text-left text-muted-foreground hover:bg-muted/80 transition"
              >
                What's on your mind?
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Stories Bar */}
          <StoriesBar
            currentUserId={user?._id}
            currentUserName={user?.fullName || user?.firstName || 'You'}
            currentUserAvatar={user?.profileImage || user?.profilePicture || user?.avatar}
          />

          {/* Mixed Posts and Reels Feed */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading feed...</p>
                </div>
              </div>
            ) : feed.length > 0 ? (
              feed.map((item) =>
                item.type === 'post' ? (
                  <PostCard
                    key={`post-${item._id || item.id}`}
                    post={item}
                    onCommentClick={handleOpenPostDetails}
                    onLikeUpdate={handlePostLikeUpdate}
                    currentUserId={user?._id}
                    onPostClick={handleOpenPostDetails}
                    showComments={item.showComments}
                  />
                ) : (
                  <ReelCard
                    key={`reel-${item._id || item.id}`}
                    reel={item}
                    currentUserId={user?._id}
                    onCommentClick={() => handleOpenReelComments(item)}
                  />
                )
              )
            ) : (
              <div className="bg-card rounded-2xl border border-border p-8 text-center">
                {/* Animated Illustration */}
                <div className="relative mb-6">
                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center animate-pulse">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/30 via-purple-500/30 to-pink-500/30 rounded-full flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div
                    className="absolute top-2 left-1/3 w-2 h-2 bg-primary/40 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  />
                  <div
                    className="absolute top-6 right-1/3 w-2 h-2 bg-purple-500/40 rounded-full animate-bounce"
                    style={{ animationDelay: '0.3s' }}
                  />
                </div>

                <h3 className="text-xl font-bold text-foreground mb-2">Your Feed is Empty</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Follow some amazing creators to see their posts and reels here!
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/explore"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all duration-200 font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    Explore
                  </Link>
                  <Link
                    href="/create"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 font-semibold shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Create Post
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Sidebar - Suggestions & Trending */}
        <aside className="hidden lg:block lg:col-span-1 border-l border-border p-4 h-screen sticky top-0 overflow-y-auto">
          {/* Suggested Users */}
          {suggestions.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-4 mb-4">
              <h3 className="font-bold text-lg mb-4">Suggested for you</h3>
              <div className="space-y-4">
                {suggestions.map((suggestion) => (
                  <div key={suggestion._id} className="flex items-center justify-between">
                    <Link
                      href={`/profile/${suggestion._id}`}
                      className="flex items-center gap-3 hover:opacity-80 transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden">
                        {(
                          suggestion.profileImage ||
                          suggestion.profilePicture ||
                          suggestion.avatar ||
                          ''
                        )?.startsWith('http') ? (
                          <img
                            src={
                              suggestion.profileImage ||
                              suggestion.profilePicture ||
                              suggestion.avatar
                            }
                            alt={suggestion.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                            {suggestion.firstName?.[0] || suggestion.username?.[0] || '?'}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm truncate max-w-[100px]">
                          {suggestion.username}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                          {suggestion.firstName} {suggestion.lastName}
                        </span>
                      </div>
                    </Link>
                    <button
                      onClick={() => handleFollowUser(suggestion._id)}
                      className="text-primary text-xs font-bold hover:underline"
                    >
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border p-4 sticky top-0">
            <h3 className="font-bold text-lg mb-4">Trending Now</h3>
            <div className="space-y-3">
              {trending.length > 0 ? (
                trending.map((trend, i) => (
                  <div key={i} className="p-3 hover:bg-muted rounded-lg cursor-pointer transition">
                    <p className="text-primary font-semibold">#{trend.topic}</p>
                    <p className="text-sm text-muted-foreground">{trend.posts_count || 0} posts</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No trending topics yet</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          loadFeed(); // Refresh feed after creating post
        }}
      />

      {/* Reel Comments Modal */}
      {selectedReel && (
        <ReelComments
          reel={selectedReel}
          currentUserId={user?._id}
          isOpen={showReelComments}
          onClose={() => setShowReelComments(false)}
        />
      )}
    </main>
  );
}
