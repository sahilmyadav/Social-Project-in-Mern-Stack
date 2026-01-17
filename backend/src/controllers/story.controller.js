import { Story } from "../models/story.model.js";
import { Followers } from "../models/followers.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary, delteOnCloudinray } from "../utils/cloudinary.js";

// Upload a story
export const uploadStory = asyncHandler(async (req, res) => {
  const { reply_settings, privacy, duration, width, height, music, filter } = req.body;
  const userId = req.user._id;

  if (!req.file) {
    throw new ApiError(400, "Media file (image/video) is required");
  }

  // Upload media to Cloudinary
  const mediaUpload = await uploadOnCloudinary(req.file.path);

  if (!mediaUpload) {
    throw new ApiError(500, "Failed to upload media to Cloudinary");
  }

  // Determine media type
  const mediaType = mediaUpload.resource_type === "video" ? "video" : "image";

  // Prepare media object with cloudinary public_id for deletion
  const media = {
    url: mediaUpload.secure_url,
    type: mediaType,
    thumbnail: mediaUpload.secure_url,
    duration: duration || mediaUpload.duration,
    width: width || mediaUpload.width,
    height: height || mediaUpload.height,
    public_id: mediaUpload.public_id, // Store for Cloudinary deletion
  };

  // Parse music data if provided
  let musicData = null;
  if (music) {
    try {
      musicData = typeof music === 'string' ? JSON.parse(music) : music;
      console.log('📀 Music data received:', musicData);
    } catch (error) {
      console.error('Error parsing music data:', error);
      // Don't throw error, just log it and continue without music
    }
  }

  // Set expiry to 24 hours from now
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const story = await Story.create({
    user_id: userId,
    media,
    music: musicData, // Add music data
    filter: filter || 'normal', // Add filter data
    reply_settings: reply_settings || "everyone",
    privacy: privacy || "followers",
    expires_at: expiresAt,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, story, "Story uploaded successfully"));
});

// Delete a story
export const deleteStory = asyncHandler(async (req, res) => {
  const { storyId } = req.params;
  const userId = req.user._id;

  const story = await Story.findById(storyId);

  if (!story || story.is_deleted) {
    throw new ApiError(404, "Story not found");
  }

  // Check if user is owner
  if (story.user_id.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to delete this story");
  }

  // Delete media from Cloudinary
  if (story.media?.public_id) {
    try {
      await delteOnCloudinray(story.media.public_id);
    } catch (error) {
      console.error("Error deleting from Cloudinary:", error);
      // Continue with story deletion even if Cloudinary fails
    }
  }

  story.is_deleted = true;
  await story.save();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Story deleted successfully"));
});

// Track story view
export const viewStory = asyncHandler(async (req, res) => {
  const { storyId } = req.params;
  const userId = req.user._id;

  const story = await Story.findById(storyId);

  if (!story || story.is_deleted) {
    throw new ApiError(404, "Story not found");
  }

  // Don't track view if user is viewing their own story
  if (story.user_id.toString() === userId.toString()) {
    return res
      .status(200)
      .json(new ApiResponse(200, { viewCount: story.viewCount }, "Own story - view not tracked"));
  }

  // Check if user already viewed this story
  const alreadyViewed = story.views.some(
    (view) => view.user.toString() === userId.toString()
  );

  if (!alreadyViewed) {
    // Add view
    story.views.push({
      user: userId,
      viewedAt: new Date(),
    });
    story.viewCount = story.views.length;
    await story.save();

  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { viewCount: story.viewCount },
        "Story view tracked"
      )
    );
});

// Get story viewers (only for story owner)
export const getStoryViewers = asyncHandler(async (req, res) => {
  const { storyId } = req.params;
  const userId = req.user._id;

  const story = await Story.findById(storyId).populate({
    path: "views.user",
    select: "firstName lastName username profilePicture profileImage avatar",
  });

  if (!story || story.is_deleted) {
    throw new ApiError(404, "Story not found");
  }

  // Only story owner can see viewers
  if (story.user_id.toString() !== userId.toString()) {
    throw new ApiError(403, "You can only view your own story viewers");
  }

  // Format viewers data
  const viewers = story.views.map((view) => ({
    _id: view.user._id,
    firstName: view.user.firstName,
    lastName: view.user.lastName,
    username: view.user.username,
    profilePicture: view.user.profilePicture || view.user.profileImage || view.user.avatar,
    viewedAt: view.viewedAt,
  }));

  // Sort by most recent first
  viewers.sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { viewers, viewCount: viewers.length },
        "Story viewers fetched successfully"
      )
    );
});

