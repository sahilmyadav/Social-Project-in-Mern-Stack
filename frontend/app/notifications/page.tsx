'use client';

import Navigation from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { followService, notificationService } from '@/lib/api-services';
import {
  AtSign,
  Bell,
  BellOff,
  CheckCheck,
  Heart,
  Loader2,
  MessageCircle,
  Settings,
  Share2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NotificationSender {
  _id: string;
  firstName: string;
  lastName: string;
  username?: string;
  profileImage?: string;
  profilePicture?: string;
  avatar?: string;
}

interface Notification {
  _id: string;
  sender_id: NotificationSender;
  type:
    | 'like'
    | 'comment'
    | 'share'
    | 'follow'
    | 'mention'
    | 'reel_like'
    | 'reel_comment'
    | 'follow_request_accepted';
  title: string;
  message: string;
  thumbnail?: string;
  action_url?: string;
  is_read: boolean;
  createdAt: string;
}

interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
  nextCursor?: string;
  hasMore: boolean;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [user, setUser] = useState<any>(null);
  const [followRequests, setFollowRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadNotifications();
    loadUser();
    loadFollowRequests();
  }, [filter]);

  const loadFollowRequests = async () => {
    setLoadingRequests(true);
    try {
      const response = await followService.getPendingRequests({ limit: 20 });
      if (response.success && response.data) {
        setFollowRequests(response.data);
      }
    } catch (error) {
      console.error('Failed to load follow requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadUser = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await notificationService.getNotifications({
        page: 1,
        limit: 20,
      });

      if (response.success && response.data) {
        const data = response.data as NotificationResponse;

        // Filter notifications based on selected filter
        const allNotifications = data.notifications || [];
        const filteredNotifications =
          filter === 'unread' ? allNotifications.filter((n) => !n.is_read) : allNotifications;

        setNotifications(filteredNotifications);
        setUnreadCount(data.unreadCount || 0);
        setHasMore(data.hasMore || false);
        setCursor(data.nextCursor);
      } else {
        console.warn('⚠️ No notification data in response');
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error: any) {
      console.error('❌ Failed to load notifications:', error);
      setError(error.message || 'Failed to load notifications');
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);

      setNotifications((prev) =>
        prev.map((notif) => (notif._id === notificationId ? { ...notif, is_read: true } : notif))
      );

      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();

      setNotifications((prev) => prev.map((notif) => ({ ...notif, is_read: true })));

      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      const response = await followService.acceptFollowRequest(requestId);
      if (response.success) {
        setFollowRequests((prev) => prev.filter((req) => req._id !== requestId));
        // Reload notifications to show the "accepted" notification
        loadNotifications();
      }
    } catch (error) {
      console.error('Failed to accept request:', error);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      await followService.rejectFollowRequest(requestId);
      setFollowRequests((prev) => prev.filter((req) => req._id !== requestId));
    } catch (error) {
      console.error('Failed to reject request:', error);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification._id);
    }

    if (notification.action_url) {
      router.push(notification.action_url);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
      case 'reel_like':
        return <Heart className="w-5 h-5 text-red-500 fill-red-500" />;
      case 'comment':
      case 'reel_comment':
        return <MessageCircle className="w-5 h-5 text-blue-500" />;
      case 'follow':
      case 'follow_request_accepted':
        return <UserPlus className="w-5 h-5 text-green-500" />;
      case 'share':
        return <Share2 className="w-5 h-5 text-purple-500" />;
      case 'mention':
        return <AtSign className="w-5 h-5 text-orange-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const filteredNotifications = notifications;

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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/account-settings')}
              title="Notification Settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'unread' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('unread')}
              >
                Unread ({unreadCount})
              </Button>
            </div>

            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-primary"
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Follow Requests Section */}
        {followRequests.length > 0 && (
          <div className="mb-6 bg-card rounded-lg border border-border p-4">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Follow Requests ({followRequests.length})
            </h2>
            <div className="space-y-3">
              {followRequests.map((request: any) => (
                <div
                  key={request._id}
                  className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold overflow-hidden">
                      {request.requester?.profileImage ||
                      request.requester?.profilePicture ||
                      request.requester?.avatar ? (
                        <img
                          src={
                            request.requester.profileImage ||
                            request.requester.profilePicture ||
                            request.requester.avatar
                          }
                          alt={request.requester.firstName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        `${request.requester?.firstName?.[0] || ''}${request.requester?.lastName?.[0] || ''}`
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {request.requester?.firstName} {request.requester?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        @{request.requester?.username || 'user'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptRequest(request._id)}
                      disabled={processingRequest === request._id}
                      className="gap-2"
                    >
                      <UserCheck size={14} />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectRequest(request._id)}
                      disabled={processingRequest === request._id}
                      className="gap-2"
                    >
                      <X size={14} />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={loadNotifications} className="mt-2">
              Try Again
            </Button>
          </div>
        )}

        {/* Notifications List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-16">
            {/* Animated Illustration */}
            <div className="relative mb-8">
              {filter === 'unread' ? (
                <div className="w-28 h-28 mx-auto bg-gradient-to-br from-green-500/20 via-emerald-500/20 to-teal-500/20 rounded-full flex items-center justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500/30 via-emerald-500/30 to-teal-500/30 rounded-full flex items-center justify-center">
                    <CheckCheck className="w-10 h-10 text-green-500" />
                  </div>
                </div>
              ) : (
                <div className="w-28 h-28 mx-auto bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center animate-pulse">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary/30 via-purple-500/30 to-pink-500/30 rounded-full flex items-center justify-center">
                    <BellOff className="w-10 h-10 text-primary" />
                  </div>
                </div>
              )}
              {/* Decorative elements */}
              <div
                className="absolute top-2 left-1/4 w-3 h-3 bg-primary/40 rounded-full animate-bounce"
                style={{ animationDelay: '0.1s' }}
              />
              <div
                className="absolute top-8 right-1/4 w-2 h-2 bg-purple-500/40 rounded-full animate-bounce"
                style={{ animationDelay: '0.3s' }}
              />
              <div
                className="absolute bottom-4 left-1/3 w-2 h-2 bg-pink-500/40 rounded-full animate-bounce"
                style={{ animationDelay: '0.5s' }}
              />
            </div>

            <h3 className="text-2xl font-bold text-foreground mb-3">
              {filter === 'unread' ? 'All Caught Up! 🎉' : 'No Notifications Yet'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
              {filter === 'unread'
                ? "You've read all your notifications. Time to explore!"
                : "When people interact with your content, you'll see it here."}
            </p>

            {/* Action Buttons */}
            {filter !== 'unread' && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
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
                  Discover Content
                </a>
                <a
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
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => (
              <div
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                className={`
                  flex items-start gap-4 p-4 rounded-lg border cursor-pointer
                  transition-all hover:border-primary/50 hover:shadow-sm
                  ${!notification.is_read ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}
                `}
              >
                {/* Sender Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold overflow-hidden">
                    {notification.sender_id.profileImage ||
                    notification.sender_id.profilePicture ||
                    notification.sender_id.avatar ? (
                      <img
                        src={
                          notification.sender_id.profileImage ||
                          notification.sender_id.profilePicture ||
                          notification.sender_id.avatar
                        }
                        alt={notification.sender_id.firstName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      `${notification.sender_id.firstName[0]}${notification.sender_id.lastName[0]}`
                    )}
                  </div>

                  {/* Notification Type Icon Badge */}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background flex items-center justify-center border-2 border-background">
                    {getNotificationIcon(notification.type)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">
                      {notification.sender_id.firstName} {notification.sender_id.lastName}
                    </span>{' '}
                    <span className="text-muted-foreground">
                      {notification.message.replace(
                        `${notification.sender_id.firstName} ${notification.sender_id.lastName} `,
                        ''
                      )}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getTimeAgo(notification.createdAt)}
                  </p>
                </div>

                {/* Thumbnail */}
                {notification.thumbnail && (
                  <div className="flex-shrink-0">
                    {notification.type === 'reel_like' || notification.type === 'reel_comment' ? (
                      // Reel thumbnail - check if it's a video or image
                      notification.thumbnail.includes('.mp4') ||
                      notification.thumbnail.includes('.webm') ||
                      notification.thumbnail.includes('.mov') ? (
                        <video
                          src={notification.thumbnail}
                          className="w-12 h-12 rounded-md object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={notification.thumbnail}
                          alt="Reel"
                          className="w-12 h-12 rounded-md object-cover"
                        />
                      )
                    ) : (
                      // Post thumbnail
                      <img
                        src={notification.thumbnail}
                        alt="Post"
                        className="w-12 h-12 rounded-md object-cover"
                      />
                    )}
                  </div>
                )}

                {/* Unread Indicator */}
                {!notification.is_read && (
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && !loading && (
          <div className="text-center mt-6">
            <Button variant="outline" onClick={loadNotifications}>
              Load More
            </Button>
          </div>
        )}
      </main>

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />
    </div>
  );
}
