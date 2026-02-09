import mongoose from 'mongoose';
import { Comment } from '../models/comment.model.js';
import { Followers } from '../models/followers.model.js';
import { Like } from '../models/like.model.js';
import { Reel } from '../models/reel.model.js';
import { ReelView } from '../models/reelView.model.js';
import { Save } from '../models/save.model.js';
import { User } from '../models/user.model.js';
import {
  addComment as addCommentService,
  parseMusicData,
  parseTagIds,
  reportContent,
  saveContent,
  sendTagNotifications,
  toggleLike,
  unsaveContent,
} from '../services/content.service.js';
import { getLikedIds } from '../services/enrichment.service.js';
import { notifyNewReel } from '../services/notification.service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { deleteLocalFile, saveFileLocally } from '../utils/localStorage.js';
import logger from '../utils/logger.js';

const MAX_CAPTION_LENGTH = 2000;

export const uploadReel = asyncHandler(async (req, res) => {
  const { caption, music_id, music, tags, thumbnail, duration, width, height } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  if (!req.file) {
    throw new ApiError(400, 'Video file is required');
  }

  if (!req.file.mimetype.startsWith('video/')) {
    throw new ApiError(400, 'Only video files are allowed for reels');
  }

  if (caption && caption.length > MAX_CAPTION_LENGTH) {
    throw new ApiError(400, `Caption must be less than ${MAX_CAPTION_LENGTH} characters`);
  }

  const savedFile = await saveFileLocally(req.file.path, userId, 'reel');

  if (!savedFile) {
    throw new ApiError(500, 'Failed to save video. Please try again.');
  }

  const media = {
    url: savedFile.url,
    thumbnail: thumbnail || savedFile.url,
    duration: duration || null,
    width: width || null,
    height: height || null,
    fileName: savedFile.fileName,
    public_id: savedFile.public_id,
    size: savedFile.size,
  };

  let parsedTags = parseTagIds(tags).slice(0, 30);

  // Filter to only valid user IDs
  const validTags = parsedTags.filter((tag) => {
    if (typeof tag === 'string' && mongoose.Types.ObjectId.isValid(tag)) {
      return true;
    }
    return false;
  });

  const musicData = parseMusicData(music);

  let reel;
  try {
    reel = await Reel.create({
      user_id: userId,
      media,
      caption: caption?.trim() || '',
      music_id: music_id || null,
      music: musicData,
      tags: validTags,
    });

    // Send notifications to tagged users
    if (validTags.length > 0) {
      sendTagNotifications({
        taggedUserIds: validTags,
        senderId: userId,
        contentId: reel._id,
        contentType: 'reel',
      }).catch((err) => logger.error('Tag notification error:', { error: err.message }));
    }
  } catch (dbError) {
    await deleteLocalFile(savedFile.url);
    throw new ApiError(500, 'Failed to create reel. Please try again.');
  }

  // Notify all followers about the new reel (async, don't block response)
  notifyNewReel(reel._id, userId, reel.media?.thumbnail || reel.media?.url || null).catch((err) => {
    logger.error('Error sending new reel notifications:', { error: err.message });
  });

  return res.status(201).json(new ApiResponse(201, reel, 'Reel created successfully'));
});

// Delete a reel
export const deleteReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;
  const userId = req.user._id;

  const reel = await Reel.findById(reelId);

  if (!reel || reel.is_deleted) {
    throw new ApiError(404, 'Reel not found');
  }

  // Check if user is owner
  if (reel.user_id.toString() !== userId.toString()) {
    throw new ApiError(403, 'You are not authorized to delete this reel');
  }

  reel.is_deleted = true;
  await reel.save();

  return res.status(200).json(new ApiResponse(200, null, 'Reel deleted successfully'));
});

