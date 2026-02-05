import { Followers } from '../models/followers.model.js';
import { User } from '../models/user.model.js';
import {
  notifyFollow,
  notifyFollowRequest,
  notifyFollowRequestAccepted,
} from '../services/notification.service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// POST /follow/request/:targetUserId - Send follow request
const sendFollowRequest = asyncHandler(async (req, res) => {
  const { targetUserId } = req.params;
  const currentUserId = req.user._id;

  // Validate target user ID
  if (!targetUserId) {
    throw new ApiError(400, 'Target user ID is required');
  }

  // Check if trying to follow self
  if (currentUserId.toString() === targetUserId) {
    throw new ApiError(400, 'You cannot follow yourself');
  }

  // Check if target user exists
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new ApiError(404, 'Target user not found');
  }

  // Check if target user is active
  if (targetUser.status !== 'active') {
    throw new ApiError(403, 'Cannot follow this user');
  }

  // Check if already following or request exists
  const existingFollow = await Followers.findOne({
    follower_id: currentUserId,
    following_id: targetUserId,
  });

  if (existingFollow) {
    // Instead of throwing error, return the existing request status
    if (existingFollow.status === 'accepted') {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            followRequest: existingFollow,
            alreadyExists: true,
            status: 'accepted',
            autoApproved: true,
          },
          'You are already following this user'
        )
      );
    } else {
      // Request already pending
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            followRequest: existingFollow,
            alreadyExists: true,
            status: 'requested',
            autoApproved: false,
          },
          'Follow request already sent'
        )
      );
    }
  }

  // Determine status based on account privacy
  const status = targetUser.isPrivate ? 'requested' : 'accepted';

  // Create follow relationship
  const followRequest = await Followers.create({
    follower_id: currentUserId,
    following_id: targetUserId,
    status,
  });
  // Send notification to the target user
  if (status === 'accepted') {
    // Public account - send follow notification
    await notifyFollow(targetUserId, currentUserId);
  } else {
    // Private account - send follow request notification
    await notifyFollowRequest(targetUserId, currentUserId);
  }
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        followRequest,
        autoApproved: !targetUser.isPrivate,
        status,
        alreadyExists: false,
      },
      targetUser.isPrivate ? 'Follow request sent successfully' : 'Now following user'
    )
  );
});

// POST /follow/accept/:requestId - Accept follow request
const acceptFollowRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const currentUserId = req.user._id;

  // Find the follow request
  const followRequest = await Followers.findById(requestId);

  if (!followRequest) {
    throw new ApiError(404, 'Follow request not found');
  }

  // Verify the current user is the target of the request
  if (followRequest.following_id.toString() !== currentUserId.toString()) {
    throw new ApiError(403, 'You can only accept requests sent to you');
  }

  // Check if already accepted
  if (followRequest.status === 'accepted') {
    throw new ApiError(400, 'Follow request already accepted');
  }

  // Update status to accepted
  followRequest.status = 'accepted';
  await followRequest.save();

  // Send notification to the requester
  await notifyFollowRequestAccepted(followRequest.follower_id, currentUserId);

  return res
    .status(200)
    .json(new ApiResponse(200, { followRequest }, 'Follow request accepted successfully'));
});

// remove follow request if pending request exists
const removeFollowRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const currentUserId = req.user._id;

  // Find the follow request
  const followRequest = await Followers.findById(requestId);

  if (!followRequest) {
    throw new ApiError(404, 'Follow request not found');
  }

  // Allow both sender (to cancel) and recipient (to reject) to remove the request
  const isSender = followRequest.follower_id.toString() === currentUserId.toString();
  const isRecipient = followRequest.following_id.toString() === currentUserId.toString();

  if (!isSender && !isRecipient) {
    throw new ApiError(403, 'You can only remove requests you sent or received');
  }

  // If already accepted, only allow unfollowing (not removing)
  if (followRequest.status === 'accepted') {
    throw new ApiError(400, 'Cannot remove an accepted follow relationship. Use unfollow instead.');
  }

  // Delete the follow request
  await Followers.findByIdAndDelete(requestId);

  const action = isSender ? 'cancelled' : 'rejected';

  return res.status(200).json(new ApiResponse(200, null, `Follow request ${action} successfully`));
});

// Cancel follow request by userId (for frontend convenience)
const cancelFollowRequestByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  // Find the pending follow request
  const followRequest = await Followers.findOne({
    follower_id: currentUserId,
    following_id: userId,
    status: 'requested',
  });

  if (!followRequest) {
    throw new ApiError(404, 'Follow request not found');
  }

  // Delete the follow request
  await Followers.findByIdAndDelete(followRequest._id);

  return res.status(200).json(new ApiResponse(200, null, 'Follow request cancelled successfully'));
});

