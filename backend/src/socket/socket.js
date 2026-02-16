import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import { CallLog } from '../models/callLog.model.js';
import { ChatMessage } from '../models/chatMessage.model.js';
import { ChatThread } from '../models/chatThread.model.js';
import { GroupCall } from '../models/groupCall.model.js';
import { GroupChat } from '../models/groupChat.model.js';
import { User } from '../models/user.model.js';
import { encryptMessage } from '../utils/encryption.js';
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

// Grace period before marking user offline (10 seconds — mobile reconnects can take a few seconds)
const DISCONNECT_GRACE_PERIOD = 10000;

// ── Call ringing timeouts ──
// If recipient doesn't answer/reject within this period, auto-fail the call
const callRingingTimeouts = new Map(); // `${callerId}:${recipientId}` -> timeoutId
const CALL_RINGING_TIMEOUT = 30000; // 30 seconds

function setCallRingingTimeout(callerId, recipientId, io, socket) {
  const key = `${callerId}:${recipientId}`;
  // Clear any existing timeout for this call
  if (callRingingTimeouts.has(key)) {
    clearTimeout(callRingingTimeouts.get(key));
  }
  const timeoutId = setTimeout(async () => {
    callRingingTimeouts.delete(key);

    // ── Guard 1: Check Redis accepted flag ──
    // acceptCall on ANY worker sets this key. In cluster mode the local
    // clearCallRingingTimeout() only clears the timeout on the same worker,
    // so this Redis check is the primary cross-worker safety net.
    if (redisClient?.isOpen) {
      try {
        const accepted = await redisClient.exists(`call_accepted:${callerId}:${recipientId}`);
        if (accepted) {
          logger.info(`[Call] Ringing timeout skipped (Redis flag): ${callerId} -> ${recipientId}`);
          await redisClient.del(`call_accepted:${callerId}:${recipientId}`);
          return;
        }
      } catch (e) {
        logger.warn(`[Call] Redis check failed in ringing timeout: ${e.message}`);
      }
    }

    // ── Guard 2: Check call log in DB ──
    // If the call was already answered (status='answered'), the timeout must
    // NOT kill it.  This covers the case where Redis is unavailable or the
    // accepted flag was missed.
    try {
      const answeredLog = await CallLog.findOne({
        callerId,
        receiverId: recipientId,
        status: 'answered',
      }).sort({ createdAt: -1 }).lean();

      if (answeredLog) {
        logger.info(`[Call] Ringing timeout skipped (DB answered): ${callerId} -> ${recipientId}`);
        return;
      }
    } catch (e) {
      logger.warn(`[Call] DB check failed in ringing timeout: ${e.message}`);
    }

    // Neither Redis nor DB indicate the call was accepted — safe to fail
    const currentPeer = await getActiveCallPeer(callerId);
    if (currentPeer === recipientId) {
      await removeActiveCallPeer(callerId);
      await removeActiveCallPeer(recipientId);
      // Use io.to() instead of socket.emit() — the caller's socket may have
      // reconnected on a different worker since the timeout was set
      io.to(callerId).emit('callFailed', { recipientId, reason: 'No answer' });
      // Notify recipient to stop ringing
      io.to(recipientId).emit('callEnded', {
        userId: callerId,
        threadId: `${callerId}:${recipientId}`,
        reason: 'No answer - timeout',
        endedAt: new Date(),
      });
      logger.info(`[Call] Ringing timeout: ${callerId} -> ${recipientId} (no answer after ${CALL_RINGING_TIMEOUT / 1000}s)`);
    }
  }, CALL_RINGING_TIMEOUT);
  callRingingTimeouts.set(key, timeoutId);
}

function clearCallRingingTimeout(callerId, recipientId) {
  const key = `${callerId}:${recipientId}`;
  if (callRingingTimeouts.has(key)) {
    clearTimeout(callRingingTimeouts.get(key));
    callRingingTimeouts.delete(key);
  }
  // Also check reverse key
  const reverseKey = `${recipientId}:${callerId}`;
  if (callRingingTimeouts.has(reverseKey)) {
    clearTimeout(callRingingTimeouts.get(reverseKey));
    callRingingTimeouts.delete(reverseKey);
  }
}

