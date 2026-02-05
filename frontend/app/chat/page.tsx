'use client';

import CreateGroupModal from '@/components/create-group-modal';
import GroupInfoModal from '@/components/group-info-modal';
import Navigation from '@/components/navigation';
import SharedContentPreview from '@/components/shared-content-preview';
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
import { authService, chatService } from '@/lib/api-services';
import { getMediaUrl } from '@/lib/media-utils';
import {
  disconnectSocket,
  emitInitiateCall,
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
import {
  Ban,
  Camera,
  CornerUpLeft,
  Edit2,
  FileText,
  Flag,
  Forward,
  Image as ImageIcon,
  Info,
  MoreHorizontal,
  Phone,
  Plus,
  Reply,
  Send,
  Trash2,
  User,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

interface Conversation {
  id: string; // threadId - unique identifier for the conversation
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  unreadCount: number;
  online: boolean;
  participantId: string; // The other user's ID for matching online/offline events
  isGroup?: boolean;
  members?: number;
  threadId?: string;
  hasStory?: boolean; // Whether the user has an active story
}

interface Message {
  id: number | string;
  sender: string;
  content: string;
  timestamp: string;
  isSent: boolean;
  status?: 'sent' | 'delivered' | 'seen';
  isEdited?: boolean;
  isDeleted?: boolean;
  // System message fields
  type?: string;
  senderId?: string;
  senderName?: string;
  isSystemMessage?: boolean;
  systemMessageType?: string;
  media?: {
    url: string;
    type: 'image' | 'video' | 'file' | 'document';
    publicId?: string;
    fileName?: string;
    filename?: string; // Backend uses lowercase
    size?: number;
  }[];
  // Reply fields
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
  const [user, setUser] = useState<any>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [activeTab, setActiveTab] = useState<'messages' | 'groups'>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups] = useState<Conversation[]>([]);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    callerAvatar: string;
    threadId: string;
    callType?: 'voice' | 'video';
  } | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  // Reply and Forward states
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');

  const handleOpenProfile = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const selectedThreadIdRef = useRef<string | null>(null);

  // Helper function to format call duration
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  // Keep ref in sync with state
  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Load all conversations immediately
    const loadConvs = async () => {
      try {
        const response = await chatService.getThreads();

        if (response.success && response.data) {
          // Handle the actual backend structure: data.threads is an array
          const threadsArray = response.data.threads || response.data || [];

          // Deduplicate threads by threadId (in case backend returns duplicates)
          const seenThreadIds = new Set<string>();
          const seenParticipantIds = new Set<string>();
          const uniqueThreads = threadsArray.filter((thread: any) => {
            const threadId = thread._id?.toString();
            const participantId = thread.participant?._id?.toString();

            if (!threadId || !participantId) return false;

            // Check both threadId and participantId for duplicates
            if (seenThreadIds.has(threadId) || seenParticipantIds.has(participantId)) {
              console.warn('⚠️ Duplicate thread detected:', { threadId, participantId });
              return false;
            }

            seenThreadIds.add(threadId);
            seenParticipantIds.add(participantId);
            return true;
          });

          // Transform threads to conversations
          const convList = uniqueThreads.map((thread: any) => {
            console.log('📦 Raw thread data:', JSON.stringify(thread, null, 2));
            const otherParticipant = thread.participant;
            console.log('👤 Other participant:', JSON.stringify(otherParticipant, null, 2));
            console.log(
              '🆔 Participant ID:',
              otherParticipant?._id,
              'Type:',
              typeof otherParticipant?._id
            );

            // Get the last message text - check all possible field names
            let lastMessageText =
              thread.lastMessage?.text ||
              thread.lastMessage?.content ||
              thread.lastMessage?.message ||
              null;

            // If text is null but there's media, show media indicator
            if (
              !lastMessageText &&
              thread.lastMessage?.media &&
              thread.lastMessage.media.length > 0
            ) {
              const mediaType = thread.lastMessage.media[0].type || 'attachment';
              if (mediaType === 'image') {
                lastMessageText = '📷 Image';
              } else if (mediaType === 'video') {
                lastMessageText = '📹 Video';
              } else if (mediaType === 'document' || mediaType === 'file') {
                lastMessageText = '📄 Document';
              } else if (mediaType === 'audio') {
                lastMessageText = '🎵 Audio';
              } else {
                lastMessageText = `📎 ${mediaType}`;
              }
            }

            // If still no message, check if there's an encrypted content field
            if (!lastMessageText && thread.lastMessage?.encryptedContent) {
              lastMessageText = '[Encrypted Message]';
            }

            // Instagram style - show message or empty
            const displayMessage = lastMessageText || '';

            const conversationObj = {
              id: thread._id, // Use threadId as unique identifier, not participant ID
              participantId: otherParticipant?._id?.toString() || otherParticipant?._id, // Ensure string conversion
              name:
                otherParticipant?.firstName ||
                otherParticipant?.fullName ||
                otherParticipant?.username ||
                'Unknown',
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
              online: otherParticipant?.isOnline || false, // Use actual online status
              threadId: thread._id,
              hasStory: otherParticipant?.hasActiveStory || false, // Check if user has active story
            };
            console.log('📋 Created conversation object:', conversationObj);
            return conversationObj;
          });
          console.log('✅ All conversations:', convList);
          setConversations(convList);

          // Request online users list AFTER conversations are loaded
          // Use a small delay to ensure socket listeners are attached
          setTimeout(() => {
            const socket = getSocket();
            if (socket?.connected) {
              socket.emit('getOnlineUsers');
            }
          }, 500);
        } else {
          console.warn(' No data in response:', response);
          setConversations([]);
        }
      } catch (error) {
        console.error(' Error loading conversations:', error);
        setConversations([]);
      }
    };

    loadConvs();

    // Initialize socket connection FIRST
    const token = localStorage.getItem('accessToken');
    if (token) {
      const initSock = initSocket(token);

      // Emit user online status ONLY after socket connects
      if (initSock?.connected) {
        emitUserOnline(parsedUser._id);
      } else {
        // Wait for connection and then emit online status
        initSock?.once('connect', () => {
          emitUserOnline(parsedUser._id);
        });
      }

      // Setup socket event listeners
      const handleNewMessage = (data: any) => {
        console.log('📩 New message received:', data);

        if (data.threadId && data.message) {
          // Skip if this is our own message (we already added it optimistically)
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

          // Add message to chat if thread is currently open
          setSelectedThreadId((currentThreadId) => {
            if (currentThreadId === data.threadId) {
              // Only add message if it's from another user (not our own)
              if (!isOwnMessage) {
                setMessages((prev) => {
                  const messageExists = prev.some((msg) => msg.id === data.message._id);
                  if (messageExists) {
                    return prev;
                  }
                  return [...prev, newMessage];
                });
              }
              // Emit message delivered acknowledgment
              if (data.message._id) {
                emitMessageDelivered(data.message._id);
              }
            }
            return currentThreadId;
          });

          // Update conversation list with new message
          setConversations((prev) => {
            const threadId = data.threadId?.toString();

            // Determine display message
            let displayMessage = data.message.text || '';
            if (!displayMessage && data.message.media && data.message.media.length > 0) {
              const mediaType = data.message.media[0].type;
              if (mediaType === 'image') {
                displayMessage = '📷 Image';
              } else if (mediaType === 'video') {
                displayMessage = '📹 Video';
              } else if (mediaType === 'document' || mediaType === 'file') {
                displayMessage = '📄 Document';
              } else {
                displayMessage = `📎 ${mediaType}`;
              }
            }

            const updatedConvs = prev.map((conv) => {
              const convId = conv.id.toString();

              // Match by conversation id (which is threadId)
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

            // Check if conversation was updated
            const conversationUpdated = updatedConvs.some((c) => c.id === threadId);

            // If thread is not in conversations, add it
            // This should be rare since newThread event should handle new threads
            if (!conversationUpdated && data.message.senderId?._id !== parsedUser._id) {
              const newConv: Conversation = {
                id: threadId, // Use threadId as unique identifier
                participantId: data.message.senderId._id,
                name:
                  data.message.senderId?.firstName || data.message.senderId?.username || 'Unknown',
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

            // Move updated conversation to top
            const conversationIndex = updatedConvs.findIndex((c) => c.id === threadId);

            if (conversationIndex > 0) {
              const [movedConv] = updatedConvs.splice(conversationIndex, 1);
              return [movedConv, ...updatedConvs];
            }

            return updatedConvs;
          });

          // Show browser notification and play sound if not focused
          if (!document.hasFocus() && data.message.senderId?._id !== parsedUser._id) {
            // Play notification sound
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
        // Update message status (delivered, read, etc.)
        if (data.messageId && data.status) {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === data.messageId ? { ...msg, status: data.status } : msg))
          );
        }
      };

      const handleMessagesSeen = (data: any) => {
        // Update all messages in thread as seen
        if (data.threadId) {
          setMessages((prev) => prev.map((msg) => ({ ...msg, status: 'seen' })));
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
            // Remove message for everyone
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
            // Mark as deleted for current user
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id.toString() === messageIdStr
                  ? { ...msg, content: 'This message was deleted', isDeleted: true }
                  : msg
              )
            );
          }
        } else {
          console.error('❌ No messageId in delete event!');
        }
      };

      const handleUserTyping = (data: any) => {
        const currentThreadId = selectedThreadIdRef.current;

        // Show/hide typing indicator based on isTyping flag
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
        // This handler might not be needed since we use isTyping flag
        if (currentThreadId && data.threadId === currentThreadId) {
          setIsOtherUserTyping(false);
        }
      };

      const handleUserOnline = (data: any) => {
        // Handle multiple data formats
        const userId = data?.userId || data?.user?._id || data?._id || data?.id;
        const userIdStr = userId?.toString();

        if (userIdStr) {
          setConversations((prev) => {
            const updated = prev.map((conv) => {
              const convParticipantStr = conv.participantId?.toString();
              if (convParticipantStr === userIdStr) {
                return { ...conv, online: true };
              }
              return conv;
            });
            return updated;
          });

          // Also update selectedConversation if it matches
          setSelectedConversation((prev) => {
            if (prev && prev.participantId?.toString() === userIdStr) {
              return { ...prev, online: true };
            }
            return prev;
          });
        }
      };

      const handleUserOffline = (data: any) => {
        // Handle multiple data formats
        const userId = data?.userId || data?.user?._id || data?._id || data?.id;
        const userIdStr = userId?.toString();

        if (userIdStr) {
          setConversations((prev) => {
            const updated = prev.map((conv) => {
              const convParticipantStr = conv.participantId?.toString();
              if (convParticipantStr === userIdStr) {
                return { ...conv, online: false };
              }
              return conv;
            });
            return updated;
          });

          // Also update selectedConversation if it matches
          setSelectedConversation((prev) => {
            if (prev && prev.participantId?.toString() === userIdStr) {
              return { ...prev, online: false };
            }
            return prev;
          });
        }
      };

      const handleNewThread = (data: any) => {
        // Add new thread to conversations list when another user messages you
        if (data && data.threadId && data.participant) {
          setConversations((prev) => {
            // Check if conversation already exists (by threadId or participantId)
            const exists = prev.some(
              (c) => c.id === data.threadId || c.participantId === data.participant._id
            );

            if (exists) {
              return prev;
            }

            // Create new conversation from thread data
            const newConv: Conversation = {
              id: data.threadId, // Use threadId as unique identifier
              participantId: data.participant._id, // Store participant ID for online/offline matching
              name:
                data.participant.firstName ||
                data.participant.fullName ||
                data.participant.username ||
                'Unknown',
              avatar:
                data.participant.profileImage ||
                data.participant.profilePicture ||
                data.participant.avatar ||
                '👤',
              lastMessage: 'New conversation started',
              timestamp: 'Now',
              unread: true,
              unreadCount: 1,
              online: data.participant.isOnline || false, // Use actual online status
              threadId: data.threadId,
            };

            return [newConv, ...prev];
          });
        }
      };

      // Voice call handlers
      const handleIncomingCall = (data: any) => {
        console.log('📞 Incoming call received:', data);

        // Backend sends 'callerId', not 'from'
        const callerId = data?.callerId || data?.from;
        const threadId = data?.threadId;
        const callerInfo = data?.callerInfo;
        const callType = data?.callType || 'voice'; // Default to voice if not specified

        console.log('📞 Call details:', { callerId, threadId, callType });

        if (!callerId || !threadId) {
          console.warn('❌ Invalid incoming call data:', data);
          return;
        }

        // Find the conversation by threadId
        const conversation = conversations.find(
          (c) => c.threadId === threadId || c.id === threadId || c.participantId === callerId
        );

        console.log('📞 Found conversation:', conversation);

        // Use priority: conversation name > callerInfo from backend > Unknown
        const callerName = conversation?.name || callerInfo?.name || 'Unknown User';
        const callerAvatar = conversation?.avatar || callerInfo?.avatar || '👤';

        setIncomingCall({
          callerId,
          callerName,
          callerAvatar,
          threadId,
          callType,
        });

        // Add system message for incoming call if it's the selected conversation
        if (
          threadId === selectedThreadIdRef.current ||
          threadId === selectedConversation?.threadId
        ) {
          const callMessage: Message = {
            id: `call-incoming-${Date.now()}`,
            sender: 'System',
            content: callType === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call',
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

        // Show browser notification
        if (typeof window !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Incoming Call', {
            body: `${callerName} is calling...`,
            icon: callerAvatar,
            tag: 'incoming-call',
          });
        }

        if (!conversation) {
          console.warn('Conversation not found. ThreadId:', threadId, 'CallerId:', callerId);
        }
      };

      const handleCallRejected = (data: any) => {
        setIncomingCall(null);
        setIsVoiceCallOpen(false);
        setIsVideoCallOpen(false);

        // Add system message for rejected call
        if (
          data.threadId === selectedThreadIdRef.current ||
          data.threadId === selectedConversation?.threadId
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
        setIsVoiceCallOpen(false);
        setIsVideoCallOpen(false);

        // Add system message for ended call
        if (
          data.threadId === selectedThreadIdRef.current ||
          data.threadId === selectedConversation?.threadId
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
        console.log('📞 Call failed:', data);
        setIncomingCall(null);
        setIsVoiceCallOpen(false);
        setIsVideoCallOpen(false);

        // Show toast notification for call failure
        showToast.error('Call Failed', data.reason || 'Unable to connect the call');

        // Add system message for failed call
        if (
          data.threadId === selectedThreadIdRef.current ||
          data.threadId === selectedConversation?.threadId ||
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

      const currentSocket = getSocket();
      if (currentSocket) {
        currentSocket.on('messagesSeen', handleMessagesSeen);
        currentSocket.on('messageEdited', handleMessageEdited);
        currentSocket.on('messageDeleted', handleMessageDeleted);

        // Handle reconnection - re-emit online status
        currentSocket.on('connect', () => {
          emitUserOnline(parsedUser._id);
          // Request online users list on connect
          currentSocket.emit('getOnlineUsers');
        });

        // Listen for initial online users list
        currentSocket.on('onlineUsersList', (data: { users: string[] }) => {
          // Update all conversations with online status
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

          // Update selected conversation if needed
          setSelectedConversation((prev) => {
            if (prev && data.users.includes(prev.participantId)) {
              return { ...prev, online: true };
            }
            return prev;
          });
        });

        // Request initial online users list (immediately if connected, otherwise wait for connect)
        if (currentSocket.connected) {
          console.log('🔌 Socket already connected, requesting online users...');
          currentSocket.emit('getOnlineUsers');
        }
        // Socket not connected yet - the 'connect' handler will request online users
      } else {
        console.error('Socket not available!');
      }

      // Request notification permission
      if (typeof window !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      // Cleanup on unmount
      return () => {
        const currentSocket = getSocket();
        if (currentSocket) {
          currentSocket.off('messagesSeen');
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

        // Clear typing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // NOTE: Do NOT disconnect socket here - keep it alive until logout
        // Socket will be disconnected in handleLogout()
      };
    }
  }, []);

  useEffect(() => {
    // Wait for user to be loaded
    if (!user) return;

    // Check if there's a userId in URL params to open chat with specific user
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    const userAvatar = searchParams.get('avatar');

    if (userId && userName) {
      // Check if conversation already exists in the loaded list
      const existingConv = conversations.find((c) => c.participantId === userId);

      if (existingConv) {
        setSelectedConversation(existingConv);
        if (existingConv.threadId) {
          setSelectedThreadId(existingConv.threadId);
          joinThread(existingConv.threadId);
          loadMessages(existingConv.threadId);
        } else {
          handleGetThread(userId);
        }
      } else {
        // Open chat with specific user
        const newConversation: Conversation = {
          id: userId, // Temporarily use userId
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
        // Clear messages initially
        setMessages([]);
        // Create/get thread and load messages
        handleGetThread(userId);
      }

      // Clear URL params
      router.replace('/chat', { scroll: false });
    }
  }, [searchParams, user, conversations.length]); // Depend on conversations.length to retry if loaded later

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleLogout = () => {
    // Emit offline status before disconnecting
    if (user?._id) {
      emitUserOffline(user._id);
    }

    // Disconnect socket
    disconnectSocket();

    // Clear storage and redirect
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
        } catch (error: any) {
          console.error('Error blocking user:', error);
        }
      },
    });
  };

  const handleReportUser = () => {
    if (!selectedConversation) return;
    const reason = prompt(`Please specify the reason for reporting ${selectedConversation.name}:`);
    if (reason && reason.trim()) {
      confirm({
        title: 'Report Submitted',
        message: `User reported for: ${reason}\n\nThank you for helping keep our community safe.`,
        confirmText: 'OK',
        cancelText: null,
        variant: 'success',
        onConfirm: () => {},
      });
    }
  };

  const handleSendMessage = async () => {
    // Allow sending if there is text OR a file
    if ((!messageInput.trim() && !selectedFile) || !selectedThreadId || isSendingMessage) return;

    // Stop typing indicator when sending
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

      if (fileToSend) {
        const formData = new FormData();
        if (messageText) formData.append('text', messageText);
        if (replyToId) formData.append('reply_to', replyToId);

        // Strictly use "media" key for backend
        formData.append('media', fileToSend);

        response = await chatService.sendMessage(selectedThreadId, formData);
      } else {
        response = await chatService.sendMessage(selectedThreadId, {
          text: messageText,
          reply_to: replyToId,
        });
      }

      if (response.success && response.data) {
        // Update with actual message from server
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessage.id
              ? {
                  ...msg,
                  id: response.data._id,
                  media: response.data.media || msg.media, // Update media URL from server
                }
              : msg
          )
        );

        // Update conversation last message and move to top
        setConversations((prev) => {
          const updated = prev.map((conv) =>
            conv.id === selectedConversation?.id
              ? {
                  ...conv,
                  lastMessage: fileToSend
                    ? fileToSend.type.startsWith('image')
                      ? '📷 Image'
                      : fileToSend.type.startsWith('video')
                        ? '📹 Video'
                        : '📄 Document'
                    : messageText,
                  timestamp: 'Now',
                  unread: false,
                }
              : conv
          );
          // Move updated conversation to top
          const updatedConv = updated.find((c) => c.id === selectedConversation?.id);
          const others = updated.filter((c) => c.id !== selectedConversation?.id);
          return updatedConv ? [updatedConv, ...others] : updated;
        });
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      if (error && typeof error === 'object') {
        console.error('Error Details:', JSON.stringify(error, null, 2));
      }

      // Error is logged to console, no need to show alert

      // Remove temp message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      setMessageInput(messageText);
      // Note: we can't easily restore file selection programmatically for security reasons
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Handle forwarding a message to a conversation
  const handleForwardMessage = async (targetConversation: Conversation) => {
    if (!messageToForward) return;

    try {
      let targetThreadId: string | undefined = targetConversation.threadId;

      // If no threadId exists, create/get the thread first
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

      // Send the forwarded message
      const forwardedText = messageToForward.content;
      const response = await chatService.sendMessage(targetThreadId, {
        text: forwardedText,
        isForwarded: true,
      });

      if (response.success) {
        showToast.success(`Message forwarded to ${targetConversation.name}`);
        setIsForwardModalOpen(false);
        setMessageToForward(null);
        setForwardSearchQuery('');
      } else {
        showToast.error('Failed to forward message');
      }
    } catch (error) {
      console.error('Error forwarding message:', error);
      showToast.error('Failed to forward message');
    }
  };

  const handleMessageInputChange = (value: string) => {
    setMessageInput(value);

    // Emit typing event
    if (selectedThreadId && selectedConversation?.participantId) {
      emitTyping(selectedThreadId, selectedConversation.participantId);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to emit stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        emitStopTyping(selectedThreadId, selectedConversation.participantId);
      }, 3000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      // Create preview URL
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editingMessageText.trim()) return;

    try {
      await chatService.editMessage(messageId, { text: editingMessageText });

      // Update message in UI
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id.toString() === messageId
            ? { ...msg, content: editingMessageText, isEdited: true }
            : msg
        )
      );

      setEditingMessageId(null);
      setEditingMessageText('');
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string, deleteFor: 'me' | 'everyone') => {
    try {
      await chatService.deleteMessage(messageId, deleteFor);

      // Remove message from UI immediately for both cases
      // Socket event will also update other user's UI for "everyone"
      setMessages((prev) => prev.filter((msg) => msg.id.toString() !== messageId));

      showToast.success(
        'Message deleted',
        deleteFor === 'everyone' ? 'Message deleted for everyone' : 'Message deleted for you'
      );
    } catch (error: any) {
      console.error('Error deleting message:', error);
      showToast.error('Delete failed', error?.message || 'Failed to delete message');
    }
  };

  const handleGetThread = async (userId: string) => {
    try {
      const response = await chatService.getThread(userId);

      if (response.success && response.data) {
        // Handle both direct _id and nested structure
        const threadId = response.data._id || response.data.thread?._id || response.data.threadId;

        if (threadId) {
          setSelectedThreadId(threadId);
          // Join thread room via socket
          joinThread(threadId);
          // Load messages for this thread
          loadMessages(threadId);
          // Mark as seen
          markThreadAsRead(threadId, userId);
        } else {
          console.error('No thread ID in response');
        }
      }
    } catch (error) {
      console.error('Error getting thread:', error);
    }
  };

  const markThreadAsRead = async (threadId: string, userId: string) => {
    try {
      await chatService.markThreadAsRead(threadId);
      // Update conversation to mark as read and reset unread count
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === threadId || conv.threadId === threadId
            ? { ...conv, unread: false, unreadCount: 0 }
            : conv
        )
      );
    } catch (error) {
      console.error('Error marking thread as read:', error);
    }
  };

  const loadMessages = async (threadId: string) => {
    setIsLoadingMessages(true);
    try {
      const response = await chatService.getMessages(threadId);

      if (response.success && response.data) {
        // Handle both array and object responses
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
          content: msg.isDeleted ? 'This message was deleted' : msg.text || msg.content || '',
          timestamp: new Date(msg.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isEdited: msg.isEdited || false,
          isDeleted: msg.isDeleted || false,
          isSent: msg.senderId?._id === user?._id,
          status: msg.status || 'sent',
          messageType: msg.messageType || 'text',
          sharedContent: msg.sharedContent,
          media: msg.media || [],
          isForwarded: msg.isForwarded || false,
          replyTo: msg.replyTo
            ? {
                _id: msg.replyTo._id,
                content: msg.replyTo.text || '',
                senderName: msg.replyTo.senderName || msg.replyTo.senderId?.firstName || 'Unknown',
              }
            : undefined,
        }));

        setMessages(formattedMessages);
      } else {
        // No messages yet
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Deduplicate conversations by id before filtering
  const uniqueConversations = conversations.filter(
    (conv, index, self) => index === self.findIndex((c) => c.id === conv.id)
  );

  const filteredConversations = uniqueConversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Deduplicate groups by id before filtering
  const uniqueGroups = groups.filter(
    (group, index, self) => index === self.findIndex((g) => g.id === group.id)
  );

  const filteredGroups = uniqueGroups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayList = activeTab === 'messages' ? filteredConversations : filteredGroups;

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[100dvh]">
        {/* Sidebar - Hidden on mobile */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Conversations List - Hidden on mobile when chat is selected */}
        <section
          className={`lg:col-span-1 border-r border-border flex flex-col h-[100dvh] overflow-hidden ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}
        >
          <div className="p-4 border-b border-border">
            <h1 className="text-2xl font-bold mb-4 text-foreground">Chats</h1>

            {/* Tabs */}
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

            {/* Create Group Button */}
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
            {/* Quick Access - Instagram Style (Online users first, then recent chats) */}
            {conversations.length > 0 && (
              <div className="p-3 border-b border-border">
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                  {/* Sort: Online users first, then by recent message */}
                  {[...uniqueConversations]
                    .sort((a, b) => {
                      // Online users come first
                      if (a.online && !b.online) return -1;
                      if (!a.online && b.online) return 1;
                      // Then sort by timestamp (most recent first)
                      return 0; // Keep original order (already sorted by recent)
                    })
                    .slice(0, 15) // Limit to 15 users
                    .map((friend, friendIndex) => (
                      <div
                        key={`friend-${friend.id}-${friendIndex}`}
                        onClick={() => {
                          setSelectedConversation(friend);
                          if (friend.threadId) {
                            setSelectedThreadId(friend.threadId);
                            joinThread(friend.threadId);
                            loadMessages(friend.threadId);
                          } else {
                            handleGetThread(friend.participantId);
                          }
                        }}
                        className="flex flex-col items-center gap-1.5 cursor-pointer min-w-[64px] hover:opacity-80 transition"
                      >
                        <div className="relative">
                          {/* Story ring gradient if has story, gray border if no story */}
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
                          {/* Online indicator */}
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
                    if (conversation.threadId) {
                      // Use threadId directly if available
                      setSelectedThreadId(conversation.threadId);
                      joinThread(conversation.threadId);
                      loadMessages(conversation.threadId);
                      markThreadAsRead(conversation.threadId, conversation.id.toString());
                    } else {
                      // Fallback: create/get thread
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
                        {conversation.members}
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
                          ({conversation.members})
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

                {/* Options Dropdown Menu */}
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
                                // Remove from conversations list
                                setConversations((prev) =>
                                  prev.filter((c) => c.id !== conversation.id)
                                );

                                // Clear selected conversation if it was deleted
                                if (selectedConversation?.id === conversation.id) {
                                  setSelectedConversation(null);
                                  setSelectedThreadId(null);
                                  setMessages([]);
                                }
                              }
                            } catch (error: any) {
                              console.error('Error deleting thread:', error);
                            }
                          },
                        });
                      }}
                      className=""
                    >
                      <Trash2 size={14} className="mr-2 " />
                      Delete Conversation
                    </DropdownMenuItem>
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

        {/* Chat Area - Show on mobile when conversation is selected */}
        {selectedConversation ? (
          <section className="lg:col-span-2 flex flex-col h-[100dvh] overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Back Button - Only visible on mobile */}
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
                    !selectedConversation.isGroup &&
                    handleOpenProfile(selectedConversation.participantId)
                  }
                  className={`w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-lg ${
                    selectedConversation.isGroup ? 'text-2xl' : ''
                  } overflow-hidden ${!selectedConversation.isGroup ? 'cursor-pointer hover:opacity-80 transition' : ''}`}
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
                        !selectedConversation.isGroup &&
                        handleOpenProfile(selectedConversation.participantId)
                      }
                      className={`font-semibold text-foreground ${!selectedConversation.isGroup ? 'cursor-pointer hover:text-primary transition' : ''}`}
                    >
                      {selectedConversation.name}
                    </p>
                    {selectedConversation.isGroup && (
                      <span className="text-xs text-muted-foreground">
                        ({selectedConversation.members} members)
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.isGroup
                      ? `${selectedConversation.members} members`
                      : selectedConversation.online
                        ? 'Active now'
                        : 'Offline'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Group Info Button */}
                {selectedConversation.isGroup && (
                  <button
                    type="button"
                    onClick={() => setIsGroupInfoOpen(true)}
                    className="p-2 hover:bg-muted rounded-full transition cursor-pointer"
                    title="Group Info"
                  >
                    <Info size={20} className="text-foreground" />
                  </button>
                )}

                {/* Voice/Video calls - available for both direct messages and groups */}
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const socket = getSocket();

                      if (selectedConversation?.participantId && selectedConversation?.threadId) {
                        // Add system message for outgoing call
                        const callMessage: Message = {
                          id: `call-initiated-${Date.now()}`,
                          sender: 'System',
                          content: '📞 Outgoing voice call',
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

                        // Initiate the call via socket
                        emitInitiateCall(
                          selectedConversation.participantId,
                          selectedConversation.threadId,
                          'voice'
                        );
                        // Open the modal
                        setIsVoiceCallOpen(true);
                      } else {
                        console.error('Cannot initiate call: Missing participant or thread info');
                        console.error('Conversation object:', selectedConversation);
                      }
                    }}
                    className="p-2 rounded-full hover:bg-muted transition cursor-pointer"
                    title="Start voice call"
                  >
                    <Phone size={20} className="text-primary" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedConversation?.participantId && selectedConversation?.threadId) {
                        // Add system message for outgoing video call
                        const callMessage: Message = {
                          id: `call-initiated-${Date.now()}`,
                          sender: 'System',
                          content: '📹 Outgoing video call',
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

                        // Initiate the video call via socket
                        emitInitiateCall(
                          selectedConversation.participantId,
                          selectedConversation.threadId,
                          'video'
                        );
                        // Open the modal
                        setIsVideoCallOpen(true);
                      } else {
                        console.error(
                          'Cannot initiate video call: Missing participant or thread info'
                        );
                      }
                    }}
                    className="p-2 rounded-full hover:bg-muted transition cursor-pointer"
                    title="Start video call"
                  >
                    <Video size={20} className="text-primary" />
                  </button>
                </>

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
                      onClick={() =>
                        !selectedConversation.isGroup &&
                        handleOpenProfile(selectedConversation.participantId)
                      }
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
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Loading messages...</p>
                </div>
              ) : (
                <>
                  {messages.map((message, msgIndex) => {
                    // Render system messages differently
                    if ((message as any).isSystemMessage) {
                      return (
                        <div
                          key={`msg-${message.id}-${msgIndex}`}
                          className="flex justify-center my-2"
                        >
                          <div className="px-3 py-1 rounded-full bg-muted/50 text-muted-foreground text-xs">
                            {message.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`msg-${message.id}-${msgIndex}`}
                        className={`flex ${message.isSent ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="flex items-start gap-2 group max-w-xs">
                          {message.isSent && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-muted transition mt-1 cursor-pointer">
                                  <MoreHorizontal size={16} className="text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                                  <Reply size={14} className="mr-2" />
                                  Reply
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setMessageToForward(message);
                                    setIsForwardModalOpen(true);
                                  }}
                                >
                                  <Forward size={14} className="mr-2" />
                                  Forward
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingMessageId(message.id.toString());
                                    setEditingMessageText(message.content);
                                  }}
                                >
                                  <Edit2 size={14} className="mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteMessage(message.id.toString(), 'me')}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete for me
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleDeleteMessage(message.id.toString(), 'everyone')
                                  }
                                  className="text-destructive"
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete for everyone
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          {editingMessageId === message.id.toString() ? (
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Input
                                  value={editingMessageText}
                                  onChange={(e) => setEditingMessageText(e.target.value)}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      handleEditMessage(message.id.toString());
                                    }
                                  }}
                                  className="flex-1"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleEditMessage(message.id.toString())}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingMessageId(null);
                                    setEditingMessageText('');
                                  }}
                                >
                                  <X size={16} />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`px-4 py-2 rounded-2xl ${
                                message.isSent
                                  ? 'bg-primary text-primary-foreground rounded-br-none'
                                  : 'bg-muted rounded-bl-none'
                              }`}
                            >
                              {/* Reply preview if this message is a reply */}
                              {message.replyTo && (
                                <div
                                  className={`mb-2 pl-2 border-l-2 ${message.isSent ? 'border-primary-foreground/50' : 'border-primary/50'}`}
                                >
                                  <p
                                    className={`text-xs font-medium ${message.isSent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                                  >
                                    {message.replyTo.senderName}
                                  </p>
                                  <p
                                    className={`text-xs truncate max-w-[180px] ${message.isSent ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}
                                  >
                                    {message.replyTo.content}
                                  </p>
                                </div>
                              )}
                              {/* Forwarded indicator */}
                              {message.isForwarded && (
                                <div
                                  className={`flex items-center gap-1 text-xs mb-1 ${message.isSent ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}
                                >
                                  <Forward size={10} />
                                  <span>Forwarded</span>
                                </div>
                              )}
                              {message.media &&
                                message.media.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="mb-2 rounded-lg overflow-hidden max-w-[240px]"
                                  >
                                    {item.type === 'video' ? (
                                      <video
                                        src={getMediaUrl(item.url)}
                                        controls
                                        className="w-full max-h-[300px] object-cover"
                                      />
                                    ) : item.type === 'document' ||
                                      item.type === 'file' ||
                                      (!item.type?.startsWith('image') &&
                                        !item.type?.startsWith('video') &&
                                        (item.fileName || item.filename)) ? (
                                      <a
                                        href={getMediaUrl(item.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition"
                                      >
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                          <FileText size={20} className="text-blue-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">
                                            {item.fileName || item.filename || 'Document'}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            Click to download
                                          </p>
                                        </div>
                                      </a>
                                    ) : (
                                      <img
                                        src={getMediaUrl(item.url)}
                                        alt="Shared content"
                                        className="w-full max-h-[300px] object-cover"
                                      />
                                    )}
                                  </div>
                                ))}
                              {message.content && (
                                <p className={message.isDeleted ? 'italic opacity-60' : ''}>
                                  {message.content}
                                </p>
                              )}

                              {/* Shared Content Preview */}
                              {((message as any).messageType === 'shared_post' ||
                                (message as any).messageType === 'shared_reel') &&
                                (message as any).sharedContent?.contentData && (
                                  <SharedContentPreview
                                    messageType={(message as any).messageType}
                                    contentData={(message as any).sharedContent.contentData}
                                  />
                                )}

                              <p
                                className={`text-xs mt-1 ${
                                  message.isSent ? 'opacity-70' : 'opacity-60'
                                }`}
                              >
                                {message.timestamp}
                                {message.isEdited && !message.isDeleted && (
                                  <span className="ml-1">(edited)</span>
                                )}
                              </p>
                            </div>
                          )}

                          {/* Dropdown for received messages */}
                          {!message.isSent && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-muted transition mt-1 cursor-pointer">
                                  <MoreHorizontal size={16} className="text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                                  <Reply size={14} className="mr-2" />
                                  Reply
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setMessageToForward(message);
                                    setIsForwardModalOpen(true);
                                  }}
                                >
                                  <Forward size={14} className="mr-2" />
                                  Forward
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteMessage(message.id.toString(), 'me')}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete for me
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing Indicator */}
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

            {/* Message Input */}
            <div className="relative">
              {/* File Preview */}
              {selectedFile && (
                <div className="absolute bottom-full left-0 right-0 p-4 bg-background border-t border-border flex items-center gap-4 z-20 shadow-md">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted">
                    {selectedFile.type.startsWith('video') ? (
                      <video src={previewUrl || ''} className="w-full h-full object-cover" />
                    ) : selectedFile.type.startsWith('image') ? (
                      <img
                        src={previewUrl || ''}
                        className="w-full h-full object-cover"
                        alt="Preview"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <FileText size={32} className="text-blue-500" />
                      </div>
                    )}
                    <button
                      onClick={removeSelectedFile}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black/80 transition"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}

              {/* Reply Preview */}
              {replyingTo && (
                <div className="px-4 py-2 border-t border-border bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CornerUpLeft size={16} className="text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-primary">
                          Replying to {replyingTo.isSent ? 'yourself' : replyingTo.sender}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {replyingTo.content || (replyingTo.media ? '📷 Media' : 'Message')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setReplyingTo(null)}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              )}

              <div className="p-4 border-t border-border flex items-end gap-2 mb-20 lg:mb-4 bg-background relative z-10 w-full">
                {/* Hidden file inputs */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,video/*"
                />
                <input
                  type="file"
                  ref={documentInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                />

                {/* Attachment Menu Button */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    className="text-muted-foreground hover:text-primary mb-0.5"
                    title="Attach file"
                  >
                    <Plus
                      size={20}
                      className={`transition-transform ${showAttachmentMenu ? 'rotate-45' : ''}`}
                    />
                  </Button>

                  {/* Attachment Options Menu */}
                  {showAttachmentMenu && (
                    <div className="absolute bottom-12 left-0 bg-card rounded-xl shadow-lg border border-border p-2 min-w-[180px] z-50">
                      <button
                        onClick={() => {
                          cameraInputRef.current?.click();
                          setShowAttachmentMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-lg transition text-sm"
                      >
                        <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                          <Camera size={16} className="text-red-500" />
                        </div>
                        <span>Camera</span>
                      </button>
                      <button
                        onClick={() => {
                          fileInputRef.current?.click();
                          setShowAttachmentMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-lg transition text-sm"
                      >
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                          <ImageIcon size={16} className="text-purple-500" />
                        </div>
                        <span>Photo & Video</span>
                      </button>
                      <button
                        onClick={() => {
                          documentInputRef.current?.click();
                          setShowAttachmentMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-lg transition text-sm"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <FileText size={16} className="text-blue-500" />
                        </div>
                        <span>Document</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder={selectedFile ? 'Add a caption...' : 'Type a message...'}
                    value={messageInput}
                    onChange={(e) => handleMessageInputChange(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={isSendingMessage}
                    className="w-full"
                  />
                </div>

                <Button
                  onClick={handleSendMessage}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer mb-0.5"
                  disabled={isSendingMessage || (!messageInput.trim() && !selectedFile)}
                >
                  <Send size={20} />
                </Button>
              </div>
            </div>
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

      {/* Mobile Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      {/* Voice Call Modal */}
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

      {/* Video Call Modal */}
      <VideoCallModal
        isOpen={isVideoCallOpen}
        onClose={() => {
          setIsVideoCallOpen(false);
          setIncomingCall(null);
        }}
        recipientName={incomingCall?.callerName || selectedConversation?.name || 'User'}
        recipientAvatar={incomingCall?.callerAvatar || selectedConversation?.avatar || '👤'}
        recipientId={incomingCall?.callerId || selectedConversation?.participantId || ''}
        isIncoming={!!incomingCall && incomingCall.callType === 'video'}
        callId={incomingCall?.threadId || selectedConversation?.threadId}
        callerId={incomingCall?.callerId}
        threadId={incomingCall?.threadId || selectedConversation?.threadId}
      />

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={(group) => {
          // Reload conversations to show new group
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
                    return {
                      id: thread._id,
                      participantId: otherParticipant?._id,
                      name: otherParticipant?.firstName || otherParticipant?.username || 'Unknown',
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
            } catch (error) {
              console.error('Error reloading conversations:', error);
            }
          };
          loadConvs();
        }}
      />

      {/* Group Info Modal */}
      <GroupInfoModal
        isOpen={isGroupInfoOpen}
        onClose={() => setIsGroupInfoOpen(false)}
        groupId={selectedConversation?.isGroup ? selectedConversation.id : ''}
        currentUserId={user?._id || ''}
        onGroupUpdated={() => {
          // Reload conversations and messages
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
                    return {
                      id: thread._id,
                      participantId: otherParticipant?._id,
                      name: otherParticipant?.firstName || otherParticipant?.username || 'Unknown',
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
                // Update selected conversation if it's the current one
                const updatedConv = convList.find((c: any) => c.id === selectedConversation?.id);
                if (updatedConv) {
                  setSelectedConversation(updatedConv);
                }
              }
            } catch (error) {
              console.error('Error reloading conversations:', error);
            }
          };
          loadConvs();
        }}
        onLeaveGroup={() => {
          // Close modal, clear selection, reload conversations
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
                    return {
                      id: thread._id,
                      participantId: otherParticipant?._id,
                      name: otherParticipant?.firstName || otherParticipant?.username || 'Unknown',
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
            } catch (error) {
              console.error('Error reloading conversations:', error);
            }
          };
          loadConvs();
        }}
      />

      {/* Forward Message Modal */}
      <Dialog open={isForwardModalOpen} onOpenChange={setIsForwardModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forward Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Message Preview */}
            {messageToForward && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Message:</p>
                <p className="text-sm truncate">
                  {messageToForward.content || (messageToForward.media ? '📷 Media' : 'Message')}
                </p>
              </div>
            )}

            {/* Search */}
            <Input
              placeholder="Search conversations..."
              value={forwardSearchQuery}
              onChange={(e) => setForwardSearchQuery(e.target.value)}
            />

            {/* Conversations List */}
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {conversations
                  .filter(
                    (conv) =>
                      conv.name.toLowerCase().includes(forwardSearchQuery.toLowerCase()) &&
                      conv.id !== selectedConversation?.id
                  )
                  .map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleForwardMessage(conv)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-lg overflow-hidden">
                        {conv.avatar?.startsWith('http') || conv.avatar?.startsWith('/') ? (
                          <img
                            src={getMediaUrl(conv.avatar)}
                            alt={conv.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm">{conv.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                      </div>
                      <Send size={16} className="text-primary" />
                    </button>
                  ))}
                {conversations.filter(
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

      {/* Confirmation Dialog */}
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
