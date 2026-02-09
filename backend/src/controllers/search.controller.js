import { Hashtag } from '../models/hashtag.model.js';
import { Post } from '../models/post.model.js';
import { SearchHistory } from '../models/searchHistory.model.js';
import { User } from '../models/user.model.js';
import { getFollowerCounts, getFollowStatusMap } from '../services/enrichment.service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';
import { buildSafeRegex, escapeRegex, getBlockedUserIds } from '../utils/searchUtils.js';

// Helper: Save search history
const saveSearchHistory = async (userId, query, searchType, resultsCount) => {
  try {
    if (userId) {
      await SearchHistory.create({
        user_id: userId,
        query,
        search_type: searchType,
        results_count: resultsCount,
      });
    }
  } catch (error) {
    logger.error('Failed to save search history:', { error: error.message });
  }
};

// Helper: Update hashtag stats
const updateHashtagStats = async (hashtagName) => {
  try {
    const hashtag = await Hashtag.findOne({ name: hashtagName.toLowerCase() });
    if (hashtag) {
      hashtag.usage_count += 1;
      hashtag.last_used_at = new Date();
      // Calculate trending score based on recent usage
      const hoursSinceLastUse = (Date.now() - hashtag.last_used_at) / (1000 * 60 * 60);
      hashtag.trending_score = hashtag.usage_count / Math.max(hoursSinceLastUse, 1);
      await hashtag.save();
    } else {
      await Hashtag.create({
        name: hashtagName.toLowerCase(),
        usage_count: 1,
        trending_score: 1,
      });
    }
  } catch (error) {
    logger.error('Failed to update hashtag stats:', { error: error.message });
  }
};

// GET /search/global - Unified search across all content types
export const globalSearch = asyncHandler(async (req, res) => {
  const { query, type, limit = 10, cursor } = req.query;
  const userId = req.user?._id;

  if (!query || query.trim().length < 2) {
    throw new ApiError(400, 'Search query must be at least 2 characters');
  }

  const searchLimit = Math.min(parseInt(limit), 50);
  const searchRegex = buildSafeRegex(query);

  const results = {
    users: [],
    posts: [],
    pages: [],
    hashtags: [],
    total_results: 0,
  };

  // Get blocked users (bidirectional) via shared utility
  const allBlockedUserIds = await getBlockedUserIds(userId, User);

  // Search Users (if type is not specified or is 'users')
  if (!type || type === 'users') {
    results.users = await User.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { username: searchRegex },
        { email: searchRegex },
      ],
      status: 'active',
      _id: { $nin: allBlockedUserIds },
    })
      .select('firstName lastName username avatar isVerified profile_type bio isPrivate')
      .limit(searchLimit)
      .lean();
  }

  // Search Posts (if type is not specified or is 'posts')
  if (!type || type === 'posts') {
    results.posts = await Post.find({
      caption: searchRegex,
      is_deleted: false,
    })
      .populate('user_id', 'firstName lastName username avatar isVerified')
      .sort('-createdAt')
      .limit(searchLimit)
      .lean();
  }

  // Search Pages/Business Accounts (if type is not specified or is 'pages')
  if (!type || type === 'pages') {
    results.pages = await User.find({
      profile_type: 'business',
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { username: searchRegex },
        { bio: searchRegex },
      ],
      status: 'active',
      _id: { $nin: allBlockedUserIds },
    })
      .select('firstName lastName username avatar isVerified profile_type bio isPrivate')
      .limit(searchLimit)
      .lean();
  }

  // Search Hashtags (if type is not specified or is 'hashtags')
  if (!type || type === 'hashtags') {
    results.hashtags = await Hashtag.find({
      name: searchRegex,
    })
      .sort('-usage_count -trending_score')
      .limit(searchLimit)
      .lean();
  }

  // Calculate total results
  results.total_results =
    results.users.length + results.posts.length + results.pages.length + results.hashtags.length;

  // Save search history
  await saveSearchHistory(userId, query, 'global', results.total_results);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        query,
        results,
        pagination: {
          limit: searchLimit,
          cursor: cursor || null,
        },
      },
      'Global search completed successfully'
    )
  );
});

