import mongoose from 'mongoose';
import { Comment } from '../models/comment.model.js';
import { Followers } from '../models/followers.model.js';
import { Like } from '../models/like.model.js';
import { Notification } from '../models/notification.model.js';
import { Post } from '../models/post.model.js';
import { Report } from '../models/report.model.js';
import { Save } from '../models/save.model.js';
import { User } from '../models/user.model.js';
import { notifyNewPost } from '../services/notification.service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { deleteMultipleFiles, saveMultipleFilesLocally } from '../utils/localStorage.js';

const MAX_FILES_PER_POST = 10;
const MAX_CAPTION_LENGTH = 2000;

export const uploadPost = asyncHandler(async (req, res) => {
  const { caption, tags, location, visibility } = req.body;
  const userId = req.user._id;
  const files = req.files;

  if (!files || files.length === 0) {
    throw new ApiError(400, 'At least one media file is required');
  }

  if (files.length > MAX_FILES_PER_POST) {
    throw new ApiError(400, `Maximum ${MAX_FILES_PER_POST} files allowed per post`);
  }

  if (caption && caption.length > MAX_CAPTION_LENGTH) {
    throw new ApiError(400, `Caption must be less than ${MAX_CAPTION_LENGTH} characters`);
  }

  const savedFiles = await saveMultipleFilesLocally(files, userId, 'post');

  if (savedFiles.length === 0) {
    throw new ApiError(500, 'Failed to save media files. Please try again.');
  }

  const media = savedFiles.map((file) => ({
    type: file.type,
    url: file.url,
    thumbnail: file.url,
    width: null,
    height: null,
    duration: null,
    public_id: file.public_id,
    fileName: file.fileName,
    size: file.size,
  }));

  let parsedTags = [];
  if (tags) {
    if (typeof tags === 'string') {
      try {
        parsedTags = JSON.parse(tags);
      } catch {
        parsedTags = tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
      }
    } else if (Array.isArray(tags)) {
      parsedTags = tags;
    }
  }
  parsedTags = parsedTags.slice(0, 30);

  let parsedLocation = null;
  if (location && typeof location === 'string' && location.trim()) {
    try {
      parsedLocation = JSON.parse(location);
    } catch {
      parsedLocation = { name: location.trim() };
    }
  }

  let post;
  try {
    // Only include valid ObjectId tags (for user mentions)
    const validTags = parsedTags.filter((tag) => {
      if (typeof tag === 'string' && mongoose.Types.ObjectId.isValid(tag)) {
        return true;
      }
      if (tag instanceof mongoose.Types.ObjectId) {
        return true;
      }
      return false;
    });

    post = await Post.create({
      user_id: userId,
      caption: caption?.trim() || '',
      media,
      tags: validTags,
      location: parsedLocation,
      visibility: visibility || 'public',
    });

    // Send notifications to tagged users
    if (validTags.length > 0) {
      const postCreator = await User.findById(userId).select('firstName lastName');

      for (const taggedUserId of validTags) {
        // Don't notify yourself if you tag yourself
        if (taggedUserId.toString() === userId.toString()) continue;

        try {
          await Notification.create({
            recipient_id: taggedUserId,
            sender_id: userId,
            type: 'tag',
            reference_id: post._id,
            reference_type: 'Post',
            title: 'You were tagged',
            message: `${postCreator.firstName} ${postCreator.lastName} tagged you in a post`,
            thumbnail: post.media?.[0]?.url || null,
            is_read: false,
            action_url: `/post/${post._id}`,
          });
        } catch (notifError) {
          // Don't fail post creation if notification fails
          console.error('Failed to send tag notification:', notifError);
        }
      }
    }
  } catch (dbError) {
    console.error('Failed to create post:', dbError);
    await deleteMultipleFiles(savedFiles.map((f) => f.url));
    throw new ApiError(500, 'Failed to create post. Please try again.');
  }

  await post.populate(
    'user_id',
    'firstName lastName username profilePicture profileImage avatar allowDownloads isVerified'
  );

  // Notify all followers about the new post (async, don't block response)
  notifyNewPost(post._id, userId, post.media?.[0]?.url || null).catch((err) => {
    console.error('Error sending new post notifications:', err);
  });

  return res.status(201).json(new ApiResponse(201, post, 'Post created successfully'));
});

// Delete a post
export const deletePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const post = await Post.findById(postId);

  if (!post || post.is_deleted) {
    throw new ApiError(404, 'Post not found');
  }

  // Check if user is owner
  if (post.user_id.toString() !== userId.toString()) {
    throw new ApiError(403, 'You are not authorized to delete this post');
  }

  post.is_deleted = true;
  await post.save();

  return res.status(200).json(new ApiResponse(200, null, 'Post deleted successfully'));
});