// Get reel details
export const getReelDetails = asyncHandler(async (req, res) => {
  const { reelId } = req.params;

  const reel = await Reel.findOne({ _id: reelId, is_deleted: false })
    .populate(
      'user_id',
      'firstName lastName username profilePicture profileImage avatar allowDownloads isVerified'
    )
    .populate('tags', 'firstName lastName username');

  if (!reel) {
    throw new ApiError(404, 'Reel not found');
  }

  // Get comments for this reel
  const comments = await Comment.find({
    target_type: 'reel',
    target_id: reelId,
    is_deleted: false,
    reply_to_comment_id: null,
  })
    .populate('user_id', 'firstName lastName username profilePicture')
    .sort({ createdAt: -1 })
    .limit(10);

  const reelData = reel.toObject();
  reelData.comments = comments;
  reelData.canDownload = reel.user_id?.allowDownloads !== false;

  // Check if current user liked this reel
  const userId = req.user?._id;
  if (userId) {
    const liked = await Like.findOne({
      user_id: userId,
      target_type: 'reel',
      target_id: reelId,
    });
    reelData.is_liked = !!liked;
  }

  return res.status(200).json(new ApiResponse(200, reelData, 'Reel details fetched successfully'));
});

export const toggleLikeReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;

  const result = await toggleLike({
    Model: Reel,
    contentId: reelId,
    userId: req.user._id,
    contentType: 'reel',
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        likes_count: result.likesCount,
        isLiked: result.isLiked,
      },
      result.message
    )
  );
});

export const commentOnReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;
  const { text, reply_to_comment_id } = req.body;

  const comment = await addCommentService({
    Model: Reel,
    contentId: reelId,
    userId: req.user._id,
    text,
    replyToCommentId: reply_to_comment_id,
    contentType: 'reel',
  });

  const reel = await Reel.findById(reelId).select('comments_count');

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        comment,
        comments_count: reel?.comments_count || 0,
      },
      'Comment added successfully'
    )
  );
});

export const getReelComments = asyncHandler(async (req, res) => {
  const { reelId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const reel = await Reel.findOne({ _id: reelId, is_deleted: false });
  if (!reel) {
    throw new ApiError(404, 'Reel not found');
  }

  const comments = await Comment.find({
    target_type: 'reel',
    target_id: reelId,
    reply_to_comment_id: null,
    is_deleted: false,
  })
    .populate('user_id', 'firstName lastName profilePicture profileImage avatar')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  return res.status(200).json(new ApiResponse(200, { comments }, 'Comments fetched successfully'));
});

export const getUserReels = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user?._id;
  const { page = 1, limit = 20 } = req.query;

  // Check if userId is a valid MongoDB ObjectId or a username
  const isValidObjectId = mongoose.Types.ObjectId.isValid(userId);

  // Validate user exists and get privacy settings
  let targetUser;
  if (isValidObjectId) {
    targetUser = await User.findById(userId);
  }
  if (!targetUser) {
    targetUser = await User.findOne({ username: userId });
  }
  if (!targetUser) {
    throw new ApiError(404, 'User not found');
  }

  const targetUserObjectId = targetUser._id;
  const targetUserId = targetUser._id.toString();

  // Check if account is private and user is not following
  const isOwnProfile = currentUserId && currentUserId.toString() === targetUserId;

  if (targetUser.isPrivate && !isOwnProfile) {
    // Check if current user is following
    const isFollowing = await Followers.findOne({
      follower_id: currentUserId,
      following_id: targetUserId,
      status: 'accepted',
    });

    if (!isFollowing) {
      // Private account and not following - return empty
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            reels: [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              pages: 0,
            },
            isPrivate: true,
            message: 'This account is private',
          },
          'This account is private'
        )
      );
    }
  }

  // User is allowed to see reels
  const reels = await Reel.find({
    user_id: targetUserObjectId,
    is_deleted: false,
  })
    .populate(
      'user_id',
      'firstName lastName username profilePicture profileImage avatar allowDownloads isVerified isPrivate'
    )
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Add isLiked status for each reel (batch — no N+1)
  const reelIds = reels.map((r) => r._id);
  const reelLikedSet = currentUserId
    ? await getLikedIds(reelIds, 'reel', currentUserId)
    : new Set();

  const reelsWithLikeStatus = reels.map((reel) => ({
    ...reel,
    isLiked: reelLikedSet.has(reel._id.toString()),
    canDownload: reel.user_id?.allowDownloads !== false,
  }));

  // Get total count for pagination
  const total = await Reel.countDocuments({
    user_id: targetUserObjectId,
    is_deleted: false,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        reels: reelsWithLikeStatus,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
        isPrivate: false,
      },
      'User reels fetched successfully'
    )
  );
});