// GET /follow/pending-requests - Get all pending follow requests
const getPendingRequests = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit = 20, page = 1 } = req.query;

  // Find all pending follow requests where current user is being followed
  const requests = await Followers.find({
    following_id: userId,
    status: 'requested',
  })
    .populate('follower_id', 'firstName lastName username profilePicture profileImage avatar')
    .sort({ created_at: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();

  // Format response
  const formattedRequests = requests.map((req) => ({
    _id: req._id,
    follower_id: req.follower_id._id,
    following_id: req.following_id,
    status: req.status,
    requester: {
      _id: req.follower_id._id,
      firstName: req.follower_id.firstName,
      lastName: req.follower_id.lastName,
      username: req.follower_id.username,
      profilePicture:
        req.follower_id.profilePicture || req.follower_id.profileImage || req.follower_id.avatar,
    },
    createdAt: req.created_at,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, formattedRequests, 'Pending requests retrieved successfully'));
});

// POST /follow/reject/:requestId - Reject follow request
const rejectFollowRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const currentUserId = req.user._id;

  // Find the follow request
  const followRequest = await Followers.findById(requestId);

  if (!followRequest) {
    throw new ApiError(404, 'Follow request not found');
  }

  // Verify the current user is the target of the request
  if (followRequest.following_id.toString() !== currentUserId.toString()) {
    throw new ApiError(403, 'You can only reject requests sent to you');
  }

  // Check if already accepted
  if (followRequest.status === 'accepted') {
    throw new ApiError(400, 'Cannot reject an accepted follow request');
  }

  // Delete the follow request
  await Followers.findByIdAndDelete(requestId);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { followRequest: { _id: requestId, status: 'rejected' } },
        'Follow request rejected successfully'
      )
    );
});

// DELETE /follow/remove/:targetUserId - Unfollow or remove follower
const removeFollow = asyncHandler(async (req, res) => {
  const { targetUserId } = req.params;
  const { action } = req.query; // action: 'unfollow' or 'remove-follower'
  const currentUserId = req.user._id;

  if (!targetUserId) {
    throw new ApiError(400, 'Target user ID is required');
  }

  if (!action || !['unfollow', 'remove-follower'].includes(action)) {
    throw new ApiError(400, "Valid action is required: 'unfollow' or 'remove-follower'");
  }

  let followRecord;

  if (action === 'unfollow') {
    // Current user wants to unfollow target user
    followRecord = await Followers.findOneAndDelete({
      follower_id: currentUserId,
      following_id: targetUserId,
    });

    if (!followRecord) {
      throw new ApiError(404, 'You are not following this user');
    }

    return res
      .status(200)
      .json(new ApiResponse(200, { unfollowed: targetUserId }, 'Successfully unfollowed user'));
  } else if (action === 'remove-follower') {
    // Current user wants to remove target user as a follower
    followRecord = await Followers.findOneAndDelete({
      follower_id: targetUserId,
      following_id: currentUserId,
    });

    if (!followRecord) {
      throw new ApiError(404, 'This user is not following you');
    }

    return res
      .status(200)
      .json(new ApiResponse(200, { removed: targetUserId }, 'Successfully removed follower'));
  }
});

// DELETE /follow/unfollow/:targetUserId - Dedicated unfollow endpoint
const unfollowUser = asyncHandler(async (req, res) => {
  const { targetUserId } = req.params;
  const currentUserId = req.user._id;

  if (!targetUserId) {
    throw new ApiError(400, 'Target user ID is required');
  }

  // Check if trying to unfollow self
  if (currentUserId.toString() === targetUserId) {
    throw new ApiError(400, 'Invalid operation');
  }

  // Current user wants to unfollow target user
  const followRecord = await Followers.findOneAndDelete({
    follower_id: currentUserId,
    following_id: targetUserId,
  });

  if (!followRecord) {
    throw new ApiError(404, 'You are not following this user');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { unfollowed: targetUserId }, 'Successfully unfollowed user'));
});

// GET /follow/status/:targetUserId - Get follow relationship status
const getFollowStatus = asyncHandler(async (req, res) => {
  const { targetUserId } = req.params;
  const currentUserId = req.user._id;

  if (!targetUserId) {
    throw new ApiError(400, 'Target user ID is required');
  }

  // Check if current user follows target
  const following = await Followers.findOne({
    follower_id: currentUserId,
    following_id: targetUserId,
  });

  // Check if target follows current user
  const follower = await Followers.findOne({
    follower_id: targetUserId,
    following_id: currentUserId,
  });

  let status = 'not-following';

  if (following && following.status === 'accepted' && follower && follower.status === 'accepted') {
    status = 'follow-back'; // Both follow each other
  } else if (following && following.status === 'accepted') {
    status = 'following'; // Current user follows target
  } else if (following && following.status === 'requested') {
    status = 'requested'; // Current user requested to follow target
  } else if (follower && follower.status === 'accepted') {
    status = 'follower'; // Target follows current user
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        status,
        following: following ? { id: following._id, status: following.status } : null,
        follower: follower ? { id: follower._id, status: follower.status } : null,
      },
      'Follow status retrieved successfully'
    )
  );
});

