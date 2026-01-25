import { Followers } from '../models/followers.model.js';
import { LiveStream } from '../models/liveStream.model.js';
import { LiveStreamComment } from '../models/liveStreamComment.model.js';
import { LiveStreamViewer } from '../models/liveStreamViewer.model.js';
import { Notification } from '../models/notification.model.js';
import { User } from '../models/user.model.js';

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
            const streamer = await User.findById(userId).select('firstName lastName username profilePicture avatar');

            // Join broadcaster to their own stream room
            socket.join(`stream:${streamId}`);

            // Notify all followers that stream has started
            const followers = await Followers.find({
                following_id: userId,
                status: 'accepted'
            }).select('follower_id');

            const followerIds = followers.map(f => f.follower_id.toString());

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
                    await notification.populate('sender_id', 'firstName lastName username profilePicture avatar');

                    // Emit real-time notification to each follower
                    io.to(followerId).emit('liveStreamStarted', {
                        streamId,
                        streamerId: userId,
                        streamerName: `${streamer?.firstName || ''} ${streamer?.lastName || ''}`.trim(),
                        streamerUsername: streamer?.username,
                        streamerAvatar: streamer?.profilePicture || streamer?.avatar,
                        title: liveStream.title,
                        thumbnail: liveStream.thumbnail
                    });

                    // Also emit as regular notification
                    io.to(followerId).emit('newNotification', {
                        notification: notification.toObject(),
                    });
                } catch (err) {
                    console.error(`Failed to create notification for follower ${followerId}:`, err);
                }
            });

            await Promise.all(notificationPromises);

            socket.emit('liveStreamStartSuccess', { streamId, status: 'live' });

        } catch (error) {
            console.error('Error starting live stream:', error);
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
                endedAt: liveStream.endedAt
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
            console.error('Error ending live stream:', error);
            socket.emit('liveStreamError', { error: 'Failed to end stream' });
        }
    });

    // Join Live Stream
    socket.on('joinLiveStream', async (data) => {
        try {
            const { streamId } = data;

            const liveStream = await LiveStream.findById(streamId);

            if (!liveStream) {
                socket.emit('liveStreamError', { error: 'Live stream not found' });
                return;
            }

            if (liveStream.status !== 'live') {
                socket.emit('liveStreamError', { error: 'Stream is not live' });
                return;
            }

            // Join the stream room
            socket.join(`stream:${streamId}`);

            // Check if viewer already exists
            let viewer = await LiveStreamViewer.findOne({
                liveStreamId: streamId,
                userId: userId
            });

            if (!viewer) {
                // Create new viewer record
                viewer = await LiveStreamViewer.create({
                    liveStreamId: streamId,
                    userId: userId,
                    joinedAt: new Date()
                });

                // Increment viewer count
                liveStream.viewerCount += 1;
                await liveStream.save();
            } else if (viewer.leftAt) {
                // Viewer rejoining
                viewer.leftAt = null;
                viewer.joinedAt = new Date();
                await viewer.save();

                liveStream.viewerCount += 1;
                await liveStream.save();
            }

            // Get viewer info
            const viewerInfo = await User.findById(userId).select('firstName lastName username profilePicture avatar');

            // Notify broadcaster and all viewers about new viewer
            // Include viewerId (the userId) for WebRTC signaling
            io.to(`stream:${streamId}`).emit('viewerJoined', {
                streamId,
                viewerId: userId.toString(), // Used for WebRTC peer connection
                viewerSocketId: socket.id, // Socket ID for direct communication
                viewerCount: liveStream.viewerCount,
                viewer: {
                    _id: userId,
                    firstName: viewerInfo?.firstName,
                    lastName: viewerInfo?.lastName,
                    username: viewerInfo?.username,
                    profilePicture: viewerInfo?.profilePicture,
                    avatar: viewerInfo?.avatar
                }
            });

            // Also notify the broadcaster specifically so they can initiate WebRTC
            io.to(liveStream.streamerId.toString()).emit('viewerJoined', {
                streamId,
                viewerId: userId.toString(),
                viewerSocketId: socket.id,
                viewerCount: liveStream.viewerCount,
                viewer: {
                    _id: userId,
                    firstName: viewerInfo?.firstName,
                    lastName: viewerInfo?.lastName,
                    username: viewerInfo?.username,
                    profilePicture: viewerInfo?.profilePicture,
                    avatar: viewerInfo?.avatar
                }
            });

            socket.emit('liveStreamJoinSuccess', {
                streamId,
                viewerCount: liveStream.viewerCount,
                broadcasterId: liveStream.streamerId.toString()
            });

        } catch (error) {
            console.error('Error joining live stream:', error);
            socket.emit('liveStreamError', { error: 'Failed to join stream' });
        }
    });

    // Leave Live Stream
    socket.on('leaveLiveStream', async (data) => {
        try {
            const { streamId } = data;

            const viewer = await LiveStreamViewer.findOne({
                liveStreamId: streamId,
                userId: userId,
                leftAt: null
            });

            if (viewer) {
                viewer.leftAt = new Date();
                await viewer.save();

                // Decrement viewer count
                const liveStream = await LiveStream.findById(streamId);
                if (liveStream && liveStream.viewerCount > 0) {
                    liveStream.viewerCount -= 1;
                    await liveStream.save();

                    // Notify all viewers about updated count
                    io.to(`stream:${streamId}`).emit('viewerLeft', {
                        streamId,
                        viewerCount: liveStream.viewerCount,
                        userId: userId
                    });
                }
            }

            // Leave the stream room
            socket.leave(`stream:${streamId}`);

            socket.emit('liveStreamLeaveSuccess', { streamId });

        } catch (error) {
            console.error('Error leaving live stream:', error);
            socket.emit('liveStreamError', { error: 'Failed to leave stream' });
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
                text: text.trim()
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
                        avatar: comment.userId.avatar
                    },
                    createdAt: comment.createdAt
                }
            });

        } catch (error) {
            console.error('Error sending live comment:', error);
            socket.emit('liveStreamError', { error: 'Failed to send comment' });
        }
    });

    // ==================== WEBRTC SIGNALING ====================

    // Live Stream Offer (Broadcaster → Viewer)
    socket.on('liveStreamOffer', async (data) => {
        try {
            const { streamId, viewerId, offer } = data;

            // Send offer to specific viewer
            io.to(viewerId).emit('liveStreamOffer', {
                streamId,
                broadcasterId: userId,
                offer
            });

        } catch (error) {
            console.error('Error sending live stream offer:', error);
            socket.emit('liveStreamError', { error: 'Failed to send offer' });
        }
    });

    // Live Stream Answer (Viewer → Broadcaster)
    socket.on('liveStreamAnswer', async (data) => {
        try {
            const { streamId, broadcasterId, answer } = data;

            // Send answer back to broadcaster
            io.to(broadcasterId).emit('liveStreamAnswer', {
                streamId,
                viewerId: userId,
                answer
            });

        } catch (error) {
            console.error('Error sending live stream answer:', error);
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
                candidate
            });

        } catch (error) {
            console.error('Error sending ICE candidate:', error);
            socket.emit('liveStreamError', { error: 'Failed to send ICE candidate' });
        }
    });

    // Handle disconnect - clean up live stream if broadcaster disconnects
    socket.on('disconnect', async () => {
        try {
            // Check if user was broadcasting
            const activeStream = await LiveStream.findOne({
                streamerId: userId,
                status: 'live'
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
                    reason: 'Broadcaster disconnected'
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
                leftAt: null
            });

            for (const viewer of viewingStreams) {
                viewer.leftAt = new Date();
                await viewer.save();

                // Decrement viewer count
                const stream = await LiveStream.findById(viewer.liveStreamId);
                if (stream && stream.viewerCount > 0) {
                    stream.viewerCount -= 1;
                    await stream.save();

                    // Notify remaining viewers
                    io.to(`stream:${viewer.liveStreamId}`).emit('viewerLeft', {
                        streamId: viewer.liveStreamId,
                        viewerCount: stream.viewerCount,
                        userId: userId
                    });
                }
            }

        } catch (error) {
            console.error('Error handling disconnect for live stream:', error);
        }
    });
};

export default liveStreamSocket;
