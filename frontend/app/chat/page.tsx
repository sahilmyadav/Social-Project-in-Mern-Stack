"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Send,
  MoreHorizontal,
  Phone,
  Video,
  Users,
  Edit2,
  Trash2,
  X,
  UserPlus,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import VoiceCallModal from "@/components/voice-call-modal";
import VideoCallModal from "@/components/video-call-modal";
import CreateGroupModal from "@/components/create-group-modal"
import SharedContentPreview from "@/components/shared-content-preview";
import GroupInfoModal from "@/components/group-info-modal";
import { chatService, authService } from "@/lib/api-services";
import {
  initSocket,
  getSocket,
  disconnectSocket,
  onNewMessage,
  offNewMessage,
  onMessageStatus,
  offMessageStatus,
  onNewThread,
  offNewThread,
  onUserOnline,
  offUserOnline,
  onUserOffline,
  offUserOffline,
  onTyping,
  offTyping,
  onStopTyping,
  offStopTyping,
  joinThread,
  emitMessageDelivered,
  emitTyping,
  emitStopTyping,
  emitUserOnline,
  emitUserOffline,
  onIncomingCall,
  offIncomingCall,
  onCallRejected,
  offCallRejected,
  onCallEnded,
  offCallEnded,
  emitInitiateCall,
  emitRejectCall,
} from "@/lib/socket";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Conversation {
  id: string; // threadId - unique identifier for the conversation
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  online: boolean;
  participantId: string; // The other user's ID for matching online/offline events
  isGroup?: boolean;
  members?: number;
  threadId?: string;
}

