import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import { CallLog } from '../models/callLog.model.js';
import { ChatMessage } from '../models/chatMessage.model.js';
import { ChatThread } from '../models/chatThread.model.js';
import { GroupChat } from '../models/groupChat.model.js';
import { User } from '../models/user.model.js';
import logger from '../utils/logger.js';
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

// ── User info cache (avoids DB queries on hot signaling paths) ──
const userInfoCache = new Map(); // userId -> { name, avatar, cachedAt }
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedUserInfo(userId) {
  const cached = userInfoCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < USER_CACHE_TTL) {
    return cached;
  }
  try {
    const user = await User.findById(userId)
      .select('firstName lastName username avatar profilePicture')
      .lean();
    if (!user) return null;
    const name =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.username || 'Unknown';
    const info = {
      name,
      avatar: user.profilePicture || user.avatar || '',
      userId: user._id.toString(),
      cachedAt: Date.now(),
    };
    userInfoCache.set(userId, info);
    return info;
  } catch (e) {
    return null;
  }
}

// ── Simple rate limiter for socket events ──
// DISABLED per client request — can be re-enabled later
// const rateLimitMap = new Map(); // `${userId}:${event}` -> { count, windowStart }
//
// function checkRateLimit(userId, event, maxPerWindow = 10, windowMs = 5000) {
//   const key = `${userId}:${event}`;
//   const now = Date.now();
//   const entry = rateLimitMap.get(key);
//   if (!entry || now - entry.windowStart > windowMs) {
//     rateLimitMap.set(key, { count: 1, windowStart: now });
//     return true;
//   }
//   entry.count++;
//   if (entry.count > maxPerWindow) return false;
//   return true;
// }
//
// // Cleanup stale rate limit entries every 30s
// setInterval(() => {
//   const now = Date.now();
//   for (const [key, entry] of rateLimitMap.entries()) {
//     if (now - entry.windowStart > 30000) rateLimitMap.delete(key);
//   }
// }, 30000);

// ── Cluster-safe group call tracking helpers ──
async function getGroupCallParticipants(groupId) {
  if (redisClient?.isOpen) {
    try {
      const members = await redisClient.sMembers(`groupcall:${groupId}`);
      return new Set(members);
    } catch (e) {
      /* fall through */
    }
  }
  if (!global.activeGroupCalls) global.activeGroupCalls = new Map();
  return global.activeGroupCalls.get(groupId) || new Set();
}

async function addGroupCallParticipant(groupId, userId) {
  if (!global.activeGroupCalls) global.activeGroupCalls = new Map();
  if (!global.activeGroupCalls.has(groupId)) global.activeGroupCalls.set(groupId, new Set());
  global.activeGroupCalls.get(groupId).add(userId);
  if (redisClient?.isOpen) {
    try {
      await redisClient.sAdd(`groupcall:${groupId}`, userId);
      await redisClient.expire(`groupcall:${groupId}`, 7200); // 2hr TTL safety
    } catch (e) {
      /* ignore */
    }
  }
}

async function removeGroupCallParticipant(groupId, userId) {
  if (global.activeGroupCalls?.has(groupId)) {
    const participants = global.activeGroupCalls.get(groupId);
    participants.delete(userId);
    if (participants.size === 0) global.activeGroupCalls.delete(groupId);
  }
  if (redisClient?.isOpen) {
    try {
      await redisClient.sRem(`groupcall:${groupId}`, userId);
      const remaining = await redisClient.sCard(`groupcall:${groupId}`);
      if (remaining === 0) await redisClient.del(`groupcall:${groupId}`);
    } catch (e) {
      /* ignore */
    }
  }
}

async function getGroupCallSize(groupId) {
  if (redisClient?.isOpen) {
    try {
      return await redisClient.sCard(`groupcall:${groupId}`);
    } catch (e) {
      /* fall through */
    }
  }
  return global.activeGroupCalls?.get(groupId)?.size || 0;
}