// GET /search/users - Search for users by name, username
export const searchUsers = asyncHandler(async (req, res) => {
  const { query, limit = 20, page = 1 } = req.query;
  const userId = req.user?._id;

  if (!query || query.trim().length < 1) {
    throw new ApiError(400, 'Search query is required');
  }

  const searchLimit = Math.min(parseInt(limit), 50);
  const skip = (parseInt(page) - 1) * searchLimit;
  const searchRegex = buildSafeRegex(query);

  // Get blocked users (bidirectional) via shared utility
  const allBlockedUserIds = await getBlockedUserIds(userId, User);

  // Ensure we don't return the current user in results either
  if (userId) {
    allBlockedUserIds.push(userId);
  }

  const users = await User.find({
    $or: [{ firstName: searchRegex }, { lastName: searchRegex }, { username: searchRegex }],
    status: 'active',
    // Exclude blocked users (bidirectional) + Self
    _id: { $nin: allBlockedUserIds },
  })
    .select('firstName lastName username avatar isVerified profile_type bio profileImage isPrivate')
    .skip(skip)
    .limit(searchLimit)
    .lean();

  // Add full name and followers count to each user (batch — no N+1)
  const userIds = users.map((u) => u._id);
  const [followerCountMap, followStatusMap] = await Promise.all([
    getFollowerCounts(userIds),
    userId ? getFollowStatusMap(userId, userIds) : Promise.resolve(new Map()),
  ]);

  const usersWithFullName = users.map((user) => {
    const status = followStatusMap.get(user._id.toString());
    return {
      ...user,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      followers_count: followerCountMap.get(user._id.toString()) || 0,
      isFollowing: status === 'accepted',
      isPending: status === 'requested',
    };
  });

  const total = await User.countDocuments({
    $or: [{ firstName: searchRegex }, { lastName: searchRegex }, { username: searchRegex }],
    status: 'active',
    _id: { $nin: allBlockedUserIds },
  });

  // Save search history
  await saveSearchHistory(userId, query, 'users', users.length);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        query,
        users: usersWithFullName,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / searchLimit),
          total_users: total,
          per_page: searchLimit,
          has_more: skip + users.length < total,
        },
      },
      'Users search completed successfully'
    )
  );
});

// GET /search/pages - Search business pages / creator pages
export const searchPages = asyncHandler(async (req, res) => {
  const { query, limit = 20, page = 1 } = req.query;
  const userId = req.user?._id;

  if (!query || query.trim().length < 2) {
    throw new ApiError(400, 'Search query must be at least 2 characters');
  }

  const searchLimit = Math.min(parseInt(limit), 50);
  const skip = (parseInt(page) - 1) * searchLimit;
  const searchRegex = buildSafeRegex(query);

  // Get blocked users (bidirectional) via shared utility
  const allBlockedUserIds = await getBlockedUserIds(userId, User);

  const pages = await User.find({
    profile_type: 'business',
    $or: [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { username: searchRegex },
      { bio: searchRegex },
    ],
    status: 'active',
    _id: { $nin: allBlockedUserIds },
  })
    .select('firstName lastName username avatar isVerified profile_type bio coverPhoto isPrivate')
    .skip(skip)
    .limit(searchLimit)
    .lean();

  const total = await User.countDocuments({
    profile_type: 'business',
    $or: [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { username: searchRegex },
      { bio: searchRegex },
    ],
    status: 'active',
    _id: { $nin: allBlockedUserIds },
  });

  // Save search history
  await saveSearchHistory(userId, query, 'pages', pages.length);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        query,
        pages,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / searchLimit),
          total_results: total,
          per_page: searchLimit,
          has_more: skip + pages.length < total,
        },
      },
      'Pages search completed successfully'
    )
  );
});

