'use client';

import Navigation from '@/components/navigation';
import PostCard from '@/components/post-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { followService, postService, searchService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import { Clock, Search, UserCheck, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const isValidImageUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  return url.startsWith('http') || url.startsWith('/uploads') || url.startsWith('uploads');
};

interface Creator {
  id: string;
  name: string;
  username?: string;
  avatar: string;
  bio: string;
  followers: number;
  following?: number;
  posts?: number;
  verified: boolean;
  isFollowing?: boolean;
  isPending?: boolean;
  isPrivate?: boolean;
}

export default function ExplorePage() {
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'posts' | 'creators'>('posts');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [followingStatus, setFollowingStatus] = useState<
    Record<string, 'following' | 'pending' | 'none'>
  >({});
  const [explorePosts, setExplorePosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
    } else {
      setUser(JSON.parse(userData));
      loadSuggestions();
      loadExplorePosts();
    }
  }, [router]);

  const loadExplorePosts = async () => {
    setLoadingPosts(true);
    setPostsError(null);
    try {
      const response = await postService.getExplorePosts({ page: 1, limit: 20 });
      if (response.success && response.data) {
        setExplorePosts(response.data.posts || []);
      } else {
        setExplorePosts([]);
      }
    } catch (error: any) {
      setPostsError(error.message || 'Failed to load posts');
      setExplorePosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchQuery.trim()) {
      const timeout = setTimeout(() => {
        searchUsers(searchQuery);
      }, 500);
      setSearchTimeout(timeout);
    } else {
      loadSuggestions();
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchQuery]);

  const loadSuggestions = async () => {
    try {
      const response = await followService.getSuggestions({ limit: 20 });
      if (response.success && response.data) {
        const suggestions = Array.isArray(response.data)
          ? response.data
          : response.data.suggestions || [];

        // Filter out current user from suggestions
        const userData = localStorage.getItem('user');
        const currentUser = userData ? JSON.parse(userData) : null;
        const filteredSuggestions = currentUser
          ? suggestions.filter((u: any) => u._id !== currentUser._id && u._id !== currentUser.id)
          : suggestions;

        const formattedCreators = filteredSuggestions.map((user: any) => ({
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          username:
            user.username || `${user.firstName?.toLowerCase()}${user.lastName?.toLowerCase()}`,
          avatar: user.profileImage || user.avatar || '👤',
          bio: user.bio || 'No bio yet',
          followers: user.followers_count || user.followersCount || 0,
          following: user.followingCount || 0,
          posts: user.postsCount || 0,
          verified: user.isVerified || false,
          isPrivate: user.isPrivate || false,
          isFollowing: user.isFollowing || false,
        }));
        setCreators(formattedCreators);
      }
    } catch (error) {}
  };

  const searchUsers = async (query: string) => {
    setIsSearching(true);
    setCreators([]); // Clear previous results

    try {
      const response = await searchService.searchUsers({ query, limit: 20 });

      if (response.success && response.data?.users) {
        let users = response.data.users || [];

        if (user) {
          const blockedUsers = user.blockedUsers || [];
          users = users.filter(
            (u: any) =>
              u._id !== user._id && // Remove self
              !blockedUsers.includes(u._id) // Remove blocked users
          );
        }

        if (Array.isArray(users) && users.length > 0) {
          const formattedCreators = users.map((user: any) => ({
            id: user._id,
            name: user.fullName || `${user.firstName} ${user.lastName}`,
            username:
              user.username || `${user.firstName?.toLowerCase()}${user.lastName?.toLowerCase()}`,
            avatar: user.avatar || user.profileImage || '👤',
            bio: user.bio || 'No bio yet',
            followers: user.followers_count || user.followersCount || 0,
            following: user.followingCount || 0,
            posts: user.postsCount || 0,
            verified: user.isVerified || false,
            isPrivate: user.profile_type === 'private',
            isFollowing: user.isFollowing || false,
          }));
          setCreators(formattedCreators);
        } else {
          setCreators([]);
        }
      } else {
        setCreators([]);
      }
    } catch (error) {
      setCreators([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFollowAction = async (userId: string, isPrivate: boolean) => {
    try {
      const currentStatus = followingStatus[userId] || 'none';

      if (currentStatus === 'following') {
        await followService.unfollowUser(userId);
        setFollowingStatus((prev) => ({ ...prev, [userId]: 'none' }));
      } else if (currentStatus === 'pending') {
        await followService.cancelFollowRequest(userId);
        setFollowingStatus((prev) => ({ ...prev, [userId]: 'none' }));
      } else {
        if (isPrivate) {
          await followService.sendFollowRequest(userId);
          setFollowingStatus((prev) => ({ ...prev, [userId]: 'pending' }));
        } else {
          await followService.followUser(userId);
          setFollowingStatus((prev) => ({ ...prev, [userId]: 'following' }));
        }
      }
    } catch (error) {}
  };

  const getFollowButtonConfig = (userId: string, isPrivate: boolean) => {
    const status = followingStatus[userId] || 'none';

    if (status === 'following') {
      return {
        text: 'Following',
        icon: <UserCheck size={16} />,
        variant: 'outline' as const,
      };
    } else if (status === 'pending') {
      return {
        text: 'Requested',
        icon: <Clock size={16} />,
        variant: 'outline' as const,
      };
    } else {
      return {
        text: isPrivate ? 'Request' : 'Follow',
        icon: <UserPlus size={16} />,
        variant: 'default' as const,
      };
    }
  };

  const handleOpenPostDetails = useCallback((post: any) => {
    setExplorePosts((prevPosts) =>
      prevPosts.map((item) => {
        if (item._id === post._id || item.id === post._id) {
          return { ...item, showComments: !item.showComments };
        }
        return item;
      })
    );
  }, []);

  const handlePostLikeUpdate = useCallback(
    (postId: string, isLiked: boolean, likeCount: number) => {
      setExplorePosts((prevPosts) =>
        prevPosts.map((item) => {
          if (item._id === postId || item.id === postId) {
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

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 pb-20 lg:pb-0">
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        <section className="lg:col-span-2">
          <div className="sticky top-0 z-20 mb-6 bg-background pt-4">
            <div className="relative bg-card rounded-2xl border border-border p-4">
              <Search
                className="absolute left-7 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                size={20}
              />
              <Input
                type="text"
                placeholder="Search users by name... (e.g., 'kr', 'john')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-7 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              )}

              {searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-lg max-h-96 overflow-y-auto">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Searching users...</span>
                      </div>
                    </div>
                  ) : creators.length > 0 ? (
                    <div className="py-2">
                      <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border">
                        {creators.length} user{creators.length !== 1 ? 's' : ''} found
                      </div>
                      {creators.map((creator) => (
                        <button
                          key={creator.id}
                          onClick={() => {
                            router.push(`/profile/${creator.id}`);
                            setSearchQuery('');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                            {isValidImageUrl(creator.avatar) ? (
                              <img
                                src={getMediaUrl(creator.avatar)}
                                alt={creator.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  if (target.nextSibling) {
                                    (target.nextSibling as HTMLElement).style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <span
                              className="w-full h-full flex items-center justify-center"
                              style={{ display: isValidImageUrl(creator.avatar) ? 'none' : 'flex' }}
                            >
                              {(creator.name || 'U')
                                .split(' ')
                                .map((n) => (n || 'U').charAt(0).toUpperCase())
                                .join('')
                                .slice(0, 2) || 'U'}
                            </span>
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-1">
                              <p className="font-semibold">{creator.name}</p>
                              {creator.verified && <span className="text-blue-500">✓</span>}
                            </div>
                            <p className="text-sm text-muted-foreground">@{creator.username}</p>
                            {creator.bio !== 'No bio yet' && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                {creator.bio}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <div>{creator.followers} followers</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      No users found for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4 mb-6 border-b border-border">
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-3 font-semibold border-b-2 transition ${
                activeTab === 'posts'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Posts
            </button>
            <button
              onClick={() => setActiveTab('creators')}
              className={`px-4 py-3 font-semibold border-b-2 transition ${
                activeTab === 'creators'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Creators
            </button>
          </div>

          {activeTab === 'posts' && (
            <div className="space-y-4">
              {loadingPosts ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : postsError ? (
                <div className="text-center py-12 text-destructive">
                  <p>{postsError}</p>
                  <Button variant="outline" onClick={loadExplorePosts} className="mt-4">
                    Try Again
                  </Button>
                </div>
              ) : explorePosts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No posts found to explore</p>
                </div>
              ) : (
                explorePosts.map((post) => (
                  <PostCard
                    key={post._id || post.id}
                    post={post}
                    currentUserId={user?._id || user?.id}
                    onCommentClick={handleOpenPostDetails}
                    onLikeUpdate={handlePostLikeUpdate}
                    onPostClick={handleOpenPostDetails}
                    showComments={post.showComments}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'creators' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {creators.length === 0 ? (
                <div className="col-span-2 text-center py-12">
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No users found' : 'No suggestions available'}
                  </p>
                </div>
              ) : (
                creators.map((creator) => {
                  const buttonConfig = getFollowButtonConfig(
                    creator.id,
                    creator.isPrivate || false
                  );

                  return (
                    <div
                      key={creator.id}
                      className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition group"
                    >
                      <div
                        onClick={() => router.push(`/profile/${creator.id}`)}
                        className="cursor-pointer mb-4"
                      >
                        <div className="flex justify-center mb-4">
                          <div className="relative">
                            {isValidImageUrl(creator.avatar) ? (
                              <img
                                src={getMediaUrl(creator.avatar)}
                                alt={creator.name}
                                className="w-24 h-24 rounded-full object-cover border-4 border-primary/20 group-hover:border-primary/40 transition"
                              />
                            ) : (
                              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-2xl font-bold text-white border-4 border-primary/20 group-hover:border-primary/40 transition">
                                {(creator.name || 'U')
                                  .split(' ')
                                  .map((n) => (n || 'U').charAt(0).toUpperCase())
                                  .join('')
                                  .slice(0, 2) || 'U'}
                              </div>
                            )}
                            {creator.verified && (
                              <div className="absolute bottom-0 right-0 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center border-2 border-card">
                                <span className="text-white text-sm">✓</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-center">
                          <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-primary transition">
                            {creator.name}
                          </h3>
                          {creator.username && (
                            <p className="text-sm text-muted-foreground mb-2">
                              @{creator.username}
                            </p>
                          )}
                          {creator.isPrivate && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              🔒 Private Account
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground text-center mb-4 line-clamp-2">
                          {creator.bio}
                        </p>

                        <div className="flex justify-center gap-6 mb-4 pb-4 border-b border-border">
                          <div className="text-center">
                            <p className="font-bold text-foreground">{creator.posts || 0}</p>
                            <p className="text-xs text-muted-foreground">Posts</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-foreground">
                              {creator.followers.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">Followers</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-foreground">{creator.following || 0}</p>
                            <p className="text-xs text-muted-foreground">Following</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/profile/${creator.id}`);
                          }}
                          variant="outline"
                          className="flex-1"
                        >
                          View Profile
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowAction(creator.id, creator.isPrivate || false);
                          }}
                          variant={buttonConfig.variant}
                          className="flex-1 gap-2"
                        >
                          {buttonConfig.icon}
                          {buttonConfig.text}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        <aside className="hidden lg:block lg:col-span-1 border-l border-border p-4">
          <div className="bg-card rounded-2xl border border-border p-4 sticky top-0">
            <h3 className="font-bold text-lg mb-4">Popular Categories</h3>
            <div className="space-y-3">
              {['Design', 'Photography', 'Technology', 'Art', 'Music', 'Travel'].map(
                (category, i) => (
                  <button
                    key={i}
                    className="w-full text-left p-3 hover:bg-muted rounded-lg transition"
                  >
                    <p className="font-semibold text-foreground">{category}</p>
                    <p className="text-xs text-muted-foreground">45.2K posts</p>
                  </button>
                )
              )}
            </div>
          </div>
        </aside>
      </div>

      <Navigation user={user} onLogout={handleLogout} isMobile={true} />
    </main>
  );
}