async function clearGroupCall(groupId) {
  if (global.activeGroupCalls) global.activeGroupCalls.delete(groupId);
  if (redisClient?.isOpen) {
    try {
      await redisClient.del(`groupcall:${groupId}`);
    } catch (e) {
      /* ignore */
    }
  }
}

async function getUserGroupCalls(userId) {
  const groups = [];
  if (global.activeGroupCalls) {
    for (const [groupId, participants] of global.activeGroupCalls.entries()) {
      if (participants.has(userId)) groups.push(groupId);
    }
  }
  return groups;
}

// ── Cluster-safe call tracking helpers ──
// Uses Redis when available (cluster mode), falls back to in-memory Map
async function setActiveCallPeer(userId, peerId) {
  if (!global.activeCallPeers) global.activeCallPeers = new Map();
  global.activeCallPeers.set(userId, peerId);
  if (redisClient?.isOpen) {
    try {
      await redisClient.set(`callpeer:${userId}`, peerId, { EX: 3600 });
    } catch (e) {
      /* ignore */
    }
  }
}

async function getActiveCallPeer(userId) {
  if (redisClient?.isOpen) {
    try {
      return await redisClient.get(`callpeer:${userId}`);
    } catch (e) {
      /* fall through */
    }
  }
  if (!global.activeCallPeers) return null;
  return global.activeCallPeers.get(userId) || null;
}

async function removeActiveCallPeer(userId) {
  if (global.activeCallPeers) global.activeCallPeers.delete(userId);
  if (redisClient?.isOpen) {
    try {
      await redisClient.del(`callpeer:${userId}`);
    } catch (e) {
      /* ignore */
    }
  }
}

async function isInActiveCall(userId) {
  if (redisClient?.isOpen) {
    try {
      return (await redisClient.exists(`callpeer:${userId}`)) === 1;
    } catch (e) {
      /* fall through */
    }
  }
  return global.activeCallPeers?.has(userId) || false;
}

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
    redisPubClient.on('error', (err) =>
      logger.error('Redis Pub Client Error', { error: err.message })
    );
    redisSubClient.on('error', (err) =>
      logger.error('Redis Sub Client Error', { error: err.message })
    );

    // Connect both clients
    await Promise.all([redisPubClient.connect(), redisSubClient.connect()]);

    // Attach Redis adapter to Socket.IO
    io.adapter(createAdapter(redisPubClient, redisSubClient));

    // Also create a regular Redis client for storing online users
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => logger.error('Redis Client Error', { error: err.message }));
    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to initialize Redis adapter', { error: error.message });
    logger.warn('Socket.IO will work but only within this worker process');
  }
}

