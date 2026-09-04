import fs from 'fs';
import { Followers } from '../models/followers.model.js';
import { LiveStream } from '../models/liveStream.model.js';
import { LiveStreamComment } from '../models/liveStreamComment.model.js';
import { LiveStreamViewer } from '../models/liveStreamViewer.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { uploadFile } from '../utils/localStorage.js';
import logger from '../utils/logger.js';

// Max age for a live stream before it's considered stale (24 hours)
const MAX_LIVE_STREAM_AGE_MS = 24 * 60 * 60 * 1000;

// ==================== 1. CREATE LIVE STREAM ====================
export const createLiveStream = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const streamerId = req.user._id;

  if (!title) {
    throw new ApiError(400, 'Title is required');
  }

  // Handle thumbnail upload if provided
  let thumbnailUrl = null;
  if (req.file) {
    const thumbnailLocalPath = req.file.path;
    const thumbnail = await uploadFile(thumbnailLocalPath);

    if (thumbnail) {
      thumbnailUrl = thumbnail.url;
    }

    // Clean up local file
    if (fs.existsSync(thumbnailLocalPath)) {
      fs.unlinkSync(thumbnailLocalPath);
    }
  }

  const liveStream = await LiveStream.create({
    streamerId,
    title,
    description,
    thumbnail: thumbnailUrl,
    status: 'waiting',
  });

  return res.status(201).json(new ApiResponse(201, liveStream, 'Live stream created successfully'));
});

// ==================== 2. START LIVE STREAM ====================
export const startLiveStream = asyncHandler(async (req, res) => {
  const { streamId } = req.params;
  const streamerId = req.user._id;

  const liveStream = await LiveStream.findById(streamId);

  if (!liveStream) {
    throw new ApiError(404, 'Live stream not found');
  }

  if (liveStream.streamerId.toString() !== streamerId.toString()) {
    throw new ApiError(403, 'You are not authorized to start this stream');
  }

  if (liveStream.status === 'live') {
    throw new ApiError(400, 'Stream is already live');
  }

  if (liveStream.status === 'ended') {
    throw new ApiError(400, 'Cannot restart an ended stream');
  }

  liveStream.status = 'live';
  liveStream.startedAt = new Date();
  await liveStream.save();

  return res.status(200).json(new ApiResponse(200, liveStream, 'Live stream started successfully'));
});

// ==================== 3. END LIVE STREAM ====================
export const endLiveStream = asyncHandler(async (req, res) => {
  const { streamId } = req.params;
  const streamerId = req.user._id;

  const liveStream = await LiveStream.findById(streamId);

  if (!liveStream) {
    throw new ApiError(404, 'Live stream not found');
  }

  if (liveStream.streamerId.toString() !== streamerId.toString()) {
    throw new ApiError(403, 'You are not authorized to end this stream');
  }

  if (liveStream.status === 'ended') {
    throw new ApiError(400, 'Stream has already ended');
  }

  liveStream.status = 'ended';
  liveStream.endedAt = new Date();
  await liveStream.save();

  // Mark all viewers as left
  await LiveStreamViewer.updateMany(
    { liveStreamId: streamId, leftAt: null },
    { leftAt: new Date() }
  );

  return res.status(200).json(new ApiResponse(200, liveStream, 'Live stream ended successfully'));
});



// Transform populated streamerId into a streamer field for frontend compatibility
const formatLiveStream = (stream) => {
  const obj = stream.toObject ? stream.toObject() : { ...stream };
  if (obj.streamerId && typeof obj.streamerId === 'object') {
    obj.streamer = {
      _id: obj.streamerId._id,
      username: obj.streamerId.username,
      fullName: `${obj.streamerId.firstName || ''} ${obj.streamerId.lastName || ''}`.trim(),
      firstName: obj.streamerId.firstName,
      lastName: obj.streamerId.lastName,
      profilePicture: obj.streamerId.profilePicture || obj.streamerId.avatar,
      avatar: obj.streamerId.avatar,
    };
    obj.streamerId = obj.streamer._id;
  }
  return obj;
};

