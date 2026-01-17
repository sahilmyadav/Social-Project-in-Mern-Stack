import { Post } from "../models/post.model.js";
import { Reel } from "../models/reel.model.js";
import { Story } from "../models/story.model.js";
import { Followers } from "../models/followers.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// Get home feed
export const getHomeFeed = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit = 10 } = req.query;

  // STEP 1: Get following list
  const following = await Followers.find({
    follower_id: userId,
    status: 'accepted'
  }).select('following_id');

  const followingIds = following.map(f => f.following_id);

  // STEP 2: Include your own posts
  const userIdsToShow = [...followingIds, userId];


  // STEP 3: Get posts ONLY from followed users
  const posts = await Post.find({
    user_id: { $in: userIdsToShow },
    is_deleted: false
  })
    .populate('user_id', 'firstName lastName username profileImage profilePicture avatar')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  // STEP 4: Add isLiked status and calculate actual counts
  const postsWithData = await Promise.all(
    posts.map(async (post) => {
      const [isLiked, commentsCount] = await Promise.all([
        Like.exists({
          target_id: post._id,
          target_type: 'post',
          user_id: userId
        }),
        Comment.countDocuments({
          target_id: post._id,
          target_type: 'post',
          is_deleted: false
        })
      ]);

      return {
        ...post,
        isLiked: !!isLiked,
        likes_count: post.likes_count || 0,
        comments_count: commentsCount, // ✅ Always accurate
        shares_count: post.shares_count || 0
      };
    })
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { posts: postsWithData },
      'Home feed fetched successfully'
    )
  );
});

// Get reels feed
export const getReelsFeed = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit = 10 } = req.query;

  // STEP 1: Get following list
  const following = await Followers.find({
    follower_id: userId,
    status: 'accepted'
  }).select('following_id');

  const followingIds = following.map(f => f.following_id);
  const userIdsToShow = [...followingIds, userId];


  // STEP 2: Get reels ONLY from followed users
  const reels = await Reel.find({
    user_id: { $in: userIdsToShow },
    is_deleted: false
  })
    .populate('user_id', 'firstName lastName username profileImage profilePicture avatar') // ✅ FIXED
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  // STEP 3: Add like/comment counts
  const reelsWithData = await Promise.all(
    reels.map(async (reel) => {
      const [isLiked, likesCount, commentsCount] = await Promise.all([
        Like.exists({ target_type: 'reel', target_id: reel._id, user_id: userId }),
        Like.countDocuments({ target_type: 'reel', target_id: reel._id }),
        Comment.countDocuments({ target_type: 'reel', target_id: reel._id })
      ]);

      return {
        ...reel,
        isLiked: !!isLiked,
        likes_count: likesCount,
        comments_count: commentsCount
      };
    })
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { reels: reelsWithData },
      'Reels feed fetched successfully'
    )
  );
});

// Get stories feed (aggregated from following)
export const getStoriesFeed = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get list of users the current user follows
  const following = await Followers.find({
    follower_id: userId,
    status: "accepted",
  }).select("following_id");

  const followingIds = following.map((f) => f.following_id);
  followingIds.push(userId);

  // Get active stories from followed users
  const stories = await Story.aggregate([
    {
      $match: {
        user_id: { $in: followingIds },
        is_deleted: false,
        expires_at: { $gt: new Date() },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $group: {
        _id: "$user_id",
        stories: { $push: "$$ROOT" },
        latestStory: { $first: "$$ROOT" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: "$user",
    },
    {
      $project: {
        user_id: "$_id",
        user: {
          _id: "$user._id",
          firstName: "$user.firstName",
          lastName: "$user.lastName",
          username: "$user.username",
          profilePicture: "$user.profilePicture",
        },
        stories: 1,
        latestStoryTime: "$latestStory.createdAt",
      },
    },
    {
      $sort: { latestStoryTime: -1 },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, stories, "Stories feed fetched successfully"));
});

// Get posts by specific user
export const getUserPosts = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user?._id;
  const { cursor, limit = 20 } = req.query;

  // Get target user to check privacy settings
  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  // Check if account is private and user is not following
  const isOwnProfile = currentUserId && currentUserId.toString() === userId;

  if (targetUser.isPrivate && !isOwnProfile) {
    // Check if current user is following
    const isFollowing = await Followers.findOne({
      follower_id: currentUserId,
      following_id: userId,
      status: 'accepted'
    });

    if (!isFollowing) {
      // Private account and not following - return empty
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            posts: [],
            nextCursor: null,
            hasMore: false,
            isPrivate: true,
            message: 'This account is private'
          },
          "This account is private"
        )
      );
    }
  }

  // User is allowed to see posts
  const query = {
    user_id: userId,
    is_deleted: false,
  };

  if (cursor) {
    query._id = { $lt: cursor };
  }

  const posts = await Post.find(query)
    .populate("user_id", "firstName lastName username profilePicture profileImage avatar isPrivate")
    .populate("tags", "firstName lastName username")
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  // Add isLiked status for each post
  const postsWithLikeStatus = await Promise.all(
    posts.map(async (post) => {
      const isLiked = currentUserId
        ? await Like.exists({ target_type: 'post', target_id: post._id, user_id: currentUserId })
        : null;

      return {
        ...post,
        isLiked: !!isLiked
      };
    })
  );

  const nextCursor = postsWithLikeStatus.length > 0 ? postsWithLikeStatus[postsWithLikeStatus.length - 1]._id : null;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts: postsWithLikeStatus,
        nextCursor,
        hasMore: postsWithLikeStatus.length === parseInt(limit),
        isPrivate: false
      },
      "User posts fetched successfully"
    )
  );
});
