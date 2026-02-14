import mongoose from 'mongoose';
import { Comment } from '../models/comment.model.js';
import { Followers } from '../models/followers.model.js';
import { Like } from '../models/like.model.js';
import { Post } from '../models/post.model.js';
import { Reel } from '../models/reel.model.js';
import { Save } from '../models/save.model.js';
import { User } from '../models/user.model.js';
import {
    addComment as addCommentService,
    deleteComment as deleteCommentService,
    likeContent,
    parseTagIds,
    reportContent,
    saveContent,
    sendTagNotifications,
    shareContent,
    unlikeContent,
    unsaveContent,
} from '../services/content.service.js';
import { getLikedIds, getSavedIds } from '../services/enrichment.service.js';
import { notifyNewPost } from '../services/notification.service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { deleteMultipleFiles, saveMultipleFilesLocally } from '../utils/localStorage.js';
import logger from '../utils/logger.js';

// No file count limit per client request — allow unlimited files
const MAX_CAPTION_LENGTH = 2000;

export const uploadPost = asyncHandler(async (req, res) => {
  const { caption, tags, location, visibility } = req.body;
  const userId = req.user._id;
  const files = req.files;

  if (!files || files.length === 0) {
    throw new ApiError(400, 'At least one media file is required');
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

  let parsedTags = parseTagIds(tags);
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
      sendTagNotifications({
        taggedUserIds: validTags,
        senderId: userId,
        contentId: post._id,
        contentType: 'post',
      }).catch((err) => logger.error('Tag notification error:', { error: err.message }));
    }
  } catch (dbError) {
    logger.error('Failed to create post:', { error: dbError.message });
    await deleteMultipleFiles(savedFiles.map((f) => f.url));
    throw new ApiError(500, 'Failed to create post. Please try again.');
  }

  await post.populate(
    'user_id',
    'firstName lastName username profilePicture profileImage avatar allowDownloads isVerified'
  );

  // Notify all followers about the new post (async, don't block response)
  notifyNewPost(post._id, userId, post.media?.[0]?.url || null).catch((err) => {
    logger.error('Error sending new post notifications:', { error: err.message });
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
  const result = await likeContent({
    Model: Post,
    contentId: postId,
    userId: req.user._id,
    contentType: 'post',
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        likes_count: result.likesCount,
        alreadyLiked: result.alreadyLiked,
        isLiked: result.isLiked,
      },
      result.alreadyLiked ? 'Post already liked' : 'Post liked successfully'
    )
  );
});

export const unlikePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const result = await unlikeContent({
    Model: Post,
    contentId: postId,
    userId: req.user._id,
    contentType: 'post',
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        likes_count: result.likesCount,
        wasLiked: result.wasLiked,
        isLiked: result.isLiked,
      },
      result.wasLiked ? 'Post unliked successfully' : 'Post not liked'
    )
  );
});

export const commentOnPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { text, reply_to_comment_id, media } = req.body;

  const comment = await addCommentService({
    Model: Post,
    contentId: postId,
    userId: req.user._id,
    text,
    replyToCommentId: reply_to_comment_id,
    media,
    contentType: 'post',
  });

  return res.status(201).json(new ApiResponse(201, comment, 'Comment added successfully'));
});

export const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  await deleteCommentService({
    Model: Post,
    commentId,
    userId: req.user._id,
  });

  return res.status(200).json(new ApiResponse(200, null, 'Comment deleted successfully'));
});

export const sharePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const result = await shareContent({
    Model: Post,
    contentId: postId,
    contentType: 'post',
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { shares_count: result.sharesCount }, 'Post shared successfully'));
});

export const savePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  await saveContent({
    Model: Post,
    contentId: postId,
    userId: req.user._id,
    contentType: 'post',
  });

  return res.status(200).json(new ApiResponse(200, null, 'Post saved successfully'));
});

