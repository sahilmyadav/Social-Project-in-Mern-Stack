import { Comment } from '../models/comment.model.js';
import { Followers } from '../models/followers.model.js';
import { Like } from '../models/like.model.js';
import { Notification } from '../models/notification.model.js';
import { Reel } from '../models/reel.model.js';
import { Report } from '../models/report.model.js';
import { Save } from '../models/save.model.js';
import { User } from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { deleteLocalFile, saveFileLocally, validateFile } from '../utils/localStorage.js';

const MAX_CAPTION_LENGTH = 2000;
const MAX_REEL_SIZE = 100 * 1024 * 1024;

export const uploadReel = asyncHandler(async (req, res) => {
  const { caption, music_id, tags, thumbnail, duration, width, height } = req.body;
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

  if (req.file.size > MAX_REEL_SIZE) {
    throw new ApiError(400, 'Video file must be less than 100MB');
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

  let parsedTags = [];
  if (tags) {
    try {
      parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    } catch {
      parsedTags = [];
    }
  }
  parsedTags = parsedTags.slice(0, 30);

  let reel;
  try {
    reel = await Reel.create({
      user_id: userId,
      media,
      caption: caption?.trim() || '',
      music_id: music_id || null,
      tags: parsedTags,
    });
  } catch (dbError) {
    await deleteLocalFile(savedFile.url);
    throw new ApiError(500, 'Failed to create reel. Please try again.');
  }

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

// // Like a reel
// export const likeReel = asyncHandler(async (req, res) => {
//   const { reelId } = req.params;
//   const userId = req.user._id;

//   const reel = await Reel.findOne({ _id: reelId, is_deleted: false });

//   if (!reel) {
//     throw new ApiError(404, "Reel not found");
//   }

//   // Check if already liked
//   const existingLike = await Like.findOne({
//     user_id: userId,
//     target_type: "reel",
//     target_id: reelId,
//   });

//   if (existingLike) {
//     throw new ApiError(400, "You already liked this reel");
//   }

//   await Like.create({
//     user_id: userId,
//     target_type: "reel",
//     target_id: reelId,
//   });

//   // Increment likes count
//   reel.likes_count += 1;
//   await reel.save();

//   return res
//     .status(200)
//     .json(new ApiResponse(200, { likes_count: reel.likes_count }, "Reel liked successfully"));
// });

// // Toggle like/unlike a reel
// export const toggleLikeReel = asyncHandler(async (req, res) => {
//   const { reelId } = req.params;
//   const userId = req.user._id;

//   const reel = await Reel.findOne({ _id: reelId, is_deleted: false });

//   if (!reel) {
//     throw new ApiError(404, "Reel not found");
//   }

//   // Check if already liked
//   const existingLike = await Like.findOne({
//     user_id: userId,
//     target_type: "reel",
//     target_id: reelId,
//   });

//   let isLiked;
//   let message;

//   if (existingLike) {
//     // Unlike the reel
//     await Like.findOneAndDelete({
//       user_id: userId,
//       target_type: "reel",
//       target_id: reelId,
//     });

//     // Decrement likes count
//     if (reel.likes_count > 0) {
//       reel.likes_count -= 1;
//       await reel.save();
//     }

//     isLiked = false;
//     message = "Reel unliked successfully";
//   } else {
//     // Like the reel
//     await Like.create({
//       user_id: userId,
//       target_type: "reel",
//       target_id: reelId,
//     });

//     // Increment likes count
//     reel.likes_count += 1;
//     await reel.save();

//     isLiked = true;
//     message = "Reel liked successfully";
//   }

//   return res
//     .status(200)
//     .json(
//       new ApiResponse(
//         200,
//         {
//           likes_count: reel.likes_count,
//           isLiked: isLiked
//         },
//         message
//       )
//     );
// });

// // Unlike a reel
// export const unlikeReel = asyncHandler(async (req, res) => {
//   const { reelId } = req.params;
//   const userId = req.user._id;

//   const like = await Like.findOneAndDelete({
//     user_id: userId,
//     target_type: "reel",
//     target_id: reelId,
//   });

//   if (!like) {
//     throw new ApiError(404, "Like not found");
//   }

//   // Decrement likes count
//   const reel = await Reel.findById(reelId);
//   if (reel && reel.likes_count > 0) {
//     reel.likes_count -= 1;
//     await reel.save();
//   }

//   return res
//     .status(200)
//     .json(new ApiResponse(200, null, "Reel unliked successfully"));
// });

export const toggleLikeReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;
  const userId = req.user._id;

  const reel = await Reel.findOne({ _id: reelId, is_deleted: false });
  if (!reel) {
    throw new ApiError(404, 'Reel not found');
  }

  const existingLike = await Like.findOne({
    user_id: userId,
    target_type: 'reel',
    target_id: reelId,
  });

  let isLiked;
  let message;

  if (existingLike) {
    // Unlike
    await Like.findOneAndDelete({
      user_id: userId,
      target_type: 'reel',
      target_id: reelId,
    });

    if (reel.likes_count > 0) {
      reel.likes_count -= 1;
    }
    isLiked = false;
    message = 'Reel unliked successfully';
  } else {
    // Like
    await Like.create({
      user_id: userId,
      target_type: 'reel',
      target_id: reelId,
    });

    reel.likes_count += 1;
    isLiked = true;
    message = 'Reel liked successfully';

    // Create notification for reel owner (only if liker is not the reel owner)
    if (reel.user_id.toString() !== userId.toString()) {
      try {
        // Get the liker's details for the notification message
        const liker = await User.findById(userId).select('firstName lastName profilePicture');

        await Notification.create({
          recipient_id: reel.user_id,
          sender_id: userId,
          type: 'reel_like',
          reference_id: reelId,
          reference_type: 'Reel',
          title: 'New Like',
          message: `${liker.firstName} ${liker.lastName} liked your reel`,
          thumbnail: reel.media?.url || null,
          is_read: false,
          action_url: `/reel/${reelId}`,
        });
      } catch (notifError) {
        // Don't fail the like operation if notification creation fails
        console.error('Failed to create notification:', notifError);
      }
    }
  }

  await reel.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        likes_count: reel.likes_count,
        isLiked: isLiked,
      },
      message
    )
  );
});

