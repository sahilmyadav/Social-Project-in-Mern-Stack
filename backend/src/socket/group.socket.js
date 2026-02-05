/**
 * Group Chat & Call Socket Events Handler
 * Handles real-time events for group messaging and group calls
 */

import { GroupCall } from '../models/groupCall.model.js';
import { GroupChat } from '../models/groupChat.model.js';
import { GroupMessage } from '../models/groupMessage.model.js';
import { User } from '../models/user.model.js';
import { encryptMessage } from '../utils/encryption.js';

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
        console.log(`👥 User ${userId} joined group room: ${groupId}`);

        // Update user's last seen in group
        const member = group.members.find((m) => m.user.toString() === userId);
        if (member) {
          member.lastSeen = new Date();
          await group.save();
        }
      }
    } catch (error) {
      console.error('Error joining group:', error);
    }
  });

  /**
   * Leave a group room
   */
  socket.on('leaveGroup', (groupId) => {
    socket.leave(`group:${groupId}`);
    console.log(`👥 User ${userId} left group room: ${groupId}`);
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
        }
      });

      // Handle mentions
      if (mentions.length > 0) {
        mentions.forEach((mentionedUserId) => {
          io.to(mentionedUserId.toString()).emit('mentioned', {
            type: 'group',
            groupId,
            messageId: message._id,
            by: userId,
            groupName: group.name,
          });
        });
      }

      // Confirm to sender
      socket.emit('groupMessageSent', {
        messageId: message._id,
        groupId,
        timestamp: message.createdAt,
      });
    } catch (error) {
      console.error('Error sending group message:', error);
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
      console.error('Error with group typing:', error);
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
      console.error('Error marking messages read:', error);
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
      console.error('Error reacting to message:', error);
    }
  });

  // ==================== GROUP CALLS ====================

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
      console.log(`📞 User ${userId} joined call room: ${callId}`);
    } catch (error) {
      console.error('Error joining call room:', error);
    }
  });

  /**
   * Leave group call room
   */
  socket.on('leaveGroupCallRoom', ({ callId }) => {
    socket.leave(`call:${callId}`);
    console.log(`📞 User ${userId} left call room: ${callId}`);
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
