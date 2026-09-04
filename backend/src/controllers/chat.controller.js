import { CallLog } from '../models/callLog.model.js';
import { ChatMessage } from '../models/chatMessage.model.js';
import { ChatThread } from '../models/chatThread.model.js';
import { GroupCall } from '../models/groupCall.model.js';
import { Post } from '../models/post.model.js';
import { Reel } from '../models/reel.model.js';
import { User } from '../models/user.model.js';
import { getIO } from '../socket/socket.js';
import { sendMessagePushNotification } from '../services/firebase.service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  decryptMessage,
  encryptMediaUrl,
  encryptMessage,
  generateSessionKey,
} from '../utils/encryption.js';
import { uploadFile } from '../utils/localStorage.js';
import logger from '../utils/logger.js';

// 1.5. Get all threads for current user (NEW)
export const getAllThreads = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit = 50, skip = 0, sortBy = 'lastMessageAt' } = req.query;

  // Find all threads where user is a participant
  const threads = await ChatThread.find({
    participants: userId,
    isDeleted: false,
  })
    .populate({
      path: 'participants',
      select: 'firstName lastName username profileImage profilePicture avatar isOnline',
      match: { _id: { $ne: userId } }, // Exclude current user
    })
    .populate({
      path: 'lastMessage',
      select: 'text encryptedContent media createdAt senderId isDeleted',
      populate: {
        path: 'senderId',
        select: 'firstName lastName username profileImage profilePicture avatar',
      },
    })
    .sort({ [sortBy]: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();

  // Transform threads to include participant info and decrypt last message
  const transformedThreads = threads.map((thread) => {
    const otherParticipant = thread.participants?.[0] || null;
    const lastMessage = thread.lastMessage;
    const userIdStr = userId.toString();

    // Decrypt last message if exists
    let lastMessageText = null;
    if (lastMessage && !lastMessage.isDeleted) {
      if (lastMessage.encryptedContent) {
        try {
          lastMessageText = decryptMessage(lastMessage.encryptedContent);
        } catch (error) {
          logger.error('Decryption error for last message:', { error: error.message });
          lastMessageText = '[Unable to decrypt]';
        }
      } else if (lastMessage.text) {
        lastMessageText = lastMessage.text;
      }
    }

    // Handle Map fields - with lean() they come as plain objects
    let unreadCount = 0;
    let isArchived = false;
    let isPinned = false;

    if (thread.unreadCount) {
      // If it's a Map object, use .get(), otherwise access as plain object
      unreadCount =
        typeof thread.unreadCount.get === 'function'
          ? thread.unreadCount.get(userIdStr) || 0
          : thread.unreadCount[userIdStr] || 0;
    }

    if (thread.isArchived) {
      isArchived =
        typeof thread.isArchived.get === 'function'
          ? thread.isArchived.get(userIdStr) || false
          : thread.isArchived[userIdStr] || false;
    }

    if (thread.isPinned) {
      isPinned =
        typeof thread.isPinned.get === 'function'
          ? thread.isPinned.get(userIdStr) || false
          : thread.isPinned[userIdStr] || false;
    }

    return {
      _id: thread._id,
      participant: otherParticipant,
      lastMessage: lastMessage
        ? {
          text: lastMessageText,
          media: lastMessage.media,
          createdAt: lastMessage.createdAt,
          senderId: lastMessage.senderId,
          isDeleted: lastMessage.isDeleted,
        }
        : null,
      lastMessageAt: thread.lastMessageAt,
      unreadCount,
      isArchived,
      isPinned,
      isBlocked: thread.isBlocked,
      blockedBy: thread.blockedBy,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  });

  // Use the threads array length + skip to avoid a second full query.
  // If we got fewer than `limit`, we know the exact total.
  const totalCount = threads.length < parseInt(limit)
    ? parseInt(skip) + threads.length
    : parseInt(skip) + parseInt(limit) + 1; // Signal there's at least one more

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        threads: transformedThreads,
        total: totalCount,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + parseInt(limit) < totalCount,
      },
      'Threads fetched successfully'
    )
  );
});

