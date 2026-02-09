'use client';

import { Button } from '@/components/ui/button';
import { chatService, followService, notificationService } from '@/lib/api-services';
import {
    Bell,
    Heart,
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
import { useEffect, useState } from 'react';
import AnimatedLogo from './animated-logo';

interface NavigationProps {
  user: any;
  onLogout: () => void;
  isMobile?: boolean;
}

export default function Navigation({ user, onLogout, isMobile }: NavigationProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [notificationApiAvailable, setNotificationApiAvailable] = useState(true);

  useEffect(() => {
    if (notificationApiAvailable && user && !isMobile) {
      loadUnreadCount();
      loadChatUnreadCount();

      const interval = setInterval(() => {
        loadUnreadCount();
        loadChatUnreadCount();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [user, notificationApiAvailable, isMobile]);

  const loadUnreadCount = async () => {
    if (!notificationApiAvailable) return;

    try {
      const [notificationResponse, followRequestsResponse] = await Promise.all([
        notificationService.getUnreadCount(),
        followService.getPendingRequests({ limit: 100 }), // Get count of pending requests
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

  const loadChatUnreadCount = async () => {
    try {
      const response = await chatService.getUnreadCount();
      if (response.success && response.data) {
        setChatUnreadCount(response.data.unreadCount || 0);
      }
    } catch (error) {
    }
  };

  const mobileNavItems = [
    { icon: Home, label: 'Home', href: '/home' },
    { icon: Search, label: 'Explore', href: '/explore' },
    { icon: Radio, label: 'Live', href: '/live' },
    { icon: Plus, label: 'Create', href: '/create', isSpecial: true }, // Special styling for create
    {
      icon: MessageCircle,
      label: 'Chat',
      href: '/chat',
      badge: chatUnreadCount > 0 ? chatUnreadCount : undefined,
    },
    {
      icon: Bell,
      label: 'Notifications',
      href: '/notifications',
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { icon: User, label: 'Profile', href: '/profile' },
  ];

  const desktopNavItems = [
    { icon: Home, label: 'Home', href: '/home' },
    { icon: Search, label: 'Explore', href: '/explore' },
    { icon: Radio, label: 'Live', href: '/live' },
    { icon: Video, label: 'Reels', href: '/reels' },
    {
      icon: MessageCircle,
      label: 'Chat',
      href: '/chat',
      badge: chatUnreadCount > 0 ? chatUnreadCount : undefined,
    },
    {
      icon: Bell,
      label: 'Notifications',
      href: '/notifications',
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { icon: Plus, label: 'Create', href: '/create' },
    { icon: Heart, label: 'Interests', href: '/interests' },
    { icon: User, label: 'Profile', href: '/profile' },
  ];

  if (isMobile) {
    return (
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-border/50 bg-card/80 backdrop-blur-xl z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around px-1 py-1.5 max-w-screen-sm mx-auto">
          {mobileNavItems.map((item) => (
            <Link key={item.label} href={item.href} className="flex-1 flex justify-center">
              <div className="relative group">
                {item.isSpecial ? (
                  <div className="relative -mt-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-secondary/40 rounded-full blur-lg scale-110 opacity-70" />
                    <div className="relative p-4 rounded-full bg-gradient-to-br from-primary via-purple-500 to-secondary text-white shadow-xl active:scale-90 transition-all duration-200 cursor-pointer border-4 border-card">
                      <item.icon size={26} strokeWidth={2.5} />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-2.5 px-3 rounded-2xl active:scale-90 active:bg-muted/60 transition-all duration-200 cursor-pointer">
                    <div className="relative">
                      <item.icon
                        size={24}
                        className="text-foreground/70 group-hover:text-foreground transition-colors"
                        strokeWidth={1.6}
                      />

                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold shadow-md ring-2 ring-card">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
        <div className="h-safe-area-inset-bottom bg-card/80" />
      </nav>
    );
  }

  return (
    <nav className="space-y-4">
      <div className="flex items-center gap-3 mb-8">
        <AnimatedLogo size={48} />
        <span className="text-xl font-bold logo-gradient-text">ClickME</span>
      </div>

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
          <p className="font-semibold text-foreground">
            {user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.username || user?.name || 'User'}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            onLogout();
          }}
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
