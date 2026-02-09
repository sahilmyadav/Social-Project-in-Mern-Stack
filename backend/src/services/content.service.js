/**
 * Content Service
 *
 * Shared business logic for post/reel interactions: like, unlike, comment,
 * save, unsave, report. Uses atomic MongoDB operations ($inc) to avoid
 * race conditions on counter fields.
 */

import { Comment } from '../models/comment.model.js';
import { Like } from '../models/like.model.js';
import { Notification } from '../models/notification.model.js';
import { Report } from '../models/report.model.js';
import { Save } from '../models/save.model.js';
import { User } from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

/**
 * Create a notification for content interaction.
 * Silently fails — should never block the main operation.
 */
async function createInteractionNotification({
  recipientId,
  senderId,
  type,
  referenceId,
  referenceType,
  title,
  message,
  thumbnail = null,
  actionUrl,
}) {
  if (recipientId.toString() === senderId.toString()) return;

  try {
    await Notification.create({
      recipient_id: recipientId,
      sender_id: senderId,
      type,
      reference_id: referenceId,
      reference_type: referenceType,
      title,
      message,
      thumbnail,
      is_read: false,
      action_url: actionUrl,
    });
  } catch (err) {
    logger.error(`Failed to create ${type} notification:`, { error: err.message });
  }
}

/**
 * Like a piece of content (post or reel).
 * Idempotent — returns success if already liked.
 *
 * @param {Object} params
 * @param {Model}  params.Model       - Mongoose model (Post or Reel)
 * @param {string} params.contentId    - Document _id
 * @param {string} params.userId       - Liker's user _id
 * @param {string} params.contentType  - 'post' or 'reel'
 * @returns {{ likesCount: number, alreadyLiked: boolean, isLiked: boolean }}
 */
export async function likeContent({ Model, contentId, userId, contentType }) {
  const content = await Model.findOne({ _id: contentId, is_deleted: false });
  if (!content) {
    throw new ApiError(404, `${capitalize(contentType)} not found`);
  }

  const existing = await Like.findOne({
    user_id: userId,
    target_type: contentType,
    target_id: contentId,
  });

  if (existing) {
    return { likesCount: content.likes_count, alreadyLiked: true, isLiked: true };
  }

  await Like.create({
    user_id: userId,
    target_type: contentType,
    target_id: contentId,
  });

  const updated = await Model.findByIdAndUpdate(
    contentId,
    { $inc: { likes_count: 1 } },
    { new: true }
  );

  // Send notification
  const liker = await User.findById(userId).select('firstName lastName');
  const thumbnail = content.media?.[0]?.url || null;
  await createInteractionNotification({
    recipientId: content.user_id,
    senderId: userId,
    type: 'like',
    referenceId: contentId,
    referenceType: capitalize(contentType),
    title: 'New Like',
    message: `${liker.firstName} ${liker.lastName} liked your ${contentType}`,
    thumbnail,
    actionUrl: `/${contentType}/${contentId}`,
  });

  return { likesCount: updated.likes_count, alreadyLiked: false, isLiked: true };
}

/**
 * Unlike a piece of content.
 * Idempotent — returns success if not liked.
 */
export async function unlikeContent({ Model, contentId, userId, contentType }) {
  const like = await Like.findOneAndDelete({
    user_id: userId,
    target_type: contentType,
    target_id: contentId,
  });

  if (!like) {
    const content = await Model.findById(contentId);
    return { likesCount: content?.likes_count || 0, wasLiked: false, isLiked: false };
  }

  const updated = await Model.findByIdAndUpdate(
    contentId,
    { $inc: { likes_count: -1 } },
    { new: true }
  );

  // Ensure count doesn't go below zero
  if (updated && updated.likes_count < 0) {
    await Model.findByIdAndUpdate(contentId, { $set: { likes_count: 0 } });
  }

  return { likesCount: Math.max(updated?.likes_count || 0, 0), wasLiked: true, isLiked: false };
}

/**
 * Toggle like/unlike on content.
 * Returns the new state.
 */