export const saveReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;

  await saveContent({
    Model: Reel,
    contentId: reelId,
    userId: req.user._id,
    contentType: 'reel',
  });

  return res.status(200).json(new ApiResponse(200, null, 'Reel saved successfully'));
});

export const unsaveReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;

  await unsaveContent({
    Model: Reel,
    contentId: reelId,
    userId: req.user._id,
    contentType: 'reel',
  });

  return res.status(200).json(new ApiResponse(200, null, 'Reel unsaved successfully'));
});

// Get user's saved reels
export const getUserSavedReels = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 20 } = req.query;

  const skip = (page - 1) * limit;

  // Find all saved reels for the user
  const savedReels = await Save.find({
    user_id: userId,
    target_type: 'reel',
  })
    .populate({
      path: 'target_id',
      populate: {
        path: 'user_id',
        select:
          'firstName lastName username profilePicture profileImage avatar allowDownloads isVerified',
      },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Filter out deleted reels and map to reel objects with canDownload flag
  const reels = savedReels
    .filter((save) => save.target_id && !save.target_id.is_deleted)
    .map((save) => ({
      ...save.target_id.toObject(),
      canDownload: save.target_id.user_id?.allowDownloads !== false,
    }));

  const totalSavedReels = await Save.countDocuments({
    user_id: userId,
    target_type: 'reel',
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        savedReels: reels,
        reels: reels, // For compatibility
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalSavedReels / limit),
          totalItems: totalSavedReels,
          itemsPerPage: parseInt(limit),
        },
      },
      'Saved reels fetched successfully'
    )
  );
});

export const reportReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new ApiError(400, 'Reason is required');
  }

  const reel = await Reel.findOne({ _id: reelId, is_deleted: false });
  if (!reel) {
    throw new ApiError(404, 'Reel not found');
  }

  await reportContent({
    contentId: reelId,
    userId: req.user._id,
    reason,
    contentType: 'reel',
  });

  return res.status(201).json(new ApiResponse(201, null, 'Reel reported successfully'));
});

// View a reel (increment view count - unique per user)
export const viewReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(reelId)) {
    throw new ApiError(400, 'Invalid reel ID');
  }

  const reel = await Reel.findOne({ _id: reelId, is_deleted: false });

  if (!reel) {
    throw new ApiError(404, 'Reel not found');
  }

  // Don't track view if user is viewing their own reel
  if (reel.user_id.toString() === userId.toString()) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { viewed: false, views_count: reel.views_count },
          'Own reel - view not tracked'
        )
      );
  }

  // Try to insert a unique view record
  // If user already viewed, this will fail due to unique index and we catch it
  try {
    await ReelView.create({ reel_id: reelId, user_id: userId });

    // Successfully inserted, so increment view count
    const updatedReel = await Reel.findByIdAndUpdate(
      reelId,
      { $inc: { views_count: 1 } },
      { new: true }
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { viewed: true, views_count: updatedReel.views_count },
          'Reel view recorded'
        )
      );
  } catch (error) {
    // Duplicate key error means user already viewed this reel
    if (error.code === 11000) {
      return res
        .status(200)
        .json(
          new ApiResponse(200, { viewed: false, views_count: reel.views_count }, 'Already viewed')
        );
    }
    throw error;
  }
});