// ── User info cache (avoids DB queries on hot signaling paths) ──
const userInfoCache = new Map(); // userId -> { name, avatar, cachedAt }
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const USER_CACHE_MAX_SIZE = 5000; // Prevent unbounded growth

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
    // Evict oldest entries if cache exceeds max size
    if (userInfoCache.size >= USER_CACHE_MAX_SIZE) {
      const firstKey = userInfoCache.keys().next().value;
      userInfoCache.delete(firstKey);
    }
    userInfoCache.set(userId, info);
    return info;
  } catch (e) {
    return null;
  }
}

// ── Simple rate limiter for socket events ──
const rateLimitMap = new Map(); // `${userId}:${event}` -> { count, windowStart }

function checkRateLimit(userId, event, maxPerWindow = 10, windowMs = 5000) {
  const key = `${userId}:${event}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  if (entry.count > maxPerWindow) return false;
  return true;
}

// Cleanup stale rate limit entries every 30s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > 30000) rateLimitMap.delete(key);
  }
  // Also evict expired userInfoCache entries proactively
  for (const [key, entry] of userInfoCache.entries()) {
    if (now - entry.cachedAt > USER_CACHE_TTL) userInfoCache.delete(key);
  }
}, 30000);

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
      // Short TTL during ringing — refreshed to longer TTL when call is accepted
      await redisClient.set(`callpeer:${userId}`, peerId, { EX: 120 });
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
    // Create Redis clients for pub/sub (adapter)
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
    logger.info('Socket.IO Redis adapter: pub/sub clients connected');

    // Attach Redis adapter to Socket.IO
    io.adapter(createAdapter(redisPubClient, redisSubClient));
    logger.info('Socket.IO Redis adapter attached successfully');

    // Also create a regular Redis client for storing online users
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => logger.error('Redis Client Error', { error: err.message }));
    await redisClient.connect();
    logger.info('Redis data client connected for online user tracking');

    // ── Flush stale online/call keys from previous server lifecycle ──
    // When the backend restarts (deploy, crash, etc.), old socket IDs remain
    // in Redis online:* SETs making every user appear online permanently.
    // Flush them so only actually-connected sockets are tracked.
    try {
      let flushed = 0;
      // Collect keys first, then batch-delete via pipeline (was individual del per key)
      let keysToFlush = [];
      let cursor = '0';
      do {
        const result = await redisClient.scan(cursor, { MATCH: 'online:*', COUNT: 200 });
        cursor = String(result.cursor);
        keysToFlush.push(...result.keys);
      } while (cursor !== '0');
      cursor = '0';
      do {
        const result = await redisClient.scan(cursor, { MATCH: 'callpeer:*', COUNT: 200 });
        cursor = String(result.cursor);
        keysToFlush.push(...result.keys);
      } while (cursor !== '0');
      if (keysToFlush.length > 0) {
        // Delete in batches of 200 to avoid oversized pipelines
        for (let i = 0; i < keysToFlush.length; i += 200) {
          const batch = keysToFlush.slice(i, i + 200);
          const pipeline = redisClient.multi();
          for (const key of batch) {
            pipeline.del(key);
          }
          await pipeline.exec();
        }
        flushed = keysToFlush.length;
      }
      if (flushed > 0) {
        logger.info(`[Redis] Flushed ${flushed} stale keys from previous lifecycle`);
      }
    } catch (e) {
      logger.warn(`[Redis] Failed to flush stale keys: ${e.message}`);
    }
  } catch (error) {
    logger.error('Failed to initialize Redis adapter', { error: error.message });
    logger.warn('Socket.IO will work but only within this worker process');
  }
}

export const initializeSocket = async (server) => {
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : '*';

  io = new Server(server, {
    cors: {
      origin: corsOrigin,
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

    logger.info(`[Socket] User connected: ${userId}, socketId: ${socket.id}, transport: ${socket.conn?.transport?.name || 'unknown'}`);

    // Cancel any pending disconnect timeout for this user (they reconnected!)
    if (disconnectTimeouts.has(userId)) {
      clearTimeout(disconnectTimeouts.get(userId));
      disconnectTimeouts.delete(userId);
      logger.info(`[Socket] Cancelled pending disconnect timeout for user: ${userId}`);
    }

    // Add user to online map (Redis + local)
    await addOnlineUser(userId, socket.id);

    // Join user's personal room (ensure string format for consistency)
    socket.join(userId);
    logger.info(`[Socket] User ${userId} joined personal room`);

    // Broadcast to all users that this user is online
    io.emit('userOnline', {
      userId: userId,
      socketId: socket.id,
    });

    // Send current online users list to the newly connected user (cluster-safe)
    // Uses validated list that cross-checks Redis with actual socket connections
    const onlineList = await getValidatedOnlineUsers();
    socket.emit('onlineUsersList', {
      users: onlineList,
    });

    // Get online users request (cluster-safe)
    socket.on('getOnlineUsers', async () => {
      const onlineUsersList = await getValidatedOnlineUsers();
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
      if (!checkRateLimit(userId, 'typing', 5, 3000)) return;
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
        // Rate limit: max 10 messages per 5 seconds
        if (!checkRateLimit(userId, 'sendMessage', 10, 5000)) {
          socket.emit('messageError', { error: 'Rate limit exceeded. Please slow down.' });
          return;
        }

        // Validate required fields
        if (!messageData.threadId || !messageData.receiverId) {
          socket.emit('messageError', { error: 'Missing threadId or receiverId' });
          return;
        }

        if (!messageData.content || typeof messageData.content !== 'string' || !messageData.content.trim()) {
          socket.emit('messageError', { error: 'Message content is required' });
          return;
        }

        // Truncate extremely long messages
        const content = messageData.content.slice(0, 5000);

        // Validate sender is a participant of the thread
        const thread = await ChatThread.findOne({
          _id: messageData.threadId,
          participants: socket.userId,
          isDeleted: false,
        });

        if (!thread) {
          socket.emit('messageError', { error: 'Thread not found or access denied' });
          return;
        }

        if (thread.isBlocked) {
          socket.emit('messageError', { error: 'Conversation is blocked' });
          return;
        }

        // Validate receiverId is actually a participant in the thread
        const validReceiverId = thread.participants.find(
          (p) => p.toString() !== socket.userId.toString()
        );
        if (!validReceiverId || validReceiverId.toString() !== messageData.receiverId.toString()) {
          socket.emit('messageError', { error: 'Invalid receiver for this thread' });
          return;
        }

        const receiverIdStr = validReceiverId.toString();

        // Use module-level encryptMessage (no dynamic import needed)
        // Persist message to database
        const newMessage = await ChatMessage.create({
          threadId: messageData.threadId,
          senderId: socket.userId,
          receiverId: receiverIdStr,
          messageType: 'text',
          encryptedContent: encryptMessage(content),
          status: 'sent',
          replyTo: messageData.replyTo || null,
        });

        // Update thread atomically — use $inc to avoid race conditions
        await ChatThread.findOneAndUpdate(
          { _id: messageData.threadId },
          {
            $set: { lastMessage: newMessage._id, lastMessageAt: new Date() },
            $inc: { [`unreadCount.${receiverIdStr}`]: 1 },
          }
        );

        // Use cached sender info to avoid DB query on hot path
        const senderInfo = await getCachedUserInfo(socket.userId.toString());

        // Format message to match frontend expectations
        const formattedMessage = {
          threadId: messageData.threadId,
          message: {
            _id: newMessage._id,
            text: content,
            senderId: {
              _id: socket.userId,
              firstName: senderInfo?.name?.split(' ')[0] || 'Unknown',
              lastName: senderInfo?.name?.split(' ').slice(1).join(' ') || '',
              username: senderInfo?.name || 'Unknown',
              profilePicture: senderInfo?.avatar || '',
              avatar: senderInfo?.avatar || '',
            },
            createdAt: newMessage.createdAt,
            status: 'sent',
            media: [],
          },
        };

        // Emit only to receiver's personal room (no thread room to avoid duplication)
        io.to(receiverIdStr).emit('newMessage', formattedMessage);

        // Confirm to sender
        socket.emit('messageSent', {
          messageId: newMessage._id,
          tempId: messageData.tempId, // So client can replace optimistic message
          status: 'sent',
          timestamp: newMessage.createdAt,
        });
      } catch (error) {
        logger.error('Error sending message via socket', { error: error.message });
        socket.emit('messageError', {
          error: 'Failed to send message',
          details: error.message,
        });
      }
    });

    // Message delivery acknowledgment — batched for efficiency
    socket.on('messageDelivered', async ({ messageId }) => {
      try {
        // Use findOneAndUpdate for an atomic single-query update instead of
        // find + mutate + save (which is 2 round trips)
        const message = await ChatMessage.findOneAndUpdate(
          {
            _id: messageId,
            receiverId: socket.userId,
            status: { $in: ['sent'] }, // Only update if not already delivered/seen
          },
          {
            $set: { status: 'delivered', deliveredAt: new Date() },
          },
          { new: true, projection: { senderId: 1 } }
        );

        if (message) {
          // Notify sender
          io.to(message.senderId.toString()).emit('messageStatus', {
            messageId,
            status: 'delivered',
            deliveredAt: new Date(),
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

        logger.info(`[Call] initiateCall: caller=${userId}, recipient=${recipientIdStr}, callType=${callType}, threadId=${threadId}`);

        // Server-side busy check: reject if CALLER is already in a call
        if (!global.activeCallPeers) global.activeCallPeers = new Map();
        const existingPeer = await getActiveCallPeer(userId);
        if (existingPeer) {
          // If the existing call peer is the SAME recipient, the caller is retrying
          // — clean up the stale call and allow the new attempt
          if (existingPeer === recipientIdStr) {
            logger.info(`[Call] Retrying call to same recipient ${recipientIdStr} — cleaning stale callpeer`);
            clearCallRingingTimeout(userId, recipientIdStr);
            await removeActiveCallPeer(userId);
            await removeActiveCallPeer(recipientIdStr);
          } else {
            // Verify the existing peer is actually connected (not a stale key)
            // Use Redis SET instead of allSockets() for cross-worker reliability
            let peerConnected = false;
            if (redisClient?.isOpen) {
              const peerCount = await redisClient.sCard(`online:${existingPeer}`);
              peerConnected = peerCount > 0;
            } else {
              peerConnected = onlineUsers.has(existingPeer);
            }
            if (!peerConnected) {
              logger.warn(`[Call] Cleaning stale callpeer for caller ${userId} (peer ${existingPeer} is offline)`);
              clearCallRingingTimeout(userId, existingPeer);
              await removeActiveCallPeer(userId);
              await removeActiveCallPeer(existingPeer);
            } else {
              logger.info(`[Call] BLOCKED: caller ${userId} already in a call with ${existingPeer}`);
              socket.emit('callFailed', {
                recipientId: recipientIdStr,
                reason: 'You are already in a call',
              });
              return;
            }
          }
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

        // Check if recipient is connected — trust Redis SET as the source of truth.
        // In cluster mode, io.in().allSockets() is unreliable across workers,
        // so we rely on Redis which is properly maintained by connect/disconnect handlers.
        let isRecipientOnline = false;
        if (redisClient?.isOpen) {
          const count = await redisClient.sCard(`online:${recipientIdStr}`);
          isRecipientOnline = count > 0;
        } else {
          isRecipientOnline = onlineUsers.has(recipientIdStr);
        }

        logger.info(`[Call] Recipient ${recipientIdStr} status: redisOnline=${isRecipientOnline}`);

        if (!isRecipientOnline) {
          logger.info(`[Call] FAILED: recipient ${recipientIdStr} is offline`);
          socket.emit('callFailed', { recipientId: recipientIdStr, reason: 'User is offline' });
          return;
        }

        // Server-side busy check: if recipient is already in a 1:1 call
        if (await isInActiveCall(recipientIdStr)) {
          // Verify the supposed peer is actually connected — use Redis SET instead
          // of allSockets() which is unreliable across cluster workers
          const supposedPeer = await getActiveCallPeer(recipientIdStr);
          let peerActuallyConnected = false;
          if (supposedPeer) {
            if (redisClient?.isOpen) {
              const peerCount = await redisClient.sCard(`online:${supposedPeer}`);
              peerActuallyConnected = peerCount > 0;
            } else {
              peerActuallyConnected = onlineUsers.has(supposedPeer);
            }
          }

          if (peerActuallyConnected) {
            logger.info(`[Call] FAILED: recipient ${recipientIdStr} is busy (peer ${supposedPeer} has active sockets)`);
            socket.emit('callFailed', {
              recipientId: recipientIdStr,
              reason: 'User is busy on another call',
            });
            return;
          } else {
            // Stale entry — clean it up and proceed
            logger.warn(`[Call] Cleaning stale callpeer for ${recipientIdStr} (peer ${supposedPeer} has 0 sockets)`);
            await removeActiveCallPeer(recipientIdStr);
            if (supposedPeer) await removeActiveCallPeer(supposedPeer);
          }
        }

        // Track active 1:1 call peer (for disconnect cleanup)
        await setActiveCallPeer(userId, recipientIdStr);
        logger.info(`[Call] Set active call peer: ${userId} <-> ${recipientIdStr}`);

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

        logger.info(`[Call] Emitting incomingCall to ${recipientIdStr} from ${userId} (${callerName}), callType: ${callType}`);

        io.to(recipientIdStr).emit('incomingCall', {
          callerId: userId,
          threadId: threadId,
          callType: callType,
          callerInfo: {
            avatar: caller?.profilePicture || caller?.avatar || '',
            name: callerName,
          },
          timestamp: new Date(),
          name: callerName,
        });

        logger.info(`[Call] incomingCall emitted successfully to ${recipientIdStr}`);

        // Start ringing timeout — auto-fail if recipient doesn't answer within 30s
        setCallRingingTimeout(userId, recipientIdStr, io, socket);
      } catch (error) {
        logger.error('[Call] Error initiating call', { error: error.message, stack: error.stack });
        // Clean up callpeer keys set earlier in this handler
        await removeActiveCallPeer(userId).catch(() => {});
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

        // Batch-check online status for all members in one pipeline (was N queries)
        let memberOnlineMap = new Map();
        if (redisClient?.isOpen) {
          const pipeline = redisClient.multi();
          for (const memberId of memberIds) {
            pipeline.sCard(`online:${memberId}`);
          }
          try {
            const results = await pipeline.exec();
            for (let i = 0; i < memberIds.length; i++) {
              memberOnlineMap.set(memberIds[i], results[i] > 0);
            }
          } catch {
            // Fallback to local map on pipeline failure
            for (const memberId of memberIds) {
              memberOnlineMap.set(memberId, onlineUsers.has(memberId));
            }
          }
        } else {
          for (const memberId of memberIds) {
            memberOnlineMap.set(memberId, onlineUsers.has(memberId));
          }
        }

        for (const memberId of memberIds) {
          if (!memberOnlineMap.get(memberId)) continue;

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
              avatar: callerUser?.profilePicture || callerUser?.avatar || '',
              name: callerName,
            },
            timestamp: new Date(),
            name: `${callerName} (${group.name})`,
          });
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

      logger.info(`[Call] acceptCall: ${userId} accepted call from ${callerIdStr}, threadId: ${threadId}`);

      // Cancel ringing timeout
      clearCallRingingTimeout(callerIdStr, userId);

      // Track the reverse peer mapping
      await setActiveCallPeer(userId, callerIdStr);

      // Extend TTL for both peers now that call is connected (1 hour)
      if (redisClient?.isOpen) {
        await redisClient.expire(`callpeer:${callerIdStr}`, 3600).catch(() => {});
        await redisClient.expire(`callpeer:${userId}`, 3600).catch(() => {});
      }

      // Mark call as accepted in Redis — so ringing timeout on other workers
      // can detect that the call was already accepted and skip cleanup
      if (redisClient?.isOpen) {
        try {
          await redisClient.set(`call_accepted:${callerIdStr}:${userId}`, '1', { EX: 60 });
        } catch (e) {
          // Non-critical — timeout will still check callpeer
        }
      }

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

      logger.info(`[Call] rejectCall: ${userId} rejected call from ${callerIdStr}, threadId: ${threadId}`);

      // Cancel ringing timeout
      clearCallRingingTimeout(callerIdStr, userId);

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
    socket.on('callBusy', async ({ callerId, threadId }) => {
      const callerIdStr = callerId?.toString();
      // Clean up callpeer keys since the call can't proceed
      await removeActiveCallPeer(callerIdStr).catch(() => {});
      await removeActiveCallPeer(userId).catch(() => {});
      io.to(callerIdStr).emit('callFailed', {
        recipientId: userId,
        threadId: threadId,
        reason: 'User is busy on another call',
      });
    });

    // End call - Either party ends the active call
    socket.on('endCall', async ({ recipientId, threadId }) => {
      const recipientIdStr = recipientId?.toString();

      logger.info(`[Call] endCall: ${userId} -> ${recipientIdStr}, threadId: ${threadId}`);

      // Cancel ringing timeout in both directions (caller or recipient may end the call)
      clearCallRingingTimeout(userId, recipientIdStr);
      clearCallRingingTimeout(recipientIdStr, userId);

      // Clean up call_accepted flag
      if (redisClient?.isOpen) {
        await redisClient.del(`call_accepted:${userId}:${recipientIdStr}`).catch(() => {});
        await redisClient.del(`call_accepted:${recipientIdStr}:${userId}`).catch(() => {});
      }

      // Clean up peer tracking
      await removeActiveCallPeer(userId);
      await removeActiveCallPeer(recipientIdStr);

      // Update call log with end time — atomic findOneAndUpdate (was find+save race)
      try {
        const now = new Date();
        await CallLog.findOneAndUpdate(
          {
            $or: [
              { callerId: userId, receiverId: recipientIdStr },
              { callerId: recipientIdStr, receiverId: userId },
            ],
            status: { $in: ['initiated', 'ringing', 'answered'] },
          },
          [
            {
              $set: {
                status: 'ended',
                endedAt: now,
                endReason: 'normal',
                duration: {
                  $cond: {
                    if: { $ne: ['$startedAt', null] },
                    then: { $floor: { $divide: [{ $subtract: [now, '$startedAt'] }, 1000] } },
                    else: 0,
                  },
                },
              },
            },
          ],
          { sort: { createdAt: -1 } }
        );
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
      logger.info(`[Call] Offer: ${userId} -> ${recipientId}, callType: ${callType}`);
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
      logger.info(`[Call] Answer: ${userId} -> ${recipientId}, callType: ${callType}`);
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
      logger.info(`[Call] ICE candidate: ${userId} -> ${recipientId}`);
      io.to(recipientId).emit('iceCandidate', {
        senderId: socket.userId,
        candidate: candidate,
        callType: callType,
      });
    });

    // User disconnect (tab close, internet loss, logout, etc.)
    socket.on('disconnect', async (reason) => {
      logger.info(`[Socket] User disconnected: ${userId}, reason: ${reason}, socketId: ${socket.id}`);

      // Remove THIS specific socket from the user's Redis SET
      const remainingSockets = await removeOnlineSocket(userId, socket.id);
      logger.info(`[Socket] User ${userId} remaining sockets (Redis): ${remainingSockets}`);

      if (remainingSockets > 0) {
        // User has other active sockets across workers — don't clean up anything
        return;
      }

      // No sockets remaining. Use grace period to handle brief disconnections
      // (network hiccup, page refresh, mobile reconnect). ALL cleanup (call +
      // offline status) is deferred so the user can reconnect within the window.

      // Cancel any previous pending timeout (idempotent if none exists)
      if (disconnectTimeouts.has(userId)) {
        clearTimeout(disconnectTimeouts.get(userId));
      }

      const timeoutId = setTimeout(async () => {
        disconnectTimeouts.delete(userId);

        // Double-check user hasn't reconnected during grace period (Redis is authoritative)
        let reconnected = false;
        if (redisClient?.isOpen) {
          const count = await redisClient.sCard(`online:${userId}`);
          reconnected = count > 0;
        }
        if (reconnected) {
          logger.info(`[Socket] User ${userId} reconnected during grace period — skipping cleanup`);
          return;
        }

        logger.info(`[Socket] Grace period expired for ${userId} — running full cleanup`);

        // ── 1:1 call cleanup ──
        const peerId = await getActiveCallPeer(userId);
        if (peerId) {
          clearCallRingingTimeout(userId, peerId);
          await removeActiveCallPeer(userId);
          const reversePeer = await getActiveCallPeer(peerId);
          if (reversePeer === userId) {
            await removeActiveCallPeer(peerId);
          }
          io.to(peerId).emit('callEnded', {
            userId: userId,
            reason: 'User disconnected',
            endedAt: new Date(),
          });
          logger.info(`[Socket] Call cleanup: notified peer ${peerId} that ${userId} disconnected`);
        }

        // ── Group call cleanup ──
        try {
          const userGroups = await getUserGroupCalls(userId);
          for (const groupId of userGroups) {
            await removeGroupCallParticipant(groupId, userId);

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

        // ── Offline status ──
        await removeOnlineUser(userId);
        io.emit('userOffline', {
          userId: userId.toString(),
        });
      }, DISCONNECT_GRACE_PERIOD);

      disconnectTimeouts.set(userId, timeoutId);
    });
  });

  // ── Periodic stale-entry cleanup (every 60s) ──
  // Each worker cleans up stale socket IDs that belong to it.
  // A socket ID is stale if it's in a Redis SET but no longer connected locally.
  // We only remove socket IDs we can confirm are NOT connected on THIS worker.
  // The 1-hour TTL on online:* keys is the final safety net for orphaned entries.
  setInterval(async () => {
    if (!redisClient?.isOpen) return;
    try {
      // Collect all socket IDs currently connected on THIS worker
      const localSocketIds = new Set();
      for (const [id] of io.sockets.sockets) {
        localSocketIds.add(id);
      }

      const users = await getOnlineUsers();
      let cleanedSockets = 0;
      let cleanedUsers = 0;
      for (const userId of users) {
        try {
          const socketIds = await redisClient.sMembers(`online:${userId}`);
          for (const socketId of socketIds) {
            // Only remove a socket ID if THIS worker's io.sockets knows about it
            // (or knew about it) AND it's no longer connected.
            // If the socket ID is unknown to this worker, it belongs to another
            // worker and we must NOT touch it.
            if (!localSocketIds.has(socketId) && onlineUsers.get(userId) !== socketId) {
              continue; // Not our socket — skip
            }
            // It's (or was) our socket and it's gone — remove from Redis SET
            if (!localSocketIds.has(socketId)) {
              await redisClient.sRem(`online:${userId}`, socketId).catch(() => {});
              cleanedSockets++;
            }
          }
          // If the SET is now empty, clean up the key entirely
          const remaining = await redisClient.sCard(`online:${userId}`);
          if (remaining === 0) {
            await redisClient.del(`online:${userId}`).catch(() => {});
            onlineUsers.delete(userId);
            cleanedUsers++;
            // Notify clients this user is offline
            io.emit('userOffline', { userId: userId.toString() });
          }
        } catch {
          // Skip this user on error
        }
      }
      if (cleanedSockets > 0 || cleanedUsers > 0) {
        logger.info(`[Cleanup] Removed ${cleanedSockets} stale socket IDs, ${cleanedUsers} fully offline users (worker pid:${process.pid})`);
      }
    } catch (e) {
      // Non-critical — will retry next interval
    }
  }, 60_000);

  // ── Heartbeat: refresh TTL for locally connected users (every 10 min) ──
  // Prevents the 1-hour safety TTL from expiring while users are still connected.
  setInterval(async () => {
    if (!redisClient?.isOpen) return;
    try {
      // Batch all expire calls in a pipeline (was individual await per socket)
      const pipeline = redisClient.multi();
      let count = 0;
      for (const [, socket] of io.sockets.sockets) {
        if (socket.userId) {
          pipeline.expire(`online:${socket.userId}`, 3600);
          count++;
        }
      }
      if (count > 0) await pipeline.exec();
    } catch {
      // Non-critical
    }
  }, 10 * 60_000);

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
      const count = await redisClient.sCard(`online:${userId}`);
      return count > 0;
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
      let cursor = '0';
      do {
        const result = await redisClient.scan(cursor, { MATCH: 'online:*', COUNT: 200 });
        cursor = String(result.cursor);
        for (const key of result.keys) {
          users.push(key.replace('online:', ''));
        }
      } while (cursor !== '0');
      return users;
    } catch (error) {
      logger.error('Error getting online users from Redis', { error: error.message });
    }
  }
  // Fallback to local Map if Redis is not available
  return Array.from(onlineUsers.keys());
};

/**
 * Get online users — trusts Redis SETs as the source of truth.
 * Socket IDs are added on connect and removed on disconnect, so the Redis
 * SETs accurately reflect who is online. The previous approach of cross-checking
 * with io.in(userId).allSockets() was unreliable in cluster mode and caused
 * false-offline issues by deleting valid Redis entries.
 */
async function getValidatedOnlineUsers() {
  if (!io) return getOnlineUsers();

  const rawUsers = await getOnlineUsers();
  if (!redisClient?.isOpen) return rawUsers;

  // Use Redis pipeline to batch all sCard calls in one round-trip (was N+1).
  const pipeline = redisClient.multi();
  for (const userId of rawUsers) {
    pipeline.sCard(`online:${userId}`);
  }

  let results;
  try {
    results = await pipeline.exec();
  } catch {
    return rawUsers; // Pipeline failed — return unfiltered
  }

  const validatedUsers = [];
  const keysToDelete = [];
  for (let i = 0; i < rawUsers.length; i++) {
    const count = results[i];
    if (count > 0) {
      validatedUsers.push(rawUsers[i]);
    } else {
      keysToDelete.push(rawUsers[i]);
      onlineUsers.delete(rawUsers[i]);
    }
  }

  // Batch-clean empty sets
  if (keysToDelete.length > 0) {
    const delPipeline = redisClient.multi();
    for (const userId of keysToDelete) {
      delPipeline.del(`online:${userId}`);
    }
    delPipeline.exec().catch(() => {});
  }

  return validatedUsers;
}

// Get online users count (cluster-safe) — uses SCAN instead of blocking KEYS
export const getOnlineUsersCount = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      let count = 0;
      let cursor = '0';
      do {
        const result = await redisClient.scan(cursor, { MATCH: 'online:*', COUNT: 200 });
        cursor = String(result.cursor);
        count += result.keys.length;
      } while (cursor !== '0');
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

  // Add to Redis SET for cross-worker tracking (supports multiple sockets per user)
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.sAdd(`online:${userId}`, socketId);
      await redisClient.expire(`online:${userId}`, 3600); // Expire after 1 hour (safety cleanup)
    } catch (error) {
      logger.error('Error adding online user to Redis', { error: error.message });
    }
  }
}

// Remove a specific socket from user's online set (cluster-safe)
async function removeOnlineSocket(userId, socketId) {
  // Note: local Map just stores last socketId, we always remove it
  // The definitive count is in Redis SET
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.sRem(`online:${userId}`, socketId);
      const remaining = await redisClient.sCard(`online:${userId}`);
      if (remaining === 0) {
        // No sockets left — remove from local map too
        onlineUsers.delete(userId.toString());
        return 0;
      }
      return remaining;
    } catch (error) {
      logger.error('Error removing online socket from Redis', { error: error.message });
    }
  }
  // Fallback: remove from local map
  onlineUsers.delete(userId.toString());
  return 0;
}

// Remove user from online list entirely (cluster-safe)
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
