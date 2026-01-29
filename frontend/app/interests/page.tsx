'use client';

import Navigation from '@/components/navigation';
import PostCard from '@/components/post-card';
import ReelCard from '@/components/reel-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService, feedService, reelService } from '@/lib/api-services';
import { showToast, toasts } from '@/lib/toast';
import {
  BookOpen,
  Briefcase,
  Brush,
  Camera,
  Car,
  Check,
  Code,
  Coffee,
  DollarSign,
  Dumbbell,
  Film,
  Flame,
  Gamepad2,
  GraduationCap,
  Heart,
  Heart as HeartIcon,
  Home as HomeIcon,
  Leaf,
  Loader2,
  Mic,
  Mountain,
  Music,
  Palette,
  PawPrint,
  Plane,
  Search,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Trophy,
  Tv,
  Utensils,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Interest categories with icons and colors
const INTEREST_CATEGORIES = [
  { id: 'music', label: 'Music', icon: Music, color: 'from-purple-500 to-pink-500' },
  { id: 'photography', label: 'Photography', icon: Camera, color: 'from-blue-500 to-cyan-500' },
  { id: 'art', label: 'Art & Design', icon: Palette, color: 'from-orange-500 to-red-500' },
  { id: 'food', label: 'Food & Cooking', icon: Utensils, color: 'from-yellow-500 to-orange-500' },
  { id: 'travel', label: 'Travel', icon: Plane, color: 'from-teal-500 to-blue-500' },
  {
    id: 'fitness',
    label: 'Fitness & Health',
    icon: Dumbbell,
    color: 'from-green-500 to-emerald-500',
  },
  { id: 'books', label: 'Books & Reading', icon: BookOpen, color: 'from-amber-500 to-yellow-500' },
  { id: 'movies', label: 'Movies & TV', icon: Film, color: 'from-red-500 to-rose-500' },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2, color: 'from-violet-500 to-purple-500' },
  { id: 'technology', label: 'Technology', icon: Code, color: 'from-slate-500 to-gray-600' },
  { id: 'fashion', label: 'Fashion & Style', icon: Shirt, color: 'from-pink-500 to-fuchsia-500' },
  { id: 'cars', label: 'Cars & Vehicles', icon: Car, color: 'from-zinc-500 to-slate-600' },
  { id: 'pets', label: 'Pets & Animals', icon: PawPrint, color: 'from-amber-600 to-orange-500' },
  { id: 'nature', label: 'Nature & Environment', icon: Leaf, color: 'from-green-600 to-lime-500' },
  {
    id: 'finance',
    label: 'Finance & Investing',
    icon: DollarSign,
    color: 'from-emerald-600 to-green-500',
  },
  { id: 'business', label: 'Business', icon: Briefcase, color: 'from-blue-600 to-indigo-500' },
  {
    id: 'education',
    label: 'Education',
    icon: GraduationCap,
    color: 'from-indigo-500 to-blue-500',
  },
  {
    id: 'relationships',
    label: 'Relationships',
    icon: HeartIcon,
    color: 'from-rose-500 to-pink-500',
  },
  { id: 'home', label: 'Home & Decor', icon: HomeIcon, color: 'from-stone-500 to-amber-600' },
  { id: 'adventure', label: 'Adventure', icon: Mountain, color: 'from-sky-500 to-blue-500' },
  { id: 'sports', label: 'Sports', icon: Trophy, color: 'from-orange-600 to-amber-500' },
  { id: 'beauty', label: 'Beauty', icon: Sparkles, color: 'from-pink-400 to-rose-400' },
  { id: 'comedy', label: 'Comedy & Memes', icon: Flame, color: 'from-yellow-500 to-red-500' },
  { id: 'diy', label: 'DIY & Crafts', icon: Brush, color: 'from-cyan-500 to-teal-500' },
  { id: 'news', label: 'News & Current Events', icon: Tv, color: 'from-gray-600 to-slate-500' },
  { id: 'science', label: 'Science', icon: Smartphone, color: 'from-blue-500 to-purple-500' },
  { id: 'spirituality', label: 'Spirituality', icon: Star, color: 'from-amber-400 to-yellow-400' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: 'from-fuchsia-500 to-pink-500' },
  { id: 'podcasts', label: 'Podcasts', icon: Mic, color: 'from-indigo-600 to-violet-500' },
  { id: 'lifestyle', label: 'Lifestyle', icon: Coffee, color: 'from-stone-500 to-stone-600' },
];

