'use client';

import AnimatedLogo from '@/components/animated-logo';
import { Button } from '@/components/ui/button';
import { authService } from '@/lib/api-services';
import { showToast } from '@/lib/toast';
import {
  ArrowRight,
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
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Trophy,
  Tv,
  Utensils,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
  { id: 'nature', label: 'Nature', icon: Leaf, color: 'from-green-600 to-lime-500' },
  { id: 'finance', label: 'Finance', icon: DollarSign, color: 'from-emerald-600 to-green-500' },
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
  { id: 'news', label: 'News', icon: Tv, color: 'from-gray-600 to-slate-500' },
  { id: 'science', label: 'Science', icon: Smartphone, color: 'from-blue-500 to-purple-500' },
  { id: 'spirituality', label: 'Spirituality', icon: Star, color: 'from-amber-400 to-yellow-400' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: 'from-fuchsia-500 to-pink-500' },
  { id: 'podcasts', label: 'Podcasts', icon: Mic, color: 'from-indigo-600 to-violet-500' },
  { id: 'lifestyle', label: 'Lifestyle', icon: Coffee, color: 'from-stone-500 to-stone-600' },
];

export default function SetupInterestsPage() {
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(userData));
  }, [router]);

  const toggleInterest = (interestId: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interestId)) {
        return prev.filter((id) => id !== interestId);
      } else {
        return [...prev, interestId];
      }
    });
  };

  const handleContinue = async () => {
    if (selectedInterests.length < 3) {
      showToast.warning('Please select at least 3 interests');
      return;
    }

    setSaving(true);
    try {
      const response = await authService.completeProfile({
        username: user?.username || `user_${Date.now()}`,
        interests: selectedInterests,
      });

      if (response.success) {
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          parsedUser.interests = selectedInterests;
          parsedUser.profileCompleted = true;
          localStorage.setItem('user', JSON.stringify(parsedUser));
        }

        showToast.success("Interests saved! Let's explore your personalized feed.");
        router.push('/home');
      } else {
        const updateResponse = await authService.updateProfile({
          interests: selectedInterests,
        } as any);

        if (updateResponse.success) {
          const userData = localStorage.getItem('user');
          if (userData) {
            const parsedUser = JSON.parse(userData);
            parsedUser.interests = selectedInterests;
            localStorage.setItem('user', JSON.stringify(parsedUser));
          }
          showToast.success('Interests saved!');
          router.push('/home');
        } else {
          showToast.error('Failed to save interests');
        }
      }
    } catch (error) {
      try {
        await authService.updateProfile({ interests: selectedInterests } as any);
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          parsedUser.interests = selectedInterests;
          localStorage.setItem('user', JSON.stringify(parsedUser));
        }
        router.push('/home');
      } catch {
        showToast.error('Failed to save interests');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.push('/home');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <AnimatedLogo size={64} />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">What are you interested in?</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Select at least 3 topics you love. We'll use this to show you posts, reels, and accounts
            you'll enjoy!
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          <div
            className={`
            px-4 py-2 rounded-full text-sm font-medium transition-all
            ${
              selectedInterests.length >= 3
                ? 'bg-green-500/20 text-green-600 border border-green-500/30'
                : 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
            }
          `}
          >
            <span className="flex items-center gap-2">
              {selectedInterests.length >= 3 ? (
                <Check className="w-4 h-4" />
              ) : (
                <Heart className="w-4 h-4" />
              )}
              {selectedInterests.length} / 3+ interests selected
            </span>
          </div>
        </div>

        {selectedInterests.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-card border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Your Interests
            </h3>
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
                      hover:opacity-90 transition-opacity shadow-sm
                    `}
                  >
                    <interest.icon className="w-4 h-4" />
                    {interest.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
          {INTEREST_CATEGORIES.map((category) => {
            const isSelected = selectedInterests.includes(category.id);
            return (
              <button
                key={category.id}
                onClick={() => toggleInterest(category.id)}
                className={`
                  relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                  ${
                    isSelected
                      ? `border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]`
                      : `border-border bg-card hover:border-primary/50 hover:bg-muted/50`
                  }
                `}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
                <div
                  className={`
                  p-3 rounded-full mb-2 transition-all
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

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
            Skip for now
          </Button>
          <Button
            onClick={handleContinue}
            disabled={selectedInterests.length < 3 || saving}
            className="gap-2 px-8"
            size="lg"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          You can always change your interests later in Settings
        </p>
      </div>
    </div>
  );
}