// 1. Create or fetch chat thread
export const createOrGetThread = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { receiverId } = req.params;

  if (!receiverId || receiverId === userId.toString()) {
    throw new ApiError(400, 'Invalid receiver ID');
  }

  // Check if receiver exists
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    throw new ApiError(404, 'Receiver not found');
  }

  // Find existing thread between these two users
  let thread = await ChatThread.findOne({
    participants: { $all: [userId, receiverId] },
    isDeleted: false,
  }).populate('participants', 'firstName lastName username profilePicture');

  const isNewThread = !thread;

  if (!thread) {
    // Create new thread
    thread = await ChatThread.create({
      participants: [userId, receiverId],
      unreadCount: {
        [userId]: 0,
        [receiverId]: 0,
      },
      isArchived: {
        [userId]: false,
        [receiverId]: false,
      },
      isPinned: {
        [userId]: false,
        [receiverId]: false,
      },
    });

    thread = await thread.populate('participants', 'firstName lastName username profilePicture');
  }

  // Emit socket event for new thread to both users
  if (isNewThread) {
    const io = getIO();
    if (io) {
      const threadData = {
        _id: thread._id,
        participant: thread.participants.find((p) => p._id.toString() !== userId.toString()),
        lastMessage: null,
        lastMessageAt: thread.lastMessageAt,
        unreadCount: 0,
        isArchived: false,
        isPinned: false,
        isBlocked: false,
      };

      // Notify the receiver about the new thread
      io.to(receiverId.toString()).emit('newThread', {
        thread: threadData,
        threadId: thread._id,
      });

      // Notify the sender (current user) about the new thread
      const senderThreadData = {
        _id: thread._id,
        participant: thread.participants.find((p) => p._id.toString() !== userId.toString()),
        lastMessage: null,
        lastMessageAt: thread.lastMessageAt,
        unreadCount: 0,
        isArchived: false,
        isPinned: false,
        isBlocked: false,
      };

      io.to(userId.toString()).emit('newThread', {
        thread: senderThreadData,
        threadId: thread._id,
      });
    }
  }

  return res.status(200).json(new ApiResponse(200, thread, 'Thread fetched successfully'));
});

