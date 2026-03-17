import { Followers } from '../models/followers.model.js';
import { LiveStream } from '../models/liveStream.model.js';
import { LiveStreamComment } from '../models/liveStreamComment.model.js';
import { LiveStreamViewer } from '../models/liveStreamViewer.model.js';
import { Notification } from '../models/notification.model.js';
import { User } from '../models/user.model.js';
import { sendLiveStreamPush } from '../services/firebase.service.js';
import logger from '../utils/logger.js';

export const liveStreamSocket = (io, socket, userId) => {
  // ==================== LIVE STREAMING EVENTS ====================

  // Start Live Stream
  socket.on('startLiveStream', async (data) => {
    try {
      const { streamId, title } = data;

      const liveStream = await LiveStream.findById(streamId);

      if (!liveStream) {
        socket.emit('liveStreamError', { error: 'Live stream not found' });
        return;
      }

      if (liveStream.streamerId.toString() !== userId.toString()) {
        socket.emit('liveStreamError', { error: 'Unauthorized' });
        return;
      }

      // Update stream status
      liveStream.status = 'live';
      liveStream.startedAt = new Date();
      await liveStream.save();

      // Get streamer info for notifications
      const streamer = await User.findById(userId).select(
        'firstName lastName username profilePicture avatar'
      );

      // Join broadcaster to their own stream room
      socket.join(`stream:${streamId}`);

      // Notify all followers that stream has started
      const followers = await Followers.find({
        following_id: userId,
        status: 'accepted',
      }).select('follower_id');

      const followerIds = followers.map((f) => f.follower_id.toString());

      // Create notifications for all followers (like Instagram)
      const notificationPromises = followerIds.map(async (followerId) => {
        try {
          // Create database notification
          const notification = await Notification.create({
            recipient_id: followerId,
            sender_id: userId,
            type: 'live_started',
            reference_id: streamId,
            reference_type: 'User',
            title: 'Live Video',
            message: `${streamer?.firstName || 'Someone'} ${streamer?.lastName || ''} started a live video`,
            thumbnail: liveStream.thumbnail || streamer?.profilePicture,
            action_url: `/live/watch/${streamId}`,
          });

          // Populate sender details
          await notification.populate(
            'sender_id',
            'firstName lastName username profilePicture avatar'
          );

          // Emit real-time notification to each follower
          io.to(followerId).emit('liveStreamStarted', {
            streamId,
            streamerId: userId,
            streamerName: `${streamer?.firstName || ''} ${streamer?.lastName || ''}`.trim(),
            streamerUsername: streamer?.username,
            streamerAvatar: streamer?.profilePicture || streamer?.avatar,
            title: liveStream.title,
            thumbnail: liveStream.thumbnail,
          });

          // Also emit as regular notification
          io.to(followerId).emit('newNotification', {
            notification: notification.toObject(),
          });

          // FCM push for live stream to all devices (web + mobile)
          sendLiveStreamPush(followerId, {
            streamId,
            streamerId: userId,
            streamerName: `${streamer?.firstName || ''} ${streamer?.lastName || ''}`.trim(),
            streamerAvatar: streamer?.profilePicture || streamer?.avatar,
            thumbnail: liveStream.thumbnail,
          }).catch(() => { });
        } catch (err) {
          logger.error(`Failed to create notification for follower ${followerId}`, {
            error: err.message,
          });
        }
      });

      await Promise.all(notificationPromises);

      socket.emit('liveStreamStartSuccess', { streamId, status: 'live' });
    } catch (error) {
      logger.error('Error starting live stream', { error: error.message });
      socket.emit('liveStreamError', { error: 'Failed to start stream' });
    }
  });

  // End Live Stream
  socket.on('endLiveStream', async (data) => {
    try {
      const { streamId } = data;

      const liveStream = await LiveStream.findById(streamId);

      if (!liveStream || liveStream.streamerId.toString() !== userId.toString()) {
        socket.emit('liveStreamError', { error: 'Unauthorized' });
        return;
      }

      // Update stream status
      liveStream.status = 'ended';
      liveStream.endedAt = new Date();
      await liveStream.save();

      // Notify all viewers in the stream room
      io.to(`stream:${streamId}`).emit('liveStreamEnded', {
        streamId,
        endedAt: liveStream.endedAt,
      });

      // Mark all viewers as left
      await LiveStreamViewer.updateMany(
        { liveStreamId: streamId, leftAt: null },
        { leftAt: new Date() }
      );

      // Leave the stream room
      socket.leave(`stream:${streamId}`);

      socket.emit('liveStreamEndSuccess', { streamId });
    } catch (error) {
      logger.error('Error ending live stream', { error: error.message });
      socket.emit('liveStreamError', { error: 'Failed to end stream' });
    }
  });

  // Join Live Stream
  socket.on('joinLiveStream', async (data) => {
    try {
      const { streamId } = data;

      const liveStream = await LiveStream.findById(streamId);

      if (!liveStream) {
        logger.info('Stream not found');
        socket.emit('liveStreamError', { error: 'Live stream not found' });
        return;
      }

      if (liveStream.status !== 'live') {
        logger.info(`Stream not live, status: ${liveStream.status}`);
        socket.emit('liveStreamError', { error: 'Stream is not live' });
        return;
      }

      logger.info(`Stream is live, broadcaster: ${liveStream.streamerId}`);

      // Join the stream room
      socket.join(`stream:${streamId}`);

      // Don't count the broadcaster as a viewer
      const isBroadcaster = liveStream.streamerId.toString() === userId.toString();

      let viewer = null;
      if (!isBroadcaster) {
        // Check if viewer already exists
        viewer = await LiveStreamViewer.findOne({
          liveStreamId: streamId,
          userId: userId,
        });

        if (!viewer) {
          // Create new viewer record
          viewer = await LiveStreamViewer.create({
            liveStreamId: streamId,
            userId: userId,
            joinedAt: new Date(),
          });

          // Increment viewer count (atomic)
          await LiveStream.updateOne({ _id: streamId }, { $inc: { viewerCount: 1 } });
        } else if (viewer.leftAt) {
          // Viewer rejoining
          viewer.leftAt = null;
          viewer.joinedAt = new Date();
          await viewer.save();

          await LiveStream.updateOne({ _id: streamId }, { $inc: { viewerCount: 1 } });
        }
      }

      // Get viewer info
      const viewerInfo = await User.findById(userId).select(
        'firstName lastName username profilePicture avatar'
      );

      // Re-read the updated viewer count after $inc
      const updatedStream = await LiveStream.findById(streamId).select('viewerCount streamerId');
      const currentViewerCount = updatedStream?.viewerCount || liveStream.viewerCount;

      const viewerData = {
        streamId,
        viewerId: userId.toString(),
        viewerSocketId: socket.id,
        viewerCount: currentViewerCount,
        viewer: {
          _id: userId,
          firstName: viewerInfo?.firstName,
          lastName: viewerInfo?.lastName,
          username: viewerInfo?.username,
          profilePicture: viewerInfo?.profilePicture,
          avatar: viewerInfo?.avatar,
        },
      };

      if (!isBroadcaster) {
        // Notify all in room including broadcaster (triggers WebRTC offer)
        io.to(`stream:${streamId}`).emit('viewerJoined', viewerData);
      }

      socket.emit('liveStreamJoinSuccess', {
        streamId,
        viewerCount: currentViewerCount,
        broadcasterId: liveStream.streamerId.toString(),
      });
    } catch (error) {
      logger.error('Error joining live stream', { error: error.message });
      socket.emit('liveStreamError', { error: 'Failed to join stream' });
    }
  });

  // Leave Live Stream
  socket.on('leaveLiveStream', async (data) => {
    try {
      const { streamId } = data;

      // Check if user is the broadcaster (they were never counted as a viewer)
      const stream = await LiveStream.findById(streamId).select('streamerId');
      if (stream && stream.streamerId.toString() === userId.toString()) {
        socket.leave(`stream:${streamId}`);
        socket.emit('liveStreamLeaveSuccess', { streamId });
        return;
      }

      const viewer = await LiveStreamViewer.findOne({
        liveStreamId: streamId,
        userId: userId,
        leftAt: null,
      });

      if (viewer) {
        viewer.leftAt = new Date();
        await viewer.save();

        // Decrement viewer count (atomic)
        const liveStream = await LiveStream.findOneAndUpdate(
          { _id: streamId, viewerCount: { $gt: 0 } },
          { $inc: { viewerCount: -1 } },
          { new: true }
        );

        if (liveStream) {
          // Notify all viewers about updated count
          io.to(`stream:${streamId}`).emit('viewerLeft', {
            streamId,
            viewerCount: liveStream.viewerCount,
            userId: userId,
          });
        }
      }

      // Leave the stream room
      socket.leave(`stream:${streamId}`);

      socket.emit('liveStreamLeaveSuccess', { streamId });
    } catch (error) {
      logger.error('Error leaving live stream', { error: error.message });
      socket.emit('liveStreamError', { error: 'Failed to leave stream' });
    }
  });

  // ==================== LIVE REACTIONS (Hearts) ====================
  /**
   * Handle live reactions (floating hearts like Instagram)
   *
   * These are ephemeral - we don't store them in the database,
   * just broadcast to all viewers for visual effect.
   */
  socket.on('liveReaction', async (data) => {
    try {
      const { streamId, type = 'heart', color } = data;

      const liveStream = await LiveStream.findById(streamId);
      if (!liveStream || liveStream.status !== 'live') {
        return; // Silently ignore reactions to non-live streams
      }

      // Get user info for the reaction
      const user = await User.findById(userId).select(
        'firstName lastName username profilePicture avatar'
      );

      // Broadcast reaction to all viewers
      io.to(`stream:${streamId}`).emit('liveReaction', {
        streamId,
        userId: userId.toString(),
        user: {
          _id: userId,
          username: user?.username,
          fullName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          profilePicture: user?.profilePicture || user?.avatar,
        },
        type,
        color: color || '#ef4444',
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error handling live reaction', { error: error.message });
    }
  });

  // ==================== PIN COMMENT ====================
  /**
   * Allow broadcaster to pin a comment for all viewers
   */
  socket.on('pinLiveComment', async (data) => {
    try {
      const { streamId, commentId } = data;

      const liveStream = await LiveStream.findById(streamId);
      if (!liveStream) {
        socket.emit('liveStreamError', { error: 'Stream not found' });
        return;
      }

      // Only the broadcaster can pin comments
      if (liveStream.streamerId.toString() !== userId.toString()) {
        socket.emit('liveStreamError', { error: 'Only the broadcaster can pin comments' });
        return;
      }

      // Get the comment
      const comment = await LiveStreamComment.findById(commentId).populate(
        'userId',
        'firstName lastName username profilePicture avatar'
      );

      if (!comment) {
        socket.emit('liveStreamError', { error: 'Comment not found' });
        return;
      }

      // Broadcast pinned comment to all viewers
      io.to(`stream:${streamId}`).emit('commentPinned', {
        streamId,
        comment: {
          _id: comment._id,
          text: comment.text,
          user: {
            _id: comment.userId._id,
            firstName: comment.userId.firstName,
            lastName: comment.userId.lastName,
            username: comment.userId.username,
            profilePicture: comment.userId.profilePicture,
            avatar: comment.userId.avatar,
          },
          createdAt: comment.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error pinning comment', { error: error.message });
      socket.emit('liveStreamError', { error: 'Failed to pin comment' });
    }
  });

  // ==================== UNPIN COMMENT ====================
  socket.on('unpinLiveComment', async (data) => {
    try {
      const { streamId } = data;

      const liveStream = await LiveStream.findById(streamId);
      if (!liveStream || liveStream.streamerId.toString() !== userId.toString()) {
        socket.emit('liveStreamError', { error: 'Unauthorized' });
        return;
      }

      // Broadcast unpin to all viewers
      io.to(`stream:${streamId}`).emit('commentUnpinned', { streamId });
    } catch (error) {
      logger.error('Error unpinning comment', { error: error.message });
    }
  });

  // Live Comment
  socket.on('liveComment', async (data) => {
    try {
      const { streamId, text } = data;

      if (!text || text.trim().length === 0) {
        socket.emit('liveStreamError', { error: 'Comment text is required' });
        return;
      }

      const liveStream = await LiveStream.findById(streamId);

      if (!liveStream || liveStream.status !== 'live') {
        socket.emit('liveStreamError', { error: 'Stream is not live' });
        return;
      }

      // Create comment
      const comment = await LiveStreamComment.create({
        liveStreamId: streamId,
        userId: userId,
        text: text.trim(),
      });

      // Populate user info
      await comment.populate('userId', 'firstName lastName username profilePicture avatar');

      // Broadcast comment to all viewers in the stream room
      io.to(`stream:${streamId}`).emit('newLiveComment', {
        streamId,
        comment: {
          _id: comment._id,
          text: comment.text,
          user: {
            _id: comment.userId._id,
            firstName: comment.userId.firstName,
            lastName: comment.userId.lastName,
            username: comment.userId.username,
            profilePicture: comment.userId.profilePicture,
            avatar: comment.userId.avatar,
          },
          createdAt: comment.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error sending live comment', { error: error.message });
      socket.emit('liveStreamError', { error: 'Failed to send comment' });
    }
  });

  // ==================== WEBRTC SIGNALING ====================

  // Live Stream Offer (Broadcaster → Viewer)
  socket.on('liveStreamOffer', async (data) => {
    try {
      const { streamId, viewerId, offer } = data;
      logger.info(`Relaying offer from ${userId} to viewer ${viewerId}`);

      // Send offer to specific viewer
      io.to(viewerId).emit('liveStreamOffer', {
        streamId,
        broadcasterId: userId,
        offer,
      });
      logger.info(`Offer sent to ${viewerId}`);
    } catch (error) {
      logger.error('Error sending live stream offer', { error: error.message });
      socket.emit('liveStreamError', { error: 'Failed to send offer' });
    }
  });

  // Live Stream Answer (Viewer → Broadcaster)
  socket.on('liveStreamAnswer', async (data) => {
    try {
      const { streamId, broadcasterId, answer } = data;
      logger.info(`Relaying answer from ${userId} to broadcaster ${broadcasterId}`);

      // Send answer back to broadcaster
      io.to(broadcasterId).emit('liveStreamAnswer', {
        streamId,
        viewerId: userId,
        answer,
      });
      logger.info(`Answer sent to ${broadcasterId}`);
    } catch (error) {
      logger.error('Error sending live stream answer', { error: error.message });
      socket.emit('liveStreamError', { error: 'Failed to send answer' });
    }
  });

  // Live Stream ICE Candidate
  socket.on('liveStreamIceCandidate', async (data) => {
    try {
      const { streamId, targetId, candidate } = data;

      // Send ICE candidate to target peer
      io.to(targetId).emit('liveStreamIceCandidate', {
        streamId,
        senderId: userId,
        candidate,
      });
    } catch (error) {
      logger.error('Error sending ICE candidate', { error: error.message });
      socket.emit('liveStreamError', { error: 'Failed to send ICE candidate' });
    }
  });

  // Handle disconnect - clean up live stream if broadcaster disconnects
  socket.on('disconnect', async () => {
    try {
      // Check if user was broadcasting
      const activeStream = await LiveStream.findOne({
        streamerId: userId,
        status: 'live',
      });

      if (activeStream) {
        // End the stream
        activeStream.status = 'ended';
        activeStream.endedAt = new Date();
        await activeStream.save();

        // Notify all viewers
        io.to(`stream:${activeStream._id}`).emit('liveStreamEnded', {
          streamId: activeStream._id,
          endedAt: activeStream.endedAt,
          reason: 'Broadcaster disconnected',
        });

        // Mark all viewers as left
        await LiveStreamViewer.updateMany(
          { liveStreamId: activeStream._id, leftAt: null },
          { leftAt: new Date() }
        );
      }

      // Check if user was viewing any streams
      const viewingStreams = await LiveStreamViewer.find({
        userId: userId,
        leftAt: null,
      });

      for (const viewer of viewingStreams) {
        viewer.leftAt = new Date();
        await viewer.save();

        // Decrement viewer count (atomic)
        const stream = await LiveStream.findOneAndUpdate(
          { _id: viewer.liveStreamId, viewerCount: { $gt: 0 } },
          { $inc: { viewerCount: -1 } },
          { new: true }
        );

        if (stream) {
          // Notify remaining viewers
          io.to(`stream:${viewer.liveStreamId}`).emit('viewerLeft', {
            streamId: viewer.liveStreamId,
            viewerCount: stream.viewerCount,
            userId: userId,
          });
        }
      }
    } catch (error) {
      logger.error('Error handling disconnect for live stream', { error: error.message });
    }
  });
};

export default liveStreamSocket;