// Get post details
export const getPostDetails = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await Post.findOne({ _id: postId, is_deleted: false })
    .populate(
      'user_id',
      'firstName lastName username profilePicture profileImage avatar allowDownloads isVerified'
    )
    .populate('tags', 'firstName lastName username');

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Check visibility
  const userId = req.user?._id;
  if (post.visibility === 'private' && post.user_id._id.toString() !== userId?.toString()) {
    throw new ApiError(403, "You don't have access to this post");
  }

  // Get comments for this post
  const comments = await Comment.find({
    target_type: 'post',
    target_id: postId,
    is_deleted: false,
    reply_to_comment_id: null,
  })
    .populate('user_id', 'firstName lastName username profilePicture')
    .sort({ createdAt: -1 })
    .limit(10);

  const postData = post.toObject();
  postData.comments = comments;
  postData.canDownload = post.user_id?.allowDownloads !== false;

  // Check if current user liked this post
  if (userId) {
    const liked = await Like.findOne({
      user_id: userId,
      target_type: 'post',
      target_id: postId,
    });
    postData.is_liked = !!liked;
  }

  return res.status(200).json(new ApiResponse(200, postData, 'Post details fetched successfully'));
});

// Like a post (Idempotent)
export const likePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const post = await Post.findOne({ _id: postId, is_deleted: false });

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Check if already liked
  const existingLike = await Like.findOne({
    user_id: userId,
    target_type: 'post',
    target_id: postId,
  });

  if (existingLike) {
    // Already liked - return success (idempotent)
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          likes_count: post.likes_count,
          alreadyLiked: true,
          isLiked: true,
        },
        'Post already liked'
      )
    );
  }

  // Create like
  const like = await Like.create({
    user_id: userId,
    target_type: 'post',
    target_id: postId,
  });

  // Increment likes count
  post.likes_count += 1;
  await post.save();

  // Create notification for post owner (only if liker is not the post owner)
  if (post.user_id.toString() !== userId.toString()) {
    try {
      // Get the liker's details for the notification message
      const liker = await User.findById(userId).select('firstName lastName profilePicture');

      await Notification.create({
        recipient_id: post.user_id,
        sender_id: userId,
        type: 'like',
        reference_id: postId,
        reference_type: 'Post',
        title: 'New Like',
        message: `${liker.firstName} ${liker.lastName} liked your post`,
        thumbnail: post.media?.[0]?.url || null,
        is_read: false,
        action_url: `/post/${postId}`,
      });
    } catch (notifError) {
      // Don't fail the like operation if notification creation fails
      console.error('Failed to create notification:', notifError);
    }
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        likes_count: post.likes_count,
        alreadyLiked: false,
        isLiked: true,
      },
      'Post liked successfully'
    )
  );
});

// Unlike a post (Idempotent)
export const unlikePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const like = await Like.findOneAndDelete({
    user_id: userId,
    target_type: 'post',
    target_id: postId,
  });

  if (!like) {
    // Not liked - return success (idempotent)
    const post = await Post.findById(postId);
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          likes_count: post?.likes_count || 0,
          wasLiked: false,
          isLiked: false,
        },
        'Post not liked'
      )
    );
  }

  // Decrement likes count
  const post = await Post.findById(postId);
  if (post && post.likes_count > 0) {
    post.likes_count -= 1;
    await post.save();
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        likes_count: post?.likes_count || 0,
        wasLiked: true,
        isLiked: false,
      },
      'Post unliked successfully'
    )
  );
});

// Add comment to a post
export const commentOnPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { text, reply_to_comment_id, media } = req.body;
  const userId = req.user._id;

  if (!text || text.trim().length === 0) {
    throw new ApiError(400, 'Comment text is required');
  }

  const post = await Post.findOne({ _id: postId, is_deleted: false });

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // If replying to a comment, verify it exists
  if (reply_to_comment_id) {
    const parentComment = await Comment.findById(reply_to_comment_id);
    if (!parentComment) {
      throw new ApiError(404, 'Parent comment not found');
    }
  }

  const comment = await Comment.create({
    user_id: userId,
    target_type: 'post',
    target_id: postId,
    text,
    reply_to_comment_id,
    media,
  });

  // Increment comment count
  post.comments_count += 1;
  await post.save();

  // If it's a reply, increment replies count on parent
  if (reply_to_comment_id) {
    await Comment.findByIdAndUpdate(reply_to_comment_id, {
      $inc: { replies_count: 1 },
    });
  }

  // Create notification for post owner (only if commenter is not the post owner)
  if (post.user_id.toString() !== userId.toString()) {
    try {
      // Get the commenter's details for the notification message
      const commenter = await User.findById(userId).select('firstName lastName profilePicture');

      await Notification.create({
        recipient_id: post.user_id,
        sender_id: userId,
        type: 'comment',
        reference_id: postId,
        reference_type: 'Post',
        title: 'New Comment',
        message: `${commenter.firstName} ${commenter.lastName} commented on your post`,
        thumbnail: post.media?.[0]?.url || null,
        is_read: false,
        action_url: `/post/${postId}`,
      });
    } catch (notifError) {
      // Don't fail the comment operation if notification creation fails
      console.error('Failed to create notification:', notifError);
    }
  }

  const populatedComment = await Comment.findById(comment._id).populate(
    'user_id',
    'firstName lastName username profilePicture'
  );

  return res.status(201).json(new ApiResponse(201, populatedComment, 'Comment added successfully'));
});

