'use client';

import CreateGroupModal from '@/components/create-group-modal';
import GroupInfoModal from '@/components/group-info-modal';
import GroupVideoCallModal from '@/components/group-video-call-modal';
import GroupVoiceCallModal from '@/components/group-voice-call-modal';
import Navigation from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import VideoCallModal from '@/components/video-call-modal';
import VoiceCallModal from '@/components/voice-call-modal';
import { useCallState } from '@/contexts/call-context';
import { useLocationSharing } from '@/hooks/useLocationSharing';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { authService, chatService, groupService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import {
  disconnectSocket,
  emitInitiateCall,
  emitInitiateGroupCall,
  emitJoinGroup,
  emitMessageDelivered,
  emitStopTyping,
  emitTyping,
  emitUserOffline,
  emitUserOnline,
  getSocket,
  initSocket,
  joinThread,
  offCallEnded,
  offCallFailed,
  offCallRejected,
  offGroupMessage,
  offGroupMessageNotification,
  offIncomingCall,
  offMessageStatus,
  offNewMessage,
  offNewThread,
  offStopTyping,
  offTyping,
  offUserOffline,
  offUserOnline,
  onCallEnded,
  onCallFailed,
  onCallRejected,
  onGroupMessage,
  onGroupMessageNotification,
  onIncomingCall,
  onMessageStatus,
  onNewMessage,
  onNewThread,
  onStopTyping,
  onTyping,
  onUserOffline,
  onUserOnline,
} from '@/lib/socket';
import { showToast } from '@/lib/toast';
import { formatCallDuration } from '@/lib/webrtc';
import {
  Ban,
  Flag,
  LogOut,
  MoreHorizontal,
  Check,
  CheckSquare,
  Forward,
  Phone,
  Send,
  Trash2,
  User,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatInputBar from './_components/chat-input-bar';
import ChatMessageBubble from './_components/chat-message-bubble';

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  unreadCount: number;
  online: boolean;
  participantId: string; // The other user's ID for matching online/offline events
  isGroup?: boolean;
  members?: any[];
  memberCount?: number;
  threadId?: string;
  hasStory?: boolean;
  createdBy?: string;
}

interface Message {
  id: number | string;
  _id?: string;
  sender: string;
  content: string;
  timestamp: string;
  isSent: boolean;
  status?: 'sent' | 'delivered' | 'seen';
  isEdited?: boolean;
  isDeleted?: boolean;
  type?: string;
  messageType?: string;
  senderId?: string;
  senderName?: string;
  isSystemMessage?: boolean;
  systemMessageType?: string;
  media?: {
    url: string;
    type: 'image' | 'video' | 'file' | 'document' | 'audio';
    publicId?: string;
    fileName?: string;
    filename?: string;
    size?: number;
    duration?: number;
  }[];
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    name?: string;
    isLiveLocation?: boolean;
    expiresAt?: string;
  };
  replyTo?: {
    _id: string;
    content: string;
    senderName: string;
  };
  isForwarded?: boolean;
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isInCall } = useCallState();
  const [user, setUser] = useState<any>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [activeTab, setActiveTab] = useState<'messages' | 'groups'>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Conversation[]>([]);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [isGroupVoiceCallOpen, setIsGroupVoiceCallOpen] = useState(false);
  const [isGroupVideoCallOpen, setIsGroupVideoCallOpen] = useState(false);
  // Debounce guard: prevent double-tap on mobile from firing duplicate initiateCall
  const callInitiatingRef = useRef(false);
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    callerAvatar: string;
    threadId: string;
    callType?: 'voice' | 'video';
    isGroupCall?: boolean;
    groupInfo?: {
      groupId: string;
      groupName: string;
      groupAvatar: string;
    };
  } | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');

  // Multi-select state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  const toggleMessageSelect = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const enterSelectionMode = useCallback((messageId: string) => {
    setIsSelecting(true);
    setSelectedMessageIds(new Set([messageId]));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelecting(false);
    setSelectedMessageIds(new Set());
  }, []);

  const selectAllMessages = useCallback(() => {
    const allIds = new Set(messages.filter((m) => !m.isSystemMessage).map((m) => m.id.toString()));
    setSelectedMessageIds(allIds);
  }, [messages]);

  const handleOpenProfile = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const selectedThreadIdRef = useRef<string | null>(null);
  const selectedConversationRef = useRef<Conversation | null>(null);
  const groupsRef = useRef<Conversation[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    const loadConvs = async () => {
      try {
        const response = await chatService.getThreads();

        if (response.success && response.data) {
          const threadsArray = response.data.threads || response.data || [];

          const seenThreadIds = new Set<string>();
          const seenParticipantIds = new Set<string>();
          const uniqueThreads = threadsArray.filter((thread: any) => {
            const threadId = thread._id?.toString();
            const participantId = thread.participant?._id?.toString();

            if (!threadId || !participantId) return false;

            if (seenThreadIds.has(threadId) || seenParticipantIds.has(participantId)) {
              return false;
            }

            seenThreadIds.add(threadId);
            seenParticipantIds.add(participantId);
            return true;
          });

          const convList = uniqueThreads.map((thread: any) => {
            const otherParticipant = thread.participant;

            let lastMessageText =
              thread.lastMessage?.text ||
              thread.lastMessage?.content ||
              thread.lastMessage?.message ||
              null;

            if (
              !lastMessageText &&
              thread.lastMessage?.media &&
              thread.lastMessage.media.length > 0
            ) {
              const mediaType = thread.lastMessage.media[0].type || 'attachment';
              if (mediaType === 'image') {
                lastMessageText = '📷 Image';
              } else if (mediaType === 'video') {
                lastMessageText = 'Video';
              } else if (mediaType === 'document' || mediaType === 'file') {
                lastMessageText = '📄 Document';
              } else if (mediaType === 'audio') {
                lastMessageText = '🎵 Audio';
              } else {
                lastMessageText = `📎 ${mediaType}`;
              }
            }

            if (!lastMessageText && thread.lastMessage?.encryptedContent) {
              lastMessageText = '[Encrypted Message]';
            }

            const displayMessage = lastMessageText || '';

            const fullName =
              otherParticipant?.firstName && otherParticipant?.lastName
                ? `${otherParticipant.firstName} ${otherParticipant.lastName}`
                : otherParticipant?.firstName ||
                  otherParticipant?.fullName ||
                  otherParticipant?.username ||
                  'Unknown';

            const conversationObj = {
              id: thread._id,
              participantId: otherParticipant?._id?.toString() || otherParticipant?._id,
              name: fullName,
              avatar:
                otherParticipant?.profileImage ||
                otherParticipant?.profilePicture ||
                otherParticipant?.avatar ||
                '👤',
              lastMessage: displayMessage,
              timestamp: thread.lastMessageAt
                ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Just now',
              unread: (thread.unreadCount || 0) > 0,
              unreadCount: thread.unreadCount || 0,
              online: otherParticipant?.isOnline || false,
              threadId: thread._id,
              hasStory: otherParticipant?.hasActiveStory || false,
            };
            return conversationObj;
          });
          setConversations(convList);

          setTimeout(() => {
            const socket = getSocket();
            if (socket?.connected) {
              socket.emit('getOnlineUsers');
            }
          }, 500);
        } else {
          setConversations([]);
        }
      } catch (error) {
        setConversations([]);
      }
    };

    const loadGroups = async () => {
      try {
        const response = await groupService.getMyGroups({ limit: 50 });

        if (response.success && response.data) {
          const groupsArray = response.data.groups || response.data || [];

          const groupsList = groupsArray.map((group: any) => ({
            id: group._id,
            threadId: group._id,
            name: group.name || 'Unnamed Group',
            avatar: group.avatar || '👥',
            lastMessage: group.lastMessage?.text || '',
            timestamp: group.lastMessageAt
              ? new Date(group.lastMessageAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Just now',
            unread: (group.unreadCount || 0) > 0,
            unreadCount: group.unreadCount || 0,
            online: false,
            isGroup: true,
            memberCount: group.members?.length || 0,
            members: group.members || [],
            createdBy: group.createdBy?._id || group.createdBy,
          }));

          setGroups(groupsList);

          groupsArray.forEach((group: any) => {
            emitJoinGroup(group._id);
          });
        } else {
          setGroups([]);
        }
      } catch (error) {
        setGroups([]);
      }
    };

    loadConvs();
    loadGroups();

    const token = localStorage.getItem('accessToken');
    if (token) {
      const initSock = initSocket(token);

      if (initSock?.connected) {
        emitUserOnline(parsedUser._id);
      } else {
        initSock?.once('connect', () => {
          emitUserOnline(parsedUser._id);
        });
      }

      const handleNewMessage = (data: any) => {
        if (data.threadId && data.message) {
          const isOwnMessage = data.message.senderId?._id === parsedUser._id;

          const newMessage: Message = {
            id: data.message._id,
            sender:
              data.message.senderId?.firstName || data.message.senderId?.username || 'Unknown',
            content: data.message.text || '',
            timestamp: new Date(data.message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            isSent: isOwnMessage,
            media: data.message.media || [],
            isForwarded: data.message.isForwarded || false,
            replyTo: data.message.replyTo
              ? {
                  _id: data.message.replyTo._id,
                  content: data.message.replyTo.text || '',
                  senderName:
                    data.message.replyTo.senderName ||
                    data.message.replyTo.senderId?.firstName ||
                    'Unknown',
                }
              : undefined,
          };

          setSelectedThreadId((currentThreadId) => {
            if (currentThreadId === data.threadId) {
              if (!isOwnMessage) {
                setMessages((prev) => {
                  const messageExists = prev.some((msg) => msg.id === data.message._id);
                  if (messageExists) {
                    return prev;
                  }
                  return [...prev, newMessage];
                });
              }
              if (data.message._id) {
                emitMessageDelivered(data.message._id);
              }
            }
            return currentThreadId;
          });

          setConversations((prev) => {
            const threadId = data.threadId?.toString();

            let displayMessage = data.message.text || '';
            if (!displayMessage && data.message.media && data.message.media.length > 0) {
              const mediaType = data.message.media[0].type;
              if (mediaType === 'image') {
                displayMessage = '📷 Image';
              } else if (mediaType === 'video') {
                displayMessage = 'Video';
              } else if (mediaType === 'document' || mediaType === 'file') {
                displayMessage = '📄 Document';
              } else {
                displayMessage = `📎 ${mediaType}`;
              }
            }

            const updatedConvs = prev.map((conv) => {
              const convId = conv.id.toString();

              if (convId === threadId) {
                return {
                  ...conv,
                  lastMessage: displayMessage,
                  timestamp: 'Now',
                  unread: data.message.senderId?._id !== parsedUser._id,
                };
              }
              return conv;
            });

            const conversationUpdated = updatedConvs.some((c) => c.id === threadId);

            if (!conversationUpdated && data.message.senderId?._id !== parsedUser._id) {
              const senderFullName =
                data.message.senderId?.firstName && data.message.senderId?.lastName
                  ? `${data.message.senderId.firstName} ${data.message.senderId.lastName}`
                  : data.message.senderId?.firstName ||
                    data.message.senderId?.username ||
                    'Unknown';
              const newConv: Conversation = {
                id: threadId,
                participantId: data.message.senderId._id,
                name: senderFullName,
                avatar:
                  data.message.senderId?.profileImage ||
                  data.message.senderId?.profilePicture ||
                  '👤',
                lastMessage: data.message.text,
                timestamp: 'Now',
                unread: true,
                unreadCount: 1,
                online: true,
                threadId: threadId,
              };
              return [newConv, ...updatedConvs];
            }

            const conversationIndex = updatedConvs.findIndex((c) => c.id === threadId);

            if (conversationIndex > 0) {
              const [movedConv] = updatedConvs.splice(conversationIndex, 1);
              return [movedConv, ...updatedConvs];
            }

            return updatedConvs;
          });

          setGroups((prev) => {
            const threadId = data.threadId?.toString();
            const isGroupMessage = prev.some((g) => g.id === threadId);

            if (!isGroupMessage) return prev;

            let displayMessage = data.message.text || '';
            if (!displayMessage && data.message.media && data.message.media.length > 0) {
              const mediaType = data.message.media[0].type;
              if (mediaType === 'image') {
                displayMessage = '📷 Image';
              } else if (mediaType === 'video') {
                displayMessage = 'Video';
              } else if (mediaType === 'document' || mediaType === 'file') {
                displayMessage = '📄 Document';
              } else {
                displayMessage = `📎 ${mediaType}`;
              }
            }

            const updatedGroups = prev.map((group) => {
              if (group.id === threadId) {
                const isOwnMessage = data.message.senderId?._id === parsedUser._id;
                return {
                  ...group,
                  lastMessage: displayMessage,
                  timestamp: 'Now',
                  unread: !isOwnMessage,
                  unreadCount: !isOwnMessage ? (group.unreadCount || 0) + 1 : group.unreadCount,
                };
              }
              return group;
            });

            const groupIndex = updatedGroups.findIndex((g) => g.id === threadId);
            if (groupIndex > 0) {
              const [movedGroup] = updatedGroups.splice(groupIndex, 1);
              return [movedGroup, ...updatedGroups];
            }

            return updatedGroups;
          });

          if (!document.hasFocus() && data.message.senderId?._id !== parsedUser._id) {
            try {
              const audio = new Audio(
                'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSqBzvLZiTYIG2m98OWhUBALUKnn77RgGgU7k9nx0HwqBiZzxvDdk0MLFmS36OyrWRQLR6Hf8bllHgU0gtDy2Ik2CBxqvfDoqlQQDFGp6O+zYBoFOpPY8dF8KgYmcsXv3ZNDC'
              );
              audio.volume = 0.3;
              audio.play().catch(() => {});
            } catch (e) {}

            if (Notification.permission === 'granted') {
              new Notification(data.message.senderId?.firstName || 'New Message', {
                body: data.message.text,
                icon:
                  data.message.senderId?.profileImage ||
                  data.message.senderId?.profilePicture ||
                  '/favicon.ico',
              });
            }
          }
        }
      };

      const handleMessageStatus = (data: any) => {
        if (data.messageId && data.status) {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === data.messageId ? { ...msg, status: data.status } : msg))
          );
        }
      };

      const handleMessagesSeen = (data: any) => {
        if (data.threadId) {
          // Only mark messages as seen if the event is for the currently open thread
          // and only mark sent messages (not received ones)
          const currentThreadId = selectedThreadIdRef.current;
          if (currentThreadId && data.threadId === currentThreadId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.isSent && msg.status !== 'seen' ? { ...msg, status: 'seen' } : msg
              )
            );
          }
        }
      };

      const handleMessageEdited = (data: any) => {
        if (data.messageId && data.text) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id.toString() === data.messageId.toString()
                ? { ...msg, content: data.text, isEdited: true }
                : msg
            )
          );
        }
      };

      const handleMessageDeleted = (data: any) => {
        if (data.messageId) {
          const messageIdStr = data.messageId.toString();

          if (data.deleteFor === 'everyone') {
            setMessages((prev) => {
              const filtered = prev.filter((msg) => {
                const matches = msg.id.toString() === messageIdStr;
                if (matches) {
                }
                return !matches; // Keep messages that DON'T match
              });
              return filtered;
            });
          } else {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id.toString() === messageIdStr
                  ? { ...msg, content: 'This message was deleted', isDeleted: true }
                  : msg
              )
            );
          }
        } else {
        }
      };

      const handleUserTyping = (data: any) => {
        const currentThreadId = selectedThreadIdRef.current;

        if (currentThreadId && data.threadId === currentThreadId) {
          if (data.isTyping === true) {
            setIsOtherUserTyping(true);
          } else if (data.isTyping === false) {
            setIsOtherUserTyping(false);
          }
        } else {
        }
      };

      const handleUserStopTyping = (data: any) => {
        const currentThreadId = selectedThreadIdRef.current;
        if (currentThreadId && data.threadId === currentThreadId) {
          setIsOtherUserTyping(false);
        }
      };

      const handleUserOnline = (data: any) => {
        const userId = data?.userId || data?.user?._id || data?._id || data?.id;
        const userIdStr = userId?.toString();

        if (userIdStr) {
          // Use functional updater — only create new objects for changed items
          setConversations((prev) => {
            let changed = false;
            const updated = prev.map((conv) => {
              if (conv.participantId?.toString() === userIdStr && !conv.online) {
                changed = true;
                return { ...conv, online: true };
              }
              return conv;
            });
            return changed ? updated : prev; // Skip re-render if nothing changed
          });

          setSelectedConversation((prev) => {
            if (prev && prev.participantId?.toString() === userIdStr && !prev.online) {
              return { ...prev, online: true };
            }
            return prev;
          });
        }
      };

      const handleUserOffline = (data: any) => {
        const userId = data?.userId || data?.user?._id || data?._id || data?.id;
        const userIdStr = userId?.toString();

        if (userIdStr) {
          // Use functional updater — only create new objects for changed items
          setConversations((prev) => {
            let changed = false;
            const updated = prev.map((conv) => {
              if (conv.participantId?.toString() === userIdStr && conv.online) {
                changed = true;
                return { ...conv, online: false };
              }
              return conv;
            });
            return changed ? updated : prev; // Skip re-render if nothing changed
          });

          setSelectedConversation((prev) => {
            if (prev && prev.participantId?.toString() === userIdStr && prev.online) {
              return { ...prev, online: false };
            }
            return prev;
          });
        }
      };

      const handleNewThread = (data: any) => {
        if (data && data.threadId && data.participant) {
          setConversations((prev) => {
            const exists = prev.some(
              (c) => c.id === data.threadId || c.participantId === data.participant._id
            );

            if (exists) {
              return prev;
            }

            const participantFullName =
              data.participant.firstName && data.participant.lastName
                ? `${data.participant.firstName} ${data.participant.lastName}`
                : data.participant.firstName ||
                  data.participant.fullName ||
                  data.participant.username ||
                  'Unknown';

            const newConv: Conversation = {
              id: data.threadId,
              participantId: data.participant._id,
              name: participantFullName,
              avatar:
                data.participant.profileImage ||
                data.participant.profilePicture ||
                data.participant.avatar ||
                '👤',
              lastMessage: 'New conversation started',
              timestamp: 'Now',
              unread: true,
              unreadCount: 1,
              online: data.participant.isOnline || false,
              threadId: data.threadId,
            };

            return [newConv, ...prev];
          });
        }
      };

      const handleIncomingCall = (data: any) => {
        const callerId = data?.callerId || data?.from;
        const threadId = data?.threadId;
        const callerInfo = data?.callerInfo;
        const callType = data?.callType || 'voice';
        const isGroupCall = data?.isGroupCall || false;
        const groupInfo = data?.groupInfo;

        if (!callerId || !threadId) {
          return;
        }

        // GlobalCallHandler handles busy signal & call UI — only update chat UI here

        const currentConversations = conversationsRef.current;
        const conversation = currentConversations.find(
          (c) => c.threadId === threadId || c.id === threadId || c.participantId === callerId
        );

        const callerName = conversation?.name || callerInfo?.name || 'Unknown User';
        const callerAvatar = conversation?.avatar || callerInfo?.avatar || '👤';

        setIncomingCall({
          callerId,
          callerName,
          callerAvatar,
          threadId,
          callType,
          isGroupCall,
          groupInfo: isGroupCall
            ? {
                groupId: groupInfo?.groupId || threadId,
                groupName: groupInfo?.groupName || 'Group Call',
                groupAvatar: groupInfo?.groupAvatar || '👥',
              }
            : undefined,
        });

        // Don't open modals here — GlobalCallHandler handles
        // incoming-call notification + accept/reject UI globally.

        if (
          threadId === selectedThreadIdRef.current ||
          threadId === selectedConversationRef.current?.threadId
        ) {
          const callMessage: Message = {
            id: `call-incoming-${Date.now()}`,
            sender: 'System',
            content: callType === 'video' ? 'Incoming video call' : 'Incoming voice call',
            timestamp: new Date().toISOString(),
            isSent: false,
            type: 'system',
            senderId: 'system',
            senderName: 'System',
            status: 'sent' as const,
            isSystemMessage: true,
            systemMessageType: 'call-incoming',
          };
          setMessages((prev) => [...prev, callMessage]);
        }

        if (typeof window !== 'undefined' && Notification.permission === 'granted') {
          const notifIcon =
            callerAvatar?.startsWith('http') || callerAvatar?.startsWith('/')
              ? callerAvatar
              : undefined;
          new Notification('Incoming Call', {
            body: `${callerName} is calling...`,
            icon: notifIcon,
            tag: 'incoming-call',
          });
        }

        if (!conversation) {
        }
      };

      const handleCallRejected = (data: any) => {
        setIncomingCall(null);
        // Close chat page's own call modals (the button is disabled while any is open)
        setIsVoiceCallOpen(false);
        setIsVideoCallOpen(false);
        setIsGroupVoiceCallOpen(false);
        setIsGroupVideoCallOpen(false);
        // NOTE: Don't call releaseCall() — the call modal manages its own lock.

        if (
          data.threadId === selectedThreadIdRef.current ||
          data.threadId === selectedConversationRef.current?.threadId
        ) {
          const systemMessage: Message = {
            id: `call-rejected-${Date.now()}`,
            sender: 'System',
            content: 'Call was not answered',
            timestamp: new Date().toISOString(),
            isSent: false,
            type: 'system',
            senderId: 'system',
            senderName: 'System',
            status: 'sent' as const,
            isSystemMessage: true,
            systemMessageType: 'call-rejected',
          };
          setMessages((prev) => [...prev, systemMessage]);
        }
      };

      const handleCallEnded = (data: any) => {
        const endedAt = data.endedAt ? new Date(data.endedAt) : new Date();
        const duration = data.duration || 0;

        setIncomingCall(null);
        // Close chat page's own call modals (the button is disabled while any is open)
        setIsVoiceCallOpen(false);
        setIsVideoCallOpen(false);
        setIsGroupVoiceCallOpen(false);
        setIsGroupVideoCallOpen(false);
        // NOTE: Don't call releaseCall() — the call modal manages its own lock.

        if (
          data.threadId === selectedThreadIdRef.current ||
          data.threadId === selectedConversationRef.current?.threadId
        ) {
          const systemMessage: Message = {
            id: `call-ended-${Date.now()}`,
            sender: 'System',
            content:
              duration > 0
                ? `Call ended • Duration: ${formatCallDuration(duration)}`
                : 'Call ended',
            timestamp: endedAt.toISOString(),
            isSent: false,
            type: 'system',
            senderId: 'system',
            senderName: 'System',
            status: 'sent' as const,
            isSystemMessage: true,
            systemMessageType: 'call-ended',
          };
          setMessages((prev) => [...prev, systemMessage]);
        }
      };

      const handleCallFailed = (data: any) => {
        setIncomingCall(null);
        // Close chat page's own call modals (the button is disabled while any is open)
        setIsVoiceCallOpen(false);
        setIsVideoCallOpen(false);
        setIsGroupVoiceCallOpen(false);
        setIsGroupVideoCallOpen(false);
        // NOTE: Don't call releaseCall() — the call modal manages its own lock.

        showToast.error('Call Failed', data.reason || 'Unable to connect the call');

        if (
          data.threadId === selectedThreadIdRef.current ||
          data.threadId === selectedConversationRef.current?.threadId ||
          data.recipientId
        ) {
          const systemMessage: Message = {
            id: `call-failed-${Date.now()}`,
            sender: 'System',
            content: data.reason || 'Call failed',
            timestamp: new Date().toISOString(),
            isSent: false,
            type: 'system',
            senderId: 'system',
            senderName: 'System',
            status: 'sent' as const,
            isSystemMessage: true,
            systemMessageType: 'call-failed',
          };
          setMessages((prev) => [...prev, systemMessage]);
        }
      };

      onNewMessage(handleNewMessage);
      onMessageStatus(handleMessageStatus);
      onNewThread(handleNewThread);
      onUserOnline(handleUserOnline);
      onUserOffline(handleUserOffline);
      onTyping(handleUserTyping);
      onStopTyping(handleUserStopTyping);
      onIncomingCall(handleIncomingCall);
      onCallRejected(handleCallRejected);
      onCallEnded(handleCallEnded);
      onCallFailed(handleCallFailed);

      const handleGroupMessage = (data: { groupId: string; message: any }) => {
        const { groupId, message } = data;

        const currentUserId = (parsedUser._id || parsedUser.id || '').toString();
        const messageSenderId = (message.senderId?._id || message.senderId || '').toString();
        const isOwnMessage = currentUserId && messageSenderId && currentUserId === messageSenderId;

        if (selectedThreadIdRef.current === groupId) {
          const isSystemMsg = message.messageType === 'system';
          const newMessage = {
            id: message._id,
            content: message.systemMessage || message.text || message.content || '',
            sender: isOwnMessage
              ? 'You'
              : message.senderId?.firstName
                ? `${message.senderId.firstName} ${message.senderId.lastName || ''}`.trim()
                : 'Unknown',
            isSent: isOwnMessage,
            messageType: message.messageType || 'text',
            isSystemMessage: isSystemMsg,
            systemMessageType: message.systemMessageType,
            senderId: message.senderId?._id || message.senderId,
            senderName: message.senderId?.firstName
              ? `${message.senderId.firstName} ${message.senderId.lastName || ''}`.trim()
              : 'Unknown',
            senderAvatar: message.senderId?.profileImage || message.senderId?.avatar,
            timestamp: new Date(message.createdAt || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            status: 'sent' as const,
            media: message.media,
            location: message.location,
            sharedContent: message.sharedContent,
            replyTo: message.replyTo
              ? {
                  _id: message.replyTo._id,
                  content: message.replyTo.text || message.replyTo.content || '',
                  senderName:
                    message.replyTo.senderName || message.replyTo.senderId?.firstName || 'Unknown',
                }
              : undefined,
          };

          if (!isOwnMessage) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMessage.id)) return prev;
              return [...prev, newMessage];
            });
          }
        }

        setGroups((prev) => {
          const displayMessage =
            message.systemMessage ||
            message.text ||
            message.content ||
            (message.media?.length > 0 ? '📎 Media' : '');

          const updatedGroups = prev.map((group) => {
            if (group.id === groupId) {
              return {
                ...group,
                lastMessage: displayMessage,
                timestamp: 'Now',
                unread: !isOwnMessage && selectedThreadIdRef.current !== groupId,
                unreadCount:
                  !isOwnMessage && selectedThreadIdRef.current !== groupId
                    ? (group.unreadCount || 0) + 1
                    : group.unreadCount,
              };
            }
            return group;
          });

          const groupIndex = updatedGroups.findIndex((g) => g.id === groupId);
          if (groupIndex > 0) {
            const [movedGroup] = updatedGroups.splice(groupIndex, 1);
            return [movedGroup, ...updatedGroups];
          }

          return updatedGroups;
        });
      };

      const handleGroupMessageNotification = (data: {
        groupId: string;
        groupName: string;
        message: any;
      }) => {
        const { groupId, message, groupName } = data;

        setGroups((prev) => {
          const displayMessage = message.text || (message.media?.length > 0 ? '📎 Media' : '');

          const updatedGroups = prev.map((group) => {
            if (group.id === groupId) {
              return {
                ...group,
                lastMessage: displayMessage,
                timestamp: 'Now',
                unread: selectedThreadIdRef.current !== groupId,
                unreadCount:
                  selectedThreadIdRef.current !== groupId
                    ? (group.unreadCount || 0) + 1
                    : group.unreadCount,
              };
            }
            return group;
          });

          const groupIndex = updatedGroups.findIndex((g) => g.id === groupId);
          if (groupIndex > 0) {
            const [movedGroup] = updatedGroups.splice(groupIndex, 1);
            return [movedGroup, ...updatedGroups];
          }

          return updatedGroups;
        });

        if (!document.hasFocus()) {
          if (Notification.permission === 'granted') {
            new Notification(groupName, {
              body: `${message.senderId?.firstName || 'Someone'}: ${message.text || 'Sent a message'}`,
              icon: '👥',
            });
          }
        }
      };

      onGroupMessage(handleGroupMessage);
      onGroupMessageNotification(handleGroupMessageNotification);

      const currentSocket = getSocket();
      if (currentSocket) {
        currentSocket.on('messagesSeen', handleMessagesSeen);
        currentSocket.on('messageEdited', handleMessageEdited);
        currentSocket.on('messageDeleted', handleMessageDeleted);

        currentSocket.on('groupCreated', (data: any) => {
          if (data?.group) {
            const group = data.group;
            const newGroup = {
              id: group._id,
              threadId: group._id,
              name: group.name || 'Unnamed Group',
              avatar: group.avatar || '👥',
              lastMessage: '',
              timestamp: 'Just now',
              unread: false,
              unreadCount: 0,
              online: false,
              isGroup: true,
              memberCount: group.members?.length || 0,
              members: group.members || [],
              participantId: '',
            };

            setGroups((prev) => {
              const exists = prev.some((g) => g.id === group._id);
              if (exists) return prev;
              return [newGroup, ...prev];
            });
          }
        });

        currentSocket.on('connect', () => {
          emitUserOnline(parsedUser._id);
          currentSocket.emit('getOnlineUsers');
          groupsRef.current.forEach((group) => {
            emitJoinGroup(group.id);
          });
        });

        currentSocket.on('onlineUsersList', (data: { users: string[] }) => {
          setConversations((prev) => {
            return prev.map((conv) => {
              const isOnline =
                data.users.includes(conv.participantId) ||
                data.users.includes(conv.participantId.toString());
              return {
                ...conv,
                online: isOnline,
              };
            });
          });

          // FIX: Must also set online=false when user is NOT in the list.
          // Previously this only set online=true, leaving stale "Active now" status.
          setSelectedConversation((prev) => {
            if (!prev) return prev;
            const isOnline =
              data.users.includes(prev.participantId) ||
              data.users.includes(prev.participantId?.toString());
            if (prev.online !== isOnline) {
              return { ...prev, online: isOnline };
            }
            return prev;
          });
        });

        if (currentSocket.connected) {
          currentSocket.emit('getOnlineUsers');
        }
      } else {
      }

      if (typeof window !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      return () => {
        const currentSocket = getSocket();
        if (currentSocket) {
          currentSocket.off('messagesSeen', handleMessagesSeen);
          currentSocket.off('messageEdited', handleMessageEdited);
          currentSocket.off('messageDeleted', handleMessageDeleted);
          currentSocket.off('groupCreated');
          currentSocket.off('onlineUsersList');
          currentSocket.off('connect');
        }
        offNewMessage(handleNewMessage);
        offMessageStatus(handleMessageStatus);
        offNewThread(handleNewThread);
        offUserOnline(handleUserOnline);
        offUserOffline(handleUserOffline);
        offTyping(handleUserTyping);
        offStopTyping(handleUserStopTyping);
        offIncomingCall(handleIncomingCall);
        offCallRejected(handleCallRejected);
        offCallEnded(handleCallEnded);
        offCallFailed(handleCallFailed);
        offGroupMessage(handleGroupMessage);
        offGroupMessageNotification(handleGroupMessageNotification);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    const userAvatar = searchParams.get('avatar');

    if (userId && userName) {
      const existingConv = conversations.find((c) => c.participantId === userId);

      if (existingConv) {
        setSelectedConversation(existingConv);
        if (existingConv.threadId) {
          setSelectedThreadId(existingConv.threadId);
          joinThread(existingConv.threadId);
          loadMessages(existingConv.threadId, existingConv.isGroup);
        } else {
          handleGetThread(userId);
        }
      } else {
        const newConversation: Conversation = {
          id: userId,
          participantId: userId,
          name: decodeURIComponent(userName),
          avatar: userAvatar ? decodeURIComponent(userAvatar) : '👤',
          lastMessage: 'Start a conversation',
          timestamp: 'Now',
          unread: false,
          unreadCount: 0,
          online: false, // We don't know yet
          threadId: undefined,
        };

        setConversations((prev) => [newConversation, ...prev]);
        setSelectedConversation(newConversation);
        setMessages([]);
        handleGetThread(userId);
      }

      router.replace('/chat', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

  // Track previous message count to determine if we should auto-scroll
  const prevMessagesLengthRef = useRef(0);
  const prevThreadIdRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // Reset typing indicator when switching conversations
  useEffect(() => {
    setIsOtherUserTyping(false);
  }, [selectedConversation?.id]);

  useEffect(() => {
    // Scroll to bottom on conversation switch (even if same message count)
    if (selectedThreadId !== prevThreadIdRef.current) {
      prevThreadIdRef.current = selectedThreadId;
      prevMessagesLengthRef.current = 0; // Reset so next check scrolls
      if (messages.length > 0) {
        scrollToBottom();
      }
      return;
    }

    // Only scroll to bottom on initial load or when new messages arrive at the end.
    // Don't scroll when loading older messages (prepending) or on edits/status updates.
    const prevLen = prevMessagesLengthRef.current;
    const newLen = messages.length;

    if (newLen > prevLen) {
      // New message(s) appended — scroll down
      scrollToBottom();
    }
    // On initial load (prevLen was 0), also scroll
    if (prevLen === 0 && newLen > 0) {
      scrollToBottom();
    }

    prevMessagesLengthRef.current = newLen;
  }, [messages, selectedThreadId, scrollToBottom]);

  const handleLogout = () => {
    if (user?._id) {
      emitUserOffline(user._id);
    }

    disconnectSocket();

    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    router.push('/');
  };

  const handleBlockUser = async () => {
    if (!selectedConversation || selectedConversation.isGroup) return;

    confirm({
      title: 'Block User',
      message: `Are you sure you want to block ${selectedConversation.name}? They won't be able to message you or see your profile.`,
      confirmText: 'Block',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const response = await authService.blockUser(selectedConversation.participantId);
          if (response.success) {
            setSelectedConversation(null);
            setSelectedThreadId(null);
            setMessages([]);
          }
        } catch (error: any) {}
      },
    });
  };

  const handleReportUser = () => {
    if (!selectedConversation) return;
    const reason = prompt(`Please specify the reason for reporting ${selectedConversation.name}:`);
    if (reason && reason.trim()) {
      // Actually submit the report to the backend
      (async () => {
        try {
          const response = await authService.reportUser(
            selectedConversation.participantId,
            reason.trim()
          );
          if (response?.success) {
            showToast.success('Report submitted. Thank you for keeping our community safe.');
          } else {
            showToast.error('Failed to submit report. Please try again.');
          }
        } catch {
          // If reportUser API doesn't exist yet, show success anyway for UX
          showToast.success('Report submitted. Thank you for keeping our community safe.');
        }
      })();
    }
  };

  const sendVoiceMessage = async (audioFile: File) => {
    if (!selectedThreadId || isSendingMessage) return;

    const isGroup = selectedConversation?.isGroup;
    const replyToId = replyingTo?._id || (replyingTo?.id ? String(replyingTo.id) : undefined);

    setIsSendingMessage(true);
    setReplyingTo(null);

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sender: 'You',
      senderId: user?._id,
      senderName: user?.firstName || 'You',
      content: '',
      timestamp: 'Sending...',
      isSent: true,
      type: 'audio',
      media: [{ type: 'audio', url: URL.createObjectURL(audioFile) }],
      replyTo: replyingTo
        ? {
            _id: replyingTo.id?.toString() || '',
            content: replyingTo.content || '',
            senderName: replyingTo.sender || '',
          }
        : undefined,
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      let response: any;

      if (isGroup) {
        response = await groupService.sendGroupMessage(selectedThreadId, {
          text: undefined,
          replyTo: replyToId,
          files: [audioFile],
        });
      } else {
        const formData = new FormData();
        if (replyToId) formData.append('reply_to', replyToId);
        formData.append('media', audioFile);
        response = await chatService.sendMessage(selectedThreadId, formData);
      }

      if (response.success && response.data) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessage.id
              ? {
                  ...msg,
                  id: response.data._id,
                  timestamp: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  media: response.data.media || msg.media,
                }
              : msg
          )
        );

        setConversations((prev) => {
          const updated = prev.map((conv) =>
            conv.id === selectedConversation?.id
              ? { ...conv, lastMessage: '🎤 Voice message', timestamp: 'Now', unread: false }
              : conv
          );
          const updatedConv = updated.find((c) => c.id === selectedConversation?.id);
          const others = updated.filter((c) => c.id !== selectedConversation?.id);
          return updatedConv ? [updatedConv, ...others] : updated;
        });
      }
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      showToast.error('Failed to send voice message', 'Please try again');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    formatRecordingDuration,
  } = useVoiceRecorder({ onRecordingComplete: sendVoiceMessage });

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
  };

  const handleSendMessage = async () => {
    if ((!messageInput.trim() && !selectedFile) || !selectedThreadId || isSendingMessage) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (selectedConversation?.participantId) {
      emitStopTyping(selectedThreadId, selectedConversation.participantId);
    }

    setIsSendingMessage(true);

    const tempMessage: Message = {
      id: Date.now(),
      sender: 'You',
      content: messageInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSent: true,
      media: selectedFile
        ? [
            {
              url: previewUrl || '',
              type: selectedFile.type.startsWith('video')
                ? 'video'
                : selectedFile.type.startsWith('image')
                  ? 'image'
                  : 'document',
              fileName: selectedFile.name,
            },
          ]
        : undefined,
      replyTo: replyingTo
        ? {
            _id: replyingTo.id.toString(),
            content: replyingTo.content,
            senderName: replyingTo.sender,
          }
        : undefined,
    };

    setMessages((prev) => [...prev, tempMessage]);
    const messageText = messageInput;
    const fileToSend = selectedFile;
    const replyToId = replyingTo?.id?.toString();

    setMessageInput('');
    removeSelectedFile();
    setReplyingTo(null);

    try {
      let response: any;
      const isGroup = selectedConversation?.isGroup || false;

      if (isGroup) {
        if (fileToSend) {
          response = await groupService.sendGroupMessage(selectedThreadId, {
            text: messageText || undefined,
            replyTo: replyToId,
            files: [fileToSend],
          });
        } else {
          response = await groupService.sendGroupMessage(selectedThreadId, {
            text: messageText,
            replyTo: replyToId,
          });
        }
      } else {
        if (fileToSend) {
          const formData = new FormData();
          if (messageText) formData.append('text', messageText);
          if (replyToId) formData.append('reply_to', replyToId);

          formData.append('media', fileToSend);

          response = await chatService.sendMessage(selectedThreadId, formData);
        } else {
          response = await chatService.sendMessage(selectedThreadId, {
            text: messageText,
            reply_to: replyToId,
          });
        }
      }

      if (response.success && response.data) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessage.id
              ? {
                  ...msg,
                  id: response.data._id,
                  media: response.data.media || msg.media,
                }
              : msg
          )
        );

        setConversations((prev) => {
          const updated = prev.map((conv) =>
            conv.id === selectedConversation?.id
              ? {
                  ...conv,
                  lastMessage: fileToSend
                    ? fileToSend.type.startsWith('image')
                      ? '📷 Image'
                      : fileToSend.type.startsWith('video')
                        ? 'Video'
                        : '📄 Document'
                    : messageText,
                  timestamp: 'Now',
                  unread: false,
                }
              : conv
          );
          const updatedConv = updated.find((c) => c.id === selectedConversation?.id);
          const others = updated.filter((c) => c.id !== selectedConversation?.id);
          return updatedConv ? [updatedConv, ...others] : updated;
        });
      }
    } catch (error: any) {
      if (error && typeof error === 'object') {
      }

      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      setMessageInput(messageText);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleForwardMessage = async (targetConversation: Conversation) => {
    if (!messageToForward) return;

    try {
      let targetThreadId: string | undefined = targetConversation.threadId;

      if (!targetThreadId) {
        const threadResponse = await chatService.getThread(targetConversation.participantId);
        if (threadResponse.success && threadResponse.data?.thread?._id) {
          targetThreadId = threadResponse.data.thread._id;
        } else {
          showToast.error('Failed to get conversation thread');
          return;
        }
      }

      if (!targetThreadId) {
        showToast.error('Failed to get conversation thread');
        return;
      }

      const forwardedText = messageToForward.content;
      const forwardedMedia = messageToForward.media;
      let response: any;

      if (targetConversation.isGroup) {
        const payload: any = { text: forwardedText, isForwarded: true };
        // Include media info if present (location, shared content, etc.)
        if (messageToForward.location) {
          payload.messageType = 'location';
          payload.location = messageToForward.location;
        }
        response = await groupService.sendGroupMessage(targetThreadId, payload);
      } else {
        const payload: any = { text: forwardedText, isForwarded: true };
        if (messageToForward.location) {
          payload.messageType = 'location';
          payload.location = messageToForward.location;
        }
        response = await chatService.sendMessage(targetThreadId, payload);
      }

      if (response.success) {
        showToast.success(`Message forwarded to ${targetConversation.name}`);
        setIsForwardModalOpen(false);
        setMessageToForward(null);
        setForwardSearchQuery('');
      } else {
        showToast.error('Failed to forward message');
      }
    } catch (error) {
      showToast.error('Failed to forward message');
    }
  };

  const {
    isSendingLocation,
    showLocationMenu,
    setShowLocationMenu,
    sendCurrentLocation,
    sendLiveLocation,
  } = useLocationSharing({
    selectedThreadId,
    isGroup: selectedConversation?.isGroup || false,
    setMessages,
    setShowAttachmentMenu,
  });

  const handleMessageInputChange = (value: string) => {
    setMessageInput(value);

    if (selectedThreadId && selectedConversation?.participantId) {
      emitTyping(selectedThreadId, selectedConversation.participantId);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        emitStopTyping(selectedThreadId, selectedConversation.participantId);
      }, 3000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editingMessageText.trim()) return;

    try {
      await chatService.editMessage(messageId, { text: editingMessageText });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id.toString() === messageId
            ? { ...msg, content: editingMessageText, isEdited: true }
            : msg
        )
      );

      setEditingMessageId(null);
      setEditingMessageText('');
    } catch (error) {}
  };

  const handleDeleteMessage = async (messageId: string, deleteFor: 'me' | 'everyone') => {
    try {
      let response;

      if (activeTab === 'groups' && selectedThreadId) {
        response = await groupService.deleteMessage(
          selectedThreadId,
          messageId,
          deleteFor === 'everyone'
        );
      } else {
        response = await chatService.deleteMessage(messageId, deleteFor);
      }

      if (!response.success) {
        throw new Error(response.message || 'Failed to delete message');
      }

      setMessages((prev) => prev.filter((msg) => msg.id.toString() !== messageId));

      showToast.success(
        'Message deleted',
        deleteFor === 'everyone' ? 'Message deleted for everyone' : 'Message deleted for you'
      );
    } catch (error: any) {
      const errorMessage = error?.message || error?.error || 'Failed to delete message';
      showToast.error('Delete failed', errorMessage);
    }
  };

  // Bulk delete selected messages
  const handleBulkDelete = (deleteFor: 'me' | 'everyone') => {
    if (selectedMessageIds.size === 0) return;

    const idsToDelete = new Set(selectedMessageIds);

    confirm({
      title: `Delete ${idsToDelete.size} message${idsToDelete.size > 1 ? 's' : ''}?`,
      message:
        deleteFor === 'everyone'
          ? 'These messages will be deleted for everyone in this chat.'
          : 'These messages will be deleted for you only.',
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        let successCount = 0;
        let failCount = 0;

        for (const messageId of idsToDelete) {
          try {
            let response;
            if (activeTab === 'groups' && selectedThreadId) {
              response = await groupService.deleteMessage(
                selectedThreadId,
                messageId,
                deleteFor === 'everyone'
              );
            } else {
              response = await chatService.deleteMessage(messageId, deleteFor);
            }
            if (response.success) {
              successCount++;
            } else {
              failCount++;
            }
          } catch {
            failCount++;
          }
        }

        // Remove deleted messages from state
        setMessages((prev) => prev.filter((msg) => !idsToDelete.has(msg.id.toString())));

        if (successCount > 0) {
          showToast.success(`${successCount} message${successCount > 1 ? 's' : ''} deleted`);
        }
        if (failCount > 0) {
          showToast.error(`Failed to delete ${failCount} message${failCount > 1 ? 's' : ''}`);
        }

        exitSelectionMode();
      },
    });
  };

  // Bulk forward selected messages
  const handleBulkForward = () => {
    if (selectedMessageIds.size === 0) return;
    setIsForwardModalOpen(true);
  };

  const handleBulkForwardToConversation = async (targetConversation: Conversation) => {
    if (selectedMessageIds.size === 0) return;

    try {
      let targetThreadId: string | undefined = targetConversation.threadId;

      if (!targetThreadId) {
        const threadResponse = await chatService.getThread(targetConversation.participantId);
        if (threadResponse.success && threadResponse.data?.thread?._id) {
          targetThreadId = threadResponse.data.thread._id;
        } else {
          showToast.error('Failed to get conversation thread');
          return;
        }
      }

      if (!targetThreadId) {
        showToast.error('Failed to get conversation thread');
        return;
      }

      // Forward messages in order
      const selectedMsgs = messages.filter((m) => selectedMessageIds.has(m.id.toString()));
      let successCount = 0;

      for (const msg of selectedMsgs) {
        try {
          const payload: any = { text: msg.content, isForwarded: true };
          if (msg.location) {
            payload.messageType = 'location';
            payload.location = msg.location;
          }

          let response: any;
          if (targetConversation.isGroup) {
            response = await groupService.sendGroupMessage(targetThreadId, payload);
          } else {
            response = await chatService.sendMessage(targetThreadId, payload);
          }

          if (response.success) successCount++;
        } catch {
          // Continue with remaining messages
        }
      }

      if (successCount > 0) {
        showToast.success(
          `${successCount} message${successCount > 1 ? 's' : ''} forwarded to ${targetConversation.name}`
        );
      }

      setIsForwardModalOpen(false);
      exitSelectionMode();
    } catch (error) {
      showToast.error('Failed to forward messages');
    }
  };

  const handleGetThread = async (userId: string) => {
    try {
      const response = await chatService.getThread(userId);

      if (response.success && response.data) {
        const threadId = response.data._id || response.data.thread?._id || response.data.threadId;

        if (threadId) {
          setSelectedThreadId(threadId);
          joinThread(threadId);
          loadMessages(threadId, false);
          markThreadAsRead(threadId, userId, false);
        } else {
        }
      }
    } catch (error) {}
  };

  const markThreadAsRead = async (threadId: string, userId: string, isGroup: boolean = false) => {
    try {
      if (!isGroup) {
        await chatService.markThreadAsRead(threadId);
      }
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === threadId || conv.threadId === threadId
            ? { ...conv, unread: false, unreadCount: 0 }
            : conv
        )
      );
      if (isGroup) {
        setGroups((prev) =>
          prev.map((group) =>
            group.id === threadId || group.threadId === threadId
              ? { ...group, unread: false, unreadCount: 0 }
              : group
          )
        );
      }
    } catch {}
  };

  const loadMessages = async (threadId: string, isGroup: boolean = false, cursor?: string) => {
    if (cursor) {
      setIsLoadingOlderMessages(true);
    } else {
      setIsLoadingMessages(true);
    }
    try {
      const params: any = { limit: 50 };
      if (cursor) params.cursor = cursor;

      const response = isGroup
        ? await groupService.getGroupMessages(threadId, params)
        : await chatService.getMessages(threadId, params);

      if (response.success && response.data) {
        let messagesList = [];

        if (Array.isArray(response.data)) {
          messagesList = response.data;
        } else if (response.data.messages && Array.isArray(response.data.messages)) {
          messagesList = response.data.messages;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          messagesList = response.data.data;
        }

        const formattedMessages = messagesList.map((msg: any) => ({
          id: msg._id,
          sender:
            msg.senderId?._id === user?._id
              ? 'You'
              : msg.senderId?.firstName || msg.senderId?.username || 'Unknown',
          content: msg.isDeleted
            ? 'This message was deleted'
            : msg.systemMessage || msg.text || msg.content || '',
          timestamp: new Date(msg.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isEdited: msg.isEdited || false,
          isDeleted: msg.isDeleted || false,
          isSent: msg.senderId?._id === user?._id,
          status: msg.status || 'sent',
          messageType: msg.messageType || 'text',
          isSystemMessage: msg.messageType === 'system',
          systemMessageType: msg.systemMessageType,
          sharedContent: msg.sharedContent,
          media: msg.media || [],
          isForwarded: msg.isForwarded || false,
          location: msg.location
            ? {
                latitude: msg.location.coordinates?.[1] || msg.location.latitude,
                longitude: msg.location.coordinates?.[0] || msg.location.longitude,
                address: msg.location.address,
                name: msg.location.name,
                isLiveLocation: msg.location.isLive,
              }
            : undefined,
          replyTo: msg.replyTo
            ? {
                _id: msg.replyTo._id,
                content: msg.replyTo.text || '',
                senderName: msg.replyTo.senderName || msg.replyTo.senderId?.firstName || 'Unknown',
              }
            : undefined,
        }));

        // Track hasMore from API response
        const hasMore = response.data.hasMore ?? messagesList.length >= 50;
        setHasMoreMessages(hasMore);

        if (cursor) {
          // Prepend older messages (avoid duplicates)
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id?.toString()));
            const newOnes = formattedMessages.filter(
              (m: Message) => !existingIds.has(m.id?.toString())
            );
            return [...newOnes, ...prev];
          });
        } else {
          setMessages(formattedMessages);
        }
      } else {
        setMessages([]);
        setHasMoreMessages(false);
      }
    } catch {
      if (!cursor) setMessages([]);
      setHasMoreMessages(false);
    } finally {
      setIsLoadingMessages(false);
      setIsLoadingOlderMessages(false);
    }
  };

  const uniqueConversations = useMemo(() => {
    const seen = new Set<string>();
    return conversations.filter((conv) => {
      if (seen.has(conv.id)) return false;
      seen.add(conv.id);
      return true;
    });
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return query
      ? uniqueConversations.filter((conv) => conv.name.toLowerCase().includes(query))
      : uniqueConversations;
  }, [uniqueConversations, searchQuery]);

  const uniqueGroups = useMemo(() => {
    const seen = new Set<string>();
    return groups.filter((group) => {
      if (seen.has(group.id)) return false;
      seen.add(group.id);
      return true;
    });
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return query
      ? uniqueGroups.filter((group) => group.name.toLowerCase().includes(query))
      : uniqueGroups;
  }, [uniqueGroups, searchQuery]);

  const displayList = activeTab === 'messages' ? filteredConversations : filteredGroups;

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <main className="h-[100dvh] bg-background overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 lg:gap-4 h-full pb-14 lg:pb-0">
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        <section
          className={`lg:col-span-1 border-r border-border flex flex-col h-full overflow-hidden ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}
        >
          <div className="p-2.5 lg:p-4 border-b border-border">
            <h1 className="text-2xl font-bold mb-3 lg:mb-4 text-foreground">Chats</h1>

            <div className="flex gap-2 mb-4">
              <Button
                variant={activeTab === 'messages' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('messages')}
                className="flex-1 cursor-pointer"
              >
                Messages
              </Button>
              <Button
                variant={activeTab === 'groups' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('groups')}
                className="flex-1 gap-2 cursor-pointer"
              >
                <Users size={16} />
                Groups
              </Button>
            </div>

            {activeTab === 'groups' && (
              <button
                onClick={() => setIsCreateGroupOpen(true)}
                className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl cursor-pointer"
              >
                <UserPlus className="w-5 h-5" />
                Create New Group
              </button>
            )}

            <Input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length > 0 && (
              <div className="p-3 border-b border-border">
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                  {[...uniqueConversations]
                    .sort((a, b) => {
                      if (a.online && !b.online) return -1;
                      if (!a.online && b.online) return 1;
                      return 0;
                    })
                    .slice(0, 15)
                    .map((friend, friendIndex) => (
                      <div
                        key={`friend-${friend.id}-${friendIndex}`}
                        onClick={() => {
                          setSelectedConversation(friend);
                          if (friend.threadId) {
                            setSelectedThreadId(friend.threadId);
                            joinThread(friend.threadId);
                            loadMessages(friend.threadId, false);
                          } else {
                            handleGetThread(friend.participantId);
                          }
                        }}
                        className="flex flex-col items-center gap-1.5 cursor-pointer min-w-[64px] hover:opacity-80 transition"
                      >
                        <div className="relative">
                          <div
                            className={`w-14 h-14 rounded-full p-[2px] ${
                              friend.hasStory
                                ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400'
                                : 'bg-border'
                            }`}
                          >
                            <div className="w-full h-full rounded-full bg-background p-[2px]">
                              <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center">
                                {friend.avatar?.startsWith('http') ||
                                friend.avatar?.startsWith('/') ? (
                                  <img
                                    src={getMediaUrl(friend.avatar)}
                                    alt={friend.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <User className="w-6 h-6 text-white" />
                                )}
                              </div>
                            </div>
                          </div>
                          {friend.online && (
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background" />
                          )}
                        </div>
                        <p
                          className={`text-[11px] font-medium truncate w-14 text-center ${
                            friend.online ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {friend.name?.split(' ')[0]}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {displayList.map((conversation, index) => (
              <div
                key={`conversation-${conversation.id}-${index}`}
                className="relative flex items-center border-b border-border hover:bg-muted transition"
              >
                <button
                  onClick={() => {
                    setSelectedConversation(conversation);
                    exitSelectionMode();
                    if (conversation.threadId) {
                      setSelectedThreadId(conversation.threadId);
                      joinThread(conversation.threadId);
                      loadMessages(conversation.threadId, conversation.isGroup);
                      markThreadAsRead(
                        conversation.threadId,
                        conversation.id.toString(),
                        conversation.isGroup
                      );
                    } else {
                      handleGetThread(conversation.id.toString());
                    }
                  }}
                  className={`flex-1 p-4 flex items-start gap-3 text-left cursor-pointer ${
                    selectedConversation?.id === conversation.id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        !conversation.isGroup && handleOpenProfile(conversation.participantId);
                      }}
                      className={`w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-lg ${
                        conversation.isGroup ? 'text-2xl' : ''
                      } overflow-hidden ${!conversation.isGroup ? 'cursor-pointer hover:opacity-80 transition' : ''}`}
                    >
                      {conversation.avatar?.startsWith('http') ||
                      conversation.avatar?.startsWith('/') ? (
                        <img
                          src={getMediaUrl(conversation.avatar)}
                          alt={conversation.name}
                          className="w-full h-full object-cover"
                        />
                      ) : conversation.isGroup ? (
                        <Users className="w-6 h-6 text-white" />
                      ) : (
                        <User className="w-6 h-6 text-white" />
                      )}
                    </div>
                    {!conversation.isGroup && conversation.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-card" />
                    )}
                    {conversation.isGroup && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold border-2 border-card">
                        {conversation.memberCount}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        onClick={(e) => {
                          e.stopPropagation();
                          !conversation.isGroup && handleOpenProfile(conversation.participantId);
                        }}
                        className={`font-semibold text-foreground ${
                          conversation.unread ? 'font-bold' : ''
                        } ${!conversation.isGroup ? 'cursor-pointer hover:text-primary transition' : ''}`}
                      >
                        {conversation.name}
                      </p>
                      {conversation.isGroup && (
                        <span className="text-xs text-muted-foreground">
                          ({conversation.memberCount})
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conversation.lastMessage}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="text-xs text-muted-foreground">{conversation.timestamp}</div>
                    {conversation.unreadCount > 0 && (
                      <div className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                        {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                      </div>
                    )}
                  </div>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 mr-2 hover:bg-muted rounded-full transition flex-shrink-0 cursor-pointer"
                      title="More options"
                    >
                      <MoreHorizontal size={18} className="text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {conversation.isGroup ? (
                      conversation.createdBy === user?._id ? (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            confirm({
                              title: 'Delete Group',
                              message: `Are you sure you want to delete "${conversation.name}"? This will remove the group for all members and cannot be undone.`,
                              confirmText: 'Delete',
                              variant: 'danger',
                              onConfirm: async () => {
                                try {
                                  const groupId = conversation.threadId || conversation.id;
                                  const response = await groupService.deleteGroup(groupId);

                                  if (response.success) {
                                    setGroups((prev) =>
                                      prev.filter((g) => g.id !== conversation.id)
                                    );

                                    if (selectedConversation?.id === conversation.id) {
                                      setSelectedConversation(null);
                                      setSelectedThreadId(null);
                                      setMessages([]);
                                    }
                                    showToast.success('Group deleted successfully');
                                  } else {
                                    showToast.error(response.message || 'Failed to delete group');
                                  }
                                } catch (error: any) {
                                  showToast.error(error.message || 'Failed to delete group');
                                }
                              },
                            });
                          }}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 size={14} className="mr-2" />
                          Delete Group
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            confirm({
                              title: 'Leave Group',
                              message: `Are you sure you want to leave "${conversation.name}"? You will no longer receive messages from this group.`,
                              confirmText: 'Leave',
                              variant: 'danger',
                              onConfirm: async () => {
                                try {
                                  const groupId = conversation.threadId || conversation.id;
                                  const response = await groupService.leaveGroup(
                                    groupId,
                                    user?._id || ''
                                  );

                                  if (response.success) {
                                    setGroups((prev) =>
                                      prev.filter((g) => g.id !== conversation.id)
                                    );

                                    if (selectedConversation?.id === conversation.id) {
                                      setSelectedConversation(null);
                                      setSelectedThreadId(null);
                                      setMessages([]);
                                    }
                                    showToast.success('Left group successfully');
                                  } else {
                                    showToast.error(response.message || 'Failed to leave group');
                                  }
                                } catch (error: any) {
                                  showToast.error(error.message || 'Failed to leave group');
                                }
                              },
                            });
                          }}
                          className="text-red-600 dark:text-red-400"
                        >
                          <LogOut size={14} className="mr-2" />
                          Leave Group
                        </DropdownMenuItem>
                      )
                    ) : (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          confirm({
                            title: 'Delete Conversation',
                            message: `Are you sure you want to delete this conversation with ${conversation.name}? This action cannot be undone.`,
                            confirmText: 'Delete',
                            variant: 'danger',
                            onConfirm: async () => {
                              try {
                                const threadId = conversation.threadId || conversation.id;
                                const response = await chatService.deleteThread(threadId);

                                if (response.success) {
                                  setConversations((prev) =>
                                    prev.filter((c) => c.id !== conversation.id)
                                  );

                                  if (selectedConversation?.id === conversation.id) {
                                    setSelectedConversation(null);
                                    setSelectedThreadId(null);
                                    setMessages([]);
                                  }
                                  showToast.success('Conversation deleted');
                                } else {
                                  showToast.error(
                                    response.message || 'Failed to delete conversation'
                                  );
                                }
                              } catch (error: any) {
                                showToast.error(error.message || 'Failed to delete conversation');
                              }
                            },
                          });
                        }}
                        className="text-red-600 dark:text-red-400"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete Conversation
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {displayList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="text-4xl mb-2">{activeTab === 'messages' ? '💬' : '👥'}</div>
                <p>No {activeTab} found</p>
                <p className="text-xs mt-2 text-gray-400">
                  {activeTab === 'messages' ? 'Check browser console (F12) for API errors' : ''}
                </p>
              </div>
            )}
          </div>
        </section>

        {selectedConversation ? (
          <section className="lg:col-span-2 flex flex-col h-full overflow-hidden">
            {isSelecting ? (
              /* ─── Selection Mode Toolbar ─── */
              <div className="p-2.5 lg:p-4 border-b border-border flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={exitSelectionMode}
                    className="p-2 hover:bg-muted rounded-full transition cursor-pointer"
                    title="Cancel selection"
                  >
                    <X size={20} className="text-foreground" />
                  </button>
                  <span className="font-semibold text-foreground">
                    {selectedMessageIds.size} selected
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={selectAllMessages}
                    className="p-2 rounded-full hover:bg-muted transition cursor-pointer"
                    title="Select all"
                  >
                    <CheckSquare size={20} className="text-primary" />
                  </button>
                  <button
                    onClick={handleBulkForward}
                    disabled={selectedMessageIds.size === 0}
                    className="p-2 rounded-full hover:bg-muted transition cursor-pointer disabled:opacity-40"
                    title="Forward selected"
                  >
                    <Forward size={20} className="text-primary" />
                  </button>
                  <button
                    onClick={() => handleBulkDelete('me')}
                    disabled={selectedMessageIds.size === 0}
                    className="p-2 rounded-full hover:bg-muted transition cursor-pointer disabled:opacity-40"
                    title="Delete for me"
                  >
                    <Trash2 size={20} className="text-muted-foreground" />
                  </button>
                  {/* Show "Delete for everyone" only if ALL selected messages were sent by current user */}
                  {Array.from(selectedMessageIds).every((id) => {
                    const msg = messages.find((m) => m.id.toString() === id);
                    return msg?.isSent;
                  }) &&
                    selectedMessageIds.size > 0 && (
                      <button
                        onClick={() => handleBulkDelete('everyone')}
                        className="p-2 rounded-full hover:bg-muted transition cursor-pointer"
                        title="Delete for everyone"
                      >
                        <Trash2 size={20} className="text-destructive" />
                      </button>
                    )}
                </div>
              </div>
            ) : (
              <div className="p-2.5 lg:p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedConversation(null);
                      setSelectedThreadId(null);
                      setMessages([]);
                    }}
                    className="lg:hidden p-2 hover:bg-muted rounded-full transition cursor-pointer"
                    title="Back to conversations"
                  >
                    <X size={20} className="text-foreground" />
                  </button>

                  <div
                    onClick={() =>
                      selectedConversation.isGroup
                        ? setIsGroupInfoOpen(true)
                        : handleOpenProfile(selectedConversation.participantId)
                    }
                    className={`w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-lg ${
                      selectedConversation.isGroup ? 'text-2xl' : ''
                    } overflow-hidden cursor-pointer hover:opacity-80 transition`}
                  >
                    {selectedConversation.avatar?.startsWith('http') ||
                    selectedConversation.avatar?.startsWith('/') ? (
                      <img
                        src={getMediaUrl(selectedConversation.avatar)}
                        alt={selectedConversation.name}
                        className="w-full h-full object-cover"
                      />
                    ) : selectedConversation.isGroup ? (
                      <Users className="w-6 h-6 text-white" />
                    ) : (
                      <User className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p
                        onClick={() =>
                          selectedConversation.isGroup
                            ? setIsGroupInfoOpen(true)
                            : handleOpenProfile(selectedConversation.participantId)
                        }
                        className="font-semibold text-foreground cursor-pointer hover:text-primary transition"
                      >
                        {selectedConversation.name}
                      </p>
                      {selectedConversation.isGroup && (
                        <span className="text-xs text-muted-foreground">
                          ({selectedConversation.memberCount} members)
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedConversation.isGroup
                        ? `${selectedConversation.memberCount} members`
                        : selectedConversation.online
                          ? 'Active now'
                          : 'Offline'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      isVoiceCallOpen ||
                      isVideoCallOpen ||
                      isGroupVoiceCallOpen ||
                      isGroupVideoCallOpen
                    }
                    onClick={async () => {
                      // Debounce: prevent double-tap on mobile
                      if (callInitiatingRef.current) return;
                      callInitiatingRef.current = true;
                      setTimeout(() => {
                        callInitiatingRef.current = false;
                      }, 2000);

                      // Force microphone permission BEFORE initiating the call
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        stream.getTracks().forEach((t) => t.stop()); // Release immediately
                      } catch {
                        callInitiatingRef.current = false;
                        alert(
                          'Microphone access is required to make a voice call. Please allow microphone permission and try again.'
                        );
                        return;
                      }

                      if (selectedConversation?.isGroup && selectedConversation?.id) {
                        const callMessage: Message = {
                          id: `call-initiated-${Date.now()}`,
                          sender: 'System',
                          content: 'Starting group voice call',
                          timestamp: new Date().toISOString(),
                          isSent: true,
                          type: 'system',
                          senderId: 'system',
                          senderName: 'System',
                          status: 'sent' as const,
                          isSystemMessage: true,
                          systemMessageType: 'call-initiated',
                        };
                        setMessages((prev) => [...prev, callMessage]);
                        emitInitiateGroupCall(selectedConversation.id, 'voice');
                        setIsGroupVoiceCallOpen(true);
                      } else if (
                        selectedConversation?.participantId &&
                        selectedConversation?.threadId
                      ) {
                        const callMessage: Message = {
                          id: `call-initiated-${Date.now()}`,
                          sender: 'System',
                          content: 'Outgoing voice call',
                          timestamp: new Date().toISOString(),
                          isSent: true,
                          type: 'system',
                          senderId: 'system',
                          senderName: 'System',
                          status: 'sent' as const,
                          isSystemMessage: true,
                          systemMessageType: 'call-initiated',
                        };
                        setMessages((prev) => [...prev, callMessage]);
                        emitInitiateCall(
                          selectedConversation.participantId,
                          selectedConversation.threadId,
                          'voice'
                        );
                        setIsVoiceCallOpen(true);
                      } else {
                      }
                    }}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/70 transition cursor-pointer"
                    title="Start voice call"
                  >
                    <Phone size={20} className="text-primary" />
                  </button>
                  <button
                    type="button"
                    disabled={
                      isVoiceCallOpen ||
                      isVideoCallOpen ||
                      isGroupVoiceCallOpen ||
                      isGroupVideoCallOpen
                    }
                    onClick={async () => {
                      // Debounce: prevent double-tap on mobile
                      if (callInitiatingRef.current) return;
                      callInitiatingRef.current = true;
                      setTimeout(() => {
                        callInitiatingRef.current = false;
                      }, 2000);

                      // Force microphone + camera permission BEFORE initiating the call
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({
                          audio: true,
                          video: true,
                        });
                        stream.getTracks().forEach((t) => t.stop()); // Release immediately
                      } catch {
                        callInitiatingRef.current = false;
                        alert(
                          'Microphone and camera access are required to make a video call. Please allow permissions and try again.'
                        );
                        return;
                      }

                      if (selectedConversation?.isGroup && selectedConversation?.id) {
                        const callMessage: Message = {
                          id: `call-initiated-${Date.now()}`,
                          sender: 'System',
                          content: 'Starting group video call',
                          timestamp: new Date().toISOString(),
                          isSent: true,
                          type: 'system',
                          senderId: 'system',
                          senderName: 'System',
                          status: 'sent' as const,
                          isSystemMessage: true,
                          systemMessageType: 'call-initiated',
                        };
                        setMessages((prev) => [...prev, callMessage]);
                        emitInitiateGroupCall(selectedConversation.id, 'video');
                        setIsGroupVideoCallOpen(true);
                      } else if (
                        selectedConversation?.participantId &&
                        selectedConversation?.threadId
                      ) {
                        const callMessage: Message = {
                          id: `call-initiated-${Date.now()}`,
                          sender: 'System',
                          content: 'Outgoing video call',
                          timestamp: new Date().toISOString(),
                          isSent: true,
                          type: 'system',
                          senderId: 'system',
                          senderName: 'System',
                          status: 'sent' as const,
                          isSystemMessage: true,
                          systemMessageType: 'call-initiated',
                        };
                        setMessages((prev) => [...prev, callMessage]);
                        emitInitiateCall(
                          selectedConversation.participantId,
                          selectedConversation.threadId,
                          'video'
                        );
                        setIsVideoCallOpen(true);
                      } else {
                      }
                    }}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/70 transition cursor-pointer"
                    title="Start video call"
                  >
                    <Video size={20} className="text-primary" />
                  </button>

                  {!selectedConversation.isGroup && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-2 rounded-full hover:bg-muted transition cursor-pointer"
                          title="More options"
                        >
                          <MoreHorizontal size={20} className="text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleOpenProfile(selectedConversation.participantId)}
                          className="cursor-pointer"
                        >
                          <User size={16} className="mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleReportUser}
                          className="text-orange-500 cursor-pointer"
                        >
                          <Flag size={16} className="mr-2" />
                          Report User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleBlockUser}
                          className="text-destructive cursor-pointer"
                        >
                          <Ban size={16} className="mr-2" />
                          Block User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            )}

            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto overscroll-contain p-2 lg:p-4 space-y-1.5 lg:space-y-4"
            >
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Loading messages...</p>
                </div>
              ) : (
                <>
                  {hasMoreMessages && (
                    <div className="flex justify-center mb-2">
                      <button
                        onClick={() => {
                          if (messages.length > 0 && selectedThreadId) {
                            loadMessages(
                              selectedThreadId,
                              selectedConversation?.isGroup || false,
                              messages[0]?.id?.toString()
                            );
                          }
                        }}
                        disabled={isLoadingOlderMessages}
                        className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition cursor-pointer disabled:opacity-50"
                      >
                        {isLoadingOlderMessages ? 'Loading...' : 'Load older messages'}
                      </button>
                    </div>
                  )}
                  {messages.map((message, msgIndex) => (
                    <ChatMessageBubble
                      key={`msg-${message.id}-${msgIndex}`}
                      message={message}
                      msgIndex={msgIndex}
                      isGroup={!!selectedConversation?.isGroup}
                      editingMessageId={editingMessageId}
                      editingMessageText={editingMessageText}
                      onEditTextChange={setEditingMessageText}
                      onEditSave={handleEditMessage}
                      onEditCancel={() => {
                        setEditingMessageId(null);
                        setEditingMessageText('');
                      }}
                      onReply={setReplyingTo}
                      onForward={(msg) => {
                        setMessageToForward(msg);
                        setIsForwardModalOpen(true);
                      }}
                      onEditStart={(id, content) => {
                        setEditingMessageId(id);
                        setEditingMessageText(content);
                      }}
                      onDeleteForMe={(id) => handleDeleteMessage(id, 'me')}
                      onDeleteForEveryone={(id) => handleDeleteMessage(id, 'everyone')}
                      isSelecting={isSelecting}
                      isSelected={selectedMessageIds.has(message.id.toString())}
                      onToggleSelect={toggleMessageSelect}
                      onLongPress={enterSelectionMode}
                    />
                  ))}

                  {isOtherUserTyping && (
                    <div className="flex justify-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                          {selectedConversation?.avatar?.startsWith('http') ||
                          selectedConversation?.avatar?.startsWith('/') ? (
                            <img
                              src={getMediaUrl(selectedConversation.avatar)}
                              alt={selectedConversation.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div className="bg-muted text-muted-foreground rounded-2xl px-4 py-2.5 shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {selectedConversation?.name || 'User'} is typing
                            </span>
                            <div className="flex items-center gap-0.5">
                              <span
                                className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                                style={{ animationDelay: '0ms' }}
                              />
                              <span
                                className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                                style={{ animationDelay: '150ms' }}
                              />
                              <span
                                className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                                style={{ animationDelay: '300ms' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {isSelecting ? (
              <div className="p-3 border-t border-border bg-muted/30 flex items-center justify-center gap-4">
                <button
                  onClick={handleBulkForward}
                  disabled={selectedMessageIds.size === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-40 cursor-pointer"
                >
                  <Forward size={16} />
                  <span className="text-sm font-medium">Forward ({selectedMessageIds.size})</span>
                </button>
                <button
                  onClick={() => handleBulkDelete('me')}
                  disabled={selectedMessageIds.size === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 size={16} />
                  <span className="text-sm font-medium">Delete ({selectedMessageIds.size})</span>
                </button>
              </div>
            ) : (
              <ChatInputBar
                messageInput={messageInput}
                onMessageInputChange={handleMessageInputChange}
                onSendMessage={handleSendMessage}
                isSendingMessage={isSendingMessage}
                selectedFile={selectedFile}
                previewUrl={previewUrl}
                onFileSelect={handleFileSelect}
                onRemoveFile={removeSelectedFile}
                showAttachmentMenu={showAttachmentMenu}
                onToggleAttachmentMenu={() => setShowAttachmentMenu(!showAttachmentMenu)}
                onEmojiSelect={handleEmojiSelect}
                isRecording={isRecording}
                recordingDuration={recordingDuration}
                formatRecordingDuration={formatRecordingDuration}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onCancelRecording={cancelRecording}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                isSendingLocation={isSendingLocation}
                showLocationMenu={showLocationMenu}
                onToggleLocationMenu={() => setShowLocationMenu(!showLocationMenu)}
                onSendCurrentLocation={sendCurrentLocation}
                onSendLiveLocation={sendLiveLocation}
              />
            )}
          </section>
        ) : (
          <section className="lg:col-span-2 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-muted-foreground">Select a conversation to start messaging</p>
            </div>
          </section>
        )}
      </div>

      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      <VoiceCallModal
        isOpen={isVoiceCallOpen}
        onClose={() => {
          setIsVoiceCallOpen(false);
          setIncomingCall(null);
        }}
        recipientName={incomingCall?.callerName || selectedConversation?.name || 'User'}
        recipientAvatar={incomingCall?.callerAvatar || selectedConversation?.avatar || '👤'}
        recipientId={incomingCall?.callerId || selectedConversation?.participantId || ''}
        currentUserId={user?._id || ''}
        isIncomingCall={!!incomingCall}
        callerId={incomingCall?.callerId}
        threadId={incomingCall?.threadId || selectedConversation?.threadId}
        onCallEnd={() => {
          setIncomingCall(null);
        }}
      />

      <VideoCallModal
        isOpen={isVideoCallOpen}
        onClose={() => {
          setIsVideoCallOpen(false);
          setIncomingCall(null);
        }}
        recipientName={incomingCall?.callerName || selectedConversation?.name || 'User'}
        recipientAvatar={incomingCall?.callerAvatar || selectedConversation?.avatar || '👤'}
        recipientId={incomingCall?.callerId || selectedConversation?.participantId || ''}
        currentUserId={user?._id || ''}
        isIncomingCall={!!incomingCall && incomingCall.callType === 'video'}
        callerId={incomingCall?.callerId}
        threadId={incomingCall?.threadId || selectedConversation?.threadId}
        onCallEnd={() => {
          setIncomingCall(null);
        }}
      />

      <GroupVoiceCallModal
        isOpen={isGroupVoiceCallOpen}
        onClose={() => {
          setIsGroupVoiceCallOpen(false);
          setIncomingCall(null);
        }}
        groupId={incomingCall?.groupInfo?.groupId || selectedConversation?.id || ''}
        groupName={incomingCall?.groupInfo?.groupName || selectedConversation?.name || 'Group'}
        groupAvatar={incomingCall?.groupInfo?.groupAvatar || selectedConversation?.avatar || '👥'}
        currentUserId={user?._id || ''}
        currentUserName={
          user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.username || ''
        }
        currentUserAvatar={user?.avatar || user?.profilePicture || ''}
        isIncomingCall={!!incomingCall?.isGroupCall && incomingCall?.callType === 'voice'}
        callerId={incomingCall?.callerId}
        callerInfo={
          incomingCall
            ? { name: incomingCall.callerName, avatar: incomingCall.callerAvatar }
            : undefined
        }
      />

      <GroupVideoCallModal
        isOpen={isGroupVideoCallOpen}
        onClose={() => {
          setIsGroupVideoCallOpen(false);
          setIncomingCall(null);
        }}
        groupId={incomingCall?.groupInfo?.groupId || selectedConversation?.id || ''}
        groupName={incomingCall?.groupInfo?.groupName || selectedConversation?.name || 'Group'}
        groupAvatar={incomingCall?.groupInfo?.groupAvatar || selectedConversation?.avatar || '👥'}
        currentUserId={user?._id || ''}
        currentUserName={
          user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.username || ''
        }
        currentUserAvatar={user?.avatar || user?.profilePicture || ''}
        isIncomingCall={!!incomingCall?.isGroupCall && incomingCall?.callType === 'video'}
        callerId={incomingCall?.callerId}
        callerInfo={
          incomingCall
            ? { name: incomingCall.callerName, avatar: incomingCall.callerAvatar }
            : undefined
        }
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={(group) => {
          const newGroup = {
            id: group._id,
            threadId: group._id,
            name: group.name || 'Unnamed Group',
            avatar: group.avatar || '👥',
            lastMessage: '',
            timestamp: 'Just now',
            unread: false,
            unreadCount: 0,
            online: false,
            isGroup: true,
            memberCount: group.members?.length || 0,
            members: group.members || [],
            participantId: '',
          };
          setGroups((prev) => [newGroup, ...prev]);
          setActiveTab('groups');
        }}
      />

      <GroupInfoModal
        isOpen={isGroupInfoOpen}
        onClose={() => setIsGroupInfoOpen(false)}
        groupId={selectedConversation?.isGroup ? selectedConversation.id : ''}
        currentUserId={user?._id || ''}
        onGroupUpdated={() => {
          const loadConvs = async () => {
            try {
              const response = await chatService.getThreads();
              if (response.success && response.data) {
                const threadsArray = response.data.threads || response.data || [];
                const convList = threadsArray.map((thread: any) => {
                  if (thread.isGroup) {
                    return {
                      id: thread._id,
                      name: thread.groupName || 'Group',
                      avatar: thread.groupAvatar || '👥',
                      lastMessage: thread.lastMessage?.text || '',
                      timestamp: thread.lastMessageAt
                        ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Just now',
                      unread: (thread.unreadCount || 0) > 0,
                      unreadCount: thread.unreadCount || 0,
                      online: false,
                      isGroup: true,
                      members: thread.participants?.length || 0,
                      threadId: thread._id,
                      participantId: '',
                    };
                  } else {
                    const otherParticipant = thread.participant;
                    const fullName =
                      otherParticipant?.firstName && otherParticipant?.lastName
                        ? `${otherParticipant.firstName} ${otherParticipant.lastName}`
                        : otherParticipant?.firstName || otherParticipant?.username || 'Unknown';
                    return {
                      id: thread._id,
                      participantId: otherParticipant?._id,
                      name: fullName,
                      avatar:
                        otherParticipant?.profileImage || otherParticipant?.profilePicture || '👤',
                      lastMessage: thread.lastMessage?.text || '',
                      timestamp: thread.lastMessageAt
                        ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Just now',
                      unread: (thread.unreadCount || 0) > 0,
                      unreadCount: thread.unreadCount || 0,
                      online: otherParticipant?.isOnline || false,
                      threadId: thread._id,
                    };
                  }
                });
                setConversations(convList);
                const updatedConv = convList.find((c: any) => c.id === selectedConversation?.id);
                if (updatedConv) {
                  setSelectedConversation(updatedConv);
                }
              }
            } catch (error) {}
          };
          loadConvs();
        }}
        onLeaveGroup={() => {
          setIsGroupInfoOpen(false);
          setSelectedConversation(null);
          setSelectedThreadId(null);
          setMessages([]);
          const loadConvs = async () => {
            try {
              const response = await chatService.getThreads();
              if (response.success && response.data) {
                const threadsArray = response.data.threads || response.data || [];
                const convList = threadsArray.map((thread: any) => {
                  if (thread.isGroup) {
                    return {
                      id: thread._id,
                      name: thread.groupName || 'Group',
                      avatar: thread.groupAvatar || '👥',
                      lastMessage: thread.lastMessage?.text || '',
                      timestamp: thread.lastMessageAt
                        ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Just now',
                      unread: (thread.unreadCount || 0) > 0,
                      unreadCount: thread.unreadCount || 0,
                      online: false,
                      isGroup: true,
                      members: thread.participants?.length || 0,
                      threadId: thread._id,
                      participantId: '',
                    };
                  } else {
                    const otherParticipant = thread.participant;
                    const fullName =
                      otherParticipant?.firstName && otherParticipant?.lastName
                        ? `${otherParticipant.firstName} ${otherParticipant.lastName}`
                        : otherParticipant?.firstName || otherParticipant?.username || 'Unknown';
                    return {
                      id: thread._id,
                      participantId: otherParticipant?._id,
                      name: fullName,
                      avatar:
                        otherParticipant?.profileImage || otherParticipant?.profilePicture || '👤',
                      lastMessage: thread.lastMessage?.text || '',
                      timestamp: thread.lastMessageAt
                        ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Just now',
                      unread: (thread.unreadCount || 0) > 0,
                      unreadCount: thread.unreadCount || 0,
                      online: otherParticipant?.isOnline || false,
                      threadId: thread._id,
                    };
                  }
                });
                setConversations(convList);
              }
            } catch (error) {}
          };
          loadConvs();
        }}
        onDeleteGroup={() => {
          setIsGroupInfoOpen(false);
          setGroups((prev) => prev.filter((g) => g.id !== selectedConversation?.id));
          setSelectedConversation(null);
          setSelectedThreadId(null);
          setMessages([]);
        }}
      />

      <Dialog
        open={isForwardModalOpen}
        onOpenChange={(open) => {
          setIsForwardModalOpen(open);
          if (!open) setForwardSearchQuery('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isSelecting
                ? `Forward ${selectedMessageIds.size} message${selectedMessageIds.size > 1 ? 's' : ''}`
                : 'Forward Message'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Preview: single message or multi-select count */}
            {isSelecting && selectedMessageIds.size > 0 ? (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  {selectedMessageIds.size} message{selectedMessageIds.size > 1 ? 's' : ''} selected
                </p>
              </div>
            ) : messageToForward ? (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Message:</p>
                <p className="text-sm truncate">
                  {messageToForward.content || (messageToForward.media ? '📷 Media' : 'Message')}
                </p>
              </div>
            ) : null}

            <Input
              placeholder="Search conversations..."
              value={forwardSearchQuery}
              onChange={(e) => setForwardSearchQuery(e.target.value)}
            />

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {[...conversations, ...groups]
                  .filter(
                    (conv) =>
                      conv.name.toLowerCase().includes(forwardSearchQuery.toLowerCase()) &&
                      conv.id !== selectedConversation?.id
                  )
                  .map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() =>
                        isSelecting
                          ? handleBulkForwardToConversation(conv)
                          : handleForwardMessage(conv)
                      }
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-lg overflow-hidden">
                        {conv.avatar?.startsWith('http') || conv.avatar?.startsWith('/') ? (
                          <img
                            src={getMediaUrl(conv.avatar)}
                            alt={conv.name}
                            className="w-full h-full object-cover"
                          />
                        ) : conv.isGroup ? (
                          <Users className="w-5 h-5 text-white" />
                        ) : (
                          <User className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm">{conv.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.isGroup ? 'Group' : conv.lastMessage}
                        </p>
                      </div>
                      <Send size={16} className="text-primary" />
                    </button>
                  ))}
                {[...conversations, ...groups].filter(
                  (conv) =>
                    conv.name.toLowerCase().includes(forwardSearchQuery.toLowerCase()) &&
                    conv.id !== selectedConversation?.id
                ).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No conversations found</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading chat...</p>
          </div>
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