// Get user's active stories
export const getUserStories = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  const stories = await Story.find({
    user_id: userId,
    is_deleted: false,
    expires_at: { $gt: new Date() },
  })
    .populate("user_id", "firstName lastName username profilePicture profileImage avatar")
    .sort({ createdAt: -1 });


  // Check privacy settings and transform data
  const filteredStories = stories
    .filter((story) => {
      if (story.privacy === "public") return true;
      if (!currentUserId) return false;
      if (story.user_id._id.toString() === currentUserId.toString()) return true;
      // For now, allow followers privacy stories when viewing user's stories (TODO: Implement proper follow check)
      if (story.privacy === "followers") return true;
      return false;
    })
    .map((story) => ({
      _id: story._id,
      user: {
        _id: story.user_id._id,
        fullName: `${story.user_id.firstName || ""} ${story.user_id.lastName || ""}`.trim(),
        username: story.user_id.username,
        profilePicture: story.user_id.profilePicture || story.user_id.profileImage || story.user_id.avatar,
      },
      media: story.media,
      music: story.music, // Include music data
      filter: story.filter || 'normal', // Include filter data
      views_count: story.views_count || 0,
      createdAt: story.createdAt,
      expires_at: story.expires_at,
      reply_settings: story.reply_settings,
      privacy: story.privacy,
    }));


  return res
    .status(200)
    .json(new ApiResponse(200, { stories: filteredStories }, "Stories fetched successfully"));
});

// Get all active stories (feed)
export const getAllStories = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // STEP 1: Get following list
  const following = await Followers.find({
    follower_id: userId,
    status: 'accepted'
  }).select('following_id');

  const followingIds = following.map(f => f.following_id);
  const userIdsToShow = [...followingIds, userId];


  // STEP 2: Get stories ONLY from followed users (active stories)
  const now = new Date();

  const stories = await Story.find({
    user_id: { $in: userIdsToShow },
    is_deleted: false,
    expires_at: { $gt: now }
  })
    .populate('user_id', 'firstName lastName username profilePicture profileImage avatar')
    .sort({ createdAt: -1 })
    .lean();

  // STEP 3: Group by user
  const storiesByUser = stories.reduce((acc, story) => {
    const authorId = story.user_id._id.toString();
    if (!acc[authorId]) {
      acc[authorId] = {
        user: {
          _id: story.user_id._id,
          firstName: story.user_id.firstName,
          lastName: story.user_id.lastName,
          username: story.user_id.username,
          profilePicture: story.user_id.profilePicture || story.user_id.profileImage || story.user_id.avatar
        },
        stories: []
      };
    }
    acc[authorId].stories.push(story);
    return acc;
  }, {});

  const groupedStories = Object.values(storiesByUser);

  return res.status(200).json(
    new ApiResponse(
      200,
      { stories: groupedStories },
      'Stories feed fetched successfully'
    )
  );
});

// Cleanup expired stories (to be called by cron job)
export const cleanupExpiredStories = asyncHandler(async (req, res) => {
  try {
    // Find all expired stories that haven't been deleted yet
    const expiredStories = await Story.find({
      expires_at: { $lt: new Date() },
      is_deleted: false,
    });


    let deletedCount = 0;
    let cloudinaryDeletedCount = 0;

    for (const story of expiredStories) {
      // Delete from Cloudinary
      if (story.media?.public_id) {
        try {
          await delteOnCloudinray(story.media.public_id);
          cloudinaryDeletedCount++;
        } catch (error) {
          console.error(`Failed to delete from Cloudinary: ${story.media.public_id}`, error);
        }
      }

      // Mark as deleted in database
      story.is_deleted = true;
      await story.save();
      deletedCount++;
    }

    const message = `Cleaned up ${deletedCount} expired stories (${cloudinaryDeletedCount} from Cloudinary)`;

    return res
      ? res.status(200).json(new ApiResponse(200, { deletedCount, cloudinaryDeletedCount }, message))
      : { deletedCount, cloudinaryDeletedCount };
  } catch (error) {
    console.error("Error cleaning up expired stories:", error);
    if (res) {
      throw new ApiError(500, "Failed to cleanup expired stories");
    }
  }
});

// Auto-cleanup function that runs periodically (call this from index.js)
export const startStoryCleanupJob = () => {
  // Run cleanup every hour
  setInterval(async () => {
    try {
      await cleanupExpiredStories();
    } catch (error) {
      console.error("Story cleanup job failed:", error);
    }
  }, 60 * 60 * 1000); // Every 1 hour

  // Run immediately on startup
  setTimeout(async () => {
    try {
      await cleanupExpiredStories();
    } catch (error) {
      console.error("Initial story cleanup failed:", error);
    }
  }, 5000); // 5 seconds after startup
};