// Delete a comment
export const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;

  const comment = await Comment.findById(commentId);

  if (!comment || comment.is_deleted) {
    throw new ApiError(404, 'Comment not found');
  }

  // Check if user is comment owner or post owner
  const post = await Post.findById(comment.target_id);
  const isOwner = comment.user_id.toString() === userId.toString();
  const isPostOwner = post?.user_id.toString() === userId.toString();

  if (!isOwner && !isPostOwner) {
    throw new ApiError(403, 'You are not authorized to delete this comment');
  }

  comment.is_deleted = true;
  await comment.save();

  // Decrement comment count
  if (post && post.comments_count > 0) {
    post.comments_count -= 1;
    await post.save();
  }

  // If it's a reply, decrement parent's replies count
  if (comment.reply_to_comment_id) {
    await Comment.findByIdAndUpdate(comment.reply_to_comment_id, {
      $inc: { replies_count: -1 },
    });
  }

  return res.status(200).json(new ApiResponse(200, null, 'Comment deleted successfully'));
});

// Share a post
export const sharePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { target, caption } = req.body;
  const userId = req.user._id;

  const post = await Post.findOne({ _id: postId, is_deleted: false });

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Increment shares count
  post.shares_count += 1;
  await post.save();

  // TODO: Implement actual sharing logic based on target (feed/story/external)
  // For now, just increment the counter

  return res
    .status(200)
    .json(new ApiResponse(200, { shares_count: post.shares_count }, 'Post shared successfully'));
});

// Save a post
export const savePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const post = await Post.findOne({ _id: postId, is_deleted: false });

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Check if already saved
  const existingSave = await Save.findOne({
    user_id: userId,
    target_type: 'post',
    target_id: postId,
  });

  if (existingSave) {
    throw new ApiError(400, 'Post already saved');
  }

  await Save.create({
    user_id: userId,
    target_type: 'post',
    target_id: postId,
  });

  // Increment saves count
  post.saves_count += 1;
  await post.save();

  return res.status(200).json(new ApiResponse(200, null, 'Post saved successfully'));
});

export const getUserSavedPosts = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 100 } = req.query;

  const skip = (page - 1) * limit;

  // Find all saved post IDs for the user
  const savedPosts = await Save.find({
    user_id: userId,
    target_type: 'post',
  })
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  // Extract post IDs
  const postIds = savedPosts.map((save) => save.target_id);

  if (postIds.length === 0) {
    return res.status(200).json(new ApiResponse(200, [], 'Saved posts fetched successfully'));
  }

  // Fetch the actual posts with user details
  const posts = await Post.find({
    _id: { $in: postIds },
    is_deleted: false,
  })
    .populate(
      'user_id',
      'firstName lastName username profilePicture profileImage avatar allowDownloads isVerified'
    )
    .lean();

  // Add isLiked status for each post
  const postsWithStatus = await Promise.all(
    posts.map(async (post) => {
      const isLiked = await Like.exists({
        target_id: post._id,
        target_type: 'post',
        user_id: userId,
      });

      return {
        ...post,
        _id: post._id,
        id: post._id,
        user_id: post.user_id,
        caption: post.caption || '',
        media: post.media || [],
        file_url: post.file_url || post.media?.[0]?.url || '',
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || 0,
        shares_count: post.shares_count || 0,
        isLiked: !!isLiked,
        isSaved: true,
        canDownload: post.user_id?.allowDownloads !== false,
        createdAt: post.createdAt,
      };
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, postsWithStatus, 'Saved posts fetched successfully'));
});

export const unsavePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const save = await Save.findOneAndDelete({
    user_id: userId,
    target_type: 'post',
    target_id: postId,
  });

  if (!save) {
    throw new ApiError(404, 'Saved post not found');
  }

  // Decrement saves count
  const post = await Post.findById(postId);
  if (post && post.saves_count > 0) {
    post.saves_count -= 1;
    await post.save();
  }

  return res.status(200).json(new ApiResponse(200, null, 'Post unsaved successfully'));
});