export default function InterestsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [originalInterests, setOriginalInterests] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'interests' | 'feed'>('interests');
  const [suggestedPosts, setSuggestedPosts] = useState<any[]>([]);
  const [suggestedReels, setSuggestedReels] = useState<any[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (activeTab === 'feed' && selectedInterests.length > 0) {
      loadSuggestedContent();
    }
  }, [activeTab, selectedInterests]);

  const loadUser = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) {
        router.push('/login');
        return;
      }

      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      // Load current interests from user profile
      const userInterests = parsedUser.interests || [];
      setSelectedInterests(userInterests);
      setOriginalInterests(userInterests);
    } catch (error) {
      console.error('Failed to load user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedContent = async () => {
    if (selectedInterests.length === 0) return;

    setLoadingFeed(true);
    try {
      // Fetch posts and reels based on interests
      const [postsResponse, reelsResponse] = await Promise.all([
        feedService.getHomeFeed({ limit: 10 }).catch(() => ({ success: false, data: null })),
        reelService.getReelsFeed({ limit: 10 }).catch(() => ({ success: false, data: null })),
      ]);

      if (postsResponse.success && postsResponse.data) {
        setSuggestedPosts(postsResponse.data.posts || []);
      }

      if (reelsResponse.success && reelsResponse.data) {
        setSuggestedReels(reelsResponse.data.reels || []);
      }
    } catch (error) {
      console.error('Failed to load suggested content:', error);
    } finally {
      setLoadingFeed(false);
    }
  };

  const toggleInterest = (interestId: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interestId)) {
        return prev.filter((id) => id !== interestId);
      } else {
        return [...prev, interestId];
      }
    });
  };

  const hasChanges = () => {
    if (selectedInterests.length !== originalInterests.length) return true;
    return !selectedInterests.every((interest) => originalInterests.includes(interest));
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      showToast.info('No changes to save');
      return;
    }

    setSaving(true);
    try {
      const response = await authService.updateProfile({
        interests: selectedInterests,
      } as any);

      if (response.success) {
        // Update local storage
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          parsedUser.interests = selectedInterests;
          localStorage.setItem('user', JSON.stringify(parsedUser));
          setUser(parsedUser);
        }

        setOriginalInterests(selectedInterests);
        toasts.settingsSaved();
      } else {
        showToast.error('Failed to save interests');
      }
    } catch (error) {
      console.error('Failed to save interests:', error);
      showToast.error('Failed to save interests');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const filteredCategories = searchQuery
    ? INTEREST_CATEGORIES.filter((cat) =>
        cat.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : INTEREST_CATEGORIES;

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
      <main className="flex-1 lg:ml-64 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-secondary">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Your Interests</h1>
          </div>
          <p className="text-muted-foreground">
            Tell us what you love! We'll personalize your feed with posts and reels that match your
            interests.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'interests' ? 'default' : 'outline'}
            onClick={() => setActiveTab('interests')}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Choose Interests
          </Button>
          <Button
            variant={activeTab === 'feed' ? 'default' : 'outline'}
            onClick={() => setActiveTab('feed')}
            className="gap-2"
            disabled={selectedInterests.length === 0}
          >
            <Flame className="w-4 h-4" />
            For You Feed
          </Button>
        </div>

        {activeTab === 'interests' ? (
          <>
            {/* Selected Interests Count */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedInterests.length} interests selected
                </span>
                {selectedInterests.length < 3 && (
                  <span className="text-xs text-amber-500">
                    (Select at least 3 for better recommendations)
                  </span>
                )}
              </div>

              {hasChanges() && (
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Save Changes
                </Button>
              )}
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search interests..."
                className="pl-10"
              />
            </div>

            {/* Selected Interests Pills */}
            {selectedInterests.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-3">Your Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedInterests.map((interestId) => {
                    const interest = INTEREST_CATEGORIES.find((c) => c.id === interestId);
                    if (!interest) return null;
                    return (
                      <button
                        key={interestId}
                        onClick={() => toggleInterest(interestId)}
                        className={`
                          flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                          bg-gradient-to-r ${interest.color} text-white
                          hover:opacity-90 transition-opacity
                        `}
                      >
                        <interest.icon className="w-4 h-4" />
                        {interest.label}
                        <X className="w-3 h-3 ml-1" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Interest Categories Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredCategories.map((category) => {
                const isSelected = selectedInterests.includes(category.id);
                return (
                  <button
                    key={category.id}
                    onClick={() => toggleInterest(category.id)}
                    className={`
                      relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                      ${
                        isSelected
                          ? `border-primary bg-primary/10 shadow-lg shadow-primary/20`
                          : `border-border bg-card hover:border-primary/50 hover:bg-muted/50`
                      }
                    `}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`
                      p-3 rounded-full mb-2
                      ${isSelected ? `bg-gradient-to-br ${category.color}` : 'bg-muted'}
                    `}
                    >
                      <category.icon
                        className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-muted-foreground'}`}
                      />
                    </div>
                    <span
                      className={`text-sm font-medium text-center ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      {category.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {filteredCategories.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No interests found matching "{searchQuery}"</p>
              </div>
            )}
          </>
        ) : (
          /* For You Feed Tab */
          <div>
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Personalized for You</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on your interests:{' '}
                {selectedInterests
                  .map((id) => INTEREST_CATEGORIES.find((c) => c.id === id)?.label)
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>

            {loadingFeed ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Posts Section */}
                {suggestedPosts.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-4">Suggested Posts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {suggestedPosts.slice(0, 4).map((post) => (
                        <PostCard key={post._id} post={post} currentUserId={user?._id} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Reels Section */}
                {suggestedReels.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-4">Suggested Reels</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {suggestedReels.slice(0, 8).map((reel) => (
                        <div key={reel._id} className="aspect-[9/16] rounded-xl overflow-hidden">
                          <ReelCard
                            reel={reel}
                            onCommentClick={() => router.push(`/reel/${reel._id}?comments=true`)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {suggestedPosts.length === 0 && suggestedReels.length === 0 && (
                  <div className="text-center py-12">
                    <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No content yet</h3>
                    <p className="text-muted-foreground">
                      Follow more people or wait for new content matching your interests
                    </p>
                  </div>
                )}
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