// ==================== 4. GET LIVE STREAM DETAILS ====================
export const getLiveStreamDetails = asyncHandler(async (req, res) => {
  const { streamId } = req.params;

  const liveStream = await LiveStream.findById(streamId).populate(
    'streamerId',
    'firstName lastName username profilePicture avatar'
  );

  if (!liveStream) {
    throw new ApiError(404, 'Live stream not found');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, formatLiveStream(liveStream), 'Live stream details fetched successfully'));
});



// ==================== 5. GET ACTIVE LIVE STREAMS (FROM FOLLOWED + FOLLOWERS) ====================
export const getActiveLiveStreams = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get users the current user follows
  const following = await Followers.find({
    follower_id: userId,
    status: 'accepted',
  }).select('following_id');

  // Get users who follow the current user (friends/followers)
  const followers = await Followers.find({
    following_id: userId,
    status: 'accepted',
  }).select('follower_id');

  // Combine both lists (following + followers) and deduplicate
  const followingIds = following.map((f) => f.following_id.toString());
  const followerIds = followers.map((f) => f.follower_id.toString());
  const connectedUserIds = [...new Set([...followingIds, ...followerIds])];

  // Find active live streams from connected users (exclude stale streams)
  const staleThreshold = new Date(Date.now() - MAX_LIVE_STREAM_AGE_MS);
  const liveStreams = await LiveStream.find({
    streamerId: { $in: connectedUserIds },
    status: 'live',
    startedAt: { $gte: staleThreshold },
  })
    .populate('streamerId', 'firstName lastName username profilePicture avatar')
    .sort({ startedAt: -1 });

  const formatted = liveStreams.map(formatLiveStream);

  return res
    .status(200)
    .json(new ApiResponse(200, formatted, 'Active live streams fetched successfully'));
});

// ==================== 6. GET ALL LIVE STREAMS (PUBLIC) ====================
export const getAllLiveStreams = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (page - 1) * limit;

  // Exclude streams older than 24h — they are stale/zombie streams
  const staleThreshold = new Date(Date.now() - MAX_LIVE_STREAM_AGE_MS);
  const liveQuery = { status: 'live', startedAt: { $gte: staleThreshold } };

  const liveStreams = await LiveStream.find(liveQuery)
    .populate('streamerId', 'firstName lastName username profilePicture avatar')
    .sort({ viewerCount: -1, startedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const formatted = liveStreams.map(formatLiveStream);

  const total = await LiveStream.countDocuments(liveQuery);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        liveStreams: formatted,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
      'All live streams fetched successfully'
    )
  );
});

// ==================== 7. JOIN LIVE STREAM ====================
export const joinLiveStream = asyncHandler(async (req, res) => {
  const { streamId } = req.params;
  const userId = req.user._id;

  const liveStream = await LiveStream.findById(streamId);

  if (!liveStream) {
    throw new ApiError(404, 'Live stream not found');
  }

  if (liveStream.status !== 'live') {
    throw new ApiError(400, 'Stream is not currently live');
  }

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

  // Re-fetch for response
  const updatedStream = await LiveStream.findById(streamId);

  return res
    .status(200)
    .json(
      new ApiResponse(200, { liveStream: updatedStream, viewer }, 'Joined live stream successfully')
    );
});

// ==================== 8. LEAVE LIVE STREAM ====================
export const leaveLiveStream = asyncHandler(async (req, res) => {
  const { streamId } = req.params;
  const userId = req.user._id;

  const viewer = await LiveStreamViewer.findOne({
    liveStreamId: streamId,
    userId: userId,
    leftAt: null,
  });

  if (!viewer) {
    throw new ApiError(404, 'You are not currently viewing this stream');
  }

  viewer.leftAt = new Date();
  await viewer.save();

  // Decrement viewer count (atomic)
  await LiveStream.updateOne(
    { _id: streamId, viewerCount: { $gt: 0 } },
    { $inc: { viewerCount: -1 } }
  );

  return res.status(200).json(new ApiResponse(200, null, 'Left live stream successfully'));
});

