'use client';

import Navigation from '@/components/navigation';
import PostCard from '@/components/post-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { followService, postService, searchService } from '@/lib/api-services';
import { Clock, Search, UserCheck, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
      // Load initial data
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
      console.error('Error loading explore posts:', error);
      setPostsError(error.message || 'Failed to load posts');
      setExplorePosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  // Debounced search
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
        // Handle different response structures - data might be an array or an object with suggestions
        const suggestions = Array.isArray(response.data)
          ? response.data
          : response.data.suggestions || [];

        const formattedCreators = suggestions.map((user: any) => ({
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
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const searchUsers = async (query: string) => {
    setIsSearching(true);
    setCreators([]); // Clear previous results

    try {
      const response = await searchService.searchUsers({ query, limit: 20 });

      if (response.success && response.data?.users) {
        let users = response.data.users || [];

        // Frontend Filtering: Remove blocked users and current user
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
      console.error('Error searching users:', error);
      setCreators([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFollowAction = async (userId: string, isPrivate: boolean) => {
    try {
      const currentStatus = followingStatus[userId] || 'none';

      if (currentStatus === 'following') {
        // Unfollow
        await followService.unfollowUser(userId);
        setFollowingStatus((prev) => ({ ...prev, [userId]: 'none' }));
      } else if (currentStatus === 'pending') {
        // Cancel request
        await followService.cancelFollowRequest(userId);
        setFollowingStatus((prev) => ({ ...prev, [userId]: 'none' }));
      } else {
        // Follow or send request
        if (isPrivate) {
          await followService.sendFollowRequest(userId);
          setFollowingStatus((prev) => ({ ...prev, [userId]: 'pending' }));
        } else {
          await followService.followUser(userId);
          setFollowingStatus((prev) => ({ ...prev, [userId]: 'following' }));
        }
      }
    } catch (error) {
      console.error('Error with follow action:', error);
    }
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
        {/* Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Main Content */}
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

              {/* Search Results Dropdown */}
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
                            {creator.avatar && creator.avatar.startsWith('http') ? (
                              <img
                                src={creator.avatar}
                                alt={creator.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to initials if image fails to load
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
                              style={{
                                display:
                                  creator.avatar && creator.avatar.startsWith('http')
                                    ? 'none'
                                    : 'flex',
                              }}
                            >
                              {creator.name
                                .split(' ')
                                .map((n) => n.charAt(0).toUpperCase())
                                .join('')
                                .slice(0, 2)}
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

          {/* Tabs */}
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

          {/* Posts Tab */}
          {activeTab === 'posts' && (
            <div className="space-y-4">
              {loadingPosts ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : postsError ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-destructive"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Something went wrong
                  </h3>
                  <p className="text-muted-foreground mb-6">{postsError}</p>
                  <Button variant="outline" onClick={loadExplorePosts} className="gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Try Again
                  </Button>
                </div>
              ) : explorePosts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="relative mb-8">
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
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
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
                  <h3 className="text-xl font-bold text-foreground mb-2">No Posts to Explore</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    Start following people or check back later for new content to discover!
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={loadExplorePosts} variant="outline" className="gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Refresh
                    </Button>
                    <Button
                      onClick={() => setActiveTab('creators')}
                      className="gap-2 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
                    >
                      <UserPlus className="w-4 h-4" />
                      Find Creators
                    </Button>
                  </div>
                </div>
              ) : (
                explorePosts.map((post) => (
                  <PostCard
                    key={post._id || post.id}
                    post={post}
                    currentUserId={user?._id || user?.id}
                  />
                ))
              )}
            </div>
          )}

          {/* Creators Tab */}
          {activeTab === 'creators' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {creators.length === 0 ? (
                <div className="col-span-2 text-center py-16">
                  <div className="relative mb-8">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-teal-500/20 rounded-full flex items-center justify-center animate-pulse">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500/30 via-cyan-500/30 to-teal-500/30 rounded-full flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div
                      className="absolute top-2 left-1/3 w-2 h-2 bg-blue-500/40 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <div
                      className="absolute top-6 right-1/3 w-2 h-2 bg-cyan-500/40 rounded-full animate-bounce"
                      style={{ animationDelay: '0.3s' }}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {searchQuery ? 'No Users Found' : 'No Suggestions Yet'}
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    {searchQuery
                      ? `We couldn't find anyone matching "${searchQuery}". Try a different search term.`
                      : "We're working on finding great creators for you. Check back soon!"}
                  </p>
                  {searchQuery && (
                    <Button onClick={() => setSearchQuery('')} variant="outline" className="gap-2">
                      <X className="w-4 h-4" />
                      Clear Search
                    </Button>
                  )}
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
                      {/* User Info - Clickable */}
                      <div
                        onClick={() => router.push(`/profile/${creator.id}`)}
                        className="cursor-pointer mb-4"
                      >
                        <div className="flex justify-center mb-4">
                          <div className="relative">
                            {creator.avatar.startsWith('http') ? (
                              <img
                                src={creator.avatar}
                                alt={creator.name}
                                className="w-24 h-24 rounded-full object-cover border-4 border-primary/20 group-hover:border-primary/40 transition"
                              />
                            ) : (
                              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-4xl border-4 border-primary/20 group-hover:border-primary/40 transition">
                                {creator.avatar}
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

                        {/* Stats */}
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

                      {/* Action Buttons */}
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

        {/* Right Sidebar - Categories */}
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

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />
    </main>
  );
}
