'use client';

import { Button } from '@/components/ui/button';
import { followService, notificationService } from '@/lib/api-services';
import {
  Bell,
  Compass,
  Home,
  LogOut,
  MessageCircle,
  Plus,
  Radio,
  Search,
  User,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NavigationProps {
  user: any;
  onLogout: () => void;
  isMobile?: boolean;
}

export default function Navigation({ user, onLogout, isMobile }: NavigationProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationApiAvailable, setNotificationApiAvailable] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // Only load if API is available and user exists
    if (notificationApiAvailable && user) {
      loadUnreadCount();

      // Poll for new notifications every 30 seconds
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, notificationApiAvailable]);

  const loadUnreadCount = async () => {
    // Don't call if we know the API isn't available
    if (!notificationApiAvailable) return;

    try {
      // Fetch both unread notifications and pending follow requests
      const [notificationResponse, followRequestsResponse] = await Promise.all([
        notificationService.getUnreadCount(),
        followService.getPendingRequests({ limit: 100 }), // Get count of pending requests
      ]);

      let totalCount = 0;

      // Add unread notifications count
      if (notificationResponse.success && notificationResponse.data) {
        totalCount += notificationResponse.data.unreadCount || 0;
      }

      // Add pending follow requests count
      if (followRequestsResponse.success && followRequestsResponse.data) {
        const pendingRequestsCount = Array.isArray(followRequestsResponse.data)
          ? followRequestsResponse.data.length
          : 0;
        totalCount += pendingRequestsCount;
      }

      setUnreadCount(totalCount);
    } catch (error: any) {
      // If 404, disable future calls
      if (error?.statusCode === 404) {
        setNotificationApiAvailable(false);
      }
      // Silently fail for all other errors
    }
  };

  // Mobile navigation items (5 essential items for cleaner look)
  const mobileNavItems = [
    { icon: Home, label: 'Home', href: '/home' },
    { icon: Compass, label: 'Explore', href: '/explore' },
    { icon: Radio, label: 'Live', href: '/live' },
    { icon: Plus, label: 'Create', href: '/create', isSpecial: true },
    { icon: MessageCircle, label: 'Chat', href: '/chat' },
    { icon: Bell, label: 'Alerts', href: '/notifications', badge: unreadCount },
    { icon: User, label: 'Profile', href: '/profile' },
  ];

  // Check if current path matches the nav item
  const isActive = (href: string) => {
    if (href === '/home') return pathname === '/home' || pathname === '/';
    return pathname?.startsWith(href);
  };

  // Desktop navigation items (all items)
  const desktopNavItems = [
    { icon: Home, label: 'Home', href: '/home' },
    { icon: Search, label: 'Explore', href: '/explore' },
    { icon: Radio, label: 'Live', href: '/live' },
    { icon: Video, label: 'Reels', href: '/reels' },
    { icon: MessageCircle, label: 'Chat', href: '/chat' },
    { icon: Bell, label: 'Notifications', href: '/notifications', badge: unreadCount },
    { icon: Plus, label: 'Create', href: '/create' },
    { icon: User, label: 'Profile', href: '/profile' },
  ];

  if (isMobile) {
    return (
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Gradient border top */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        {/* Nav container with glass effect */}
        <div className="bg-card/90 backdrop-blur-xl border-t border-border/50 shadow-2xl shadow-black/20">
          <div className="flex items-center justify-around px-1 py-1.5 max-w-screen-sm mx-auto">
            {mobileNavItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link key={item.label} href={item.href} className="flex-1 flex justify-center">
                  {item.isSpecial ? (
                    // Special Create button with gradient ring
                    <div className="relative -mt-6">
                      {/* Outer glow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 rounded-full blur-md opacity-60 animate-pulse" />

                      {/* Button */}
                      <div className="relative p-3.5 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white shadow-lg active:scale-90 transition-all duration-200 cursor-pointer border-4 border-card">
                        <item.icon size={22} strokeWidth={2.5} />
                      </div>
                    </div>
                  ) : (
                    // Regular nav items with labels
                    <div
                      className={`
                      flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl
                      transition-all duration-200 active:scale-90 cursor-pointer min-w-[48px]
                      ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}
                    `}
                    >
                      <div className="relative">
                        {/* Active indicator dot */}
                        {active && (
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                        )}

                        <item.icon
                          size={22}
                          strokeWidth={active ? 2.5 : 2}
                          className={`transition-all duration-200 ${active ? 'scale-110' : ''}`}
                        />

                        {/* Badge for notifications */}
                        {item.badge && item.badge > 0 && (
                          <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold border-2 border-card animate-pulse">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </div>

                      {/* Label */}
                      <span
                        className={`
                        text-[10px] font-medium transition-all duration-200
                        ${active ? 'text-primary font-semibold' : ''}
                      `}
                      >
                        {item.label}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Safe area padding for iOS */}
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </nav>
    );
  }

  return (
    <nav className="space-y-4">
      <Link href="/home" className="block mb-8">
        <img
          src="/logo.png"
          alt="ClickME"
          className="w-12 h-12 rounded-xl object-cover hover:scale-105 transition-transform"
        />
      </Link>

      <div className="space-y-2">
        {desktopNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.label} href={item.href}>
              <button
                className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer relative
                ${
                  active
                    ? 'bg-primary/10 text-primary border-l-2 border-primary'
                    : 'hover:bg-muted text-foreground'
                }
              `}
              >
                <item.icon
                  size={20}
                  className={active ? 'text-primary' : 'text-muted-foreground'}
                />
                <span className={`font-semibold ${active ? 'text-primary' : ''}`}>
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            </Link>
          );
        })}
      </div>

      <div className="pt-4 border-t border-border">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">Signed in as</p>
          <p className="font-semibold text-foreground">{user?.name}</p>
        </div>
        <Button
          onClick={onLogout}
          variant="outline"
          className="w-full gap-2 bg-transparent hover:bg-red-500/10 hover:text-red-500 hover:border-red-500 transition-colors cursor-pointer"
        >
          <LogOut size={18} />
          Log Out
        </Button>
      </div>
    </nav>
  );
}
