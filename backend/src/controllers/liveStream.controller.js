import fs from 'fs';
import { Followers } from '../models/followers.model.js';
import { LiveStream } from '../models/liveStream.model.js';
import { LiveStreamComment } from '../models/liveStreamComment.model.js';
import { LiveStreamViewer } from '../models/liveStreamViewer.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { uploadOnCloudinary } from '../utils/localStorage.js';

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
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

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
    .json(new ApiResponse(200, liveStream, 'Live stream details fetched successfully'));
});

// ==================== 5. GET ACTIVE LIVE STREAMS (FROM FOLLOWED USERS) ====================
export const getActiveLiveStreams = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get list of users that the current user follows
  const following = await Followers.find({
    follower_id: userId,
    status: 'accepted',
  }).select('following_id');

  const followingIds = following.map((f) => f.following_id);

  // Find active live streams from followed users
  const liveStreams = await LiveStream.find({
    streamerId: { $in: followingIds },
    status: 'live',
  })
    .populate('streamerId', 'firstName lastName username profilePicture avatar')
    .sort({ startedAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, liveStreams, 'Active live streams fetched successfully'));
});

// ==================== 6. GET ALL LIVE STREAMS (PUBLIC) ====================
export const getAllLiveStreams = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (page - 1) * limit;

  const liveStreams = await LiveStream.find({ status: 'live' })
    .populate('streamerId', 'firstName lastName username profilePicture avatar')
    .sort({ viewerCount: -1, startedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await LiveStream.countDocuments({ status: 'live' });

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

  // Check if viewer already exists
  let viewer = await LiveStreamViewer.findOne({
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

  return res
    .status(200)
    .json(new ApiResponse(200, { liveStream, viewer }, 'Joined live stream successfully'));
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

  // Decrement viewer count
  const liveStream = await LiveStream.findById(streamId);
  if (liveStream && liveStream.viewerCount > 0) {
    liveStream.viewerCount -= 1;
    await liveStream.save();
  }

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
