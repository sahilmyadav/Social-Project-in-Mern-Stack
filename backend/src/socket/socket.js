import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import { ChatMessage } from '../models/chatMessage.model.js';
import { GroupChat } from '../models/groupChat.model.js';
import { User } from '../models/user.model.js';
import groupSocket from './group.socket.js';
import liveStreamSocket from './liveStream.socket.js';

let io;
let redisClient;
let redisPubClient;
let redisSubClient;

// Track online users: userId -> Set of socketIds (multiple tabs/devices)
// Note: In cluster mode, this Map is per-worker. For cross-worker user tracking,
// we'll use Redis for shared state
const onlineUsers = new Map();

// Track disconnect timeouts for grace period
const disconnectTimeouts = new Map();

// Grace period before marking user offline (5 seconds)
const DISCONNECT_GRACE_PERIOD = 5000;

/**
 * Initialize Redis clients for Socket.IO adapter
 */
async function initializeRedisAdapter(io) {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const isClusterMode =
    process.env.NODE_ENV === 'production' || process.env.ENABLE_CLUSTER === 'true';

  if (!isClusterMode) {
    return;
  }

  try {
    // Create Redis clients for pub/sub
    redisPubClient = createClient({ url: redisUrl });
    redisSubClient = redisPubClient.duplicate();

    // Error handlers
    redisPubClient.on('error', (err) => console.error(' Redis Pub Client Error:', err));
    redisSubClient.on('error', (err) => console.error(' Redis Sub Client Error:', err));

    // Connect both clients
    await Promise.all([redisPubClient.connect(), redisSubClient.connect()]);

    // Attach Redis adapter to Socket.IO
    io.adapter(createAdapter(redisPubClient, redisSubClient));

    // Also create a regular Redis client for storing online users
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => console.error(' Redis Client Error:', err));
    await redisClient.connect();
  } catch (error) {
    console.error(' Failed to initialize Redis adapter:', error);
    console.warn(' Socket.IO will work but only within this worker process');
  }
}