export async function toggleLike({ Model, contentId, userId, contentType }) {
  const content = await Model.findOne({ _id: contentId, is_deleted: false });
  if (!content) {
    throw new ApiError(404, `${capitalize(contentType)} not found`);
  }

  const existing = await Like.findOne({
    user_id: userId,
    target_type: contentType,
    target_id: contentId,
  });

  if (existing) {
    await Like.findByIdAndDelete(existing._id);
    const updated = await Model.findByIdAndUpdate(
      contentId,
      { $inc: { likes_count: -1 } },
      { new: true }
    );
    const count = Math.max(updated?.likes_count || 0, 0);
    if (count === 0 && updated?.likes_count < 0) {
      await Model.findByIdAndUpdate(contentId, { $set: { likes_count: 0 } });
    }
    return {
      likesCount: count,
      isLiked: false,
      message: `${capitalize(contentType)} unliked successfully`,
    };
  }

  await Like.create({
    user_id: userId,
    target_type: contentType,
    target_id: contentId,
  });

  const updated = await Model.findByIdAndUpdate(
    contentId,
    { $inc: { likes_count: 1 } },
    { new: true }
  );

  // Notification
  const liker = await User.findById(userId).select('firstName lastName');
  const thumbnail = content.media?.[0]?.url || null;
  await createInteractionNotification({
    recipientId: content.user_id,
    senderId: userId,
    type: 'like',
    referenceId: contentId,
    referenceType: capitalize(contentType),
    title: 'New Like',
    message: `${liker.firstName} ${liker.lastName} liked your ${contentType}`,
    thumbnail,
    actionUrl: `/${contentType}/${contentId}`,
  });

  return {
    likesCount: updated.likes_count,
    isLiked: true,
    message: `${capitalize(contentType)} liked successfully`,
  };
}

/**
 * Add a comment to content.
 */
export async function addComment({
  Model,
  contentId,
  userId,
  text,
  replyToCommentId,
  media,
  contentType,
}) {
  if (!text || text.trim().length === 0) {
    throw new ApiError(400, 'Comment text is required');
  }

  const content = await Model.findOne({ _id: contentId, is_deleted: false });
  if (!content) {
    throw new ApiError(404, `${capitalize(contentType)} not found`);
  }

  if (replyToCommentId) {
    const parent = await Comment.findById(replyToCommentId);
    if (!parent) {
      throw new ApiError(404, 'Parent comment not found');
    }
  }

  const comment = await Comment.create({
    user_id: userId,
    target_type: contentType,
    target_id: contentId,
    text,
    reply_to_comment_id: replyToCommentId,
    media,
  });

  // Atomic increment
  await Model.findByIdAndUpdate(contentId, { $inc: { comments_count: 1 } });

  if (replyToCommentId) {
    await Comment.findByIdAndUpdate(replyToCommentId, { $inc: { replies_count: 1 } });
  }

  // Notification
  const commenter = await User.findById(userId).select('firstName lastName');
  const thumbnail = content.media?.[0]?.url || null;
  await createInteractionNotification({
    recipientId: content.user_id,
    senderId: userId,
    type: 'comment',
    referenceId: contentId,
    referenceType: capitalize(contentType),
    title: 'New Comment',
    message: `${commenter.firstName} ${commenter.lastName} commented on your ${contentType}`,
    thumbnail,
    actionUrl: `/${contentType}/${contentId}`,
  });

  const populated = await Comment.findById(comment._id).populate(
    'user_id',
    'firstName lastName username profilePicture'
  );

  return populated;
}

/**
 * Delete a comment from content.
 */
export async function deleteComment({ Model, commentId, userId }) {
  const comment = await Comment.findById(commentId);
  if (!comment || comment.is_deleted) {
    throw new ApiError(404, 'Comment not found');
  }

  const content = await Model.findById(comment.target_id);
  const isOwner = comment.user_id.toString() === userId.toString();
  const isContentOwner = content?.user_id.toString() === userId.toString();

  if (!isOwner && !isContentOwner) {
    throw new ApiError(403, 'You are not authorized to delete this comment');
  }

  comment.is_deleted = true;
  await comment.save();

  // Atomic decrement
  if (content) {
    await Model.findByIdAndUpdate(content._id, { $inc: { comments_count: -1 } });
  }

  if (comment.reply_to_comment_id) {
    await Comment.findByIdAndUpdate(comment.reply_to_comment_id, { $inc: { replies_count: -1 } });
  }
}