// GET /search/hashtags - Search hashtags and show trending stats
export const searchHashtags = asyncHandler(async (req, res) => {
  const { query, limit = 20, page = 1 } = req.query;
  const userId = req.user?._id;

  if (!query || query.trim().length < 1) {
    throw new ApiError(400, 'Search query is required');
  }

  const searchLimit = Math.min(parseInt(limit), 50);
  const skip = (parseInt(page) - 1) * searchLimit;
  const searchRegex = buildSafeRegex(query);

  const hashtags = await Hashtag.find({
    name: searchRegex,
  })
    .sort('-trending_score -usage_count')
    .skip(skip)
    .limit(searchLimit)
    .lean();

  const total = await Hashtag.countDocuments({
    name: searchRegex,
  });

  // Get posts count for each hashtag
  const hashtagsWithStats = await Promise.all(
    hashtags.map(async (hashtag) => {
      const postsCount = await Post.countDocuments({
        caption: new RegExp(`#${escapeRegex(hashtag.name)}`, 'i'),
        is_deleted: false,
      });

      return {
        ...hashtag,
        posts_count: postsCount,
      };
    })
  );

  // Save search history
  await saveSearchHistory(userId, query, 'hashtags', hashtags.length);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        query,
        hashtags: hashtagsWithStats,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / searchLimit),
          total_hashtags: total,
          per_page: searchLimit,
          has_more: skip + hashtags.length < total,
        },
      },
      'Hashtags search completed successfully'
    )
  );
});

// GET /search/trending - Get trending topics, hashtags, and posts
export const getTrending = asyncHandler(async (req, res) => {
  const { limit = 10, timeframe = '24h' } = req.query;
  const userId = req.user?._id;
  const searchLimit = Math.min(parseInt(limit), 50);

  // Get blocked users (bidirectional) via shared utility
  const allBlockedUserIds = await getBlockedUserIds(userId, User);

  // Calculate time range for trending
  const timeRanges = {
    '1h': 1,
    '6h': 6,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30,
  };

  const hoursAgo = timeRanges[timeframe] || 24;
  const sinceDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  // Get trending hashtags
  const trendingHashtags = await Hashtag.find({
    last_used_at: { $gte: sinceDate },
  })
    .sort('-trending_score -usage_count')
    .limit(searchLimit)
    .lean();

  // Add posts count for each hashtag
  const hashtagsWithPosts = await Promise.all(
    trendingHashtags.map(async (hashtag) => {
      const postsCount = await Post.countDocuments({
        caption: new RegExp(`#${escapeRegex(hashtag.name)}`, 'i'),
        is_deleted: false,
        createdAt: { $gte: sinceDate },
      });

      return {
        ...hashtag,
        posts_count: postsCount,
      };
    })
  );

  // Get trending posts (most liked/commented in timeframe)
  const trendingPosts = await Post.find({
    is_deleted: false,
    createdAt: { $gte: sinceDate },
    user_id: { $nin: allBlockedUserIds },
  })
    .populate('user_id', 'firstName lastName username avatar isVerified')
    .sort('-likes_count -comments_count')
    .limit(searchLimit)
    .lean();

  // Get trending users (most followed recently)
  const trendingUsers = await User.find({
    status: 'active',
    lastActive: { $gte: sinceDate },
    _id: { $nin: allBlockedUserIds },
  })
    .select('firstName lastName username avatar isVerified profile_type bio isPrivate')
    .limit(searchLimit)
    .lean();

  // Extract trending topics from hashtags
  const trendingTopics = hashtagsWithPosts.slice(0, 10).map((h) => ({
    topic: h.name,
    posts_count: h.posts_count,
    trending_score: h.trending_score,
  }));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        timeframe,
        trending_hashtags: hashtagsWithPosts,
        trending_posts: trendingPosts,
        trending_users: trendingUsers,
        trending_topics: trendingTopics,
        generated_at: new Date(),
      },
      'Trending data fetched successfully'
    )
  );
});

// GET /search/history - Get user's search history
export const getSearchHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit = 20 } = req.query;

  const history = await SearchHistory.find({ user_id: userId })
    .sort('-createdAt')
    .limit(parseInt(limit))
    .lean();

  return res
    .status(200)
    .json(new ApiResponse(200, { history }, 'Search history fetched successfully'));
});

// DELETE /search/history - Clear search history
export const clearSearchHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await SearchHistory.deleteMany({ user_id: userId });

  return res.status(200).json(new ApiResponse(200, null, 'Search history cleared successfully'));
});