// Add comment to a reel
// Comment on a reel
export const commentOnReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;
  const { text, reply_to_comment_id } = req.body;
  const userId = req.user._id;

  // Validate input
  if (!text || text.trim().length === 0) {
    throw new ApiError(400, 'Comment text is required');
  }

  // Check if reel exists
  const reel = await Reel.findOne({ _id: reelId, is_deleted: false });
  if (!reel) {
    throw new ApiError(404, 'Reel not found');
  }

  // Create comment
  const comment = await Comment.create({
    user_id: userId,
    target_type: 'reel',
    target_id: reelId,
    text: text.trim(),
    reply_to_comment_id: reply_to_comment_id || null,
  });

  // Populate comment with user details
  const populatedComment = await Comment.findById(comment._id)
    .populate('user_id', 'firstName lastName profilePicture')
    .populate('reply_to_comment_id', 'text user_id')
    .populate('reply_to_comment_id.user_id', 'firstName lastName');

  // Update reel comments count
  reel.comments_count += 1;
  await reel.save();

  // Create notification for reel owner (only if commenter is not the reel owner)
  if (reel.user_id.toString() !== userId.toString()) {
    try {
      // Get the commenter's details for the notification message
      const commenter = await User.findById(userId).select('firstName lastName profilePicture');

      await Notification.create({
        recipient_id: reel.user_id,
        sender_id: userId,
        type: 'reel_comment',
        reference_id: reelId,
        reference_type: 'Reel',
        title: 'New Comment',
        message: `${commenter.firstName} ${commenter.lastName} commented on your reel`,
        thumbnail: reel.media?.url || null,
        is_read: false,
        action_url: `/reel/${reelId}`,
      });
    } catch (notifError) {
      // Don't fail the comment operation if notification creation fails
      console.error('Failed to create notification:', notifError);
    }
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        comment: populatedComment,
        comments_count: reel.comments_count,
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

  // Validate user exists and get privacy settings
  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw new ApiError(404, 'User not found');
  }

  // Check if account is private and user is not following
  const isOwnProfile = currentUserId && currentUserId.toString() === userId;

  if (targetUser.isPrivate && !isOwnProfile) {
    // Check if current user is following
    const isFollowing = await Followers.findOne({
      follower_id: currentUserId,
      following_id: userId,
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
    user_id: userId,
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

  // Add isLiked status for each reel
  const reelsWithLikeStatus = await Promise.all(
    reels.map(async (reel) => {
      const isLiked = currentUserId
        ? await Like.exists({ target_type: 'reel', target_id: reel._id, user_id: currentUserId })
        : null;

      return {
        ...reel,
        isLiked: !!isLiked,
        canDownload: reel.user_id?.allowDownloads !== false,
      };
    })
  );

  // Get total count for pagination
  const total = await Reel.countDocuments({
    user_id: userId,
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

// Save a reel
export const saveReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;
  const userId = req.user._id;

  const reel = await Reel.findOne({ _id: reelId, is_deleted: false });

  if (!reel) {
    throw new ApiError(404, 'Reel not found');
  }

  // Check if already saved
  const existingSave = await Save.findOne({
    user_id: userId,
    target_type: 'reel',
    target_id: reelId,
  });

  if (existingSave) {
    throw new ApiError(400, 'Reel already saved');
  }

  await Save.create({
    user_id: userId,
    target_type: 'reel',
    target_id: reelId,
  });

  // Increment saves count
  reel.saves_count = (reel.saves_count || 0) + 1;
  await reel.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { saves_count: reel.saves_count }, 'Reel saved successfully'));
});

// Unsave a reel
export const unsaveReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;
  const userId = req.user._id;

  const save = await Save.findOneAndDelete({
    user_id: userId,
    target_type: 'reel',
    target_id: reelId,
  });

  if (!save) {
    throw new ApiError(404, 'Saved reel not found');
  }

  // Decrement saves count
  const reel = await Reel.findById(reelId);
  if (reel && reel.saves_count > 0) {
    reel.saves_count -= 1;
    await reel.save();
  }

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

// Report a reel
export const reportReel = asyncHandler(async (req, res) => {
  const { reelId } = req.params;
  const { reason, details, attachments } = req.body;
  const userId = req.user._id;

  if (!reason) {
    throw new ApiError(400, 'Reason is required');
  }

  const reel = await Reel.findOne({ _id: reelId, is_deleted: false });

  if (!reel) {
    throw new ApiError(404, 'Reel not found');
  }

  const report = await Report.create({
    user_id: userId,
    target_type: 'reel',
    target_id: reelId,
    reason,
    details,
    attachments,
  });

  return res.status(201).json(new ApiResponse(201, report, 'Reel reported successfully'));
});