// ==================== 9. SEND LIVE COMMENT ====================
export const sendLiveComment = asyncHandler(async (req, res) => {
  const { streamId } = req.params;
  const { text } = req.body;
  const userId = req.user._id;

  if (!text || text.trim().length === 0) {
    throw new ApiError(400, 'Comment text is required');
  }

  const liveStream = await LiveStream.findById(streamId);

  if (!liveStream) {
    throw new ApiError(404, 'Live stream not found');
  }

  if (liveStream.status !== 'live') {
    throw new ApiError(400, 'Cannot comment on a stream that is not live');
  }

  const comment = await LiveStreamComment.create({
    liveStreamId: streamId,
    userId: userId,
    text: text.trim(),
  });

  // Populate user info
  await comment.populate('userId', 'firstName lastName username profilePicture avatar');

  return res.status(201).json(new ApiResponse(201, comment, 'Comment sent successfully'));
});

// ==================== 10. GET LIVE COMMENTS ====================
export const getLiveComments = asyncHandler(async (req, res) => {
  const { streamId } = req.params;
  const { limit = 50, before } = req.query;

  const query = { liveStreamId: streamId };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const comments = await LiveStreamComment.find(query)
    .populate('userId', 'firstName lastName username profilePicture avatar')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  return res.status(200).json(new ApiResponse(200, comments, 'Comments fetched successfully'));
});

// ==================== 11. GET LIVE STREAM VIEWERS ====================
export const getLiveStreamViewers = asyncHandler(async (req, res) => {
  const { streamId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const skip = (page - 1) * limit;

  const viewers = await LiveStreamViewer.find({
    liveStreamId: streamId,
    leftAt: null,
  })
    .populate('userId', 'firstName lastName username profilePicture avatar')
    .sort({ joinedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await LiveStreamViewer.countDocuments({
    liveStreamId: streamId,
    leftAt: null,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        viewers,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
      'Viewers fetched successfully'
    )
  );
});

// ==================== 12. GET USER'S LIVE STREAMS ====================
export const getUserLiveStreams = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10, status } = req.query;

  const skip = (page - 1) * limit;

  const query = { streamerId: userId };
  if (status) {
    query.status = status;
  }

  const liveStreams = await LiveStream.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await LiveStream.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        liveStreams,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
      'User live streams fetched successfully'
    )
  );
});

// ==================== 13. DELETE LIVE STREAM ====================
export const deleteLiveStream = asyncHandler(async (req, res) => {
  const { streamId } = req.params;
  const streamerId = req.user._id;

  const liveStream = await LiveStream.findById(streamId);

  if (!liveStream) {
    throw new ApiError(404, 'Live stream not found');
  }

  if (liveStream.streamerId.toString() !== streamerId.toString()) {
    throw new ApiError(403, 'You are not authorized to delete this stream');
  }

  // Delete associated viewers and comments
  await LiveStreamViewer.deleteMany({ liveStreamId: streamId });
  await LiveStreamComment.deleteMany({ liveStreamId: streamId });

  // Delete the stream
  await LiveStream.findByIdAndDelete(streamId);

  return res.status(200).json(new ApiResponse(200, null, 'Live stream deleted successfully'));
});

// ==================== STALE STREAM CLEANUP ====================

/**
 * Clean up stale/zombie live streams that were never properly ended.
 * This handles cases where the server restarts or the broadcaster
 * disconnects without the socket disconnect handler firing.
 */
export const cleanupStaleLiveStreams = async () => {
  try {
    const staleThreshold = new Date(Date.now() - MAX_LIVE_STREAM_AGE_MS);

    const staleStreams = await LiveStream.updateMany(
      { status: 'live', startedAt: { $lt: staleThreshold } },
      { status: 'ended', endedAt: new Date() }
    );

    if (staleStreams.modifiedCount > 0) {
      logger.info(`[LiveStream Cleanup] Ended ${staleStreams.modifiedCount} stale live stream(s)`);

      // Also mark their viewers as left
      await LiveStreamViewer.updateMany(
        { leftAt: null },
        { leftAt: new Date() }
      );
    }
  } catch (error) {
    logger.error('[LiveStream Cleanup] Error cleaning up stale streams', { error: error.message });
  }
};

/**
 * Start periodic cleanup job for stale live streams.
 * Runs every 30 minutes.
 */
export const startLiveStreamCleanupJob = () => {
  // Run immediately on startup to clean up streams from before the restart
  cleanupStaleLiveStreams();

  // Then run every 30 minutes
  setInterval(cleanupStaleLiveStreams, 30 * 60 * 1000);
  logger.info('[LiveStream Cleanup] Stale stream cleanup job started (every 30 min)');
};
