import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import { ChatMessage } from '../models/chatMessage.model.js';
import { User } from '../models/user.model.js';
import liveStreamSocket from './liveStream.socket.js';

let io;
let redisClient;
let redisPubClient;
let redisSubClient;

// Track online users: userId -> socketId
// Note: In cluster mode, this Map is per-worker. For cross-worker user tracking,
// we'll use Redis for shared state
const onlineUsers = new Map();

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
  // Parse CORS origins from environment variable
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : '*';

  io = new Server(server, {
    cors: {
      origin: corsOrigins,
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
    const userId = socket.userId;

    //  ADD USER TO ONLINE MAP (Redis + local)
    await addOnlineUser(userId, socket.id);

    // Join user's personal room
    socket.join(userId);

    //  BROADCAST TO ALL USERS THAT THIS USER IS ONLINE
    io.emit('userOnline', {
      userId: userId.toString(),
      socketId: socket.id,
    });

    //  SEND CURRENT ONLINE USERS LIST TO THE NEWLY CONNECTED USER
    socket.emit('onlineUsersList', {
      users: Array.from(onlineUsers.keys()),
    });

    //  GET ONLINE USERS REQUEST
    socket.on('getOnlineUsers', () => {
      const onlineUsersList = Array.from(onlineUsers.keys());
      socket.emit('onlineUsersList', { users: onlineUsersList });
    });

    // ==================== LIVE STREAMING HANDLERS ====================
    liveStreamSocket(io, socket, userId);

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
    // NEW MESSAGE SENDING (FIXED - PROPER FORMAT)
    // ============================================

    socket.on('sendMessage', async (messageData) => {
      try {
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

        // Send the message to the receiver in real-time
        io.to(messageData.receiverId).emit('newMessage', formattedMessage);

        // Also send back to sender for confirmation (optional)
        socket.emit('messageSent', {
          messageId: messageData.messageId,
          status: 'sent',
          timestamp: new Date(),
        });
      } catch (error) {
        console.error(' Error sending message via socket:', error);
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
    // VOICE/VIDEO CALL SIGNALING (FIXED)
    // ============================================

    // Initiate call - User A calls User B
    socket.on('initiateCall', async ({ recipientId, threadId, callType = 'voice' }) => {
      try {
        // Check if recipient is connected
        const recipientSockets = await io.in(recipientId).allSockets();
        if (recipientSockets.size === 0) {
          // Recipient is offline
          socket.emit('callFailed', {
            recipientId,
            reason: 'User is offline',
          });
          return;
        }

        // Fetch caller's user info to send with the notification
        const callerUser = await User.findById(socket.userId).select(
          'firstName lastName username profilePicture avatar'
        );

        // Construct proper caller name
        let callerName = 'Unknown User';
        if (callerUser?.firstName && callerUser?.lastName) {
          callerName = `${callerUser.firstName} ${callerUser.lastName}`;
        } else if (callerUser?.username) {
          callerName = callerUser.username;
        }

        // Send incoming call notification to recipient with caller info
        io.to(recipientId).emit('incomingCall', {
          callerId: socket.userId,
          threadId: threadId,
          callType: callType,
          callerInfo: {
            avatar: callerUser?.profilePicture || callerUser?.avatar || '👤',
            name: callerName, // Added name to callerInfo object as expected by frontend
          },
          timestamp: new Date(),
          name: callerName,
        });
      } catch (error) {
        console.error('Error initiating call:', error);
        socket.emit('callFailed', {
          recipientId,
          reason: 'Internal server error',
        });
      }
    });

    // Accept call - User B accepts the incoming call
    socket.on('acceptCall', ({ callerId, threadId }) => {
      // Notify the caller that call was accepted
      io.to(callerId).emit('callAccepted', {
        receiverId: socket.userId,
        threadId: threadId,
      });
    });

    // Reject call - User B rejects the incoming call
    socket.on('rejectCall', ({ callerId, threadId }) => {
      // Notify the caller that call was rejected
      io.to(callerId).emit('callRejected', {
        receiverId: socket.userId,
        threadId: threadId,
      });
    });

    // End call - Either party ends the active call
    socket.on('endCall', ({ recipientId, threadId }) => {
      // Notify the other party that call ended
      io.to(recipientId).emit('callEnded', {
        userId: socket.userId,
        threadId: threadId,
        endedAt: new Date(),
      });
    });

    // ============================================
    // WEBRTC SIGNALING (SDP Offer/Answer/ICE)
    // ============================================

    // WebRTC offer - Send WebRTC offer for peer connection
    socket.on('offer', ({ recipientId, offer }) => {
      io.to(recipientId).emit('offer', {
        callerId: socket.userId,
        offer: offer,
      });
    });

    // WebRTC answer - Send WebRTC answer back to caller
    socket.on('answer', ({ callerId, answer }) => {
      io.to(callerId).emit('answer', {
        receiverId: socket.userId,
        answer: answer,
      });
    });

    // ICE candidate exchange for WebRTC connection
    socket.on('iceCandidate', ({ recipientId, candidate }) => {
      io.to(recipientId).emit('iceCandidate', {
        senderId: socket.userId,
        candidate: candidate,
      });
    });

    // USER DISCONNECT (tab close, internet loss, logout, etc.)
    socket.on('disconnect', async (reason) => {
      //  REMOVE USER FROM ONLINE MAP (Redis + local)
      await removeOnlineUser(userId);

      //  BROADCAST TO ALL USERS THAT THIS USER IS OFFLINE
      io.emit('userOffline', {
        userId: userId.toString(),
      });

      const totalOnline = await getOnlineUsersCount();
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
  // Add to local Map
  onlineUsers.set(userId.toString(), socketId);

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
