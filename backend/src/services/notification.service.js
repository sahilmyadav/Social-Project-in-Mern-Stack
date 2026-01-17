import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { sendPushNotification } from "./firebase.service.js";
import { getIO } from "../socket/socket.js";

/**
 * Create and send notification
 */
export const createNotification = async ({
  recipientId,
  senderId,
  type,
  referenceId,
  referenceType,
  title,
  message,
  thumbnail,
  actionUrl,
  metadata,
}) => {
  try {
    // Don't send notification to self
    if (recipientId.toString() === senderId.toString()) {
      return null;
    }

    // Create notification in database
    const notification = await Notification.create({
      recipient_id: recipientId,
      sender_id: senderId,
      type,
      reference_id: referenceId,
      reference_type: referenceType,
      title,
      message,
      thumbnail,
      action_url: actionUrl,
      metadata,
    });

    // Populate sender details
    await notification.populate("sender_id", "firstName lastName username profilePicture");

    // Send real-time notification via Socket.IO
    const io = getIO();
    if (io) {
      io.to(recipientId.toString()).emit("newNotification", {
        notification: notification.toObject(),
      });
    }

    // Send push notification (Firebase)
    await sendPushNotification(recipientId, {
      type,
      title,
      message,
      thumbnail,
      reference_id: referenceId,
      action_url: actionUrl,
      sender_id: senderId,
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

/**
 * Create notification for post like
 */
export const notifyPostLike = async (postId, postOwnerId, likerId, postThumbnail) => {
  const liker = await User.findById(likerId).select("firstName lastName username");

  return createNotification({
    recipientId: postOwnerId,
    senderId: likerId,
    type: "like",
    referenceId: postId,
    referenceType: "Post",
    title: "New Like",
    message: `${liker.firstName} ${liker.lastName} liked your post`,
    thumbnail: postThumbnail,
    actionUrl: `/post/${postId}`,
  });
};

/**
 * Create notification for comment
 */
export const notifyPostComment = async (postId, postOwnerId, commenterId, postThumbnail, commentText) => {
  const commenter = await User.findById(commenterId).select("firstName lastName username");

  return createNotification({
    recipientId: postOwnerId,
    senderId: commenterId,
    type: "comment",
    referenceId: postId,
    referenceType: "Post",
    title: "New Comment",
    message: `${commenter.firstName} ${commenter.lastName} commented: ${commentText.substring(0, 50)}${commentText.length > 50 ? "..." : ""}`,
    thumbnail: postThumbnail,
    actionUrl: `/post/${postId}`,
  });
};

/**
 * Create notification for post share
 */
export const notifyPostShare = async (postId, postOwnerId, sharerId, postThumbnail) => {
  const sharer = await User.findById(sharerId).select("firstName lastName username");

  return createNotification({
    recipientId: postOwnerId,
    senderId: sharerId,
    type: "share",
    referenceId: postId,
    referenceType: "Post",
    title: "Post Shared",
    message: `${sharer.firstName} ${sharer.lastName} shared your post`,
    thumbnail: postThumbnail,
    actionUrl: `/post/${postId}`,
  });
};

/**
 * Create notification for follow
 */
export const notifyFollow = async (followedUserId, followerId) => {
  const follower = await User.findById(followerId).select("firstName lastName username profilePicture");

  return createNotification({
    recipientId: followedUserId,
    senderId: followerId,
    type: "follow",
    referenceId: followerId,
    referenceType: "User",
    title: "New Follower",
    message: `${follower.firstName} ${follower.lastName} started following you`,
    thumbnail: follower.profilePicture,
    actionUrl: `/profile/${follower.username}`,
  });
};

/**
 * Create notification for follow request
 */
export const notifyFollowRequest = async (targetUserId, requesterId) => {
  const requester = await User.findById(requesterId).select("firstName lastName username profilePicture");

  return createNotification({
    recipientId: targetUserId,
    senderId: requesterId,
    type: "follow_request",
    referenceId: requesterId,
    referenceType: "User",
    title: "Follow Request",
    message: `${requester.firstName} ${requester.lastName} requested to follow you`,
    thumbnail: requester.profilePicture,
    actionUrl: `/follow-requests`,
  });
};

/**
 * Create notification for reel like
 */
export const notifyReelLike = async (reelId, reelOwnerId, likerId, reelThumbnail) => {
  const liker = await User.findById(likerId).select("firstName lastName username");

  return createNotification({
    recipientId: reelOwnerId,
    senderId: likerId,
    type: "reel_like",
    referenceId: reelId,
    referenceType: "Reel",
    title: "New Like",
    message: `${liker.firstName} ${liker.lastName} liked your reel`,
    thumbnail: reelThumbnail,
    actionUrl: `/reel/${reelId}`,
  });
};

/**
 * Create notification for reel comment
 */
export const notifyReelComment = async (reelId, reelOwnerId, commenterId, reelThumbnail, commentText) => {
  const commenter = await User.findById(commenterId).select("firstName lastName username");

  return createNotification({
    recipientId: reelOwnerId,
    senderId: commenterId,
    type: "reel_comment",
    referenceId: reelId,
    referenceType: "Reel",
    title: "New Comment",
    message: `${commenter.firstName} ${commenter.lastName} commented on your reel: ${commentText.substring(0, 50)}`,
    thumbnail: reelThumbnail,
    actionUrl: `/reel/${reelId}`,
  });
};

/**
 * Create notification for follow request accepted
 */
export const notifyFollowRequestAccepted = async (requesterId, accepterId) => {
  const accepter = await User.findById(accepterId).select("firstName lastName username profilePicture");

  return createNotification({
    recipientId: requesterId,
    senderId: accepterId,
    type: "follow_accepted",
    referenceId: accepterId,
    referenceType: "User",
    title: "Follow Request Accepted",
    message: `${accepter.firstName} ${accepter.lastName} accepted your follow request`,
    thumbnail: accepter.profilePicture,
    actionUrl: `/profile/${accepter.username}`,
  });
};

/**
 * Create notification for mention in comment
 */
export const notifyMention = async (mentionedUserId, mentionerId, postId, postThumbnail, commentText) => {
  const mentioner = await User.findById(mentionerId).select("firstName lastName username");

  return createNotification({
    recipientId: mentionedUserId,
    senderId: mentionerId,
    type: "mention",
    referenceId: postId,
    referenceType: "Post",
    title: "Mentioned You",
    message: `${mentioner.firstName} ${mentioner.lastName} mentioned you in a comment: ${commentText.substring(0, 50)}`,
    thumbnail: postThumbnail,
    actionUrl: `/post/${postId}`,
  });
};