// 2. Send message
export const sendMessage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { threadId } = req.params;
  const {
    text,
    media_ids = [],
    reply_to,
    messageType,
    sharedContent,
    isForwarded,
    location,
  } = req.body;

  // Validate thread
  const thread = await ChatThread.findOne({
    _id: threadId,
    participants: userId,
    isDeleted: false,
  });

  if (!thread) {
    throw new ApiError(404, 'Thread not found');
  }

  // Check if thread is blocked
  if (thread.isBlocked) {
    throw new ApiError(403, 'Cannot send message. Conversation is blocked.');
  }

  // Get receiver ID
  const receiverId = thread.participants.find((p) => p.toString() !== userId.toString());

  // Extract files early for validation
  const files = req.files || [];

  // Validate message content
  if (
    !text &&
    (!media_ids || media_ids.length === 0) &&
    files.length === 0 &&
    !sharedContent &&
    !location
  ) {
    throw new ApiError(400, 'Message must contain text, media, shared content, or location');
  }

  // Prepare message data
  const messageData = {
    threadId,
    senderId: userId,
    receiverId,
    messageType: messageType || 'text',
    replyTo: reply_to || null,
    status: 'sent',
    isForwarded: isForwarded || false,
  };

  // Encrypt message text if provided
  if (text) {
    messageData.encryptedContent = encryptMessage(text);
  }

  // Process media files
  if (files.length > 0) {
    const uploadPromises = files.map((file) => uploadFile(file.path));
    const uploadResults = await Promise.all(uploadPromises);

    // Map results to media objects, filtering out failed uploads
    messageData.media = files
      .map((file, index) => {
        const upload = uploadResults[index];
        if (!upload) return null;

        const fileType = file.mimetype.startsWith('image/')
          ? 'image'
          : file.mimetype.startsWith('video/')
            ? 'video'
            : file.mimetype.startsWith('audio/')
              ? 'audio'
              : 'file';

        return {
          type: fileType,
          url: upload.secure_url,
          filename: file.originalname,
          size: file.size,
          publicId: upload.public_id,
        };
      })
      .filter((item) => item !== null);

    if (messageData.media.length === 0) {
      throw new ApiError(500, 'Failed to upload files');
    }

    // Update message type if it was just "text"
    if (messageData.messageType === 'text' && messageData.media.length > 0) {
      messageData.messageType = messageData.media[0].type;
    }
  }

  // Handle shared content (posts/reels)
  if (messageType === 'shared_post' || messageType === 'shared_reel') {
    if (!sharedContent || !sharedContent.contentId) {
      throw new ApiError(400, 'Content ID required for shared content');
    }

    // Fetch and cache the content data
    let contentData;
    if (messageType === 'shared_post') {
      const post = await Post.findById(sharedContent.contentId)
        .populate('user_id', 'firstName lastName username profilePicture profileImage avatar')
        .lean();

      if (!post || post.is_deleted) {
        throw new ApiError(404, 'Post not found or has been deleted');
      }

      contentData = {
        _id: post._id,
        caption: post.caption,
        media: post.media,
        user: {
          _id: post.user_id._id,
          firstName: post.user_id.firstName,
          lastName: post.user_id.lastName,
          username: post.user_id.username,
          profilePicture:
            post.user_id.profilePicture || post.user_id.profileImage || post.user_id.avatar,
        },
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || 0,
        createdAt: post.createdAt,
      };
    } else {
      const reel = await Reel.findById(sharedContent.contentId)
        .populate('user_id', 'firstName lastName username profilePicture profileImage avatar')
        .lean();

      if (!reel || reel.is_deleted) {
        throw new ApiError(404, 'Reel not found or has been deleted');
      }

      contentData = {
        _id: reel._id,
        caption: reel.caption,
        media: reel.media,
        user: {
          _id: reel.user_id._id,
          firstName: reel.user_id.firstName,
          lastName: reel.user_id.lastName,
          username: reel.user_id.username,
          profilePicture:
            reel.user_id.profilePicture || reel.user_id.profileImage || reel.user_id.avatar,
        },
        likes_count: reel.likes_count || 0,
        comments_count: reel.comments_count || 0,
        createdAt: reel.createdAt,
      };
    }

    messageData.sharedContent = {
      contentType: messageType === 'shared_post' ? 'post' : 'reel',
      contentId: sharedContent.contentId,
      contentData: contentData,
    };

    // Set default text if not provided
    if (!text) {
      const defaultText = `Shared a ${messageType === 'shared_post' ? 'post' : 'reel'}`;
      messageData.encryptedContent = encryptMessage(defaultText);
    }
  }

  // Handle location messages
  if (messageType === 'location' && location) {
    if (!location.latitude || !location.longitude) {
      throw new ApiError(400, 'Location requires latitude and longitude');
    }

    messageData.location = {
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address || '',
      name: location.name || '',
      isLiveLocation: location.isLiveLocation || false,
      expiresAt: location.isLiveLocation
        ? new Date(Date.now() + (location.duration || 15) * 60 * 1000)
        : null,
    };

    // Set default text for location
    if (!text) {
      const defaultText = location.isLiveLocation ? '📍 Live Location' : '📍 Location';
      messageData.encryptedContent = encryptMessage(defaultText);
    }
  }

  // Create message
  const message = await ChatMessage.create(messageData);

  // Populate sender and reply info
  await message.populate('senderId', 'firstName lastName username profilePicture');
  if (reply_to) {
    await message.populate('replyTo', 'encryptedContent createdAt');
  }

  // Update thread atomically — use findOneAndUpdate with $inc to avoid
  // race conditions when multiple messages are sent concurrently
  await ChatThread.findOneAndUpdate(
    { _id: threadId },
    {
      $set: { lastMessage: message._id, lastMessageAt: new Date() },
      $inc: { [`unreadCount.${receiverId.toString()}`]: 1 },
    }
  );

  // Prepare message for socket emission
  const messageForSocket = {
    ...message.toObject(),
    text:
      text || (messageData.encryptedContent ? decryptMessage(messageData.encryptedContent) : null),
  };

  // Emit socket event for real-time delivery
  const io = getIO();
  if (io) {
    // Emit to receiver's personal room only.
    // Previously we also emitted to the thread room, but that caused
    // duplicate delivery when the receiver had joined the thread.
    io.to(receiverId.toString()).emit('newMessage', {
      threadId,
      message: messageForSocket,
    });

    // NOTE: We no longer emit a premature 'delivered' status here.
    // Delivery is confirmed when the receiver's socket emits 'messageDelivered'
    // after actually receiving the message, which is handled in socket.js.
  }

  // Send FCM push for mobile devices (background/killed state)
  const plainText = text || (messageData.encryptedContent ? decryptMessage(messageData.encryptedContent) : '');
  const senderName = message.senderId
    ? `${message.senderId.firstName || ''} ${message.senderId.lastName || ''}`.trim()
    : 'Unknown';
  sendMessagePushNotification(receiverId.toString(), {
    senderId: userId,
    senderName,
    senderAvatar: message.senderId?.profilePicture || '',
    threadId,
    messagePreview: plainText.slice(0, 100),
    messageType: messageData.messageType || 'text',
  }).catch((err) => logger.error('[MsgPush] FCM push failed:', { error: err.message }));

  // Return response with decrypted text
  return res.status(201).json(new ApiResponse(201, messageForSocket, 'Message sent successfully'));
});

