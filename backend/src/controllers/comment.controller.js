import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Like/Unlike a comment (Toggle)
export const likeComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user._id;

    // Verify comment exists
    const comment = await Comment.findById(commentId);
    if (!comment || comment.is_deleted) {
        throw new ApiError(404, "Comment not found");
    }

    // Check if user already liked this comment
    const existingLike = await Like.findOne({
        user_id: userId,
        target_type: "comment",
        target_id: commentId,
    });

    let isLiked;
    let likesCount;

    if (existingLike) {
        // Unlike - remove the like
        await Like.deleteOne({ _id: existingLike._id });

        // Decrement likes count
        comment.likes_count = Math.max(0, comment.likes_count - 1);
        await comment.save();

        isLiked = false;
        likesCount = comment.likes_count;
    } else {
        // Like - create new like
        await Like.create({
            user_id: userId,
            target_type: "comment",
            target_id: commentId,
        });

        // Increment likes count
        comment.likes_count += 1;
        await comment.save();

        isLiked = true;
        likesCount = comment.likes_count;
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                isLiked,
                likes_count: likesCount,
            },
            isLiked ? "Comment liked successfully" : "Comment unliked successfully"
        )
    );
});

// Reply to a comment
export const replyToComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!text?.trim()) {
        throw new ApiError(400, "Reply text is required");
    }

    // Verify parent comment exists
    const parentComment = await Comment.findById(commentId);
    if (!parentComment || parentComment.is_deleted) {
        throw new ApiError(404, "Parent comment not found");
    }

    // Create the reply
    const reply = await Comment.create({
        user_id: userId,
        target_type: parentComment.target_type,
        target_id: parentComment.target_id,
        text: text.trim(),
        reply_to_comment_id: commentId,
        reply_to_user_id: parentComment.user_id,
    });

    // Increment parent comment's replies count
    parentComment.replies_count += 1;
    await parentComment.save();

    // Populate user details for the reply
    const populatedReply = await Comment.findById(reply._id).populate({
        path: "user_id",
        select: "firstName lastName profilePicture username",
    }).populate({
        path: "reply_to_user_id",
        select: "firstName lastName username",
    });

    return res.status(201).json(
        new ApiResponse(201, populatedReply, "Reply added successfully")
    );
});

// Get all replies for a comment
export const getCommentReplies = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;

  // Verify parent comment exists
  const parentComment = await Comment.findById(commentId);
  if (!parentComment) {
    throw new ApiError(404, 'Comment not found');
  }

  // Get replies
  const replies = await Comment.find({
    reply_to_comment_id: commentId,
    is_deleted: false
  })
    .populate('user_id', 'firstName lastName username profileImage profilePicture avatar') // ✅ ADD profileImage
    .populate('reply_to_user_id', 'firstName lastName username') // User being replied to
    .sort({ createdAt: 1 }) // Oldest first for replies
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  // Add isLiked status for each reply
  const repliesWithLikeStatus = await Promise.all(
    replies.map(async (reply) => {
      const isLiked = await Like.exists({
        target_type: 'comment',
        target_id: reply._id,
        user_id: userId
      });

      return {
        ...reply.toObject(),
        isLikedByCurrentUser: !!isLiked
      };
    })
  );

  const totalReplies = await Comment.countDocuments({
    reply_to_comment_id: commentId,
    is_deleted: false
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        replies: repliesWithLikeStatus,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalReplies / parseInt(limit)),
          totalReplies,
          hasMore: parseInt(page) * parseInt(limit) < totalReplies
        }
      },
      'Replies fetched successfully'
    )
  );
});

// Edit a comment
export const editComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!text?.trim()) {
        throw new ApiError(400, "Comment text is required");
    }

    // Find comment
    const comment = await Comment.findById(commentId);
    if (!comment || comment.is_deleted) {
        throw new ApiError(404, "Comment not found");
    }

    // Check if user is the comment owner
    if (comment.user_id.toString() !== userId.toString()) {
        throw new ApiError(403, "You are not authorized to edit this comment");
    }

    // Update comment
    comment.text = text.trim();
    comment.is_edited = true;
    comment.edited_at = new Date();
    await comment.save();

    // Populate user details
    const populatedComment = await Comment.findById(comment._id).populate({
        path: "user_id",
        select: "firstName lastName profilePicture username",
    });

    return res.status(200).json(
        new ApiResponse(200, populatedComment, "Comment updated successfully")
    );
});

// Delete a comment
export const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user._id;

    // Find comment
    const comment = await Comment.findById(commentId);
    if (!comment || comment.is_deleted) {
        throw new ApiError(404, "Comment not found");
    }

    // Check if user is comment owner or post/reel owner
    let isAuthorized = comment.user_id.toString() === userId.toString();

    if (!isAuthorized) {
        // Check if user is the post/reel owner
        if (comment.target_type === "post") {
            const post = await Post.findById(comment.target_id);
            isAuthorized = post && post.user_id.toString() === userId.toString();
        }
        // Add similar check for reels if needed
    }

    if (!isAuthorized) {
        throw new ApiError(403, "You are not authorized to delete this comment");
    }

    // Soft delete the comment
    comment.is_deleted = true;
    await comment.save();

    // Decrement parent comment's replies count if this is a reply
    if (comment.reply_to_comment_id) {
        await Comment.findByIdAndUpdate(comment.reply_to_comment_id, {
            $inc: { replies_count: -1 },
        });
    }

    // Decrement post/reel comment count
    if (comment.target_type === "post") {
        await Post.findByIdAndUpdate(comment.target_id, {
            $inc: { comments_count: -1 },
        });
    }

    return res.status(200).json(
        new ApiResponse(200, null, "Comment deleted successfully")
    );
});

// Unlike a comment (explicit endpoint)
export const unlikeComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user._id;

    // Verify comment exists
    const comment = await Comment.findById(commentId);
    if (!comment || comment.is_deleted) {
        throw new ApiError(404, "Comment not found");
    }

    // Find and remove the like
    const existingLike = await Like.findOne({
        user_id: userId,
        target_type: "comment",
        target_id: commentId,
    });

    if (!existingLike) {
        throw new ApiError(400, "You haven't liked this comment");
    }

    await Like.deleteOne({ _id: existingLike._id });

    // Decrement likes count
    comment.likes_count = Math.max(0, comment.likes_count - 1);
    await comment.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                isLiked: false,
                likes_count: comment.likes_count,
            },
            "Comment unliked successfully"
        )
    );
});

// Get comment details with like status
export const getCommentDetails = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user?._id;

    // Find comment
    const comment = await Comment.findById(commentId)
        .populate({
            path: "user_id",
            select: "firstName lastName profilePicture username",
        })
        .populate({
            path: "reply_to_user_id",
            select: "firstName lastName username",
        })
        .lean();

    if (!comment || comment.is_deleted) {
        throw new ApiError(404, "Comment not found");
    }

    // Check if current user has liked this comment
    let isLikedByCurrentUser = false;
    if (userId) {
        const like = await Like.findOne({
            user_id: userId,
            target_type: "comment",
            target_id: commentId,
        });
        isLikedByCurrentUser = !!like;
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                ...comment,
                isLikedByCurrentUser,
            },
            "Comment fetched successfully"
        )
    );
});
