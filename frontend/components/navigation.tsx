'use client';

import { followService, notificationService } from '@/lib/api-services';
import {
  Bookmark,
  Compass,
  Film,
  Heart,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PlusSquare,
  Search,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NavigationProps {
  user: any;
  onLogout: () => void;
  isMobile?: boolean;
}

export default function Navigation({ user, onLogout, isMobile }: NavigationProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationApiAvailable, setNotificationApiAvailable] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (notificationApiAvailable && user) {
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, notificationApiAvailable]);

  const loadUnreadCount = async () => {
    if (!notificationApiAvailable) return;

    try {
      const [notificationResponse, followRequestsResponse] = await Promise.all([
        notificationService.getUnreadCount(),
        followService.getPendingRequests({ limit: 100 }),
      ]);

      let totalCount = 0;

      if (notificationResponse.success && notificationResponse.data) {
        totalCount += notificationResponse.data.unreadCount || 0;
      }

      if (followRequestsResponse.success && followRequestsResponse.data) {
        const pendingRequestsCount = Array.isArray(followRequestsResponse.data)
          ? followRequestsResponse.data.length
          : 0;
        totalCount += pendingRequestsCount;
      }

      setUnreadCount(totalCount);
    } catch (error: any) {
      if (error?.statusCode === 404) {
        setNotificationApiAvailable(false);
      }
    }
  };

  const mainNavItems = [
    { icon: Home, label: 'Home', href: '/home' },
    { icon: Search, label: 'Search', href: '/explore' },
    { icon: Compass, label: 'Explore', href: '/explore' },
    { icon: Film, label: 'Reels', href: '/reels' },
    { icon: MessageCircle, label: 'Messages', href: '/chat' },
    { icon: Heart, label: 'Notifications', href: '/notifications', badge: unreadCount },
    { icon: PlusSquare, label: 'Create', href: '/create' },
    { icon: User, label: 'Profile', href: '/profile' },
  ];

  const mobileNavItems = [
    { icon: Home, label: 'Home', href: '/home' },
    { icon: Search, label: 'Search', href: '/explore' },
    { icon: PlusSquare, label: 'Create', href: '/create' },
    { icon: Film, label: 'Reels', href: '/reels' },
    { icon: User, label: 'Profile', href: '/profile' },
  ];

  const isActive = (href: string) => pathname === href;

  // Mobile Bottom Navigation
  if (isMobile) {
    return (
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50">
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          {mobileNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.label} href={item.href}>
                <div
                  className={`flex flex-col items-center justify-center p-2 transition-transform active:scale-90 ${
                    active ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <item.icon
                    size={26}
                    className={`transition-all duration-200 ${active ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`}
                    fill={active && item.icon !== PlusSquare ? 'currentColor' : 'none'}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  // Desktop Sidebar Navigation
  return (
    <nav className="flex flex-col h-full py-6 px-3">
      {/* Logo */}
      <Link href="/home" className="mb-10 px-3 group">
        <h1 className="text-[22px] font-serif italic font-semibold hidden xl:block group-hover:opacity-80 transition-opacity">
          ClickME
        </h1>
        <div className="xl:hidden w-11 h-11 flex items-center justify-center hover:bg-muted rounded-lg transition-colors">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
            <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 1.802c-2.67 0-2.986.01-4.04.058-.976.045-1.505.207-1.858.344-.466.182-.8.398-1.15.748-.35.35-.566.684-.748 1.15-.137.353-.3.882-.344 1.857-.048 1.055-.058 1.37-.058 4.041 0 2.67.01 2.986.058 4.04.045.976.207 1.505.344 1.858.182.466.399.8.748 1.15.35.35.684.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058 2.67 0 2.987-.01 4.04-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.684.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041 0-2.67-.01-2.986-.058-4.04-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 0 0-.748-1.15 3.098 3.098 0 0 0-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.055-.048-1.37-.058-4.041-.058zm0 3.063a5.135 5.135 0 1 1 0 10.27 5.135 5.135 0 0 1 0-10.27zm0 8.468a3.333 3.333 0 1 0 0-6.666 3.333 3.333 0 0 0 0 6.666zm6.538-8.671a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" />
          </svg>
        </div>
      </Link>

      {/* Main Navigation */}
      <div className="flex-1 space-y-1">
        {mainNavItems.map((item, index) => {
          // Skip duplicate Explore for desktop (we use Search)
          if (item.label === 'Explore' && index === 2) return null;

          const active = isActive(item.href);
          return (
            <Link key={item.label} href={item.href}>
              <div
                className={`flex items-center gap-4 px-3 py-3 rounded-lg transition-all duration-200 group hover:bg-muted/80 ${
                  active ? 'font-bold' : 'font-normal'
                }`}
              >
                <div className="relative">
                  <item.icon
                    size={26}
                    className={`transition-transform duration-200 group-hover:scale-110 ${
                      active ? 'stroke-[2.5px]' : 'stroke-[1.5px]'
                    }`}
                    fill={
                      active && ![PlusSquare, Search, Heart].includes(item.icon)
                        ? 'currentColor'
                        : 'none'
                    }
                  />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#FF3040] text-white text-[11px] rounded-full flex items-center justify-center font-semibold">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="hidden xl:block text-[15px]">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* More Menu */}
      <div className="relative mt-4">
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className="w-full flex items-center gap-4 px-3 py-3 rounded-lg transition-all duration-200 hover:bg-muted/80"
        >
          <Menu size={26} className="stroke-[1.5px]" />
          <span className="hidden xl:block text-[15px]">More</span>
        </button>

        {/* Dropdown Menu */}
        {showMoreMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
            <div className="absolute bottom-full left-0 mb-2 w-[266px] bg-card rounded-2xl border border-border shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="py-2">
                <Link
                  href="/account-settings"
                  onClick={() => setShowMoreMenu(false)}
                  className="flex items-center gap-4 px-4 py-[14px] hover:bg-muted/80 transition-colors"
                >
                  <Settings size={22} className="stroke-[1.5px]" />
                  <span className="text-[14px]">Settings</span>
                </Link>

                <Link
                  href="/profile?tab=saved"
                  onClick={() => setShowMoreMenu(false)}
                  className="flex items-center gap-4 px-4 py-[14px] hover:bg-muted/80 transition-colors"
                >
                  <Bookmark size={22} className="stroke-[1.5px]" />
                  <span className="text-[14px]">Saved</span>
                </Link>

                {mounted && (
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="w-full flex items-center gap-4 px-4 py-[14px] hover:bg-muted/80 transition-colors"
                  >
                    {theme === 'dark' ? (
                      <Sun size={22} className="stroke-[1.5px]" />
                    ) : (
                      <Moon size={22} className="stroke-[1.5px]" />
                    )}
                    <span className="text-[14px]">Switch appearance</span>
                  </button>
                )}

                <div className="h-[6px] bg-muted/50 my-2" />

                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-4 px-4 py-[14px] hover:bg-muted/80 transition-colors"
                >
                  <LogOut size={22} className="stroke-[1.5px]" />
                  <span className="text-[14px]">Log out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* User Profile Mini - Instagram Style */}
      <div className="mt-3">
        <Link href="/profile">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/80 transition-all duration-200 group">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700 flex items-center justify-center overflow-hidden ring-[2px] ring-transparent group-hover:ring-foreground/10 transition-all">
                {(user?.profileImage || user?.profilePicture)?.startsWith?.('http') ? (
                  <img
                    src={user?.profileImage || user?.profilePicture}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-xs font-medium">
                    {user?.firstName?.[0] || user?.username?.[0] || 'U'}
                  </span>
                )}
              </div>
            </div>
            <div className="hidden xl:block flex-1 min-w-0">
              <p className="text-[14px] font-semibold truncate leading-tight">
                {user?.username || 'user'}
              </p>
              <p className="text-[12px] text-muted-foreground truncate leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
            </div>
          </div>
        </Link>
      </div>
    </nav>
  );
}