// 3. Delete message
export const deleteMessage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { messageId } = req.params;
  const { deleteFor = 'me' } = req.body; // 'me' or 'everyone'

  const message = await ChatMessage.findById(messageId);

  if (!message || message.isDeleted) {
    throw new ApiError(404, 'Message not found');
  }

  if (deleteFor === 'everyone') {
    // Only the sender can delete for everyone
    if (message.senderId.toString() !== userId.toString()) {
      throw new ApiError(403, 'You can only delete your own messages for everyone');
    }

    // Hard delete for everyone (only within 24 hours)
    const messageAge = Date.now() - message.createdAt.getTime();
    const maxDeletionTime = 24 * 60 * 60 * 1000; // 24 hours

    if (messageAge > maxDeletionTime) {
      throw new ApiError(400, 'Cannot delete message older than 24 hours for everyone');
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    await message.save();

    // Notify via socket — emit to both participants' personal rooms
    // (thread room is unreliable since users may not have joined it)
    const io = getIO();
    if (io) {
      const deletePayload = {
        messageId: message._id,
        threadId: message.threadId,
        deleteFor: 'everyone',
      };
      io.to(message.senderId.toString()).emit('messageDeleted', deletePayload);
      io.to(message.receiverId.toString()).emit('messageDeleted', deletePayload);
    }
  } else {
    // Soft delete for current user only - anyone in the thread can do this
    // Check if user is a participant (either sender or receiver)
    const isParticipant =
      message.senderId.toString() === userId.toString() ||
      message.receiverId.toString() === userId.toString();

    if (!isParticipant) {
      throw new ApiError(403, 'You are not a participant in this conversation');
    }

    if (!message.deletedFor) {
      message.deletedFor = [];
    }

    // Check if already deleted for this user
    const alreadyDeleted = message.deletedFor.some((id) => id.toString() === userId.toString());

    if (!alreadyDeleted) {
      message.deletedFor.push(userId);
      await message.save();
    }
  }

  return res.status(200).json(new ApiResponse(200, null, 'Message deleted successfully'));
});

// 4. Edit message
export const editMessage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { messageId } = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    throw new ApiError(400, 'Message text is required');
  }

  const message = await ChatMessage.findById(messageId);

  if (!message || message.isDeleted) {
    throw new ApiError(404, 'Message not found');
  }

  // Check authorization
  if (message.senderId.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only edit your own messages');
  }

  // Check if message is older than 15 minutes
  const messageAge = Date.now() - message.createdAt.getTime();
  const maxEditTime = 15 * 60 * 1000; // 15 minutes

  if (messageAge > maxEditTime) {
    throw new ApiError(400, 'Cannot edit message older than 15 minutes');
  }

  // Encrypt new content
  message.encryptedContent = encryptMessage(text);
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  // Notify via socket — emit to both participants' personal rooms
  // (thread room is unreliable since users may not have joined it)
  const io = getIO();
  if (io) {
    const editPayload = {
      messageId: message._id,
      threadId: message.threadId,
      text: text,
      editedAt: message.editedAt,
    };
    io.to(message.senderId.toString()).emit('messageEdited', editPayload);
    io.to(message.receiverId.toString()).emit('messageEdited', editPayload);
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...message.toObject(),
        text: text,
      },
      'Message edited successfully'
    )
  );
});

