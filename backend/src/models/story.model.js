import mongoose from 'mongoose';

const storySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    media: {
      type: {
        type: String,
        enum: ['image', 'video'],
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
      thumbnail: String,
      duration: Number,
      width: Number,
      height: Number,
      public_id: String, // Cloudinary public_id for deletion
    },
    // Music field for Instagram-like music feature
    music: {
      trackId: String,
      trackName: String,
      artistName: String,
      albumArt: String,
      previewUrl: String,
      startTime: Number, // Start time in seconds for 30-second clip
    },
    // Filter applied to the story (e.g., 'normal', 'clarendon', 'gingham', etc.)
    filter: {
      type: String,
      default: 'normal',
    },
    reply_settings: {
      type: String,
      enum: ['everyone', 'followers', 'off'],
      default: 'everyone',
    },
    privacy: {
      type: String,
      enum: ['public', 'followers', 'close_friends'],
      default: 'followers',
    },
    views_count: {
      type: Number,
      default: 0,
    },
    // View tracking - stores who viewed the story and when
    views: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
    },
    expires_at: {
      type: Date,
      required: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Auto-expire after 24 hours
storySchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ user_id: 1, createdAt: -1 });
storySchema.index({ 'views.user': 1 }); // Index for view tracking queries

export const Story = mongoose.model('Story', storySchema);