export const initializeSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // Initialize Redis adapter for cluster mode
  await initializeRedisAdapter(io);

  // Authentication middleware for socket
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.userId = decoded._id;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId.toString(); // Ensure string format
    console.log(`User connected: ${userId} (socket: ${socket.id})`);

    // Cancel any pending disconnect timeout for this user (they reconnected!)
    if (disconnectTimeouts.has(userId)) {
      clearTimeout(disconnectTimeouts.get(userId));
      disconnectTimeouts.delete(userId);
      console.log(`User ${userId} reconnected, cancelled offline broadcast`);
    }

    //  ADD USER TO ONLINE MAP (Redis + local)
    await addOnlineUser(userId, socket.id);

    // Join user's personal room (ensure string format for consistency)
    socket.join(userId);

    //  BROADCAST TO ALL USERS THAT THIS USER IS ONLINE
    console.log(`Broadcasting userOnline event for userId: ${userId}`);
    io.emit('userOnline', {
      userId: userId,
      socketId: socket.id,
    });

    //  SEND CURRENT ONLINE USERS LIST TO THE NEWLY CONNECTED USER (cluster-safe)
    const onlineList = await getOnlineUsers();
    console.log(`Sending online users list to ${userId}: [${onlineList.join(', ')}]`);
    socket.emit('onlineUsersList', {
      users: onlineList,
    });

    //  GET ONLINE USERS REQUEST (cluster-safe)
    socket.on('getOnlineUsers', async () => {
      const onlineUsersList = await getOnlineUsers();
      console.log(`User ${userId} requested online users: [${onlineUsersList.join(', ')}]`);
      socket.emit('onlineUsersList', { users: onlineUsersList });
    });

    // ==================== LIVE STREAMING HANDLERS ====================
    liveStreamSocket(io, socket, userId);

    // ==================== GROUP CHAT & CALL HANDLERS ====================
    groupSocket(io, socket, userId);

    // Join thread room
    socket.on('joinThread', (threadId) => {
      socket.join(threadId);
    });

    // Leave thread room
    socket.on('leaveThread', (threadId) => {
      socket.leave(threadId);
    });

    //  HANDLE EXPLICIT ONLINE EVENT
    socket.on('userOnline', async (data) => {
      const targetUserId = data.userId || userId;
      await addOnlineUser(targetUserId, socket.id);
      io.emit('userOnline', {
        userId: targetUserId.toString(),
        socketId: socket.id,
      });
    });

    //  HANDLE EXPLICIT OFFLINE EVENT
    socket.on('userOffline', async (data) => {
      const targetUserId = data.userId || userId;
      await removeOnlineUser(targetUserId);
      io.emit('userOffline', {
        userId: targetUserId.toString(),
      });
    });

    // Typing indicator
    socket.on('typing', ({ threadId, receiverId }) => {
      socket.to(receiverId).emit('userTyping', {
        threadId,
        userId: socket.userId,
        isTyping: true,
      });
    });

    socket.on('stopTyping', ({ threadId, receiverId }) => {
      socket.to(receiverId).emit('userTyping', {
        threadId,
        userId: socket.userId,
        isTyping: false,
      });
    });

    // ============================================
    // MESSAGE SENDING
    // ============================================

    socket.on('sendMessage', async (messageData) => {
      try {
        console.log(`Sending message via socket: ${socket.userId} -> ${messageData.receiverId}`);

        // Fetch sender's user info
        const senderUser = await User.findById(socket.userId).select(
          'firstName lastName username profilePicture avatar'
        );

        // Format message to match your frontend expectations
        const formattedMessage = {
          threadId: messageData.threadId,
          message: {
            _id: messageData.messageId, // Use the ID from database
            text: messageData.content,
            senderId: {
              _id: socket.userId,
              firstName: senderUser?.firstName,
              lastName: senderUser?.lastName,
              username: senderUser?.username,
              profilePicture: senderUser?.profilePicture,
              avatar: senderUser?.avatar,
            },
            createdAt: messageData.timestamp || new Date(),
            status: 'sent',
          },
        };

        // Send to thread room so both participants get the message
        if (messageData.threadId) {
          io.to(messageData.threadId).emit('newMessage', formattedMessage);
        }

        // Also send to receiver's personal room (for notification when not in thread)
        io.to(messageData.receiverId).emit('newMessage', formattedMessage);
        console.log(
          `Message sent to thread ${messageData.threadId} and receiver ${messageData.receiverId}`
        );

        // Also send back to sender for confirmation (optional)
        socket.emit('messageSent', {
          messageId: messageData.messageId,
          status: 'sent',
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('❌ Error sending message via socket:', error);
        socket.emit('messageError', {
          error: 'Failed to send message',
          details: error.message,
        });
      }
    });

    // Message delivery acknowledgment
    socket.on('messageDelivered', async ({ messageId }) => {
      try {
        const message = await ChatMessage.findById(messageId);
        if (message && message.receiverId.toString() === socket.userId) {
          message.status = 'delivered';
          message.deliveredAt = new Date();
          await message.save();

          // Notify sender
          io.to(message.senderId.toString()).emit('messageStatus', {
            messageId,
            status: 'delivered',
            deliveredAt: message.deliveredAt,
          });
        }
      } catch (error) {
        console.error(' Message delivery error:', error);
      }
    });

    // ============================================
    // VOICE/VIDEO CALL SIGNALING
    // ============================================

    // Initiate call - User A calls User B
    socket.on('initiateCall', async ({ recipientId, threadId, callType = 'voice' }) => {
      try {
        // Ensure recipientId is a string for room lookup consistency
        const recipientIdStr = recipientId?.toString();
        console.log(`Call initiated: ${userId} -> ${recipientIdStr}, type: ${callType}`);

        // Check if recipient is connected (use string format for room lookup)
        const recipientSockets = await io.in(recipientIdStr).allSockets();
        console.log(`Recipient ${recipientIdStr} has ${recipientSockets.size} active sockets`);

        if (recipientSockets.size === 0) {
          console.log(`Recipient ${recipientIdStr} is offline`);
          // Recipient is offline
          socket.emit('callFailed', {
            recipientId: recipientIdStr,
            reason: 'User is offline',
          });
          return;
        }

        // Fetch caller's user info to send with the notification
        const callerUser = await User.findById(userId).select(
          'firstName lastName username profilePicture avatar'
        );

        // Construct proper caller name
        let callerName = 'Unknown User';
        if (callerUser?.firstName && callerUser?.lastName) {
          callerName = `${callerUser.firstName} ${callerUser.lastName}`;
        } else if (callerUser?.username) {
          callerName = callerUser.username;
        }

        console.log(`Sending incoming call notification to ${recipientIdStr}`);

        // Send incoming call notification to recipient with caller info
        io.to(recipientIdStr).emit('incomingCall', {
          callerId: userId,
          threadId: threadId,
          callType: callType,
          callerInfo: {
            avatar: callerUser?.profilePicture || callerUser?.avatar || '👤',
            name: callerName,
          },
          timestamp: new Date(),
          name: callerName,
        });

        console.log(`Call notification sent successfully to room: ${recipientIdStr}`);
      } catch (error) {
        console.error('❌ Error initiating call:', error);
        socket.emit('callFailed', {
          recipientId,
          reason: 'Internal server error',
        });
      }
    });

    // Initiate GROUP call - User A calls ALL online members in a group
    socket.on('initiateGroupCall', async ({ groupId, callType = 'voice' }) => {
      try {
        console.log(`Group call initiated by ${userId} in group ${groupId}, type: ${callType}`);

        // Fetch the group and its members
        const group = await GroupChat.findById(groupId).select('name avatar members').lean();

        if (!group) {
          console.log(`Group ${groupId} not found`);
          socket.emit('callFailed', {
            groupId,
            reason: 'Group not found',
          });
          return;
        }

        // Get all member IDs except the caller
        const memberIds = group.members.map((m) => m.user.toString()).filter((id) => id !== userId);

        if (memberIds.length === 0) {
          console.log(`No other members in group ${groupId}`);
          socket.emit('callFailed', {
            groupId,
            reason: 'No other members in this group',
          });
          return;
        }

        // Fetch caller's user info to send with the notification
        const callerUser = await User.findById(userId).select(
          'firstName lastName username profilePicture avatar'
        );

        // Construct proper caller name
        let callerName = 'Unknown User';
        if (callerUser?.firstName && callerUser?.lastName) {
          callerName = `${callerUser.firstName} ${callerUser.lastName}`;
        } else if (callerUser?.username) {
          callerName = callerUser.username;
        }

        // Track how many online members we found
        let onlineMembersCount = 0;

        // Send incoming call notification to each online member
        for (const memberId of memberIds) {
          const memberSockets = await io.in(memberId).allSockets();

          if (memberSockets.size > 0) {
            onlineMembersCount++;
            console.log(`Sending group call notification to ${memberId}`);

            io.to(memberId).emit('incomingCall', {
              callerId: userId,
              threadId: groupId, // Use groupId as threadId
              callType: callType,
              isGroupCall: true, // Flag to indicate this is a group call
              groupInfo: {
                groupId: groupId,
                groupName: group.name,
                groupAvatar: group.avatar,
              },
              callerInfo: {
                avatar: callerUser?.profilePicture || callerUser?.avatar || '👤',
                name: callerName,
              },
              timestamp: new Date(),
              name: `${callerName} (${group.name})`, // Show caller name and group name
            });
          }
        }

        if (onlineMembersCount === 0) {
          console.log(`No online members in group ${groupId}`);
          socket.emit('callFailed', {
            groupId,
            reason: 'No group members are online',
          });
          return;
        }

        console.log(`Group call notification sent to ${onlineMembersCount} online members`);
      } catch (error) {
        console.error('❌ Error initiating group call:', error);
        socket.emit('callFailed', {
          groupId,
          reason: 'Internal server error',
        });
      }
    });

    // ============================================
    // GROUP CALL MANAGEMENT
    // ============================================

    // Track active group calls: groupId -> Set of participant userIds
    // Note: This is a simple in-memory store for now
    if (!global.activeGroupCalls) {
      global.activeGroupCalls = new Map();
    }

    // Join a group call
    socket.on('joinGroupCall', async ({ groupId, callType }) => {
      try {
        console.log(`User ${userId} joining group call ${groupId}`);

        // Get or create the group call session
        if (!global.activeGroupCalls.has(groupId)) {
          global.activeGroupCalls.set(groupId, new Set());
        }

        const participants = global.activeGroupCalls.get(groupId);

        // Get existing participants before adding new one
        const existingParticipantIds = Array.from(participants);

        participants.add(userId);

        // Join the group call room
        socket.join(`group-call:${groupId}`);

        // Get user info for the joining user
        const user = await User.findById(userId).select(
          'firstName lastName username avatar profilePicture'
        );
        const userName =
          user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`
            : user?.username || 'Unknown';

        // Notify all OTHER participants in the call that this user joined
        socket.to(`group-call:${groupId}`).emit('groupCallParticipantJoined', {
          userId: userId,
          userName: userName,
          avatar: user?.profilePicture || user?.avatar,
          callType: callType,
        });

        // Send the list of existing participants to the joining user
        if (existingParticipantIds.length > 0) {
          const existingUsers = await User.find({ _id: { $in: existingParticipantIds } }).select(
            'firstName lastName username avatar profilePicture'
          );

          for (const existingUser of existingUsers) {
            const existingUserName =
              existingUser?.firstName && existingUser?.lastName
                ? `${existingUser.firstName} ${existingUser.lastName}`
                : existingUser?.username || 'Unknown';

            socket.emit('groupCallParticipantJoined', {
              userId: existingUser._id.toString(),
              userName: existingUserName,
              avatar: existingUser?.profilePicture || existingUser?.avatar,
            });
          }
        }

        console.log(
          `User ${userId} joined group call ${groupId}, total participants: ${participants.size}`
        );
      } catch (error) {
        console.error('❌ Error joining group call:', error);
      }
    });

    // Accept a group call (for incoming calls)
    socket.on('acceptGroupCall', async ({ groupId, callerId }) => {
      try {
        console.log(`User ${userId} accepting group call ${groupId}`);

        // Get or create the group call session
        if (!global.activeGroupCalls.has(groupId)) {
          global.activeGroupCalls.set(groupId, new Set());
        }

        const participants = global.activeGroupCalls.get(groupId);

        // Get existing participants before adding new one
        const existingParticipantIds = Array.from(participants);

        participants.add(userId);

        // Join the group call room
        socket.join(`group-call:${groupId}`);

        // Get user info for the joining user
        const user = await User.findById(userId).select(
          'firstName lastName username avatar profilePicture'
        );
        const userName =
          user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`
            : user?.username || 'Unknown';

        // Notify all OTHER participants in the call that this user joined
        socket.to(`group-call:${groupId}`).emit('groupCallParticipantJoined', {
          userId: userId,
          userName: userName,
          avatar: user?.profilePicture || user?.avatar,
        });

        // Send the list of existing participants to the joining user
        if (existingParticipantIds.length > 0) {
          const existingUsers = await User.find({ _id: { $in: existingParticipantIds } }).select(
            'firstName lastName username avatar profilePicture'
          );

          for (const existingUser of existingUsers) {
            const existingUserName =
              existingUser?.firstName && existingUser?.lastName
                ? `${existingUser.firstName} ${existingUser.lastName}`
                : existingUser?.username || 'Unknown';

            socket.emit('groupCallParticipantJoined', {
              userId: existingUser._id.toString(),
              userName: existingUserName,
              avatar: existingUser?.profilePicture || existingUser?.avatar,
            });
          }
        }

        // Notify the caller that this user accepted
        io.to(callerId?.toString()).emit('groupCallAccepted', {
          userId: userId,
          userName: userName,
          avatar: user?.profilePicture || user?.avatar,
          groupId: groupId,
        });

        console.log(`User ${userId} accepted group call ${groupId}`);
      } catch (error) {
        console.error('❌ Error accepting group call:', error);
      }
    });

    // Reject a group call
    socket.on('rejectGroupCall', ({ groupId, callerId }) => {
      console.log(`User ${userId} rejected group call ${groupId}`);

      // Notify the caller (optional)
      io.to(callerId?.toString()).emit('groupCallRejected', {
        userId: userId,
        groupId: groupId,
      });
    });

    // Leave a group call
    socket.on('leaveGroupCall', async ({ groupId }) => {
      try {
        console.log(`User ${userId} leaving group call ${groupId}`);

        // Remove from participants
        if (global.activeGroupCalls.has(groupId)) {
          const participants = global.activeGroupCalls.get(groupId);
          participants.delete(userId);

          // If no participants left, clean up the call
          if (participants.size === 0) {
            global.activeGroupCalls.delete(groupId);
            console.log(`Group call ${groupId} ended (no participants)`);
          }
        }

        // Leave the group call room
        socket.leave(`group-call:${groupId}`);

        // Notify remaining participants
        io.to(`group-call:${groupId}`).emit('groupCallParticipantLeft', {
          userId: userId,
        });

        console.log(`User ${userId} left group call ${groupId}`);
      } catch (error) {
        console.error('❌ Error leaving group call:', error);
      }
    });

    // Toggle mute in group call
    socket.on('groupCallMuteToggle', ({ groupId, isMuted }) => {
      io.to(`group-call:${groupId}`).emit('groupCallParticipantMuted', {
        userId: userId,
        isMuted: isMuted,
      });
    });

    // Toggle video in group call
    socket.on('groupCallVideoToggle', ({ groupId, isVideoOff }) => {
      io.to(`group-call:${groupId}`).emit('groupCallParticipantVideoToggle', {
        userId: userId,
        isVideoOff: isVideoOff,
      });
    });

    // End group call (host only)
    socket.on('endGroupCall', async ({ groupId }) => {
      try {
        console.log(`Group call ${groupId} ended by ${userId}`);

        // Notify all participants
        io.to(`group-call:${groupId}`).emit('groupCallEnded', {
          endedBy: userId,
        });

        // Clean up
        if (global.activeGroupCalls.has(groupId)) {
          global.activeGroupCalls.delete(groupId);
        }
      } catch (error) {
        console.error('❌ Error ending group call:', error);
      }
    });

    // Accept call - User B accepts the incoming call
    socket.on('acceptCall', ({ callerId, threadId }) => {
      const callerIdStr = callerId?.toString();
      console.log(`Call accepted: ${userId} accepted call from ${callerIdStr}`);

      // Notify the caller that call was accepted
      io.to(callerIdStr).emit('callAccepted', {
        receiverId: userId,
        threadId: threadId,
      });

      console.log(`Call accepted notification sent to ${callerIdStr}`);
    });

    // Reject call - User B rejects the incoming call
    socket.on('rejectCall', ({ callerId, threadId }) => {
      const callerIdStr = callerId?.toString();
      console.log(`Call rejected: ${userId} rejected call from ${callerIdStr}`);

      // Notify the caller that call was rejected
      io.to(callerIdStr).emit('callRejected', {
        receiverId: userId,
        threadId: threadId,
      });
    });

    // End call - Either party ends the active call
    socket.on('endCall', ({ recipientId, threadId }) => {
      const recipientIdStr = recipientId?.toString();
      console.log(`Call ended: ${userId} ended call with ${recipientIdStr}`);

      // Notify the other party that call ended
      io.to(recipientIdStr).emit('callEnded', {
        userId: userId,
        threadId: threadId,
        endedAt: new Date(),
      });
    });

    // ============================================
    // WEBRTC SIGNALING (SDP Offer/Answer/ICE)
    // ============================================

    // WebRTC offer - Send WebRTC offer for peer connection
    socket.on('offer', async ({ recipientId, offer, callType }) => {
      console.log(`WebRTC offer: ${socket.userId} -> ${recipientId} (type: ${callType})`);

      // Get caller info to send with offer
      const caller = await User.findById(socket.userId).select(
        'firstName lastName username avatar profilePicture'
      );
      const callerName =
        caller?.firstName && caller?.lastName
          ? `${caller.firstName} ${caller.lastName}`
          : caller?.username || 'Unknown';

      io.to(recipientId).emit('offer', {
        callerId: socket.userId,
        offer: offer,
        callType: callType,
        callerInfo: {
          userId: socket.userId,
          userName: callerName,
          userAvatar: caller?.profilePicture || caller?.avatar,
        },
      });
    });

    // WebRTC answer - Send WebRTC answer back to caller
    socket.on('answer', async ({ recipientId, answer, callType }) => {
      console.log(`WebRTC answer: ${socket.userId} -> ${recipientId} (type: ${callType})`);

      // Get answerer info to send with answer
      const answerer = await User.findById(socket.userId).select(
        'firstName lastName username avatar profilePicture'
      );
      const answererName =
        answerer?.firstName && answerer?.lastName
          ? `${answerer.firstName} ${answerer.lastName}`
          : answerer?.username || 'Unknown';

      io.to(recipientId).emit('answer', {
        recipientId: socket.userId,
        answer: answer,
        callType: callType,
        answererInfo: {
          userId: socket.userId,
          userName: answererName,
          userAvatar: answerer?.profilePicture || answerer?.avatar,
        },
      });
    });

    // ICE candidate exchange for WebRTC connection
    socket.on('iceCandidate', ({ recipientId, candidate }) => {
      console.log(`ICE candidate: ${socket.userId} -> ${recipientId}`);

      io.to(recipientId).emit('iceCandidate', {
        senderId: socket.userId,
        candidate: candidate,
      });
    });

    // USER DISCONNECT (tab close, internet loss, logout, etc.)
    socket.on('disconnect', async (reason) => {
      console.log(`User disconnected: ${userId} (reason: ${reason})`);

      // Check if user has other active sockets (multiple tabs/devices)
      const userSockets = await io.in(userId).allSockets();

      if (userSockets.size > 0) {
        // User still has other connections, don't mark as offline
        console.log(`User ${userId} still has ${userSockets.size} other socket(s), staying online`);
        return;
      }

      // Use grace period to handle brief disconnections (network hiccup, page refresh)
      console.log(`Starting ${DISCONNECT_GRACE_PERIOD}ms grace period for ${userId}`);

      const timeoutId = setTimeout(async () => {
        // Double-check user hasn't reconnected during grace period
        const currentSockets = await io.in(userId).allSockets();
        if (currentSockets.size > 0) {
          console.log(`User ${userId} reconnected during grace period, staying online`);
          disconnectTimeouts.delete(userId);
          return;
        }

        //  REMOVE USER FROM ONLINE MAP (Redis + local)
        await removeOnlineUser(userId);

        //  BROADCAST TO ALL USERS THAT THIS USER IS OFFLINE
        console.log(`Broadcasting userOffline event for userId: ${userId.toString()}`);
        io.emit('userOffline', {
          userId: userId.toString(),
        });

        const totalOnline = await getOnlineUsersCount();
        console.log(`📊 Total online users: ${totalOnline}`);

        disconnectTimeouts.delete(userId);
      }, DISCONNECT_GRACE_PERIOD);

      disconnectTimeouts.set(userId, timeoutId);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

// HELPER FUNCTION: Check if a user is online (cluster-safe)
export const isUserOnline = async (userId) => {
  if (redisClient && redisClient.isOpen) {
    try {
      const exists = await redisClient.exists(`online:${userId}`);
      return exists === 1;
    } catch (error) {
      console.error('Error checking online status from Redis:', error);
    }
  }
  // Fallback to local Map if Redis is not available
  return onlineUsers.has(userId.toString());
};

//  HELPER FUNCTION: Get all online users (cluster-safe)
export const getOnlineUsers = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      const keys = await redisClient.keys('online:*');
      return keys.map((key) => key.replace('online:', ''));
    } catch (error) {
      console.error('Error getting online users from Redis:', error);
    }
  }
  // Fallback to local Map if Redis is not available
  return Array.from(onlineUsers.keys());
};

//  HELPER FUNCTION: Get online users count (cluster-safe)
export const getOnlineUsersCount = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      const keys = await redisClient.keys('online:*');
      return keys.length;
    } catch (error) {
      console.error('Error getting online users count from Redis:', error);
    }
  }
  // Fallback to local Map if Redis is not available
  return onlineUsers.size;
};