// 5. Get messages
export const getMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { threadId } = req.params;
  const { limit = 50, cursor, since } = req.query;

  // Validate thread access
  const thread = await ChatThread.findOne({
    _id: threadId,
    participants: userId,
    isDeleted: false,
  });

  if (!thread) {
    throw new ApiError(404, 'Thread not found');
  }

  // Build query
  const query = {
    threadId,
    isDeleted: false,
    deletedFor: { $ne: userId },
  };

  if (cursor) {
    // Cursor-based pagination: fetch messages OLDER than the cursor
    query._id = { $lt: cursor };
  }

  if (since) {
    query.createdAt = { $gt: new Date(since) };
  }

  // Fetch messages: sort descending to get the latest N, then reverse for chronological order
  const messages = await ChatMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate('senderId', 'firstName lastName username profilePicture')
    .populate({
      path: 'replyTo',
      select: 'encryptedContent senderId createdAt',
      populate: {
        path: 'senderId',
        select: 'firstName lastName username',
      },
    });

  // Reverse to chronological order (oldest first) for the client
  messages.reverse();

  // Decrypt messages
  const decryptedMessages = messages.map((msg) => {
    const msgObj = msg.toObject();
    if (msgObj.encryptedContent) {
      try {
        msgObj.text = decryptMessage(msgObj.encryptedContent);
        delete msgObj.encryptedContent;
      } catch (error) {
        logger.error('Decryption error:', { error: error.message });
        msgObj.text = '[Unable to decrypt message]';
      }
    }
    // Decrypt replyTo content if present
    if (msgObj.replyTo && msgObj.replyTo.encryptedContent) {
      try {
        msgObj.replyTo.text = decryptMessage(msgObj.replyTo.encryptedContent);
        msgObj.replyTo.senderName = msgObj.replyTo.senderId
          ? `${msgObj.replyTo.senderId.firstName} ${msgObj.replyTo.senderId.lastName}`
          : 'Unknown';
        delete msgObj.replyTo.encryptedContent;
      } catch (error) {
        logger.error('Decryption error for replyTo:', { error: error.message });
        msgObj.replyTo.text = '[Unable to decrypt message]';
      }
    }
    return msgObj;
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        messages: decryptedMessages,
        hasMore: messages.length === parseInt(limit),
        nextCursor: messages.length > 0 ? messages[0]._id : null,
      },
      'Messages fetched successfully'
    )
  );
});

// 6. Mark messages as seen
export const markMessagesAsSeen = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { threadId } = req.params;

  // Validate thread
  const thread = await ChatThread.findOne({
    _id: threadId,
    participants: userId,
    isDeleted: false,
  });

  if (!thread) {
    throw new ApiError(404, 'Thread not found');
  }

  // Update all unseen messages
  const result = await ChatMessage.updateMany(
    {
      threadId,
      receiverId: userId,
      status: { $in: ['sent', 'delivered'] },
    },
    {
      $set: {
        status: 'seen',
        seenAt: new Date(),
      },
    }
  );

  // Reset unread count for current user atomically to avoid race conditions
  // where a new message arrives between the read and the save.
  await ChatThread.findOneAndUpdate(
    { _id: threadId },
    { $set: { [`unreadCount.${userId.toString()}`]: 0 } }
  );

  // Get sender ID
  const senderId = thread.participants.find((p) => p.toString() !== userId.toString());

  // Notify sender via socket
  const io = getIO();
  if (io) {
    io.to(senderId.toString()).emit('messagesSeen', {
      threadId,
      seenBy: userId,
      seenAt: new Date(),
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { messagesUpdated: result.modifiedCount }, 'Messages marked as seen')
    );
});

// 7. Upload media for chat
export const uploadChatMedia = asyncHandler(async (req, res) => {
  const files = req.files;

  if (!files || files.length === 0) {
    throw new ApiError(400, 'No files uploaded');
  }

  const mediaFiles = files.map((file) => {
    const fileType = file.mimetype.startsWith('image/')
      ? 'image'
      : file.mimetype.startsWith('video/')
        ? 'video'
        : file.mimetype.startsWith('audio/')
          ? 'audio'
          : 'file';

    // Generate encrypted media URL token
    const mediaUrl = `/uploads/${file.filename}`;
    const token = encryptMediaUrl(mediaUrl);

    return {
      media_id: file.filename,
      type: fileType,
      url: mediaUrl,
      token: token,
      filename: file.originalname,
      size: file.size,
    };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { media: mediaFiles }, 'Media uploaded successfully'));
});

