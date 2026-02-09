'use client';

import Navigation from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog';
import { authService } from '@/lib/api-services';
import { toasts } from '@/lib/toast';
import { ArrowLeft, UserX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function BlockedUsersPage() {
  const router = useRouter();
  const { confirm, dialogProps } = useConfirmDialog();
  const [user, setUser] = useState<any>(null);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentUser();
    loadBlockedUsers();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      } else {
        const response = await authService.getCurrentUser();
        if (response.success && response.data) {
          setUser(response.data);
          localStorage.setItem('user', JSON.stringify(response.data));
        }
      }
    } catch (error) {
      router.push('/login');
    }
  };

  const loadBlockedUsers = async () => {
    try {
      setLoading(true);
      const response = await authService.getBlockedUsers();

      if (response.success && response.data) {
        const users = Array.isArray(response.data)
          ? response.data
          : response.data.blockedUsers || [];
        setBlockedUsers(users);
      } else {
        setBlockedUsers([]);
      }
    } catch (error) {
      setBlockedUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = (userId: string, userName: string) => {
    confirm({
      title: 'Unblock User',
      message: `Are you sure you want to unblock ${userName}?`,
      confirmText: 'Unblock',
      variant: 'info',
      onConfirm: async () => {
        try {
          setUnblocking(userId);
          const response = await authService.unblockUser(userId);

          if (response.success) {
            setBlockedUsers(blockedUsers.filter((u) => u._id !== userId && u.id !== userId));
            toasts.userUnblocked(userName);
          } else {
            toasts.error(response.message || 'Failed to unblock user');
          }
        } catch (error: any) {
          toasts.error(error?.message || 'Failed to unblock user');
        } finally {
          setUnblocking(null);
        }
      },
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-20 lg:pb-0">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-0">
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        <section className="lg:col-span-3 p-4 lg:p-8">
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => router.push('/account-settings')}
              className="mb-4 gap-2 cursor-pointer"
            >
              <ArrowLeft size={20} />
              Back to Settings
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Blocked Users</h1>
            <p className="text-muted-foreground mt-2">
              Manage users you've blocked. Blocked users can't see your profile, posts, or message
              you.
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading blocked users...</p>
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserX size={40} className="text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Blocked Users</h3>
                <p className="text-muted-foreground">
                  You haven't blocked anyone yet. When you block someone, they'll appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {blockedUsers.map((blockedUser) => {
                  const userId = blockedUser._id || blockedUser.id;
                  const fullName =
                    blockedUser.fullName ||
                    `${blockedUser.firstName || ''} ${blockedUser.lastName || ''}`.trim();
                  const username = blockedUser.username || blockedUser.email || 'user';
                  const avatar =
                    blockedUser.profilePicture || blockedUser.profileImage || blockedUser.avatar;

                  return (
                    <div
                      key={userId}
                      className="p-4 hover:bg-muted/50 transition flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-2xl overflow-hidden">
                          {avatar && avatar.startsWith('http') ? (
                            <img
                              src={avatar}
                              alt={fullName || username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{(fullName?.[0] || username?.[0] || 'U').toUpperCase()}</span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-semibold text-foreground">{fullName || username}</h3>
                          <p className="text-sm text-muted-foreground">@{username}</p>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleUnblock(userId, fullName || username)}
                        disabled={unblocking === userId}
                        variant="outline"
                        className="gap-2 cursor-pointer  hover:text-red-400 text-white"
                      >
                        {unblocking === userId ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            Unblocking...
                          </>
                        ) : (
                          <>
                            <UserX size={16} />
                            Unblock
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {blockedUsers.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                ℹ️ About Blocking
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Blocked users can't see your profile or posts</li>
                <li>• They can't send you messages or follow you</li>
                <li>• You won't see their posts in your feed</li>
                <li>• Unblocking will restore normal interactions</li>
              </ul>
            </div>
          )}
        </section>
      </div>

      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      <ConfirmDialog {...dialogProps} />
    </main>
  );
}
