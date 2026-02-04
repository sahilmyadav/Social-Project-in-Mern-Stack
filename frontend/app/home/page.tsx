'use client';

import Navigation from '@/components/navigation';
import PostCard from '@/components/post-card';
import ReelCard from '@/components/reel-card';
import ReelComments from '@/components/reel-comments';
import { FeedSkeleton, InfiniteScrollTrigger, StoriesBarSkeleton, SuggestionSkeleton } from '@/components/skeletons';
import StoriesBar from '@/components/stories-bar';
import { feedService, followService, reelService, searchService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import { Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
const CreatePostModal = dynamic(() => import('@/components/create-post-modal'), { ssr: false });

const INITIAL_LOAD = 5; // Load only 5 items initially for faster first paint
const LOAD_MORE_COUNT = 10;

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReel, setSelectedReel] = useState<any>(null);
  const [showReelComments, setShowReelComments] = useState(false);
  const [feed, setFeed] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);

  // Loading states
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  // Pagination - cursor based for posts, page based for reels
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [reelsPage, setReelsPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

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

  // Load home feed - Progressive loading
  const loadFeed = useCallback(async (isInitial: boolean = false) => {
    try {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }

      const limit = isInitial ? INITIAL_LOAD : LOAD_MORE_COUNT;

      // For initial load, fetch feed first (priority), then others in background
      if (isInitial) {
        // Priority: Load posts and reels first
        const [postsResponse, reelsResponse] = await Promise.all([
          feedService.getHomeFeed({ limit }).catch((err) => {
            console.error('Posts API error:', err);
            return { success: false, data: null };
          }),
          reelService.getReelsFeed({ limit, page: 1 }).catch((err) => {
            console.error('Reels API error:', err);
            return { success: false, data: null };
          }),
        ]);

        const postsData = postsResponse.success && postsResponse.data ? postsResponse.data.posts || [] : [];
        const reelsData = reelsResponse.success && reelsResponse.data ? reelsResponse.data.reels || [] : [];

        // Store cursor for next page
        if (postsResponse.data?.nextCursor) {
          setPostsCursor(postsResponse.data.nextCursor);
        }

        // Mix posts and reels
        const mixedFeed = mixFeedItems(postsData, reelsData);
        setFeed(mixedFeed);
        setHasMore(postsData.length >= limit || reelsData.length >= limit);
        setInitialLoading(false);

        // Load suggestions and trending in background (non-blocking)
        loadSidebar();
      } else {
        // Load more - fetch next page using cursor for posts, page for reels
        const nextReelsPage = reelsPage + 1;

        const [postsResponse, reelsResponse] = await Promise.all([
          postsCursor
            ? feedService.getHomeFeed({ limit, cursor: postsCursor }).catch(() => ({ success: false, data: null }))
            : Promise.resolve({ success: false, data: null }),
          reelService.getReelsFeed({ limit, page: nextReelsPage }).catch(() => ({ success: false, data: null })),
        ]);

        const postsData = postsResponse.success && postsResponse.data ? postsResponse.data.posts || [] : [];
        const reelsData = reelsResponse.success && reelsResponse.data ? reelsResponse.data.reels || [] : [];

        // Update cursor for next page
        if (postsResponse.data?.nextCursor) {
          setPostsCursor(postsResponse.data.nextCursor);
        } else {
          setPostsCursor(null);
        }
        setReelsPage(nextReelsPage);

        if (postsData.length === 0 && reelsData.length === 0) {
          setHasMore(false);
        } else {
          const mixedFeed = mixFeedItems(postsData, reelsData);
          setFeed(prev => [...prev, ...mixedFeed]);
          setHasMore(postsData.length >= limit || reelsData.length >= limit);
        }
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
    }
  }, [postsCursor, reelsPage]);
  // Mix posts and reels together
  const mixFeedItems = (postsData: any[], reelsData: any[]) => {
    const mixedFeed: any[] = [];
    const maxLength = Math.max(postsData.length, reelsData.length);

    for (let i = 0; i < maxLength; i++) {
      if (postsData[i]) {
        mixedFeed.push({ ...postsData[i], type: 'post' });
      }
      if (reelsData[i]) {
        mixedFeed.push({ ...reelsData[i], type: 'reel' });
      }
    }
    return mixedFeed;
  };

  // Load sidebar content (non-blocking)
  const loadSidebar = async () => {
    setSuggestionsLoading(true);
    try {
      const [suggestionsResponse, trendingResponse] = await Promise.all([
        followService.getSuggestions({ limit: 5 }).catch(() => ({ success: false, data: null })),
        searchService.getTrending({ limit: 5 }).catch(() => ({ success: false, data: null })),
      ]);

      if (suggestionsResponse.success && suggestionsResponse.data) {
        setSuggestions(suggestionsResponse.data.suggestions || []);
      }

      if (trendingResponse.success && trendingResponse.data) {
        setTrending(trendingResponse.data.trending_topics || []);
      }
    } catch (error) {
      console.error('Error loading sidebar:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Load more handler for infinite scroll
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadFeed(false);
    }
  }, [loadingMore, hasMore, loadFeed]);
  const handleFollowUser = async (userId: string) => {
    try {
      const response = await followService.followUser(userId);
      if (response.success) {
        // Remove from suggestions
        setSuggestions((prev) => prev.filter((u) => u._id !== userId));
      }
    } catch (error) {
      console.error('Failed to follow user:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadFeed(true);
    }
  }, [user]);

  const handleLogout = () => {
    console.log('handleLogout called');
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      console.log('localStorage cleared, redirecting to /login');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if there's an error
      window.location.href = '/login';
    }
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

  const handleReelViewUpdate = useCallback((reelId: string, viewCount: number) => {
    setFeed((prevFeed) =>
      prevFeed.map((item) => {
        if (item.type === 'reel' && (item._id === reelId || item.id === reelId)) {
          return {
            ...item,
            views_count: viewCount,
            isViewed: true,
          };
        }
        return item;
      })
    );
  }, []);

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
                {(() => {
                  const avatar = user?.profileImage || user?.profilePicture || user?.avatar;
                  if (
                    avatar &&
                    avatar !== '👤' &&
                    (avatar.startsWith('http') || avatar.startsWith('/'))
                  ) {
                    return (
                      <img
                        src={getMediaUrl(avatar)}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    );
                  }
                  return <span>{user?.firstName?.[0] || '😊'}</span>;
                })()}
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
          {initialLoading ? (
            <StoriesBarSkeleton />
          ) : (
            <StoriesBar
              currentUserId={user?._id}
              currentUserName={user?.fullName || user?.firstName || 'You'}
              currentUserAvatar={user?.profileImage || user?.profilePicture || user?.avatar}
            />
          )}

          {/* Mixed Posts and Reels Feed */}
          <div className="space-y-4">
            {initialLoading ? (
              <FeedSkeleton count={3} />
            ) : feed.length > 0 ? (
              <>
                {feed.map((item) =>
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
                      onViewUpdate={handleReelViewUpdate}
                    />
                  )
                )}
                {/* Infinite Scroll Trigger */}
                <InfiniteScrollTrigger
                  onLoadMore={handleLoadMore}
                  hasMore={hasMore}
                  isLoading={loadingMore}
                />
              </>
            ) : (
              <div className="bg-card rounded-2xl border border-border p-8 text-center">
                <p className="text-muted-foreground mb-2">No posts or reels yet</p>
                <p className="text-sm text-muted-foreground">
                  Follow some users to see their content here!
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Right Sidebar - Suggestions & Trending */}
        <aside className="hidden lg:block lg:col-span-1 border-l border-border p-4 h-screen sticky top-0 overflow-y-auto">
          {/* Suggested Users */}
          <div className="bg-card rounded-2xl border border-border p-4 mb-4">
            <h3 className="font-bold text-lg mb-4">Suggested for you</h3>
            <div className="space-y-4">
              {suggestionsLoading ? (
                // Skeleton loading
                [...Array(3)].map((_, i) => <SuggestionSkeleton key={i} />)
              ) : suggestions.length > 0 ? (
                suggestions.map((suggestion) => (
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
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No suggestions yet</p>
              )}
            </div>
          </div>

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
          // Reset and refresh feed after creating post
          setPostsCursor(null);
          setReelsPage(1);
          setFeed([]);
          loadFeed(true);
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
