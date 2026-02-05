'use client';

import Navigation from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { authService, followService, notificationService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
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
  const [followingStatus, setFollowingStatus] = useState<Record<string, 'none' | 'following' | 'pending'>>({});
  const [processingFollowBack, setProcessingFollowBack] = useState<string | null>(null);
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

  // Check if current user is following the notification sender
  const checkFollowingStatus = async (userId: string) => {
    try {
      const response = await authService.getUserProfile(userId);
      if (response.success && response.data) {
        const user = response.data;
        if (user.isFollowing) {
          setFollowingStatus(prev => ({ ...prev, [userId]: 'following' }));
        } else if (user.isPending) {
          setFollowingStatus(prev => ({ ...prev, [userId]: 'pending' }));
        } else {
          setFollowingStatus(prev => ({ ...prev, [userId]: 'none' }));
        }
      }
    } catch (error) {
      console.error('Failed to check following status:', error);
    }
  };

  // Handle Follow Back button click
  const handleFollowBack = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation(); // Prevent notification click
    setProcessingFollowBack(userId);
    try {
      const response = await followService.followBack(userId);
      if (response.success) {
        setFollowingStatus(prev => ({ ...prev, [userId]: 'following' }));
      }
    } catch (error: any) {
      console.error('Failed to follow back:', error);
      // If error is "already following" or similar, update status
      if (error?.message?.toLowerCase().includes('already')) {
        setFollowingStatus(prev => ({ ...prev, [userId]: 'following' }));
      }
    } finally {
      setProcessingFollowBack(null);
    }
  };

  // Check following status for follow notifications
  useEffect(() => {
    const followNotifications = notifications.filter(n => n.type === 'follow' && n.sender_id?._id);
    followNotifications.forEach(notification => {
      const senderId = notification.sender_id._id;
      if (!followingStatus[senderId]) {
        checkFollowingStatus(senderId);
      }
    });
  }, [notifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification._id);
    }

    // Build the navigation URL based on notification type
    let targetUrl = notification.action_url;

    // If action_url exists, parse it to get the post/reel ID
    if (notification.action_url) {
      // Check if it's a comment notification - open with comments visible
      if (notification.type === 'comment' || notification.type === 'mention') {
        // Extract post ID from action_url (e.g., /post/123 or /posts/123)
        const postIdMatch = notification.action_url.match(/\/posts?\/([a-zA-Z0-9]+)/);
        if (postIdMatch) {
          targetUrl = `/post/${postIdMatch[1]}?comments=true`;
        } else {
          targetUrl = `${notification.action_url}?comments=true`;
        }
      } else if (notification.type === 'reel_comment') {
        // Extract reel ID from action_url
        const reelIdMatch = notification.action_url.match(/\/reels?\/([a-zA-Z0-9]+)/);
        if (reelIdMatch) {
          targetUrl = `/reel/${reelIdMatch[1]}?comments=true`;
        } else {
          targetUrl = `${notification.action_url}?comments=true`;
        }
      } else if (notification.type === 'like') {
        // Navigate to post page
        const postIdMatch = notification.action_url.match(/\/posts?\/([a-zA-Z0-9]+)/);
        if (postIdMatch) {
          targetUrl = `/post/${postIdMatch[1]}`;
        }
      } else if (notification.type === 'reel_like') {
        // Navigate to reel page
        const reelIdMatch = notification.action_url.match(/\/reels?\/([a-zA-Z0-9]+)/);
        if (reelIdMatch) {
          targetUrl = `/reel/${reelIdMatch[1]}`;
        }
      } else if (
        notification.type === 'follow' ||
        notification.type === 'follow_request_accepted'
      ) {
        // Navigate to user profile
        const userIdMatch = notification.action_url.match(/\/profile\/([a-zA-Z0-9]+)/);
        if (userIdMatch) {
          targetUrl = `/profile/${userIdMatch[1]}`;
        } else if (notification.sender_id?._id) {
          targetUrl = `/profile/${notification.sender_id._id}`;
        }
      }
    } else {
      // Fallback: construct URL based on notification type
      if (notification.type === 'follow' || notification.type === 'follow_request_accepted') {
        if (notification.sender_id?._id) {
          targetUrl = `/profile/${notification.sender_id._id}`;
        }
      }
    }

    if (targetUrl) {
      router.push(targetUrl);
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
    <main className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Main Content */}
        <section className="lg:col-span-2 max-w-2xl mx-auto pb-20 lg:pb-0 px-4 py-6">
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
                            src={getMediaUrl(
                              request.requester.profileImage ||
                              request.requester.profilePicture ||
                              request.requester.avatar
                            )}
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
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
                {filter === 'unread' ? (
                  <CheckCheck className="w-10 h-10 text-muted-foreground" />
                ) : (
                  <BellOff className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </h3>
              <p className="text-muted-foreground">
                {filter === 'unread'
                  ? "You've read all your notifications"
                  : "When people interact with your posts, you'll see it here"}
              </p>
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
                          src={getMediaUrl(
                            notification.sender_id.profileImage ||
                            notification.sender_id.profilePicture ||
                            notification.sender_id.avatar
                          )}
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
                            src={getMediaUrl(notification.thumbnail)}
                            className="w-12 h-12 rounded-md object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={getMediaUrl(notification.thumbnail)}
                            alt="Reel"
                            className="w-12 h-12 rounded-md object-cover"
                          />
                        )
                      ) : (
                        // Post thumbnail
                        <img
                          src={getMediaUrl(notification.thumbnail)}
                          alt="Post"
                          className="w-12 h-12 rounded-md object-cover"
                        />
                      )}
                    </div>
                  )}

                  {/* Follow Back Button - for follow notifications */}
                  {notification.type === 'follow' && notification.sender_id?._id && (
                    <div className="flex-shrink-0">
                      {followingStatus[notification.sender_id._id] === 'following' ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <UserCheck size={14} className="text-green-500" />
                          Following
                        </span>
                      ) : followingStatus[notification.sender_id._id] === 'pending' ? (
                        <span className="text-xs text-muted-foreground">Requested</span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e) => handleFollowBack(e, notification.sender_id._id)}
                          disabled={processingFollowBack === notification.sender_id._id}
                          className="gap-1"
                        >
                          {processingFollowBack === notification.sender_id._id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <UserPlus size={14} />
                          )}
                          Follow Back
                        </Button>
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
        </section>

        {/* Empty right column for symmetry */}
        <aside className="hidden lg:block lg:col-span-1 h-screen sticky top-0 border-l border-border"></aside>
      </div>

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />
    </main>
  );
}
