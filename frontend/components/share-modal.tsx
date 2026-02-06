'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import UserAvatar from '@/components/user-avatar';
import { chatService, followService } from '@/lib/api-services';
import { showToast } from '@/lib/toast';
import { Link2, Loader2, Search, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: 'post' | 'reel';
  contentId: string;
  contentUrl?: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName?: string;
  username: string;
  profileImage?: string;
  profilePicture?: string;
  avatar?: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  contentType,
  contentId,
  contentUrl,
}: ShareModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [sharedUsers, setSharedUsers] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Generate shareable link
  const shareableLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${contentType}/${contentId}`
      : contentUrl || `/${contentType}/${contentId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      showToast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast.error('Failed to copy link');
    }
  };

  const handleShareToWhatsApp = () => {
    const message = `Check out this ${contentType}: ${shareableLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleShareToTelegram = () => {
    const message = `Check out this ${contentType}: ${shareableLink}`;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareableLink)}&text=${encodeURIComponent(`Check out this ${contentType}!`)}`,
      '_blank'
    );
  };

  const handleShareToTwitter = () => {
    const message = `Check out this ${contentType}: ${shareableLink}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Check out this ${contentType}`,
          text: `Check out this ${contentType} on ClickME!`,
          url: shareableLink,
        });
      } catch (error) {
        // User cancelled or error
      }
    } else {
      handleCopyLink();
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsersToShare();
      setSearchQuery('');
      setSharedUsers(new Set());
      setCopied(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (user) =>
          user.firstName?.toLowerCase().includes(query) ||
          user.lastName?.toLowerCase().includes(query) ||
          user.username?.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const loadUsersToShare = async () => {
    try {
      setLoading(true);
      const userData = localStorage.getItem('user');
      if (!userData) return;

      const currentUser = JSON.parse(userData);
      const userMap = new Map<string, User>();

      // Load following
      try {
        const followingResponse = await followService.getFollowing(currentUser._id, { limit: 100 });
        if (followingResponse.success && followingResponse.data) {
          const followingUsers = followingResponse.data.following || followingResponse.data || [];
          followingUsers.forEach((user: any) => {
            if (user._id && user._id !== currentUser._id) {
              userMap.set(user._id, {
                _id: user._id,
                firstName: user.firstName || user.username || 'User',
                lastName: user.lastName || '',
                username: user.username || '',
                profileImage: user.profileImage || user.profilePicture,
                profilePicture: user.profilePicture || user.profileImage,
                avatar: user.avatar,
              });
            }
          });
        }
      } catch (error) {
        console.error('Error loading following:', error);
      }

      // Load chat conversations
      try {
        const threadsResponse = await chatService.getThreads();
        if (threadsResponse.success && threadsResponse.data) {
          const threads = threadsResponse.data.threads || threadsResponse.data || [];
          threads.forEach((thread: any) => {
            // Get the other participant from the thread
            const participants = thread.participants || [];
            participants.forEach((participant: any) => {
              const participantId = participant._id || participant;
              if (
                participantId &&
                participantId !== currentUser._id &&
                typeof participant === 'object'
              ) {
                userMap.set(participantId, {
                  _id: participantId,
                  firstName: participant.firstName || participant.username || 'User',
                  lastName: participant.lastName || '',
                  username: participant.username || '',
                  profileImage: participant.profileImage || participant.profilePicture,
                  profilePicture: participant.profilePicture || participant.profileImage,
                  avatar: participant.avatar,
                });
              }
            });
          });
        }
      } catch (error) {
        console.error('Error loading chat threads:', error);
      }

      const allUsers = Array.from(userMap.values());
      setUsers(allUsers);
      setFilteredUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (userId: string) => {
    if (sharing || sharedUsers.has(userId)) return;

    setSharing(userId);
    try {
      // First, get or create thread with the user
      const threadResponse = await chatService.getThread(userId);

      // Try different possible response structures
      let threadId = null;

      if (threadResponse.success && threadResponse.data?.thread?._id) {
        threadId = threadResponse.data.thread._id;
      } else if (threadResponse.data?._id) {
        // Sometimes the thread is directly in data
        threadId = threadResponse.data._id;
      } else if ((threadResponse as any).thread?._id) {
        // Sometimes thread is at root level
        threadId = (threadResponse as any).thread._id;
      }

      if (!threadId) {
        console.error('❌ Could not extract thread ID from response:', threadResponse);
        throw new Error('Failed to create conversation. Please try again.');
      }

      // Send rich message with shared content metadata
      const response = await chatService.sendMessage(threadId, {
        text: `Shared a ${contentType}`,
        messageType: contentType === 'post' ? 'shared_post' : 'shared_reel',
        sharedContent: {
          contentId: contentId,
        },
      } as any);

      if (response.success) {
        setSharedUsers((prev) => new Set(prev).add(userId));
      }
    } catch (error: any) {
      console.error('❌ Error sharing:', error);
      showToast.error(error.message || 'Failed to share');
    } finally {
      setSharing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Share {contentType}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Copy Link & External Share Options */}
        <div className="p-4 border-b border-border space-y-3">
          {/* Copy Link - Click to copy */}
          <div
            className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
            onClick={handleCopyLink}
            title="Click to copy link"
          >
            <Link2 size={16} className="text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground truncate flex-1">{shareableLink}</span>
            {copied && <span className="text-xs text-green-500 font-medium">Copied!</span>}
          </div>

          {/* External Share Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Share to:</span>
            <div className="flex gap-2">
              {/* WhatsApp */}
              <button
                onClick={handleShareToWhatsApp}
                className="w-10 h-10 rounded-full bg-[#25D366] hover:bg-[#20BA5A] flex items-center justify-center transition-colors"
                title="Share to WhatsApp"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </button>
              {/* Telegram */}
              <button
                onClick={handleShareToTelegram}
                className="w-10 h-10 rounded-full bg-[#0088cc] hover:bg-[#0077b5] flex items-center justify-center transition-colors"
                title="Share to Telegram"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </button>
              {/* Twitter/X */}
              <button
                onClick={handleShareToTwitter}
                className="w-10 h-10 rounded-full bg-black hover:bg-gray-800 flex items-center justify-center transition-colors"
                title="Share to X"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </button>
              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  copied ? 'bg-green-500 hover:bg-green-600' : 'bg-primary hover:bg-primary/90'
                }`}
                title={copied ? 'Copied!' : 'Copy Link'}
              >
                {copied ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 text-white fill-none stroke-current"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <Link2 size={18} className="text-white" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'No users found'
                  : 'No users to share with yet. Follow people or start chatting!'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => {
                const isShared = sharedUsers.has(user._id);
                const isSharing = sharing === user._id;

                return (
                  <div
                    key={user._id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <UserAvatar
                        user={{
                          _id: user._id,
                          firstName: user.firstName,
                          lastName: user.lastName,
                          username: user.username,
                          profileImage: user.profileImage,
                          profilePicture: user.profilePicture,
                          avatar: user.avatar,
                        }}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {user.firstName} {user.lastName || ''}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(user._id);
                      }}
                      disabled={isSharing || isShared}
                      className="gap-2"
                      variant={isShared ? 'outline' : 'default'}
                    >
                      {isSharing ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Sending...
                        </>
                      ) : isShared ? (
                        <>✓ Sent</>
                      ) : (
                        <>
                          <Send size={14} />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Share this {contentType} with your followers via direct message
          </p>
        </div>
      </div>
    </div>
  );
}