//  HELPER FUNCTION: Add user to online list (cluster-safe)
async function addOnlineUser(userId, socketId) {
  const userIdStr = userId.toString();
  // Add to local Map
  onlineUsers.set(userIdStr, socketId);
  console.log(`Added to online map: ${userIdStr} (total: ${onlineUsers.size})`);

  // Add to Redis for cross-worker tracking
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.set(`online:${userId}`, socketId, {
        EX: 3600, // Expire after 1 hour (safety cleanup)
      });
    } catch (error) {
      console.error('Error adding online user to Redis:', error);
    }
  }
}

//  HELPER FUNCTION: Remove user from online list (cluster-safe)
async function removeOnlineUser(userId) {
  // Remove from local Map
  onlineUsers.delete(userId.toString());

  // Remove from Redis
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.del(`online:${userId}`);
    } catch (error) {
      console.error('Error removing online user from Redis:', error);
    }
  }
}

// HELPER FUNCTION: Cleanup Redis connections on shutdown
export const cleanupRedis = async () => {
  try {
    if (redisPubClient && redisPubClient.isOpen) {
      await redisPubClient.quit();
    }
    if (redisSubClient && redisSubClient.isOpen) {
      await redisSubClient.quit();
    }
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch (error) {
    console.error('Error cleaning up Redis connections:', error);
  }
};

export default {
  initializeSocket,
  getIO,
  isUserOnline,
  getOnlineUsers,
  getOnlineUsersCount,
};
