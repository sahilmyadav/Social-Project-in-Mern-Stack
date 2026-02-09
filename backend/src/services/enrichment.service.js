/**
 * Bulk enrichment helpers.
 *
 * Replace N+1 per-item queries with batch operations.
 * Each function accepts an array of items and returns a Map keyed by item _id.
 *
 * Usage:
 *   const likedSet = await getLikedIds(postIds, 'post', userId);
 *   posts.map(p => ({ ...p, isLiked: likedSet.has(p._id.toString()) }));
 */

import { Comment } from '../models/comment.model.js';
import { Followers } from '../models/followers.model.js';
import { Like } from '../models/like.model.js';
import { Save } from '../models/save.model.js';

// ─── Like Status ────────────────────────────────────────────────

/**
 * Returns a Set of stringified target_ids that the given user has liked.
 * @param {ObjectId[]} targetIds   Post/Reel/Comment ids
 * @param {'post'|'reel'|'comment'} targetType
 * @param {ObjectId} userId        The current user
 * @returns {Promise<Set<string>>}
 */
export async function getLikedIds(targetIds, targetType, userId) {
  if (!userId || targetIds.length === 0) return new Set();
  const docs = await Like.find({
    target_id: { $in: targetIds },
    target_type: targetType,
    user_id: userId,
  })
    .select('target_id')
    .lean();
  return new Set(docs.map((d) => d.target_id.toString()));
}

// ─── Save / Bookmark Status ────────────────────────────────────

/**
 * Returns a Set of stringified target_ids that the given user has saved.
 */
export async function getSavedIds(targetIds, targetType, userId) {
  if (!userId || targetIds.length === 0) return new Set();
  const docs = await Save.find({
    target_id: { $in: targetIds },
    target_type: targetType,
    user_id: userId,
  })
    .select('target_id')
    .lean();
  return new Set(docs.map((d) => d.target_id.toString()));
}

// ─── Like Counts ────────────────────────────────────────────────

/**
 * Returns a Map<string, number> of like counts keyed by target_id.
 */
export async function getLikeCounts(targetIds, targetType) {
  if (targetIds.length === 0) return new Map();
  const agg = await Like.aggregate([
    { $match: { target_id: { $in: targetIds }, target_type: targetType } },
    { $group: { _id: '$target_id', count: { $sum: 1 } } },
  ]);
  return new Map(agg.map((r) => [r._id.toString(), r.count]));
}

// ─── Comment Counts ─────────────────────────────────────────────

/**
 * Returns a Map<string, number> of comment counts keyed by target_id.
 */
export async function getCommentCounts(targetIds, targetType) {
  if (targetIds.length === 0) return new Map();
  const agg = await Comment.aggregate([
    {
      $match: {
        target_id: { $in: targetIds },
        target_type: targetType,
        is_deleted: false,
      },
    },
    { $group: { _id: '$target_id', count: { $sum: 1 } } },
  ]);
  return new Map(agg.map((r) => [r._id.toString(), r.count]));
}

// ─── Follow Relationships ───────────────────────────────────────

/**
 * Returns a Map<string, { status }> of follow relationships from currentUser → targetUserIds.
 */
export async function getFollowStatusMap(currentUserId, targetUserIds) {
  if (!currentUserId || targetUserIds.length === 0) return new Map();
  const docs = await Followers.find({
    follower_id: currentUserId,
    following_id: { $in: targetUserIds },
  })
    .select('following_id status')
    .lean();
  return new Map(docs.map((d) => [d.following_id.toString(), d.status]));
}

/**
 * Returns a Map<string, number> of follower counts keyed by user_id.
 */
export async function getFollowerCounts(userIds) {
  if (userIds.length === 0) return new Map();
  const agg = await Followers.aggregate([
    { $match: { following_id: { $in: userIds }, status: 'accepted' } },
    { $group: { _id: '$following_id', count: { $sum: 1 } } },
  ]);
  return new Map(agg.map((r) => [r._id.toString(), r.count]));
}
