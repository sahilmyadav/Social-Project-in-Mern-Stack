/**
 * Group Chat & Call Socket Events Handler
 * Handles real-time events for group messaging and group calls
 */

import { GroupCall } from '../models/groupCall.model.js';
import { GroupChat } from '../models/groupChat.model.js';
import { GroupMessage } from '../models/groupMessage.model.js';
import { User } from '../models/user.model.js';
import { encryptMessage } from '../utils/encryption.js';
import {
  sendMessagePushNotification,
  sendPushNotification,
  sendGroupCallPushNotification,
  sendCallEventPush,
} from '../services/firebase.service.js';
import logger from '../utils/logger.js';

export default function groupSocket(io, socket, userId) {
  // ==================== GROUP ROOM MANAGEMENT ====================

  /**
   * Join a group room for real-time updates
   */
  socket.on('joinGroup', async (groupId) => {
    try {
      // Verify user is member of the group
      const group = await GroupChat.findOne({
        _id: groupId,
        'members.user': userId,
        isDeleted: false,
      });

      if (group) {
        socket.join(`group:${groupId}`);
        logger.info(`User ${userId} joined group room: ${groupId}`);

        // Update user's last seen in group
        const member = group.members.find((m) => m.user.toString() === userId);
        if (member) {
          member.lastSeen = new Date();
          await group.save();
        }
      }
    } catch (error) {
      logger.error('Error joining group', { error: error.message });
    }
  });

  /**
   * Leave a group room
   */
  socket.on('leaveGroup', (groupId) => {
    socket.leave(`group:${groupId}`);
    logger.info(`User ${userId} left group room: ${groupId}`);
  });

  // ==================== GROUP MESSAGING ====================

  /**
   * Send message to group
   */
  socket.on('sendGroupMessage', async (data) => {
    try {
      const { groupId, text, messageType = 'text', replyTo, mentions = [] } = data;

      // Verify membership
      const group = await GroupChat.findOne({
        _id: groupId,
        'members.user': userId,
        isDeleted: false,
      });

      if (!group || !group.canSendMessage(userId)) {
        socket.emit('groupMessageError', {
          error: 'Cannot send message to this group',
          groupId,
        });
        return;
      }

      // Create message
      const messageData = {
        groupId,
        senderId: userId,
        messageType,
        mentions,
      };

      if (text) {
        messageData.encryptedContent = encryptMessage(text);
      }

      if (replyTo) {
        messageData.replyTo = replyTo;
      }

      // Handle disappearing messages
      if (group.settings.disappearingMessages?.enabled) {
        messageData.expiresAt = new Date(
          Date.now() + group.settings.disappearingMessages.duration * 1000
        );
      }

      const message = await GroupMessage.create(messageData);

      // Update group
      group.lastMessage = message._id;
      group.lastMessageAt = new Date();
      group.totalMessages += 1;

      // Update unread counts
      group.members.forEach((member) => {
        if (member.user.toString() !== userId) {
          member.unreadCount = (member.unreadCount || 0) + 1;
        }
      });
      await group.save();

      // Populate message
      const populatedMessage = await GroupMessage.findById(message._id)
        .populate('senderId', 'firstName lastName username profileImage avatar')
        .populate('replyTo', 'encryptedContent messageType senderId')
        .lean();

      // Decrypt for sending
      const decryptedMessage = {
        ...populatedMessage,
        text,
      };

      // Emit to all group members
      io.to(`group:${groupId}`).emit('groupMessage', {
        groupId,
        message: decryptedMessage,
      });

      // Also emit to individual member rooms for notifications
      group.members.forEach((member) => {
        if (member.user.toString() !== userId) {
          io.to(member.user.toString()).emit('groupMessageNotification', {
            groupId,
            groupName: group.name,
            groupAvatar: group.avatar,
            message: decryptedMessage,
          });

          // FCM push for group messages on mobile
          sendMessagePushNotification(member.user.toString(), {
            senderId: userId,
            senderName: populatedMessage.senderId
              ? `${populatedMessage.senderId.firstName} ${populatedMessage.senderId.lastName}`
              : 'Unknown',
            senderAvatar: populatedMessage.senderId?.avatar || '',
            threadId: groupId,
            messagePreview: text?.slice(0, 100) || 'New message',
            messageType,
            isGroupMessage: true,
            groupName: group.name,
          }).catch((err) => logger.error('[GroupMsgPush] FCM push failed:', { error: err.message, memberId: member.user.toString() }));
        }
      });

      // Handle mentions — emit socket + send FCM push
      if (mentions.length > 0) {
        const sender = populatedMessage.senderId;
        const senderName = sender
          ? `${sender.firstName} ${sender.lastName}`
          : 'Someone';

        for (const mentionedUserId of mentions) {
          const mentionId = mentionedUserId.toString();
          if (mentionId === userId) continue; // Don't notify self

          io.to(mentionId).emit('mentioned', {
            type: 'group',
            groupId,
            messageId: message._id,
            by: userId,
            groupName: group.name,
          });

          // FCM push for mentioned users
          sendPushNotification(mentionId, {
            type: 'mention',
            title: `${senderName} mentioned you`,
            message: `in ${group.name}: ${text?.slice(0, 80) || 'a message'}`,
            thumbnail: sender?.avatar || '',
            reference_id: groupId,
            action_url: `/chat/group/${groupId}`,
            sender_id: userId,
          }).catch((err) => logger.error('[GroupMentionPush] FCM push failed:', { error: err.message, mentionId }));
        }
      }

      // Confirm to sender
      socket.emit('groupMessageSent', {
        messageId: message._id,
        groupId,
        timestamp: message.createdAt,
      });
    } catch (error) {
      logger.error('Error sending group message', { error: error.message });
      socket.emit('groupMessageError', {
        error: 'Failed to send message',
        details: error.message,
      });
    }
  });

  /**
   * Typing indicator for groups
   */
  socket.on('groupTyping', async ({ groupId }) => {
    try {
      const user = await User.findById(userId).select('firstName lastName');
      socket.to(`group:${groupId}`).emit('groupUserTyping', {
        groupId,
        userId,
        userName: `${user.firstName} ${user.lastName}`,
        isTyping: true,
      });
    } catch (error) {
      logger.error('Error with group typing', { error: error.message });
    }
  });

  socket.on('groupStopTyping', ({ groupId }) => {
    socket.to(`group:${groupId}`).emit('groupUserTyping', {
      groupId,
      userId,
      isTyping: false,
    });
  });

  /**
   * Mark messages as read
   */
  socket.on('markGroupMessagesRead', async ({ groupId, lastMessageId }) => {
    try {
      const group = await GroupChat.findOne({
        _id: groupId,
        'members.user': userId,
      });

      if (!group) return;

      // Update member's unread count and last seen
      const member = group.members.find((m) => m.user.toString() === userId);
      if (member) {
        member.unreadCount = 0;
        member.lastSeen = new Date();
        await group.save();
      }

      // Update read receipts on messages
      if (lastMessageId) {
        await GroupMessage.updateMany(
          {
            groupId,
            createdAt: { $lte: (await GroupMessage.findById(lastMessageId))?.createdAt },
            'readBy.user': { $ne: userId },
          },
          {
            $push: { readBy: { user: userId, readAt: new Date() } },
          }
        );
      }

      // Notify other members about read status
      socket.to(`group:${groupId}`).emit('groupMessagesRead', {
        groupId,
        userId,
        readAt: new Date(),
      });
    } catch (error) {
      logger.error('Error marking messages read', { error: error.message });
    }
  });

  /**
   * React to message
   */
  socket.on('reactToGroupMessage', async ({ groupId, messageId, emoji }) => {
    try {
      const message = await GroupMessage.findOne({
        _id: messageId,
        groupId,
        isDeleted: false,
      });

      if (!message) return;

      // Remove existing reaction from this user
      message.reactions = message.reactions.filter((r) => r.user.toString() !== userId);

      // Add new reaction if emoji provided
      if (emoji) {
        message.reactions.push({
          user: userId,
          emoji,
          reactedAt: new Date(),
        });
      }

      await message.save();

      // Notify group
      io.to(`group:${groupId}`).emit('groupMessageReaction', {
        groupId,
        messageId,
        userId,
        emoji,
        reactions: message.reactions,
      });
    } catch (error) {
      logger.error('Error reacting to message', { error: error.message });
    }
  });

  // ==================== GROUP CALLS ====================

  /**
   * Initiate a group call.
   *
   * FIX: sendGroupCallPushNotification() is now called here.
   * Previously this was completely missing — group call FCM was NEVER sent,
   * meaning members in background/killed state never received any notification.
   */
  socket.on('initiateGroupCall', async (data) => {
    try {
      const { groupId, callType = 'voice' } = data;

      const group = await GroupChat.findOne({
        _id: groupId,
        'members.user': userId,
        isDeleted: false,
      });
      if (!group) {
        socket.emit('groupCallError', { error: 'Group not found or not a member', groupId });
        return;
      }

      const caller = await User.findById(userId).select('firstName lastName avatar').lean();
      const callerName = caller ? `${caller.firstName} ${caller.lastName}` : 'Unknown';
      const callerAvatar = caller?.avatar || '';

      const memberIds = group.members
        .filter((m) => !m.isRemoved && !m.isLeft)
        .map((m) => m.user.toString());

      // Create GroupCall log entry
      const callId = `gcall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const participants = memberIds.map((uid) => ({
        user: uid,
        status: uid === userId ? 'joined' : 'ringing',
        invitedAt: new Date(),
        ...(uid === userId ? { joinedAt: new Date(), role: 'host' } : {}),
      }));

      await GroupCall.create({
        callId,
        groupId,
        callType: callType === 'video' ? 'video' : 'audio',
        initiator: userId,
        participants,
        status: 'ringing',
        startedAt: new Date(),
      }).catch((e) => logger.warn(`[GroupCall] Failed to create call log: ${e.message}`));

      // Emit to all online group members (socket layer)
      socket.to(`group:${groupId}`).emit('incomingGroupCall', {
        groupId,
        callId,
        callType,
        callerId: userId,
        callerName,
        callerAvatar,
        groupName: group.name,
        groupAvatar: group.avatar || '',
      });

      logger.info(`[GroupCall] ${userId} initiated ${callType} call (${callId}) in group ${groupId}`);

      // Create system message in group chat (like 1:1 call logs)
      try {
        const callTypeLabel = callType === 'video' ? 'Video call' : 'Voice call';
        const content = `${callerName} started a ${callTypeLabel.toLowerCase()}`;

        const sysMsg = await GroupMessage.create({
          groupId,
          senderId: userId,
          messageType: 'system',
          systemMessage: content,
          systemMessageType: 'call_started',
        });

        const populatedMsg = await GroupMessage.findById(sysMsg._id)
          .populate('senderId', 'firstName lastName username profileImage avatar')
          .lean();

        group.members.forEach((member) => {
          io.to(member.user.toString()).emit('groupMessage', {
            groupId,
            message: { ...populatedMsg, text: content },
          });
        });
      } catch (msgErr) {
        logger.warn('[GroupCall] Failed to create call_started system message:', msgErr.message);
      }

      // Send FCM push to ALL members (covers offline/background/killed devices)
      sendGroupCallPushNotification(memberIds, userId, {
        callerId: userId,
        callerName,
        callerAvatar,
        callType,
        groupId: groupId.toString(),
        groupName: group.name,
        threadId: groupId.toString(),
      }).catch((err) => {
        logger.warn('[GroupCall] FCM push failed (non-fatal):', err.message);
      });
    } catch (error) {
      logger.error('Error initiating group call', { error: error.message });
      socket.emit('groupCallError', { error: 'Failed to initiate group call', details: error.message });
    }
  });

  /**
   * End a group call — notify all members and send FCM dismiss events.
   */
  socket.on('endGroupCall', async ({ groupId, callId }) => {
    try {
      socket.to(`group:${groupId}`).emit('groupCallEnded', { groupId, callId, endedBy: userId });

      // Update GroupCall log
      let endedCallRecord = null;
      if (callId) {
        const now = new Date();
        endedCallRecord = await GroupCall.findOneAndUpdate(
          { callId, status: { $in: ['initiating', 'ringing', 'ongoing'] } },
          [
            {
              $set: {
                status: 'ended',
                endedAt: now,
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
          { new: true }
        ).catch((e) => {
          logger.warn(`[GroupCall] Failed to update call log: ${e.message}`);
          return null;
        });
      }

      const group = await GroupChat.findOne({ _id: groupId, 'members.user': userId }).lean();

      // Create system message in group chat (like 1:1 call logs)
      if (group) {
        try {
          const durationSec = endedCallRecord?.duration || 0;
          const callTypeLabel = endedCallRecord?.callType === 'video' ? 'Video call' : 'Voice call';
          const durationLabel = durationSec > 0
            ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
            : '';
          const content = durationLabel
            ? `${callTypeLabel} \u2022 ${durationLabel}`
            : callTypeLabel;

          const sysMsg = await GroupMessage.create({
            groupId,
            senderId: endedCallRecord?.initiator || userId,
            messageType: 'system',
            systemMessage: content,
            systemMessageType: 'call_ended',
          });

          const populatedMsg = await GroupMessage.findById(sysMsg._id)
            .populate('senderId', 'firstName lastName username profileImage avatar')
            .lean();

          group.members.forEach((member) => {
            io.to(member.user.toString()).emit('groupMessage', {
              groupId,
              message: { ...populatedMsg, text: content },
            });
          });
        } catch (msgErr) {
          logger.warn('[GroupCall] Failed to create call_ended system message:', msgErr.message);
        }

        const memberIds = group.members
          .filter((m) => !m.isRemoved && !m.isLeft && m.user.toString() !== userId)
          .map((m) => m.user.toString());

        await Promise.allSettled(
          memberIds.map((uid) => sendCallEventPush(uid, userId, 'call_ended'))
        );
      }
    } catch (error) {
      logger.error('Error ending group call', { error: error.message });
    }
  });

  /**
   * Join group call room
   */
  socket.on('joinGroupCall', async ({ callId }) => {
    try {
      const call = await GroupCall.findOne({
        callId,
        status: { $in: ['ringing', 'ongoing'] },
      });

      if (!call) return;

      socket.join(`call:${callId}`);
      logger.info(`User ${userId} joined call room: ${callId}`);
    } catch (error) {
      logger.error('Error joining call room', { error: error.message });
    }
  });

  /**
   * Leave group call room
   */
  socket.on('leaveGroupCallRoom', ({ callId }) => {
    socket.leave(`call:${callId}`);
    logger.info(`User ${userId} left call room: ${callId}`);
  });

  /**
   * WebRTC signaling for group calls
   */
  socket.on('groupCallOffer', ({ callId, targetUserId, offer }) => {
    io.to(targetUserId).emit('groupCallOffer', {
      callId,
      fromUserId: userId,
      offer,
    });
  });

  socket.on('groupCallAnswer', ({ callId, targetUserId, answer }) => {
    io.to(targetUserId).emit('groupCallAnswer', {
      callId,
      fromUserId: userId,
      answer,
    });
  });

  socket.on('groupCallIceCandidate', ({ callId, targetUserId, candidate }) => {
    io.to(targetUserId).emit('groupCallIceCandidate', {
      callId,
      fromUserId: userId,
      candidate,
    });
  });

  /**
   * Media state changes
   */
  socket.on('groupCallMediaState', ({ callId, mediaType, enabled }) => {
    io.to(`call:${callId}`).emit('groupCallMediaStateChanged', {
      callId,
      userId,
      mediaType,
      enabled,
    });
  });

  /**
   * Speaking indicator
   */
  socket.on('groupCallSpeaking', ({ callId, isSpeaking }) => {
    io.to(`call:${callId}`).emit('groupCallSpeakingChanged', {
      callId,
      userId,
      isSpeaking,
    });
  });

  /**
   * Screen share started
   */
  socket.on('groupCallScreenShare', ({ callId, isSharing }) => {
    io.to(`call:${callId}`).emit('groupCallScreenShareChanged', {
      callId,
      userId,
      isSharing,
    });
  });

  /**
   * Hand raise
   */
  socket.on('groupCallHandRaise', ({ callId, isRaised }) => {
    io.to(`call:${callId}`).emit('groupCallHandRaised', {
      callId,
      userId,
      isRaised,
    });
  });

  /**
   * Chat message during call
   */
  socket.on('groupCallChatMessage', async ({ callId, message }) => {
    const user = await User.findById(userId).select('firstName lastName profileImage');
    io.to(`call:${callId}`).emit('groupCallChatMessage', {
      callId,
      message,
      sender: {
        _id: userId,
        firstName: user?.firstName,
        lastName: user?.lastName,
        profileImage: user?.profileImage,
      },
      timestamp: new Date(),
    });
  });

  // ==================== CLEANUP ON DISCONNECT ====================

  socket.on('disconnecting', async () => {
    // Get all group rooms user was in
    const rooms = [...socket.rooms].filter((room) => room.startsWith('group:'));

    // Notify groups about user going offline
    rooms.forEach((room) => {
      socket.to(room).emit('groupMemberOffline', {
        groupId: room.replace('group:', ''),
        userId,
      });
    });

    // Handle active call disconnection
    const callRooms = [...socket.rooms].filter((room) => room.startsWith('call:'));
    for (const room of callRooms) {
      const callId = room.replace('call:', '');

      // Update call participant status
      const call = await GroupCall.findOne({ callId, status: 'ongoing' });
      if (call) {
        const participant = call.participants.find(
          (p) => p.user.toString() === userId && p.status === 'connected'
        );

        if (participant) {
          participant.status = 'disconnected';
          await call.save();

          socket.to(room).emit('groupCallParticipantDisconnected', {
            callId,
            userId,
          });
        }
      }
    }
  });
}
