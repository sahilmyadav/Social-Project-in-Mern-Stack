'use client';

import { Button } from '@/components/ui/button';
import { followService, notificationService } from '@/lib/api-services';
import { Bell, Home, LogOut, MessageCircle, Plus, Radio, Search, User, Video } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface NavigationProps {
  user: any;
  onLogout: () => void;
  isMobile?: boolean;
}

export default function Navigation({ user, onLogout, isMobile }: NavigationProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationApiAvailable, setNotificationApiAvailable] = useState(true);

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

  // Mobile navigation items (5 essential items)
  const mobileNavItems = [
    { icon: Home, label: 'Home', href: '/home' },
    { icon: Search, label: 'Explore', href: '/explore' },
    { icon: Radio, label: 'Live', href: '/live' },
    { icon: Plus, label: 'Create', href: '/create', isSpecial: true }, // Special styling for create
    { icon: MessageCircle, label: 'Chat', href: '/chat' },
    { icon: Bell, label: 'Notifications', href: '/notifications', badge: unreadCount },
    { icon: User, label: 'Profile', href: '/profile' },
  ];

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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-lg z-50 shadow-lg">
        <div className="flex items-center justify-around px-2 py-2 max-w-screen-sm mx-auto">
          {mobileNavItems.map((item) => (
            <Link key={item.label} href={item.href} className="flex-1 flex justify-center">
              <div className="relative">
                {item.isSpecial ? (
                  // Special Create button with gradient
                  <div className="p-3 rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-md active:scale-95 transition-transform cursor-pointer">
                    <item.icon size={24} strokeWidth={2.5} />
                  </div>
                ) : (
                  // Regular nav items
                  <div className="p-3 rounded-xl hover:bg-muted/50 active:scale-95 transition-all relative cursor-pointer">
                    <item.icon size={24} className="text-foreground" strokeWidth={2} />

                    {/* Badge for notifications - positioned on icon */}
                    {item.badge && item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1.5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold border-2 border-card shadow-sm">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
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
        {desktopNavItems.map((item) => (
          <Link key={item.label} href={item.href}>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition text-foreground relative cursor-pointer">
              <item.icon size={20} className="text-primary" />
              <span className="font-semibold">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          </Link>
        ))}
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