// 8. Request audio/video call
export const requestCall = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { receiverId } = req.params;
  const { callType = 'audio' } = req.body; // 'audio' or 'video'

  if (!receiverId || receiverId === userId.toString()) {
    throw new ApiError(400, 'Invalid receiver ID');
  }

  // Check if receiver exists
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    throw new ApiError(404, 'Receiver not found');
  }

  // Get or create thread
  let thread = await ChatThread.findOne({
    participants: { $all: [userId, receiverId] },
    isDeleted: false,
  });

  if (!thread) {
    thread = await ChatThread.create({
      participants: [userId, receiverId],
    });
  }

  // Generate unique call ID and encryption key
  const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const encryptionKey = generateSessionKey();

  // Create call log
  const callLog = await CallLog.create({
    callId,
    callType,
    callerId: userId,
    receiverId,
    threadId: thread._id,
    status: 'initiated',
    encryptionKey,
  });

  // Populate caller info
  await callLog.populate('callerId', 'firstName lastName username profilePicture');

  // Emit socket event to receiver
  const io = getIO();
  if (io) {
    io.to(receiverId.toString()).emit('incomingCall', {
      callId,
      callType,
      caller: callLog.callerId,
      encryptionKey, // For WebRTC encryption
    });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        callId,
        callType,
        status: 'ringing',
        encryptionKey,
      },
      'Call initiated successfully'
    )
  );
});

// 9. End call
export const endCall = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const { duration, quality, endReason = 'normal' } = req.body;

  const callLog = await CallLog.findOne({ callId });

  if (!callLog) {
    throw new ApiError(404, 'Call not found');
  }

  // Update call log
  callLog.status = 'ended';
  callLog.endedAt = new Date();
  callLog.duration = duration || 0;
  callLog.quality = quality || {};
  callLog.endReason = endReason;

  // Calculate duration if not provided
  if (!duration && callLog.startedAt) {
    callLog.duration = Math.floor((callLog.endedAt - callLog.startedAt) / 1000);
  }

  await callLog.save();

  // Notify participants via socket
  const io = getIO();
  if (io) {
    io.to(callLog.callerId.toString()).emit('callEnded', { callId, endReason });
    io.to(callLog.receiverId.toString()).emit('callEnded', {
      callId,
      endReason,
    });
  }

  return res.status(200).json(new ApiResponse(200, callLog, 'Call ended successfully'));
});

// 9b. Get call history for the logged-in user (1:1 + group calls)
export const getCallHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit = 30, skip = 0 } = req.query;
  const lim = parseInt(limit);
  const sk = parseInt(skip);

  // 1:1 calls
  const [oneToOneCalls, oneToOneTotal] = await Promise.all([
    CallLog.find({
      $or: [{ callerId: userId }, { receiverId: userId }],
      isDeleted: false,
    })
      .populate('callerId', 'firstName lastName username profilePicture avatar')
      .populate('receiverId', 'firstName lastName username profilePicture avatar')
      .sort({ createdAt: -1 })
      .lean(),
    CallLog.countDocuments({
      $or: [{ callerId: userId }, { receiverId: userId }],
      isDeleted: false,
    }),
  ]);

  // Group calls
  const [groupCalls, groupCallTotal] = await Promise.all([
    GroupCall.find({
      'participants.user': userId,
      status: { $in: ['ringing', 'ongoing', 'ended', 'failed', 'cancelled'] },
    })
      .populate('initiator', 'firstName lastName username profilePicture avatar')
      .populate('groupId', 'name avatar')
      .sort({ createdAt: -1 })
      .lean(),
    GroupCall.countDocuments({
      'participants.user': userId,
      status: { $in: ['ringing', 'ongoing', 'ended', 'failed', 'cancelled'] },
    }),
  ]);

  // Format 1:1 calls
  const formatted1v1 = oneToOneCalls.map((call) => {
    const isCaller = call.callerId?._id?.toString() === userId.toString();
    return {
      callId: call.callId,
      callType: call.callType,
      caller: call.callerId,
      receiver: call.receiverId,
      direction: isCaller ? 'outgoing' : 'incoming',
      status: call.status,
      duration: call.duration || 0,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      endReason: call.endReason,
      createdAt: call.createdAt,
      threadId: call.threadId,
      isGroupCall: false,
    };
  });

  // Format group calls
  const formattedGroup = groupCalls.map((call) => {
    const isCaller = call.initiator?._id?.toString() === userId.toString();
    const myParticipant = call.participants?.find((p) => p.user?.toString() === userId.toString());
    // Map group call status to match 1:1 format
    let status = call.status;
    if (status === 'ongoing') status = 'answered';
    if (status === 'cancelled') status = 'missed';
    if (myParticipant?.status === 'missed' || myParticipant?.status === 'declined') status = 'missed';

    return {
      callId: call.callId,
      callType: call.callType,
      caller: call.initiator,
      receiver: {
        _id: call.groupId?._id || call.groupId,
        firstName: call.groupId?.name || 'Group',
        lastName: '',
        username: call.groupId?.name || 'Group',
        profilePicture: call.groupId?.avatar || '',
        avatar: call.groupId?.avatar || '',
      },
      direction: isCaller ? 'outgoing' : 'incoming',
      status,
      duration: call.duration || 0,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      endReason: call.endReason,
      createdAt: call.createdAt,
      threadId: call.groupId?._id || call.groupId,
      isGroupCall: true,
      groupName: call.groupId?.name,
      groupAvatar: call.groupId?.avatar,
    };
  });

  // Merge and sort by date
  const allCalls = [...formatted1v1, ...formattedGroup]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(sk, sk + lim);

  const total = oneToOneTotal + groupCallTotal;

  return res.status(200).json(
    new ApiResponse(200, {
      calls: allCalls,
      total,
      hasMore: sk + lim < total,
    }, 'Call history fetched')
  );
});