export const initializeSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
    pingInterval: 25000,
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

    // Cancel any pending disconnect timeout for this user (they reconnected!)
    if (disconnectTimeouts.has(userId)) {
      clearTimeout(disconnectTimeouts.get(userId));
      disconnectTimeouts.delete(userId);
    }

    // Add user to online map (Redis + local)
    await addOnlineUser(userId, socket.id);

    // Join user's personal room (ensure string format for consistency)
    socket.join(userId);

    // Broadcast to all users that this user is online
    io.emit('userOnline', {
      userId: userId,
      socketId: socket.id,
    });

    // Send current online users list to the newly connected user (cluster-safe)
    const onlineList = await getOnlineUsers();
    socket.emit('onlineUsersList', {
      users: onlineList,
    });

    // Get online users request (cluster-safe)
    socket.on('getOnlineUsers', async () => {
      const onlineUsersList = await getOnlineUsers();
      socket.emit('onlineUsersList', { users: onlineUsersList });
    });

    // Live streaming handlers
    liveStreamSocket(io, socket, userId);

    // Group chat & call handlers
    groupSocket(io, socket, userId);

    // Join thread room
    socket.on('joinThread', (threadId) => {
      socket.join(threadId);
    });

    // Leave thread room
    socket.on('leaveThread', (threadId) => {
      socket.leave(threadId);
    });

    // Handle explicit online event
    socket.on('userOnline', async (data) => {
      const targetUserId = data.userId || userId;
      await addOnlineUser(targetUserId, socket.id);
      io.emit('userOnline', {
        userId: targetUserId.toString(),
        socketId: socket.id,
      });
    });

    // Handle explicit offline event
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

    // Message sending

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

        // Send to thread room so both participants get the message
        if (messageData.threadId) {
          io.to(messageData.threadId).emit('newMessage', formattedMessage);
        }

        // Also send to receiver's personal room (for notification when not in thread)
        io.to(messageData.receiverId).emit('newMessage', formattedMessage);

        // Also send back to sender for confirmation (optional)
        socket.emit('messageSent', {
          messageId: messageData.messageId,
          status: 'sent',
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error('Error sending message via socket', { error: error.message });
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
        logger.error('Message delivery error', { error: error.message });
      }
    });

    // Voice/video call signaling

    // Initiate call - User A calls User B
    socket.on('initiateCall', async ({ recipientId, threadId, callType = 'voice' }) => {
      try {
        const recipientIdStr = recipientId?.toString();

        // Server-side busy check: reject if CALLER is already in a call
        if (!global.activeCallPeers) global.activeCallPeers = new Map();
        if (await isInActiveCall(userId)) {
          socket.emit('callFailed', {
            recipientId: recipientIdStr,
            reason: 'You are already in a call',
          });
          return;
        }

        // Validate: check block status
        const [caller, recipient] = await Promise.all([
          User.findById(userId)
            .select('blockedUsers firstName lastName username profilePicture avatar')
            .lean(),
          User.findById(recipientIdStr).select('blockedUsers').lean(),
        ]);

        if (!caller || !recipient) {
          socket.emit('callFailed', { recipientId: recipientIdStr, reason: 'User not found' });
          return;
        }

        const callerBlocked = caller.blockedUsers?.some((id) => id.toString() === recipientIdStr);
        const recipientBlocked = recipient.blockedUsers?.some((id) => id.toString() === userId);
        if (callerBlocked || recipientBlocked) {
          socket.emit('callFailed', {
            recipientId: recipientIdStr,
            reason: 'Cannot call this user',
          });
          return;
        }

        // Validate: thread exists and belongs to both users
        if (threadId) {
          const thread = await ChatThread.findById(threadId)
            .select('participants isBlocked')
            .lean();
          if (thread?.isBlocked) {
            socket.emit('callFailed', {
              recipientId: recipientIdStr,
              reason: 'Conversation is blocked',
            });
            return;
          }
        }

        // Check if recipient is connected
        const recipientSockets = await io.in(recipientIdStr).allSockets();
        if (recipientSockets.size === 0) {
          socket.emit('callFailed', { recipientId: recipientIdStr, reason: 'User is offline' });
          return;
        }

        // Server-side busy check: if recipient is already in a 1:1 call
        if (await isInActiveCall(recipientIdStr)) {
          socket.emit('callFailed', {
            recipientId: recipientIdStr,
            reason: 'User is busy on another call',
          });
          return;
        }

        // Track active 1:1 call peer (for disconnect cleanup)
        await setActiveCallPeer(userId, recipientIdStr);

        // Create call log entry
        try {
          const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await CallLog.create({
            callId,
            callType: callType === 'video' ? 'video' : 'audio',
            callerId: userId,
            receiverId: recipientIdStr,
            threadId: threadId || undefined,
            status: 'initiated',
          });
        } catch (e) {
          logger.error('Error creating call log', { error: e.message });
        }

        let callerName = 'Unknown User';
        if (caller?.firstName && caller?.lastName) {
          callerName = `${caller.firstName} ${caller.lastName}`;
        } else if (caller?.username) {
          callerName = caller.username;
        }

        io.to(recipientIdStr).emit('incomingCall', {
          callerId: userId,
          threadId: threadId,
          callType: callType,
          callerInfo: {
            avatar: caller?.profilePicture || caller?.avatar || '👤',
            name: callerName,
          },
          timestamp: new Date(),
          name: callerName,
        });
      } catch (error) {
        logger.error('Error initiating call', { error: error.message });
        socket.emit('callFailed', { recipientId, reason: 'Internal server error' });
      }
    });

    // Initiate GROUP call - User A calls ALL online members in a group
    socket.on('initiateGroupCall', async ({ groupId, callType = 'voice' }) => {
      try {
        const group = await GroupChat.findById(groupId).select('name avatar members').lean();

        if (!group) {
          socket.emit('callFailed', { groupId, reason: 'Group not found' });
          return;
        }

        // Validate caller is a member of the group
        const isMember = group.members.some((m) => m.user.toString() === userId);
        if (!isMember) {
          socket.emit('callFailed', { groupId, reason: 'You are not a member of this group' });
          return;
        }

        const memberIds = group.members.map((m) => m.user.toString()).filter((id) => id !== userId);

        if (memberIds.length === 0) {
          socket.emit('callFailed', { groupId, reason: 'No other members in this group' });
          return;
        }

        const callerUser = await User.findById(userId).select(
          'firstName lastName username profilePicture avatar'
        );

        let callerName = 'Unknown User';
        if (callerUser?.firstName && callerUser?.lastName) {
          callerName = `${callerUser.firstName} ${callerUser.lastName}`;
        } else if (callerUser?.username) {
          callerName = callerUser.username;
        }

        let onlineMembersCount = 0;

        for (const memberId of memberIds) {
          const memberSockets = await io.in(memberId).allSockets();

          if (memberSockets.size > 0) {
            onlineMembersCount++;

            io.to(memberId).emit('incomingCall', {
              callerId: userId,
              threadId: groupId,
              callType: callType,
              isGroupCall: true,
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
              name: `${callerName} (${group.name})`,
            });
          }
        }

        if (onlineMembersCount === 0) {
          socket.emit('callFailed', { groupId, reason: 'No group members are online' });
          return;
        }
      } catch (error) {
        logger.error('Error initiating group call', { error: error.message });
        socket.emit('callFailed', { groupId, reason: 'Internal server error' });
      }
    });

    // Group call management

    // Track active group calls — uses Redis when available for cluster safety
    if (!global.activeGroupCalls) {
      global.activeGroupCalls = new Map();
    }

    // Join a group call
    socket.on('joinGroupCall', async ({ groupId, callType }) => {
      try {
        // if (!checkRateLimit(userId, 'joinGroupCall', 3, 5000)) return; // Rate limit disabled

        // Get existing participants before adding new one
        const existingParticipants = await getGroupCallParticipants(groupId);
        const existingParticipantIds = Array.from(existingParticipants).filter(
          (id) => id !== userId
        );

        await addGroupCallParticipant(groupId, userId);

        // Join the group call room
        socket.join(`group-call:${groupId}`);

        // Get user info (cached)
        const userInfo = await getCachedUserInfo(userId);
        const userName = userInfo?.name || 'Unknown';
        const userAvatar = userInfo?.avatar || '';

        // Create or update GroupCall record in MongoDB
        try {
          const callTypeNormalized = callType === 'video' ? 'video' : 'audio';
          let groupCallRecord = await GroupCall.findOne({
            groupId,
            status: { $in: ['initiating', 'ringing', 'ongoing'] },
          });

          if (!groupCallRecord) {
            // First participant — create the record
            groupCallRecord = await GroupCall.create({
              callId: `gc_${groupId}_${Date.now()}`,
              groupId,
              callType: callTypeNormalized,
              initiator: userId,
              status: 'ongoing',
              startedAt: new Date(),
              participants: [
                {
                  user: userId,
                  status: 'joined',
                  joinedAt: new Date(),
                  role: 'host',
                  isAudioEnabled: true,
                  isVideoEnabled: callTypeNormalized === 'video',
                },
              ],
            });
          } else {
            // Additional participant — add to existing record
            const existingParticipant = groupCallRecord.participants.find(
              (p) => p.user.toString() === userId
            );
            if (!existingParticipant) {
              groupCallRecord.participants.push({
                user: userId,
                status: 'joined',
                joinedAt: new Date(),
                role: 'participant',
                isAudioEnabled: true,
                isVideoEnabled: callTypeNormalized === 'video',
              });
              await groupCallRecord.save();
            }
          }
        } catch (dbErr) {
          logger.error('Error creating/updating GroupCall record', { error: dbErr.message });
        }

        // Notify all OTHER participants in the call that this user joined
        socket.to(`group-call:${groupId}`).emit('groupCallParticipantJoined', {
          userId: userId,
          userName: userName,
          avatar: userAvatar,
          callType: callType,
        });

        // Send the list of existing participants to the joining user
        if (existingParticipantIds.length > 0) {
          for (const existingUserId of existingParticipantIds) {
            const existingInfo = await getCachedUserInfo(existingUserId);
            socket.emit('groupCallParticipantJoined', {
              userId: existingUserId,
              userName: existingInfo?.name || 'Unknown',
              avatar: existingInfo?.avatar || '',
            });
          }
        }
      } catch (error) {
        logger.error('Error joining group call', { error: error.message });
      }
    });

    // Accept a group call (for incoming calls)
    socket.on('acceptGroupCall', async ({ groupId, callerId }) => {
      try {
        // Get existing participants before adding new one
        const existingParticipants = await getGroupCallParticipants(groupId);
        const existingParticipantIds = Array.from(existingParticipants).filter(
          (id) => id !== userId
        );

        await addGroupCallParticipant(groupId, userId);

        // Join the group call room
        socket.join(`group-call:${groupId}`);

        // Get user info (cached)
        const userInfo = await getCachedUserInfo(userId);
        const userName = userInfo?.name || 'Unknown';
        const userAvatar = userInfo?.avatar || '';

        // Notify all OTHER participants in the call that this user joined
        socket.to(`group-call:${groupId}`).emit('groupCallParticipantJoined', {
          userId: userId,
          userName: userName,
          avatar: userAvatar,
        });

        // Send the list of existing participants to the joining user
        if (existingParticipantIds.length > 0) {
          for (const existingUserId of existingParticipantIds) {
            const existingInfo = await getCachedUserInfo(existingUserId);
            socket.emit('groupCallParticipantJoined', {
              userId: existingUserId,
              userName: existingInfo?.name || 'Unknown',
              avatar: existingInfo?.avatar || '',
            });
          }
        }

        // Notify the caller that this user accepted
        io.to(callerId?.toString()).emit('groupCallAccepted', {
          userId: userId,
          userName: userName,
          avatar: userAvatar,
          groupId: groupId,
        });
      } catch (error) {
        logger.error('Error accepting group call', { error: error.message });
      }
    });

    // Reject a group call
    socket.on('rejectGroupCall', ({ groupId, callerId }) => {
      // Notify the caller (optional)
      io.to(callerId?.toString()).emit('groupCallRejected', {
        userId: userId,
        groupId: groupId,
      });
    });

    // Leave a group call
    socket.on('leaveGroupCall', async ({ groupId }) => {
      try {
        await removeGroupCallParticipant(groupId, userId);

        // Leave the group call room
        socket.leave(`group-call:${groupId}`);

        // Update GroupCall record — mark participant as left
        try {
          const groupCallRecord = await GroupCall.findOne({
            groupId,
            status: { $in: ['initiating', 'ringing', 'ongoing'] },
          });
          if (groupCallRecord) {
            const participant = groupCallRecord.participants.find(
              (p) => p.user.toString() === userId && p.status === 'joined'
            );
            if (participant) {
              participant.status = 'left';
              participant.leftAt = new Date();
              if (participant.joinedAt) {
                participant.duration = Math.floor(
                  (Date.now() - participant.joinedAt.getTime()) / 1000
                );
              }
            }

            // If no one is left, end the call
            const remainingSize = await getGroupCallSize(groupId);
            if (remainingSize === 0) {
              groupCallRecord.status = 'ended';
              groupCallRecord.endedAt = new Date();
              groupCallRecord.endReason = 'completed';
              if (groupCallRecord.startedAt) {
                groupCallRecord.duration = Math.floor(
                  (Date.now() - groupCallRecord.startedAt.getTime()) / 1000
                );
              }
            }
            await groupCallRecord.save();
          }
        } catch (dbErr) {
          logger.error('Error updating GroupCall record on leave', { error: dbErr.message });
        }

        // Notify remaining participants
        io.to(`group-call:${groupId}`).emit('groupCallParticipantLeft', {
          userId: userId,
        });
      } catch (error) {
        logger.error('Error leaving group call', { error: error.message });
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
        // Update GroupCall record
        try {
          await GroupCall.findOneAndUpdate(
            { groupId, status: { $in: ['initiating', 'ringing', 'ongoing'] } },
            {
              status: 'ended',
              endedAt: new Date(),
              endReason: 'ended_by_host',
              $set: {
                'participants.$[elem].status': 'left',
                'participants.$[elem].leftAt': new Date(),
              },
            },
            {
              arrayFilters: [{ 'elem.status': 'joined' }],
            }
          );
        } catch (dbErr) {
          logger.error('Error updating GroupCall record on end', { error: dbErr.message });
        }

        // Notify all participants
        io.to(`group-call:${groupId}`).emit('groupCallEnded', {
          endedBy: userId,
        });

        // Clean up (Redis + local)
        await clearGroupCall(groupId);
      } catch (error) {
        logger.error('Error ending group call', { error: error.message });
      }
    });

    // Accept call - User B accepts the incoming call
    socket.on('acceptCall', async ({ callerId, threadId }) => {
      const callerIdStr = callerId?.toString();

      // Track the reverse peer mapping
      await setActiveCallPeer(userId, callerIdStr);

      // Update call log to 'answered'
      try {
        await CallLog.findOneAndUpdate(
          { callerId: callerIdStr, receiverId: userId, status: { $in: ['initiated', 'ringing'] } },
          { status: 'answered', startedAt: new Date() },
          { sort: { createdAt: -1 } }
        );
      } catch (e) {
        logger.error('Error updating call log on accept', { error: e.message });
      }

      io.to(callerIdStr).emit('callAccepted', {
        receiverId: userId,
        threadId: threadId,
      });
    });

    // Reject call - User B rejects the incoming call
    socket.on('rejectCall', async ({ callerId, threadId }) => {
      const callerIdStr = callerId?.toString();

      // Clean up peer tracking
      await removeActiveCallPeer(userId);
      await removeActiveCallPeer(callerIdStr);

      // Log rejected call
      try {
        await CallLog.findOneAndUpdate(
          { callerId: callerIdStr, receiverId: userId, status: { $in: ['initiated', 'ringing'] } },
          { status: 'rejected', endedAt: new Date(), endReason: 'declined' },
          { sort: { createdAt: -1 } }
        );
      } catch (e) {
        logger.error('Error updating call log on reject', { error: e.message });
      }

      io.to(callerIdStr).emit('callRejected', {
        receiverId: userId,
        threadId: threadId,
      });
    });

    // Busy signal - recipient is already in a call
    socket.on('callBusy', ({ callerId, threadId }) => {
      const callerIdStr = callerId?.toString();
      io.to(callerIdStr).emit('callFailed', {
        recipientId: userId,
        threadId: threadId,
        reason: 'User is busy on another call',
      });
    });

    // End call - Either party ends the active call
    socket.on('endCall', async ({ recipientId, threadId }) => {
      const recipientIdStr = recipientId?.toString();

      // Clean up peer tracking
      await removeActiveCallPeer(userId);
      await removeActiveCallPeer(recipientIdStr);

      // Update call log with end time
      try {
        const callLog = await CallLog.findOne({
          $or: [
            { callerId: userId, receiverId: recipientIdStr },
            { callerId: recipientIdStr, receiverId: userId },
          ],
          status: { $in: ['initiated', 'ringing', 'answered'] },
        }).sort({ createdAt: -1 });
        if (callLog) {
          callLog.status = 'ended';
          callLog.endedAt = new Date();
          callLog.endReason = 'normal';
          if (callLog.startedAt) {
            callLog.duration = Math.floor((callLog.endedAt - callLog.startedAt) / 1000);
          }
          await callLog.save();
        }
      } catch (e) {
        logger.error('Error updating call log on end', { error: e.message });
      }

      io.to(recipientIdStr).emit('callEnded', {
        userId: userId,
        threadId: threadId,
        endedAt: new Date(),
      });
    });

    // WebRTC signaling (SDP Offer/Answer/ICE)
    // Uses cached user info to avoid DB queries on every signal

    // WebRTC offer - Send WebRTC offer for peer connection
    socket.on('offer', async ({ recipientId, offer, callType }) => {
      // if (!checkRateLimit(userId, 'offer', 5, 3000)) return; // Rate limit disabled
      const userInfo = await getCachedUserInfo(socket.userId);
      io.to(recipientId).emit('offer', {
        callerId: socket.userId,
        offer: offer,
        callType: callType,
        callerInfo: userInfo
          ? {
              userId: socket.userId,
              userName: userInfo.name,
              userAvatar: userInfo.avatar,
            }
          : { userId: socket.userId, userName: 'Unknown', userAvatar: '' },
      });
    });

    // WebRTC answer - Send WebRTC answer back to caller
    socket.on('answer', async ({ recipientId, answer, callType }) => {
      // if (!checkRateLimit(userId, 'answer', 5, 3000)) return; // Rate limit disabled
      const userInfo = await getCachedUserInfo(socket.userId);
      io.to(recipientId).emit('answer', {
        recipientId: socket.userId,
        answer: answer,
        callType: callType,
        answererInfo: userInfo
          ? {
              userId: socket.userId,
              userName: userInfo.name,
              userAvatar: userInfo.avatar,
            }
          : { userId: socket.userId, userName: 'Unknown', userAvatar: '' },
      });
    });

    // ICE candidate exchange for WebRTC connection
    socket.on('iceCandidate', ({ recipientId, candidate, callType }) => {
      // if (!checkRateLimit(userId, 'iceCandidate', 50, 5000)) return; // Rate limit disabled
      io.to(recipientId).emit('iceCandidate', {
        senderId: socket.userId,
        candidate: candidate,
        callType: callType,
      });
    });

    // User disconnect (tab close, internet loss, logout, etc.)
    socket.on('disconnect', async (reason) => {
      // Check if user has other active sockets (multiple tabs/devices)
      const userSockets = await io.in(userId).allSockets();

      if (userSockets.size > 0) {
        return;
      }

      // ── Call cleanup on disconnect ──
      // 1:1 call cleanup — notify the other party
      const peerId = await getActiveCallPeer(userId);
      if (peerId) {
        await removeActiveCallPeer(userId);
        // Also clean the reverse mapping if it points back to us
        const reversePeer = await getActiveCallPeer(peerId);
        if (reversePeer === userId) {
          await removeActiveCallPeer(peerId);
        }
        io.to(peerId).emit('callEnded', {
          userId: userId,
          reason: 'User disconnected',
          endedAt: new Date(),
        });
      }

      // Group call cleanup — remove from any active group calls (Redis + local)
      try {
        const userGroups = await getUserGroupCalls(userId);
        for (const groupId of userGroups) {
          await removeGroupCallParticipant(groupId, userId);

          // Update GroupCall MongoDB record
          try {
            const gcRecord = await GroupCall.findOne({
              groupId,
              status: { $in: ['initiating', 'ringing', 'ongoing'] },
            });
            if (gcRecord) {
              const participant = gcRecord.participants.find(
                (p) => p.user.toString() === userId && p.status === 'joined'
              );
              if (participant) {
                participant.status = 'left';
                participant.leftAt = new Date();
                if (participant.joinedAt) {
                  participant.duration = Math.floor(
                    (Date.now() - participant.joinedAt.getTime()) / 1000
                  );
                }
              }
              const remaining = await getGroupCallSize(groupId);
              if (remaining === 0) {
                gcRecord.status = 'ended';
                gcRecord.endedAt = new Date();
                gcRecord.endReason = 'completed';
                if (gcRecord.startedAt) {
                  gcRecord.duration = Math.floor(
                    (Date.now() - gcRecord.startedAt.getTime()) / 1000
                  );
                }
              }
              await gcRecord.save();
            }
          } catch (dbErr) {
            logger.error('Error updating GroupCall on disconnect', { error: dbErr.message });
          }

          io.to(`group-call:${groupId}`).emit('groupCallParticipantLeft', { userId });
        }
      } catch (e) {
        logger.error('Error cleaning up group calls on disconnect', { error: e.message });
      }

      // Use grace period to handle brief disconnections (network hiccup, page refresh)

      const timeoutId = setTimeout(async () => {
        // Double-check user hasn't reconnected during grace period
        const currentSockets = await io.in(userId).allSockets();
        if (currentSockets.size > 0) {
          disconnectTimeouts.delete(userId);
          return;
        }

        // Remove user from online map (Redis + local)
        await removeOnlineUser(userId);

        // Broadcast to all users that this user is offline
        io.emit('userOffline', {
          userId: userId.toString(),
        });

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

// Check if a user is online (cluster-safe)
export const isUserOnline = async (userId) => {
  if (redisClient && redisClient.isOpen) {
    try {
      const exists = await redisClient.exists(`online:${userId}`);
      return exists === 1;
    } catch (error) {
      logger.error('Error checking online status from Redis', { error: error.message });
    }
  }
  // Fallback to local Map if Redis is not available
  return onlineUsers.has(userId.toString());
};

// Get all online users (cluster-safe) — uses SCAN instead of blocking KEYS
export const getOnlineUsers = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      const users = [];
      let cursor = 0;
      do {
        const result = await redisClient.scan(cursor, { MATCH: 'online:*', COUNT: 200 });
        cursor = result.cursor;
        for (const key of result.keys) {
          users.push(key.replace('online:', ''));
        }
      } while (cursor !== 0);
      return users;
    } catch (error) {
      logger.error('Error getting online users from Redis', { error: error.message });
    }
  }
  // Fallback to local Map if Redis is not available
  return Array.from(onlineUsers.keys());
};

// Get online users count (cluster-safe) — uses SCAN instead of blocking KEYS
export const getOnlineUsersCount = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      let count = 0;
      let cursor = 0;
      do {
        const result = await redisClient.scan(cursor, { MATCH: 'online:*', COUNT: 200 });
        cursor = result.cursor;
        count += result.keys.length;
      } while (cursor !== 0);
      return count;
    } catch (error) {
      logger.error('Error getting online users count from Redis', { error: error.message });
    }
  }
  // Fallback to local Map if Redis is not available
  return onlineUsers.size;
};

// Add user to online list (cluster-safe)
async function addOnlineUser(userId, socketId) {
  const userIdStr = userId.toString();
  // Add to local Map
  onlineUsers.set(userIdStr, socketId);

  // Add to Redis for cross-worker tracking
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.set(`online:${userId}`, socketId, {
        EX: 3600, // Expire after 1 hour (safety cleanup)
      });
    } catch (error) {
      logger.error('Error adding online user to Redis', { error: error.message });
    }
  }
}

// Remove user from online list (cluster-safe)
async function removeOnlineUser(userId) {
  // Remove from local Map
  onlineUsers.delete(userId.toString());

  // Remove from Redis
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.del(`online:${userId}`);
    } catch (error) {
      logger.error('Error removing online user from Redis', { error: error.message });
    }
  }
}

// Cleanup Redis connections on shutdown
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
    logger.error('Error cleaning up Redis connections', { error: error.message });
  }
};

export default {
  initializeSocket,
  getIO,
  isUserOnline,
  getOnlineUsers,
  getOnlineUsersCount,
};