// POST /follow/follow-back/:targetUserId - Follow back a user
const followBack = asyncHandler(async (req, res) => {
  const { targetUserId } = req.params;
  const currentUserId = req.user._id;

  if (!targetUserId) {
    throw new ApiError(400, 'Target user ID is required');
  }

  // Check if target user exists
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new ApiError(404, 'Target user not found');
  }

  // Verify that target user follows current user
  const isFollower = await Followers.findOne({
    follower_id: targetUserId,
    following_id: currentUserId,
    status: 'accepted',
  });

  if (!isFollower) {
    throw new ApiError(400, 'This user is not following you');
  }

  // Check if already following back
  const alreadyFollowing = await Followers.findOne({
    follower_id: currentUserId,
    following_id: targetUserId,
  });

  if (alreadyFollowing) {
    if (alreadyFollowing.status === 'accepted') {
      throw new ApiError(400, 'You are already following this user');
    } else {
      throw new ApiError(400, 'Follow request already sent');
    }
  }

  // Create follow back relationship (auto-approve since they follow us)
  const status = targetUser.isPrivate ? 'requested' : 'accepted';

  const followBack = await Followers.create({
    follower_id: currentUserId,
    following_id: targetUserId,
    status,
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        followBack,
        autoApproved: !targetUser.isPrivate,
      },
      targetUser.isPrivate ? 'Follow request sent successfully' : 'Successfully followed back'
    )
  );
});

// GET /follow/suggestions - Get follow suggestions
const getFollowSuggestions = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { limit = 10, cursor } = req.query;

  // Get users current user is already following
  const following = await Followers.find({
    follower_id: currentUserId,
    status: 'accepted',
  }).select('following_id');

  const followingIds = following.map((f) => f.following_id);
  followingIds.push(currentUserId); // Exclude self

  // Build query
  const query = {
    _id: { $nin: followingIds },
    status: 'active',
  };

  if (cursor) {
    query._id = { ...query._id, $lt: cursor };
  }

  // Get mutual followers (people who follow users that current user follows)
  const mutualFollowers = await Followers.aggregate([
    {
      $match: {
        following_id: { $in: followingIds.slice(0, -1) }, // Exclude self from followingIds
        status: 'accepted',
      },
    },
    {
      $group: {
        _id: '$follower_id',
        mutualCount: { $sum: 1 },
      },
    },
    {
      $match: {
        _id: { $nin: followingIds },
      },
    },
    { $sort: { mutualCount: -1 } },
    { $limit: parseInt(limit) },
  ]);

  const mutualFollowerIds = mutualFollowers.map((m) => m._id);

  // Get suggested users (prioritize mutual followers)
  let suggestions = await User.find({
    _id: { $in: mutualFollowerIds },
  })
    .select('firstName lastName email phone avatar profileImage bio isPrivate')
    .limit(parseInt(limit));

  // If not enough mutual followers, add random active users
  if (suggestions.length < parseInt(limit)) {
    const remaining = parseInt(limit) - suggestions.length;
    const additionalUsers = await User.find({
      ...query,
      _id: { $nin: [...followingIds, ...mutualFollowerIds] },
    })
      .select('firstName lastName email phone avatar profileImage bio isPrivate')
      .limit(remaining)
      .sort({ createdAt: -1 });

    suggestions = [...suggestions, ...additionalUsers];
  }

  // Add mutual connection count
  suggestions = suggestions.map((user) => {
    const mutual = mutualFollowers.find((m) => m._id.toString() === user._id.toString());
    return {
      ...user.toObject(),
      mutualConnectionsCount: mutual ? mutual.mutualCount : 0,
    };
  });

  const nextCursor = suggestions.length > 0 ? suggestions[suggestions.length - 1]._id : null;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        suggestions,
        nextCursor,
        hasMore: suggestions.length === parseInt(limit),
      },
      'Follow suggestions retrieved successfully'
    )
  );
});

const totalFollowers = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  if (!userId) {
    throw new ApiError(400, 'User ID is required');
  }

  const count = await Followers.countDocuments({
    following_id: userId,
    status: 'accepted',
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { count }, 'Total followers fetched successfully'));
});
// const totalFollowers = asyncHandler(async (req, res) => {
//   const userId = req.user?.Id;