/**
 * Save content to user's saved list.
 */
export async function saveContent({ Model, contentId, userId, contentType }) {
  const content = await Model.findOne({ _id: contentId, is_deleted: false });
  if (!content) {
    throw new ApiError(404, `${capitalize(contentType)} not found`);
  }

  const existing = await Save.findOne({
    user_id: userId,
    target_type: contentType,
    target_id: contentId,
  });

  if (existing) {
    throw new ApiError(400, `${capitalize(contentType)} already saved`);
  }

  await Save.create({
    user_id: userId,
    target_type: contentType,
    target_id: contentId,
  });

  await Model.findByIdAndUpdate(contentId, { $inc: { saves_count: 1 } });
}

/**
 * Unsave content from user's saved list.
 */
export async function unsaveContent({ Model, contentId, userId, contentType }) {
  const save = await Save.findOneAndDelete({
    user_id: userId,
    target_type: contentType,
    target_id: contentId,
  });

  if (!save) {
    throw new ApiError(400, `${capitalize(contentType)} not saved`);
  }

  const updated = await Model.findByIdAndUpdate(
    contentId,
    { $inc: { saves_count: -1 } },
    { new: true }
  );

  if (updated && updated.saves_count < 0) {
    await Model.findByIdAndUpdate(contentId, { $set: { saves_count: 0 } });
  }
}

/**
 * Share content — increment share counter.
 */
export async function shareContent({ Model, contentId, contentType }) {
  const content = await Model.findOne({ _id: contentId, is_deleted: false });
  if (!content) {
    throw new ApiError(404, `${capitalize(contentType)} not found`);
  }

  const updated = await Model.findByIdAndUpdate(
    contentId,
    { $inc: { shares_count: 1 } },
    { new: true }
  );

  return { sharesCount: updated.shares_count };
}

/**
 * Report content.
 */
export async function reportContent({ contentId, userId, reason, contentType }) {
  const existing = await Report.findOne({
    user_id: userId,
    target_type: contentType,
    target_id: contentId,
  });

  if (existing) {
    throw new ApiError(400, `You have already reported this ${contentType}`);
  }

  await Report.create({
    user_id: userId,
    target_type: contentType,
    target_id: contentId,
    reason: reason || 'inappropriate',
    status: 'pending',
  });
}

/**
 * Parse tag IDs from a request body field.
 * Handles both JSON string and array input.
 */
export function parseTagIds(taggedUsers) {
  if (!taggedUsers) return [];

  let parsed = taggedUsers;
  if (typeof taggedUsers === 'string') {
    try {
      parsed = JSON.parse(taggedUsers);
    } catch {
      parsed = taggedUsers.split(',').map((id) => id.trim());
    }
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter((id) => id && typeof id === 'string' && id.trim().length > 0);
}

/**
 * Send tag notifications to tagged users.
 */
export async function sendTagNotifications({ taggedUserIds, senderId, contentId, contentType }) {
  if (!taggedUserIds?.length) return;

  const sender = await User.findById(senderId).select('firstName lastName');
  if (!sender) return;

  for (const taggedUserId of taggedUserIds) {
    if (taggedUserId.toString() === senderId.toString()) continue;

    await createInteractionNotification({
      recipientId: taggedUserId,
      senderId,
      type: 'tag',
      referenceId: contentId,
      referenceType: capitalize(contentType),
      title: 'You were tagged',
      message: `${sender.firstName} ${sender.lastName} tagged you in a ${contentType}`,
      actionUrl: `/${contentType}/${contentId}`,
    });
  }
}

/**
 * Parse music data from request body (handles JSON string or object).
 */
export function parseMusicData(music) {
  if (!music) return null;
  if (typeof music === 'string') {
    try {
      return JSON.parse(music);
    } catch {
      return null;
    }
  }
  return music;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