// 9c. Delete (soft) a call log entry
export const deleteCallLog = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { callId } = req.params;

  const callLog = await CallLog.findOneAndUpdate(
    {
      callId,
      $or: [{ callerId: userId }, { receiverId: userId }],
    },
    { isDeleted: true },
    { new: true }
  );

  if (!callLog) {
    throw new ApiError(404, 'Call log not found');
  }

  return res.status(200).json(new ApiResponse(200, null, 'Call log deleted'));
});

// 10. Delete thread
export const deleteThread = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { threadId } = req.params;

  // Find the thread
  const thread = await ChatThread.findById(threadId);

  if (!thread) {
    throw new ApiError(404, 'Thread not found');
  }

  // Check if user is a participant in the thread
  const isParticipant = thread.participants.some(
    (participant) => participant.toString() === userId.toString()
  );

  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant in this thread');
  }

  // Soft delete: mark thread as deleted for this user.
  // We use isDeleted flag instead of removing the participant,
  // which would break the other user's thread lookup.
  // Mark all messages as deleted-for-me
  await ChatMessage.updateMany(
    { threadId, deletedFor: { $ne: userId } },
    { $addToSet: { deletedFor: userId } }
  );

  // Check if both participants have "deleted" the thread.
  // A message is "fully deleted" only when ALL participants have it in their deletedFor.
  // Count messages that are NOT yet deleted by every participant.
  const allParticipantIds = thread.participants.map((p) => p.toString());
  const remainingMessages = await ChatMessage.countDocuments({
    threadId,
    isDeleted: false,
    // Find messages where at least one participant has NOT deleted it.
    // i.e., deletedFor does NOT contain ALL participant IDs.
    $or: allParticipantIds.map((pid) => ({ deletedFor: { $ne: pid } })),
  });

  // If every message has been deleted by all participants, clean up the thread.
  // Use findOneAndUpdate to prevent double-deletion race.
  if (remainingMessages === 0) {
    const deleted = await ChatThread.findOneAndUpdate(
      { _id: threadId, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    // Only delete messages if we were the one to mark the thread deleted
    if (deleted) {
      await ChatMessage.deleteMany({ threadId });
    }
  }

  // Emit socket event to notify about thread deletion
  const io = getIO();
  if (io) {
    io.to(userId.toString()).emit('threadDeleted', {
      threadId,
      deletedAt: new Date(),
    });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        threadId,
        deletedAt: new Date(),
      },
      'Thread deleted successfully'
    )
  );
});

// Get total unread count across all threads
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userIdStr = userId.toString();

  // Use aggregation to sum unread counts in a single query instead of
  // fetching all threads and summing in JS
  const result = await ChatThread.aggregate([
    {
      $match: {
        participants: userId,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        totalUnread: {
          $sum: {
            $ifNull: [
              { $getField: { field: userIdStr, input: '$unreadCount' } },
              0,
            ],
          },
        },
      },
    },
  ]);

  const totalUnread = result.length > 0 ? result[0].totalUnread : 0;

  return res
    .status(200)
    .json(new ApiResponse(200, { unreadCount: totalUnread }, 'Unread count fetched successfully'));
});

export default {
  getAllThreads,
  createOrGetThread,
  sendMessage,
  deleteMessage,
  editMessage,
  getMessages,
  markMessagesAsSeen,
  uploadChatMedia,
  requestCall,
  endCall,
  deleteThread,
  getUnreadCount,
};