//   if (!userId) return res.status.json(new ApiError(400, "User ID not found"));
//   const count = await Followers.countDocuments({
//     following_id: req.params.userId,
//     status: "accepted",
//   });

//   return res
//     .status(200)
//     .json(
//       new ApiResponse(200, { count }, "Total followers fetched successfully")
//     );
// });

const totalFollowing = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (!userId) {
    throw new ApiError(400, 'User ID is required');
  }

  const count = await Followers.countDocuments({
    follower_id: userId,
    status: 'accepted',
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { count }, 'Total following fetched successfully'));
});

// GET /follow/followers/:userId - Get list of followers
const getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const currentUserId = req.user._id;

  if (!userId) {
    throw new ApiError(400, 'User ID is required');
  }

  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 50);
  const skip = (pageNum - 1) * limitNum;

  // Get total count
  const total = await Followers.countDocuments({
    following_id: userId,
    status: 'accepted',
  });

  // Get followers with user details
  const followerRecords = await Followers.find({
    following_id: userId,
    status: 'accepted',
  })
    .populate(
      'follower_id',
      'firstName lastName username avatar profileImage bio isVerified isPrivate'
    )
    .skip(skip)
    .limit(limitNum)
    .sort('-created_at')
    .lean();

  // Map followers and check if current user follows them back
  const followerPromises = followerRecords
    .filter((record) => record.follower_id != null) // Filter out records where user was deleted
    .map(async (record) => {
      const follower = record.follower_id;

      // Check if current user follows this follower back
      const followRelationship = await Followers.findOne({
        follower_id: currentUserId,
        following_id: follower._id,
      });

      const isFollowingBack = followRelationship?.status === 'accepted';
      const isPending = followRelationship?.status === 'requested';

      return {
        _id: follower._id,
        firstName: follower.firstName,
        lastName: follower.lastName,
        fullName: `${follower.firstName} ${follower.lastName}`,
        username: follower.username,
        profilePicture: follower.profileImage || follower.avatar,
        avatar: follower.avatar,
        bio: follower.bio,
        isVerified: follower.isVerified,
        isPrivate: follower.isPrivate || false,
        isFollowing: isFollowingBack,
        isPending: isPending,
      };
    });

  const followers = await Promise.all(followerPromises);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        followers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          hasMore: skip + followers.length < total,
        },
      },
      'Followers retrieved successfully'
    )
  );
});

// GET /follow/following/:userId - Get list of users being followed
const getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const currentUserId = req.user._id;

  if (!userId) {
    throw new ApiError(400, 'User ID is required');
  }

  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 50);
  const skip = (pageNum - 1) * limitNum;

  // Get total count
  const total = await Followers.countDocuments({
    follower_id: userId,
    status: 'accepted',
  });

  // Get following with user details
  const followingRecords = await Followers.find({
    follower_id: userId,
    status: 'accepted',
  })
    .populate(
      'following_id',
      'firstName lastName username avatar profileImage bio isVerified isPrivate'
    )
    .skip(skip)
    .limit(limitNum)
    .sort('-created_at')
    .lean();

  // Map following users and check if current user follows them
  const followingPromises = followingRecords
    .filter((record) => record.following_id != null) // Filter out records where user was deleted
    .map(async (record) => {
      const followedUser = record.following_id;

      // Check if current user follows this person
      const followRelationship = await Followers.findOne({
        follower_id: currentUserId,
        following_id: followedUser._id,
      });

      const isFollowing = followRelationship?.status === 'accepted';
      const isPending = followRelationship?.status === 'requested';

      return {
        _id: followedUser._id,
        firstName: followedUser.firstName,
        lastName: followedUser.lastName,
        fullName: `${followedUser.firstName} ${followedUser.lastName}`,
        username: followedUser.username,
        profilePicture: followedUser.profileImage || followedUser.avatar,
        avatar: followedUser.avatar,
        bio: followedUser.bio,
        isVerified: followedUser.isVerified,
        isPrivate: followedUser.isPrivate || false,
        isFollowing: isFollowing,
        isPending: isPending,
      };
    });

  const following = await Promise.all(followingPromises);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        following,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          hasMore: skip + following.length < total,
        },
      },
      'Following list retrieved successfully'
    )
  );
});

export {
  acceptFollowRequest,
  cancelFollowRequestByUserId,
  followBack,
  getFollowers,
  getFollowing,
  getFollowStatus,
  getFollowSuggestions,
  getPendingRequests,
  rejectFollowRequest,
  removeFollow,
  removeFollowRequest,
  sendFollowRequest,
  totalFollowers,
  totalFollowing,
  unfollowUser,
};