// Report a post
export const reportPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { reason, details, attachments } = req.body;
  const userId = req.user._id;

  if (!reason) {
    throw new ApiError(400, 'Reason is required');
  }

  const post = await Post.findOne({ _id: postId, is_deleted: false });

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const report = await Report.create({
    user_id: userId,
    target_type: 'post',
    target_id: postId,
    reason,
    details,
    attachments,
  });

  return res.status(201).json(new ApiResponse(201, report, 'Post reported successfully'));
});

export const getCurrentUserPosts = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const posts = await Post.find({ user_id: userId, is_deleted: false })
    .sort({ createdAt: -1 })
    .populate(
      'user_id',
      'firstName lastName username profilePicture profileImage avatar allowDownloads isVerified'
    );

  // Add canDownload flag to each post
  const postsWithDownloadFlag = posts.map((post) => ({
    ...post.toObject(),
    canDownload: post.user_id?.allowDownloads !== false,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, postsWithDownloadFlag, 'User posts fetched successfully'));
});

export const totalPostCount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const count = await Post.countDocuments({
    user_id: userId,
    is_deleted: false,
  });
  // todo

  // total followeres count
  const followersCount = await Followers.countDocuments({
    following_id: userId,
    status: 'accepted',
  });

  // total following count
  const followingCount = await Followers.countDocuments({
    follower_id: userId,
    status: 'accepted',
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { totalPostCount: count }, 'Total post count fetched successfully'));
});

// Get all comments for a post with pagination
export const getAllComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { limit = 20, page = 1 } = req.query;
  const userId = req.user._id;

  const comments = await Comment.find({
    target_id: postId,
    target_type: 'post',
    is_deleted: false,
    reply_to_comment_id: null, // Only get top-level comments
  })
    .populate('user_id', 'firstName lastName username profileImage profilePicture avatar') // ✅ ADD profileImage
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  // Add isLiked status for each comment
  const commentsWithLikeStatus = await Promise.all(
    comments.map(async (comment) => {
      const isLiked = await Like.exists({
        target_type: 'comment',
        target_id: comment._id,
        user_id: userId,
      });

      return {
        ...comment.toObject(),
        isLiked: !!isLiked,
      };
    })
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, { comments: commentsWithLikeStatus }, 'Comments fetched successfully')
    );
});

// Get explore posts - posts from users NOT being followed
export const getExplorePosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const currentUserId = req.user._id;

  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 50); // Max 50 posts per page
  const skip = (pageNum - 1) * limitNum;

  // Get list of users the current user is following
  const followingRecords = await Followers.find({
    follower_id: currentUserId,
    status: 'accepted',
  }).select('following_id');

  const followingIds = followingRecords.map((record) => record.following_id);

  // Add current user to exclusion list (don't show own posts)
  const excludedUserIds = [...followingIds, currentUserId];

  // Get current user's blocked users
  const currentUser = await User.findById(currentUserId).select('blockedUsers');
  const blockedByCurrentUser = currentUser?.blockedUsers || [];

  // Find users who have blocked the current user
  const usersWithBlocks = await User.find({
    blockedUsers: currentUserId,
  })
    .select('_id')
    .lean();
  const usersWhoBlockedCurrentUser = usersWithBlocks.map((u) => u._id);

  // Combine all blocked users (bidirectional)
  const allBlockedUserIds = [...blockedByCurrentUser, ...usersWhoBlockedCurrentUser];

  // Combine exclusions: following + self + blocked users
  const allExcludedUserIds = [...excludedUserIds, ...allBlockedUserIds];

  // Find posts from users NOT in the exclusion list
  const posts = await Post.find({
    user_id: { $nin: allExcludedUserIds },
    is_deleted: false,
    visibility: 'public', // Only show public posts in explore
  })
    .populate(
      'user_id',
      'firstName lastName username profileImage avatar isVerified allowDownloads'
    )
    .sort({ createdAt: -1 }) // Sort by most recent first
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Enrich posts with engagement data
  const enrichedPosts = await Promise.all(
    posts.map(async (post) => {
      // Check if current user liked this post
      const isLiked = await Like.exists({
        user_id: currentUserId,
        target_type: 'post',
        target_id: post._id,
      });

      // Check if current user saved this post
      const isSaved = await Save.exists({
        user_id: currentUserId,
        target_type: 'post',
        target_id: post._id,
      });

      return {
        _id: post._id,
        user_id: post.user_id,
        caption: post.caption || '',
        media: post.media || [],
        tags: post.tags || [],
        location: post.location || null,
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || 0,
        shares_count: post.shares_count || 0,
        saves_count: post.saves_count || 0,
        isLiked: !!isLiked,
        isSaved: !!isSaved,
        canDownload: post.user_id?.allowDownloads !== false,
        createdAt: post.createdAt,
      };
    })
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts: enrichedPosts,
        page: pageNum,
        limit: limitNum,
        hasMore: enrichedPosts.length === limitNum,
      },
      'Explore posts fetched successfully'
    )
  );
});