interface Message {
  id: number | string;
  sender: string;
  content: string;
  timestamp: string;
  isSent: boolean;
  status?: "sent" | "delivered" | "seen";
  isEdited?: boolean;
  isDeleted?: boolean;
  // System message fields
  type?: string;
  senderId?: string;
  senderName?: string;
  isSystemMessage?: boolean;
  systemMessageType?: string;
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [activeTab, setActiveTab] = useState<"messages" | "groups">("messages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups] = useState<Conversation[]>([]);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    callerAvatar: string;
    threadId: string;
    callType?: "voice" | "video";
  } | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    console.log("🔄 selectedThreadId changed:", selectedThreadId);
    selectedThreadIdRef.current = selectedThreadId;
    console.log("📌 selectedThreadIdRef.current updated to:", selectedThreadIdRef.current);
  }, [selectedThreadId]);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/");
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

          console.log("📦 Raw threads from backend:", threadsArray.length);

          // Deduplicate threads by threadId (in case backend returns duplicates)
          const seenThreadIds = new Set<string>();
          const seenParticipantIds = new Set<string>();
          const uniqueThreads = threadsArray.filter((thread: any) => {
            const threadId = thread._id?.toString();
            const participantId = thread.participant?._id?.toString();

            if (!threadId || !participantId) return false;

            // Check both threadId and participantId for duplicates
            if (seenThreadIds.has(threadId) || seenParticipantIds.has(participantId)) {
              console.warn("⚠️ Duplicate thread detected:", { threadId, participantId });
              return false;
            }

            seenThreadIds.add(threadId);
            seenParticipantIds.add(participantId);
            return true;
          });

          console.log("✨ Unique threads after deduplication:", uniqueThreads.length);

          // Transform threads to conversations
          const convList = uniqueThreads.map((thread: any) => {
            const otherParticipant = thread.participant;
            console.log("👤 Participant:", otherParticipant);
            console.log("💬 Last message object:", thread.lastMessage);

            // Get the last message text - check all possible field names
            let lastMessageText = thread.lastMessage?.text ||
              thread.lastMessage?.content ||
              thread.lastMessage?.message ||
              null;

            // If text is null but there's media, show media indicator
            if (!lastMessageText && thread.lastMessage?.media && thread.lastMessage.media.length > 0) {
              const mediaType = thread.lastMessage.media[0].type || 'attachment';
              lastMessageText = `📎 ${mediaType}`;
            }

            // If still no message, check if there's an encrypted content field
            if (!lastMessageText && thread.lastMessage?.encryptedContent) {
              lastMessageText = '[Encrypted Message]';
            }

            console.log("📝 Final last message text:", lastMessageText);

            // Instagram style - show message or empty
            const displayMessage = lastMessageText || "";

            return {
              id: thread._id, // Use threadId as unique identifier, not participant ID
              participantId: otherParticipant?._id, // Store participant ID for online/offline matching
              name:
                otherParticipant?.firstName ||
                otherParticipant?.fullName ||
                otherParticipant?.username ||
                "Unknown",
              avatar:
                otherParticipant?.profileImage ||
                otherParticipant?.profilePicture ||
                otherParticipant?.avatar ||
                "👤",
              lastMessage: displayMessage,
              timestamp: thread.lastMessageAt
                ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : "Just now",
              unread: (thread.unreadCount || 0) > 0,
              online: otherParticipant?.isOnline || false, // Use actual online status
              threadId: thread._id,
            };
          });
          console.log("✅ Conversations transformed:", convList);
          setConversations(convList);
        } else {
          console.warn("⚠️ No data in response:", response);
          setConversations([]);
        }
      } catch (error) {
        console.error("❌ Error loading conversations:", error);
        setConversations([]);
      }
    };

    loadConvs();

    // Request online users list after conversations are loaded
    setTimeout(() => {
      const socket = getSocket();
      if (socket?.connected) {
        console.log("📡 Requesting online users list after loading conversations");
        socket.emit('getOnlineUsers');
      }
    }, 500);

    // Initialize socket connection FIRST
    const token = localStorage.getItem("accessToken");
    if (token) {
      const initSock = initSocket(token);

      // ✅ Emit user online status ONLY after socket connects
      if (initSock?.connected) {
        console.log("📡 Socket already connected, emitting online status");
        emitUserOnline(parsedUser._id);
      } else {
        // Wait for connection and then emit online status
        initSock?.once('connect', () => {
          console.log("✅ Socket connected, emitting online status");
          emitUserOnline(parsedUser._id);
        });
      }

      // Setup socket event listeners
      const handleNewMessage = (data: any) => {
        console.log("📩 New message received:", data);

        if (data.threadId && data.message) {
          const newMessage = {
            id: data.message._id,
            sender:
              data.message.senderId?.firstName ||
              data.message.senderId?.username ||
              "Unknown",
            content: data.message.text || "",
            timestamp: new Date(data.message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isSent: data.message.senderId?._id === parsedUser._id,
          };

          // Add message to chat if thread is currently open
          setSelectedThreadId((currentThreadId) => {
            if (currentThreadId === data.threadId) {
              // Check if message already exists to prevent duplicates
              setMessages((prev) => {
                const messageExists = prev.some(msg => msg.id === data.message._id);
                if (messageExists) {
                  console.log("⚠️ Message already exists, skipping duplicate");
                  return prev;
                }
                return [...prev, newMessage];
              });
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

            const updatedConvs = prev.map((conv) => {
              const convId = conv.id.toString();

              // Match by conversation id (which is threadId)
              if (convId === threadId) {
                return {
                  ...conv,
                  lastMessage: data.message.text,
                  timestamp: "Now",
                  unread: data.message.senderId?._id !== parsedUser._id,
                };
              }
              return conv;
            });

            // Check if conversation was updated
            const conversationUpdated = updatedConvs.some(
              (c) => c.id === threadId
            );

            // If thread is not in conversations, add it
            // This should be rare since newThread event should handle new threads
            if (!conversationUpdated && data.message.senderId?._id !== parsedUser._id) {
              const newConv: Conversation = {
                id: threadId, // Use threadId as unique identifier
                participantId: data.message.senderId._id,
                name:
                  data.message.senderId?.firstName ||
                  data.message.senderId?.username ||
                  "Unknown",
                avatar: data.message.senderId?.profileImage || data.message.senderId?.profilePicture || "👤",
                lastMessage: data.message.text,
                timestamp: "Now",
                unread: true,
                online: true,
                threadId: threadId,
              };
              return [newConv, ...updatedConvs];
            }

            // Move updated conversation to top
            const conversationIndex = updatedConvs.findIndex(
              (c) => c.id === threadId
            );

            if (conversationIndex > 0) {
              const [movedConv] = updatedConvs.splice(conversationIndex, 1);
              return [movedConv, ...updatedConvs];
            }

            return updatedConvs;
          });

          // Show browser notification and play sound if not focused
          if (
            !document.hasFocus() &&
            data.message.senderId?._id !== parsedUser._id
          ) {
            // Play notification sound
            try {
              const audio = new Audio(
                "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSqBzvLZiTYIG2m98OWhUBALUKnn77RgGgU7k9nx0HwqBiZzxvDdk0MLFmS36OyrWRQLR6Hf8bllHgU0gtDy2Ik2CBxqvfDoqlQQDFGp6O+zYBoFOpPY8dF8KgYmcsXv3ZNDC"
              );
              audio.volume = 0.3;
              audio.play().catch(() => { });
            } catch (e) { }

            if (Notification.permission === "granted") {
              new Notification(
                data.message.senderId?.firstName || "New Message",
                {
                  body: data.message.text,
                  icon: data.message.senderId?.profileImage || data.message.senderId?.profilePicture || "/favicon.ico",
                }
              );
            }
          }
        }
      };

      const handleMessageStatus = (data: any) => {
        console.log("📨 Message status:", data);
        // Update message status (delivered, read, etc.)
        if (data.messageId && data.status) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === data.messageId ? { ...msg, status: data.status } : msg
            )
          );
        }
      };

      const handleMessagesSeen = (data: any) => {
        console.log("👁️ Messages seen:", data);
        // Update all messages in thread as seen
        if (data.threadId) {
          setMessages((prev) =>
            prev.map((msg) => ({ ...msg, status: "seen" }))
          );
        }
      };

      const handleMessageEdited = (data: any) => {
        console.log("✏️ Message edited:", data);
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
        console.log("🗑️🗑️🗑️ MESSAGE DELETED EVENT RECEIVED 🗑️🗑️🗑️");
        console.log("Event data:", JSON.stringify(data, null, 2));

        if (data.messageId) {
          const messageIdStr = data.messageId.toString();
          console.log("Processing message ID:", messageIdStr);

          if (data.deleteFor === "everyone") {
            console.log("✅ Deleting message for EVERYONE");
            // Remove message for everyone
            setMessages((prev) => {
              console.log("Current messages in state:", prev.map(m => ({ id: m.id, content: m.content.substring(0, 20) })));
              const filtered = prev.filter((msg) => {
                const matches = msg.id.toString() === messageIdStr;
                if (matches) {
                  console.log(`Found matching message to delete: ${msg.id}`);
                }
                return !matches; // Keep messages that DON'T match
              });
              console.log("Messages after filtering:", filtered.map(m => ({ id: m.id, content: m.content.substring(0, 20) })));
              return filtered;
            });
          } else {
            console.log("Marking as deleted for current user only");
            // Mark as deleted for current user
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id.toString() === messageIdStr
                  ? { ...msg, content: "This message was deleted", isDeleted: true }
                  : msg
              )
            );
          }
        } else {
          console.error("❌ No messageId in delete event!");
        }
      };

      const handleUserTyping = (data: any) => {
        console.log("⌨️ User typing:", data);
        const currentThreadId = selectedThreadIdRef.current;
        console.log("📌 Current selectedThreadId (from ref):", currentThreadId);
        console.log("📌 Event threadId:", data.threadId);
        console.log("📌 Match?", currentThreadId === data.threadId);

        // Show/hide typing indicator based on isTyping flag
        if (currentThreadId && data.threadId === currentThreadId) {
          if (data.isTyping === true) {
            console.log("✅ Showing typing indicator");
            setIsOtherUserTyping(true);
          } else if (data.isTyping === false) {
            console.log("❌ Hiding typing indicator");
            setIsOtherUserTyping(false);
          }
        } else {
          console.log("⚠️ Not showing - thread mismatch or no thread selected");
        }
      };

      const handleUserStopTyping = (data: any) => {
        console.log("⏹️ User stopped typing:", data);
        const currentThreadId = selectedThreadIdRef.current;
        // This handler might not be needed since we use isTyping flag
        if (currentThreadId && data.threadId === currentThreadId) {
          setIsOtherUserTyping(false);
        }
      };

      const handleUserOnline = (data: any) => {
        console.log("🟢 User online event received:", JSON.stringify(data));

        // Handle multiple data formats
        const userId = data?.userId || data?.user?._id || data?._id || data?.id;

        if (userId) {
          console.log("✅ Updating user online - userId:", userId);
          setConversations((prev) => {
            const updated = prev.map((conv) => {
              if (conv.participantId === userId) {
                console.log(`🟢 Setting ${conv.name} online`);
                return { ...conv, online: true };
              }
              return conv;
            });
            return updated;
          });

          // Also update selectedConversation if it matches
          setSelectedConversation((prev) => {
            if (prev && prev.participantId === userId) {
              console.log(`🟢 Selected conversation now online: ${prev.name}`);
              return { ...prev, online: true };
            }
            return prev;
          });
        } else {
          console.warn("⚠️ No userId found in online event:", data);
        }
      };

      const handleUserOffline = (data: any) => {
        console.log("⚫ User offline event received:", JSON.stringify(data));

        // Handle multiple data formats
        const userId = data?.userId || data?.user?._id || data?._id || data?.id;

        if (userId) {
          console.log("✅ Updating user offline - userId:", userId);
          setConversations((prev) => {
            const updated = prev.map((conv) => {
              if (conv.participantId === userId) {
                console.log(`⚫ Setting ${conv.name} offline`);
                return { ...conv, online: false };
              }
              return conv;
            });
            return updated;
          });

          // Also update selectedConversation if it matches
          setSelectedConversation((prev) => {
            if (prev && prev.participantId === userId) {
              console.log(`⚫ Selected conversation now offline: ${prev.name}`);
              return { ...prev, online: false };
            }
            return prev;
          });
        } else {
          console.warn("⚠️ No userId found in offline event:", data);
        }
      };

      const handleNewThread = (data: any) => {
        console.log("🆕 New thread received:", data);
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
                "Unknown",
              avatar:
                data.participant.profileImage ||
                data.participant.profilePicture ||
                data.participant.avatar ||
                "👤",
              lastMessage: "New conversation started",
              timestamp: "Now",
              unread: true,
              online: data.participant.isOnline || false, // Use actual online status
              threadId: data.threadId,
            };

            return [newConv, ...prev];
          });
        }
      };

      // Voice call handlers
      const handleIncomingCall = (data: any) => {
        console.log("📞 Incoming call received:", JSON.stringify(data, null, 2));
        console.log("📞 Current user ID:", parsedUser._id);

        // Backend sends 'callerId', not 'from'
        const callerId = data?.callerId || data?.from;
        const threadId = data?.threadId;
        const callerInfo = data?.callerInfo;
        const callType = data?.callType || "voice"; // Default to voice if not specified

        console.log("📞 Extracted - callerId:", callerId, "threadId:", threadId, "callType:", callType);

        if (!callerId || !threadId) {
          console.warn("⚠️ Invalid incoming call data:", data);
          return;
        }

        // Find the conversation by threadId
        const conversation = conversations.find((c) =>
          c.threadId === threadId || c.id === threadId || c.participantId === callerId
        );

        console.log("🔍 Found conversation for incoming call:", conversation);
        console.log("📞 Caller info from backend:", callerInfo);
        console.log("📞 Call type:", callType);

        // Use priority: conversation name > callerInfo from backend > Unknown
        const callerName = conversation?.name || callerInfo?.name || "Unknown User";
        const callerAvatar = conversation?.avatar || callerInfo?.avatar || "👤";

        setIncomingCall({
          callerId,
          callerName,
          callerAvatar,
          threadId,
          callType,
        });

        // Add system message for incoming call if it's the selected conversation
        if (threadId === selectedThreadIdRef.current || threadId === selectedConversation?.threadId) {
          const callMessage: Message = {
            id: `call-incoming-${Date.now()}`,
            sender: "System",
            content: callType === 'video' ? "📹 Incoming video call" : "📞 Incoming voice call",
            timestamp: new Date().toISOString(),
            isSent: false,
            type: "system",
            senderId: "system",
            senderName: "System",
            status: "sent" as const,
            isSystemMessage: true,
            systemMessageType: "call-incoming"
          };
          setMessages((prev) => [...prev, callMessage]);
        }

        // Show browser notification
        if (typeof window !== 'undefined' && Notification.permission === "granted") {
          new Notification("Incoming Call", {
            body: `${callerName} is calling...`,
            icon: callerAvatar,
            tag: "incoming-call",
          });
        }

        if (!conversation) {
          console.warn("⚠️ Conversation not found. ThreadId:", threadId, "CallerId:", callerId);
          console.log("📋 Available conversations:", conversations.map(c => ({ id: c.id, threadId: c.threadId, participantId: c.participantId })));
        }
      };

      const handleCallRejected = (data: any) => {
        console.log("❌ Call was rejected:", data);
        setIncomingCall(null);
        setIsVoiceCallOpen(false);
        setIsVideoCallOpen(false);

        // Add system message for rejected call
        if (data.threadId === selectedThreadIdRef.current || data.threadId === selectedConversation?.threadId) {
          const systemMessage: Message = {
            id: `call-rejected-${Date.now()}`,
            sender: "System",
            content: "Call was not answered",
            timestamp: new Date().toISOString(),
            isSent: false,
            type: "system",
            senderId: "system",
            senderName: "System",
            status: "sent" as const,
            isSystemMessage: true,
            systemMessageType: "call-rejected"
          };
          setMessages((prev) => [...prev, systemMessage]);
        }
      };

      const handleCallEnded = (data: any) => {
        console.log("📞 Call ended:", data);
        const endedAt = data.endedAt ? new Date(data.endedAt) : new Date();
        const duration = data.duration || 0;

        setIncomingCall(null);
        setIsVoiceCallOpen(false);
        setIsVideoCallOpen(false);

        // Add system message for ended call
        if (data.threadId === selectedThreadIdRef.current || data.threadId === selectedConversation?.threadId) {
          const systemMessage: Message = {
            id: `call-ended-${Date.now()}`,
            sender: "System",
            content: duration > 0 ? `Call ended • Duration: ${formatCallDuration(duration)}` : "Call ended",
            timestamp: endedAt.toISOString(),
            isSent: false,
            type: "system",
            senderId: "system",
            senderName: "System",
            status: "sent" as const,
            isSystemMessage: true,
            systemMessageType: "call-ended"
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

      const currentSocket = getSocket();
      if (currentSocket) {
        console.log("🔌 Registering socket listeners, socket ID:", currentSocket.id);

        currentSocket.on("messagesSeen", handleMessagesSeen);
        currentSocket.on("messageEdited", handleMessageEdited);
        currentSocket.on("messageDeleted", handleMessageDeleted);

        // Handle reconnection - re-emit online status
        currentSocket.on("connect", () => {
          console.log("✅ Socket connected/reconnected:", currentSocket.id);
          emitUserOnline(parsedUser._id);
          // Request online users list on connect
          currentSocket.emit('getOnlineUsers');
        });

        // ✅ Listen for initial online users list
        currentSocket.on("onlineUsersList", (data: { users: string[] }) => {
          console.log("📋 Received online users list:", data.users);

          // Update all conversations with online status
          setConversations((prev) =>
            prev.map((conv) => ({
              ...conv,
              online: data.users.includes(conv.participantId)
            }))
          );

          // Update selected conversation if needed
          setSelectedConversation((prev) => {
            if (prev && data.users.includes(prev.participantId)) {
              return { ...prev, online: true };
            }
            return prev;
          });
        });

        // ✅ Request initial online users list
        currentSocket.emit('getOnlineUsers');

        // Generic listener to catch any event
        currentSocket.onAny((eventName, ...args) => {
          console.log(`📡 Socket event received: ${eventName}`, args);
        });
      } else {
        console.error("❌ Socket not available!");
      }

      // Request notification permission
      if (
        typeof window !== "undefined" &&
        Notification.permission === "default"
      ) {
        Notification.requestPermission();
      }

      // Cleanup on unmount
      return () => {
        const currentSocket = getSocket();
        if (currentSocket) {
          currentSocket.off("messagesSeen");
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
    // Check if there's a userId in URL params to open chat with specific user
    const userId = searchParams.get("userId");
    const userName = searchParams.get("userName");
    const userAvatar = searchParams.get("avatar");

    if (userId && userName) {
      // Open chat with specific user
      const newConversation: Conversation = {
        id: userId, // Use userId string directly
        participantId: userId,
        name: decodeURIComponent(userName),
        avatar: userAvatar ? decodeURIComponent(userAvatar) : "👤",
        lastMessage: "Start a conversation",
        timestamp: "Now",
        unread: false,
        online: true,
        threadId: undefined,
      };

      // Check if conversation already exists
      setConversations((prev) => {
        const exists = prev.find((c) => c.participantId === userId);
        if (exists) {
          return prev;
        }
        return [newConversation, ...prev];
      });

      setSelectedConversation(newConversation);
      // Clear messages initially
      setMessages([]);
      // Create/get thread and load messages
      handleGetThread(userId);
      // Clear URL params
      router.replace("/chat", { scroll: false });
    }
  }, [searchParams]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    router.push("/");
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedThreadId || isSendingMessage) return;

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
      sender: "You",
      content: messageInput,
      timestamp: new Date().toLocaleTimeString(),
      isSent: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    const messageText = messageInput;
    setMessageInput("");

    try {
      const response = await chatService.sendMessage(selectedThreadId, {
        text: messageText,
      });

      if (response.success && response.data) {
        // Update with actual message from server
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessage.id ? { ...msg, id: response.data._id } : msg
          )
        );

        // Update conversation last message and move to top
        setConversations((prev) => {
          const updated = prev.map((conv) =>
            conv.id === selectedConversation?.id
              ? {
                ...conv,
                lastMessage: messageText,
                timestamp: "Now",
                unread: false,
              }
              : conv
          );
          // Move updated conversation to top
          const updatedConv = updated.find(
            (c) => c.id === selectedConversation?.id
          );
          const others = updated.filter(
            (c) => c.id !== selectedConversation?.id
          );
          return updatedConv ? [updatedConv, ...others] : updated;
        });
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      // Remove temp message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      setMessageInput(messageText); // Restore message input
    } finally {
      setIsSendingMessage(false);
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
      setEditingMessageText("");
    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  const handleDeleteMessage = async (
    messageId: string,
    deleteFor: "me" | "everyone"
  ) => {
    try {
      console.log(`Deleting message ${messageId} for: ${deleteFor}`);
      await chatService.deleteMessage(messageId, deleteFor);

      // Remove message from UI immediately for both cases
      // Socket event will also update other user's UI for "everyone"
      setMessages((prev) =>
        prev.filter((msg) => msg.id.toString() !== messageId)
      );

      console.log(`Message ${messageId} removed from local UI`);
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleGetThread = async (userId: string) => {
    try {
      console.log("🔗 Getting thread for userId:", userId);
      const response = await chatService.getThread(userId);
      console.log("📌 Thread response:", response);

      if (response.success && response.data) {
        // Handle both direct _id and nested structure
        const threadId = response.data._id || response.data.thread?._id || response.data.threadId;
        console.log("✅ Thread ID:", threadId);

        if (threadId) {
          setSelectedThreadId(threadId);
          // Join thread room via socket
          joinThread(threadId);
          // Load messages for this thread
          loadMessages(threadId);
          // Mark as seen
          markThreadAsRead(threadId, userId);
        } else {
          console.error("❌ No thread ID in response");
        }
      }
    } catch (error) {
      console.error("❌ Error getting thread:", error);
    }
  };

  const markThreadAsRead = async (threadId: string, userId: string) => {
    try {
      await chatService.markThreadAsRead(threadId);
      // Update conversation to mark as read
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === threadId // Match by conversation id (which is threadId)
            ? { ...conv, unread: false }
            : conv
        )
      );
    } catch (error) {
      console.error("❌ Error marking thread as read:", error);
    }
  };

  const loadMessages = async (threadId: string) => {
    setIsLoadingMessages(true);
    try {
      const response = await chatService.getMessages(threadId);
      console.log("📨 Messages response:", response);

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

        console.log("✅ Messages list:", messagesList);

        const formattedMessages = messagesList.map((msg: any) => ({
          id: msg._id,
          sender:
            msg.senderId?._id === user?._id
              ? "You"
              : msg.senderId?.firstName || msg.senderId?.username || "Unknown",
          content: msg.isDeleted ? "This message was deleted" : (msg.text || msg.content || ""),
          timestamp: new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isEdited: msg.isEdited || false,
          isDeleted: msg.isDeleted || false,
          isSent: msg.senderId?._id === user?._id,
          status: msg.status || "sent",
          messageType: msg.messageType || "text",
          sharedContent: msg.sharedContent,
        }));

        console.log("📋 Formatted messages:", formattedMessages);
        setMessages(formattedMessages);
      } else {
        // No messages yet
        console.log("⚠️ No messages in response");
        setMessages([]);
      }
    } catch (error) {
      console.error("❌ Error loading messages:", error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayList =
    activeTab === "messages" ? filteredConversations : filteredGroups;

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 h-screen">
        {/* Sidebar - Hidden on mobile */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Conversations List - Hidden on mobile when chat is selected */}
        <section className={`lg:col-span-1 border-r border-border flex flex-col ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border">
            <h1 className="text-2xl font-bold mb-4 text-foreground">Chats</h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={activeTab === "messages" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("messages")}
                className="flex-1"
              >
                Messages
              </Button>
              <Button
                variant={activeTab === "groups" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("groups")}
                className="flex-1 gap-2"
              >
                <Users size={16} />
                Groups
              </Button>
            </div>

            {/* Create Group Button */}
            {activeTab === "groups" && (
              <button
                onClick={() => setIsCreateGroupOpen(true)}
                className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
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
            {displayList.map((conversation) => (
              <div
                key={conversation.id}
                className="relative flex items-center border-b border-border hover:bg-muted transition"
              >
                <button
                  onClick={() => {
                    console.log("🔄 Conversation clicked:", conversation);
                    console.log("📌 Has threadId?", conversation.threadId);
                    setSelectedConversation(conversation);
                    if (conversation.threadId) {
                      // Use threadId directly if available
                      console.log("✅ Setting selectedThreadId to:", conversation.threadId);
                      setSelectedThreadId(conversation.threadId);
                      joinThread(conversation.threadId);
                      loadMessages(conversation.threadId);
                      markThreadAsRead(
                        conversation.threadId,
                        conversation.id.toString()
                      );
                    } else {
                      // Fallback: create/get thread
                      console.log("⚠️ No threadId, calling handleGetThread");
                      handleGetThread(conversation.id.toString());
                    }
                  }}
                  className={`flex-1 p-4 flex items-start gap-3 text-left ${selectedConversation?.id === conversation.id ? "bg-muted" : ""
                    }`}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        !conversation.isGroup && handleOpenProfile(conversation.participantId);
                      }}
                      className={`w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg ${conversation.isGroup ? "text-2xl" : ""
                        } overflow-hidden ${!conversation.isGroup ? "cursor-pointer hover:opacity-80 transition" : ""}`}
                    >
                      {conversation.avatar?.startsWith("http") ? (
                        <img
                          src={conversation.avatar}
                          alt={conversation.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        conversation.avatar
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
                        className={`font-semibold text-foreground ${conversation.unread ? "font-bold" : ""
                          } ${!conversation.isGroup ? "cursor-pointer hover:text-primary transition" : ""}`}
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
                    <div className="text-xs text-muted-foreground">
                      {conversation.timestamp}
                    </div>
                    {conversation.unread && (
                      <div className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold animate-pulse">
                        !
                      </div>
                    )}
                  </div>
                </button>

                {/* Options Dropdown Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 mr-2 hover:bg-muted rounded-full transition flex-shrink-0"
                      title="More options"
                    >
                      <MoreHorizontal size={18} className="text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete this conversation with ${conversation.name}?`)) {
                          try {
                            const threadId = conversation.threadId || conversation.id;
                            const response = await chatService.deleteThread(threadId);

                            if (response.success) {
                              // Remove from conversations list
                              setConversations(prev => prev.filter(c => c.id !== conversation.id));

                              // Clear selected conversation if it was deleted
                              if (selectedConversation?.id === conversation.id) {
                                setSelectedConversation(null);
                                setSelectedThreadId(null);
                                setMessages([]);
                              }

                              console.log("✅ Thread deleted successfully");
                            } else {
                              alert(response.message || "Failed to delete conversation");
                            }
                          } catch (error: any) {
                            console.error("❌ Error deleting thread:", error);
                            alert(error.message || "Failed to delete conversation");
                          }
                        }
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 size={14} className="mr-2" />
                      Delete Conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {displayList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="text-4xl mb-2">
                  {activeTab === "messages" ? "💬" : "👥"}
                </div>
                <p>No {activeTab} found</p>
                <p className="text-xs mt-2 text-gray-400">
                  {activeTab === "messages"
                    ? "Check browser console (F12) for API errors"
                    : ""}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Chat Area - Show on mobile when conversation is selected */}
        {selectedConversation ? (
          <section className="lg:col-span-2 flex flex-col">
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
                  className="lg:hidden p-2 hover:bg-muted rounded-full transition"
                  title="Back to conversations"
                >
                  <X size={20} className="text-foreground" />
                </button>

                <div
                  onClick={() => !selectedConversation.isGroup && handleOpenProfile(selectedConversation.participantId)}
                  className={`w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg ${selectedConversation.isGroup ? "text-2xl" : ""
                    } overflow-hidden ${!selectedConversation.isGroup ? "cursor-pointer hover:opacity-80 transition" : ""}`}
                >
                  {selectedConversation.avatar?.startsWith("http") ? (
                    <img
                      src={selectedConversation.avatar}
                      alt={selectedConversation.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    selectedConversation.avatar
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p
                      onClick={() => !selectedConversation.isGroup && handleOpenProfile(selectedConversation.participantId)}
                      className={`font-semibold text-foreground ${!selectedConversation.isGroup ? "cursor-pointer hover:text-primary transition" : ""}`}
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
                        ? "Active now"
                        : "Offline"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Group Info Button */}
                {selectedConversation.isGroup && (
                  <button
                    type="button"
                    onClick={() => setIsGroupInfoOpen(true)}
                    className="p-2 hover:bg-muted rounded-full transition"
                    title="Group Info"
                  >
                    <Info size={20} className="text-foreground" />
                  </button>
                )}

                {/* Voice/Video calls only for direct messages */}
                {!selectedConversation.isGroup && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        console.log("📞 Voice call button clicked");
                        console.log("📞 Current user:", user?._id);
                        console.log("📞 Selected conversation:", selectedConversation);
                        console.log("📞 Participant ID:", selectedConversation?.participantId);
                        console.log("📞 Thread ID:", selectedConversation?.threadId);

                        const socket = getSocket();
                        console.log("📞 Socket connected:", socket?.connected, "Socket ID:", socket?.id);

                        if (selectedConversation?.participantId && selectedConversation?.threadId) {
                          // Add system message for outgoing call
                          const callMessage: Message = {
                            id: `call-initiated-${Date.now()}`,
                            sender: "System",
                            content: "📞 Outgoing voice call",
                            timestamp: new Date().toISOString(),
                            isSent: true,
                            type: "system",
                            senderId: "system",
                            senderName: "System",
                            status: "sent" as const,
                            isSystemMessage: true,
                            systemMessageType: "call-initiated"
                          };
                          setMessages((prev) => [...prev, callMessage]);

                          // Initiate the call via socket
                          emitInitiateCall(selectedConversation.participantId, selectedConversation.threadId);
                          // Open the modal
                          setIsVoiceCallOpen(true);
                        } else {
                          console.error("❌ Cannot initiate call: Missing participant or thread info");
                          console.error("❌ Conversation object:", selectedConversation);
                        }
                      }}
                      className="p-2 rounded-full hover:bg-muted transition"
                      title="Start voice call"
                    >
                      <Phone size={20} className="text-primary" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        console.log("📹 Video call button clicked");
                        if (selectedConversation?.participantId && selectedConversation?.threadId) {
                          // Add system message for outgoing video call
                          const callMessage: Message = {
                            id: `call-initiated-${Date.now()}`,
                            sender: "System",
                            content: "📹 Outgoing video call",
                            timestamp: new Date().toISOString(),
                            isSent: true,
                            type: "system",
                            senderId: "system",
                            senderName: "System",
                            status: "sent" as const,
                            isSystemMessage: true,
                            systemMessageType: "call-initiated"
                          };
                          setMessages((prev) => [...prev, callMessage]);

                          // Initiate the video call via socket
                          emitInitiateCall(selectedConversation.participantId, selectedConversation.threadId, "video");
                          // Open the modal
                          setIsVideoCallOpen(true);
                        } else {
                          console.error("❌ Cannot initiate video call: Missing participant or thread info");
                        }
                      }}
                      className="p-2 rounded-full hover:bg-muted transition"
                      title="Start video call"
                    >
                      <Video size={20} className="text-primary" />
                    </button>
                  </>
                )}

                <button className="p-2 rounded-full hover:bg-muted transition" title="More options">
                  <MoreHorizontal size={20} className="text-muted-foreground" />
                </button>
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
                  {messages.map((message) => {
                    // Render system messages differently
                    if ((message as any).isSystemMessage) {
                      return (
                        <div key={message.id} className="flex justify-center my-2">
                          <div className="px-3 py-1 rounded-full bg-muted/50 text-muted-foreground text-xs">
                            {message.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={message.id}
                        className={`flex ${message.isSent ? "justify-end" : "justify-start"
                          }`}
                      >
                        <div className="flex items-start gap-2 group max-w-xs">
                          {message.isSent && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-muted transition mt-1">
                                  <MoreHorizontal
                                    size={16}
                                    className="text-muted-foreground"
                                  />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
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
                                  onClick={() =>
                                    handleDeleteMessage(
                                      message.id.toString(),
                                      "me"
                                    )
                                  }
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete for me
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleDeleteMessage(
                                      message.id.toString(),
                                      "everyone"
                                    )
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
                                  onChange={(e) =>
                                    setEditingMessageText(e.target.value)
                                  }
                                  onKeyPress={(e) => {
                                    if (e.key === "Enter") {
                                      handleEditMessage(message.id.toString());
                                    }
                                  }}
                                  className="flex-1"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleEditMessage(message.id.toString())
                                  }
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingMessageId(null);
                                    setEditingMessageText("");
                                  }}
                                >
                                  <X size={16} />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`px-4 py-2 rounded-2xl ${message.isSent
                                ? "bg-primary text-primary-foreground rounded-br-none"
                                : "bg-muted text-foreground rounded-bl-none"
                                }`}
                            >
                              <p className={message.isDeleted ? "italic opacity-60" : ""}>
                                {message.content}
                              </p>

                              {/* Shared Content Preview */}
                              {((message as any).messageType === 'shared_post' || (message as any).messageType === 'shared_reel') &&
                                (message as any).sharedContent?.contentData && (
                                  <SharedContentPreview
                                    messageType={(message as any).messageType}
                                    contentData={(message as any).sharedContent.contentData}
                                  />
                                )}

                              <p
                                className={`text-xs mt-1 ${message.isSent ? "opacity-70" : "opacity-60"
                                  }`}
                              >
                                {message.timestamp}
                                {message.isEdited && !message.isDeleted && (
                                  <span className="ml-1">(edited)</span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing Indicator */}
                  {isOtherUserTyping && (
                    <div className="flex justify-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-lg flex-shrink-0">
                          {selectedConversation?.avatar?.startsWith('http') ? (
                            <img
                              src={selectedConversation.avatar}
                              alt={selectedConversation.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            selectedConversation?.avatar || '👤'
                          )}
                        </div>
                        <div className="bg-muted text-muted-foreground rounded-2xl px-4 py-2.5 shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{selectedConversation?.name || 'User'} is typing</span>
                            <div className="flex items-center gap-0.5">
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
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
            <div className="p-4 border-t border-border flex gap-2">
              <Input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => handleMessageInputChange(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={isSendingMessage}
              />
              <Button
                onClick={handleSendMessage}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isSendingMessage || !messageInput.trim()}
              >
                <Send size={20} />
              </Button>
            </div>
          </section>
        ) : (
          <section className="lg:col-span-2 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-muted-foreground">
                Select a conversation to start messaging
              </p>
            </div>
          </section>
        )}

        {/* Right Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 border-l border-border p-4">
          <div className="bg-card rounded-2xl border border-border p-4 sticky top-0">
            <h3 className="font-bold text-lg mb-4">Online Friends</h3>
            <div className="space-y-3">
              {conversations
                .filter((conv) => conv.online) // Only show online friends
                .map((friend) => (
                  <div
                    key={friend.participantId}
                    onClick={() => {
                      setSelectedConversation(friend);
                      setSelectedThreadIdRef(friend.threadId);
                      setIsMobileConversationOpen(true);
                    }}
                    className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer transition"
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                        {friend.avatar}
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-card" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {friend.name}
                      </p>
                      <p className="text-xs text-green-500">Online</p>
                    </div>
                  </div>
                ))}

              {conversations.filter((conv) => conv.online).length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    No friends online
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>
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
        recipientName={incomingCall?.callerName || selectedConversation?.name || "User"}
        recipientAvatar={incomingCall?.callerAvatar || selectedConversation?.avatar || "👤"}
        recipientId={incomingCall?.callerId || selectedConversation?.participantId || ""}
        currentUserId={user?._id || ""}
        isIncomingCall={!!incomingCall}
        callerId={incomingCall?.callerId}
        threadId={incomingCall?.threadId || selectedConversation?.threadId}
        onCallEnd={() => {
          console.log("📞 Voice call ended");
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
        recipientName={incomingCall?.callerName || selectedConversation?.name || "User"}
        recipientAvatar={incomingCall?.callerAvatar || selectedConversation?.avatar || "👤"}
        recipientId={incomingCall?.callerId || selectedConversation?.participantId || ""}
        isIncoming={!!incomingCall && incomingCall.callType === "video"}
        callId={incomingCall?.threadId || selectedConversation?.threadId}
        callerId={incomingCall?.callerId}
        threadId={incomingCall?.threadId || selectedConversation?.threadId}
      />

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={(group) => {
          console.log("✅ Group created:", group);
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
                      name: thread.groupName || "Group",
                      avatar: thread.groupAvatar || "👥",
                      lastMessage: thread.lastMessage?.text || "",
                      timestamp: thread.lastMessageAt
                        ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "Just now",
                      unread: (thread.unreadCount || 0) > 0,
                      online: false,
                      isGroup: true,
                      members: thread.participants?.length || 0,
                      threadId: thread._id,
                      participantId: "",
                    };
                  } else {
                    const otherParticipant = thread.participant;
                    return {
                      id: thread._id,
                      participantId: otherParticipant?._id,
                      name: otherParticipant?.firstName || otherParticipant?.username || "Unknown",
                      avatar: otherParticipant?.profileImage || otherParticipant?.profilePicture || "👤",
                      lastMessage: thread.lastMessage?.text || "",
                      timestamp: thread.lastMessageAt
                        ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "Just now",
                      unread: (thread.unreadCount || 0) > 0,
                      online: otherParticipant?.isOnline || false,
                      threadId: thread._id,
                    };
                  }
                });
                setConversations(convList);
              }
            } catch (error) {
              console.error("Error reloading conversations:", error);
            }
          };
          loadConvs();
        }}
      />

      {/* Group Info Modal */}
      <GroupInfoModal
        isOpen={isGroupInfoOpen}
        onClose={() => setIsGroupInfoOpen(false)}
        groupId={selectedConversation?.isGroup ? selectedConversation.id : ""}
        currentUserId={user?._id || ""}
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
                      name: thread.groupName || "Group",
                      avatar: thread.groupAvatar || "👥",
                      lastMessage: thread.lastMessage?.text || "",
                      timestamp: thread.lastMessageAt
                        ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "Just now",
                      unread: (thread.unreadCount || 0) > 0,
                      online: false,
                      isGroup: true,
                      members: thread.participants?.length || 0,
                      threadId: thread._id,
                      participantId: "",
                    };
                  } else {
                    const otherParticipant = thread.participant;
                    return {
                      id: thread._id,
                      participantId: otherParticipant?._id,
                      name: otherParticipant?.firstName || otherParticipant?.username || "Unknown",
                      avatar: otherParticipant?.profileImage || otherParticipant?.profilePicture || "👤",
                      lastMessage: thread.lastMessage?.text || "",
                      timestamp: thread.lastMessageAt
                        ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "Just now",
                      unread: (thread.unreadCount || 0) > 0,
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
              console.error("Error reloading conversations:", error);
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
                      name: thread.groupName || "Group",
                      avatar: thread.groupAvatar || "👥",
                      lastMessage: thread.lastMessage?.text || "",
                      timestamp: thread.lastMessageAt
                        ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "Just now",
                      unread: (thread.unreadCount || 0) > 0,
                      online: false,
                      isGroup: true,
                      members: thread.participants?.length || 0,
                      threadId: thread._id,
                      participantId: "",
                    };
                  } else {
                    const otherParticipant = thread.participant;
                    return {
                      id: thread._id,
                      participantId: otherParticipant?._id,
                      name: otherParticipant?.firstName || otherParticipant?.username || "Unknown",
                      avatar: otherParticipant?.profileImage || otherParticipant?.profilePicture || "👤",
                      lastMessage: thread.lastMessage?.text || "",
                      timestamp: thread.lastMessageAt
                        ? new Date(thread.lastMessageAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "Just now",
                      unread: (thread.unreadCount || 0) > 0,
                      online: otherParticipant?.isOnline || false,
                      threadId: thread._id,
                    };
                  }
                });
                setConversations(convList);
              }
            } catch (error) {
              console.error("Error reloading conversations:", error);
            }
          };
          loadConvs();
        }}
      />
    </main >
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}