export const getUserSavedPosts = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 100 } = req.query;

  const skip = (page - 1) * limit;

  // Find ALL saved items (posts + reels) for the user
  const savedItems = await Save.find({
    user_id: userId,
  })
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  // Split into posts and reels
  const savedPostEntries = savedItems.filter((s) => s.target_type === 'post');
  const savedReelEntries = savedItems.filter((s) => s.target_type === 'reel');

  const postIds = savedPostEntries.map((s) => s.target_id);
  const reelIds = savedReelEntries.map((s) => s.target_id);

  // Fetch posts and reels in parallel
  const [posts, reels] = await Promise.all([
    postIds.length > 0
      ? Post.find({ _id: { $in: postIds }, is_deleted: false })
          .populate(
            'user_id',
            'firstName lastName username profilePicture profileImage avatar allowDownloads isVerified'
          )
          .lean()
      : [],
    reelIds.length > 0
      ? Reel.find({ _id: { $in: reelIds }, is_deleted: false })
          .populate(
            'user_id',
            'firstName lastName username profilePicture profileImage avatar allowDownloads isVerified'
          )
          .lean()
      : [],
  ]);

  // Get liked status in batch
  const allPostIds = posts.map((p) => p._id);
  const allReelIds = reels.map((r) => r._id);

  const [postLikedSet, reelLikedSet] = await Promise.all([
    allPostIds.length > 0 ? getLikedIds(allPostIds, 'post', userId) : new Set(),
    allReelIds.length > 0 ? getLikedIds(allReelIds, 'reel', userId) : new Set(),
  ]);

  // Create lookup maps for ordering
  const postMap = new Map(posts.map((p) => [p._id.toString(), p]));
  const reelMap = new Map(reels.map((r) => [r._id.toString(), r]));

  // Build result in saved order (most recently saved first)
  const results = [];
  for (const item of savedItems) {
    const id = item.target_id.toString();

    if (item.target_type === 'post' && postMap.has(id)) {
      const post = postMap.get(id);
      results.push({
        ...post,
        _id: post._id,
        id: post._id,
        savedItemType: 'post',
        user_id: post.user_id,
        caption: post.caption || '',
        media: post.media || [],
        file_url: post.file_url || post.media?.[0]?.url || '',
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || 0,
        shares_count: post.shares_count || 0,
        isLiked: postLikedSet.has(post._id.toString()),
        isSaved: true,
        canDownload: post.user_id?.allowDownloads !== false,
        createdAt: post.createdAt,
      });
    } else if (item.target_type === 'reel' && reelMap.has(id)) {
      const reel = reelMap.get(id);
      results.push({
        ...reel,
        _id: reel._id,
        id: reel._id,
        savedItemType: 'reel',
        user_id: reel.user_id,
        caption: reel.caption || '',
        media: reel.media || [],
        file_url: reel.media?.[0]?.url || '',
        likes_count: reel.likes_count || 0,
        comments_count: reel.comments_count || 0,
        shares_count: reel.shares_count || 0,
        views_count: reel.views_count || 0,
        isLiked: reelLikedSet.has(reel._id.toString()),
        isSaved: true,
        canDownload: reel.user_id?.allowDownloads !== false,
        createdAt: reel.createdAt,
      });
    }
  }

  return res.status(200).json(new ApiResponse(200, results, 'Saved content fetched successfully'));
});

export const unsavePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  await unsaveContent({
    Model: Post,
    contentId: postId,
    userId: req.user._id,
    contentType: 'post',
  });

  return res.status(200).json(new ApiResponse(200, null, 'Post unsaved successfully'));
});

export const reportPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new ApiError(400, 'Reason is required');
  }

  const post = await Post.findOne({ _id: postId, is_deleted: false });
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  await reportContent({
    contentId: postId,
    userId: req.user._id,
    reason,
    contentType: 'post',
  });

  return res.status(201).json(new ApiResponse(201, null, 'Post reported successfully'));
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
    .populate('user_id', 'firstName lastName username profileImage profilePicture avatar')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  // Add isLiked status for each comment (batch — no N+1)
  const commentIds = comments.map((c) => c._id);
  const commentLikedSet = await getLikedIds(commentIds, 'comment', userId);

  const commentsWithLikeStatus = comments.map((comment) => ({
    ...comment.toObject(),
    isLiked: commentLikedSet.has(comment._id.toString()),
  }));

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

  // Enrich posts with engagement data (batch — no N+1)
  const explorePostIds = posts.map((p) => p._id);
  const [exploreLikedSet, exploreSavedSet] = await Promise.all([
    getLikedIds(explorePostIds, 'post', currentUserId),
    getSavedIds(explorePostIds, 'post', currentUserId),
  ]);

  const enrichedPosts = posts.map((post) => ({
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
    views_count: post.views_count || 0,
    isLiked: exploreLikedSet.has(post._id.toString()),
    isSaved: exploreSavedSet.has(post._id.toString()),
    canDownload: post.user_id?.allowDownloads !== false,
    createdAt: post.createdAt,
  }));

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

// Track post view
export const trackPostView = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(400, 'Valid post ID is required');
  }

  const post = await Post.findById(postId);

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  if (post.is_deleted) {
    throw new ApiError(404, 'Post has been deleted');
  }

  // Check if user has already viewed this post
  const hasViewed = post.viewers?.some((viewerId) => viewerId.toString() === userId.toString());

  if (!hasViewed) {
    // Add user to viewers and increment view count
    await Post.findByIdAndUpdate(postId, {
      $addToSet: { viewers: userId },
      $inc: { views_count: 1 },
    });
  }

  return res.status(200).json(new ApiResponse(200, { success: true }, 'View tracked successfully'));
});

// Get post view count
export const getPostViews = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(400, 'Valid post ID is required');
  }

  const post = await Post.findById(postId).select('views_count').lean();

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { views_count: post.views_count || 0 },
        'View count fetched successfully'
      )
    );
});
