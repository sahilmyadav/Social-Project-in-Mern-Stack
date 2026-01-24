import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "like",
        "comment",
        "share",
        "follow",
        "follow_request",
        "follow_accepted",
        "reel_like",
        "reel_comment",
        "story_view",
        "mention",
        "tag",
        "live_invite",
      ],
      required: true,
      index: true,
    },
    reference_id: {
      type: mongoose.Schema.Types.ObjectId,
      // Can reference Post, Comment, Reel, Story, etc.
    },
    reference_type: {
      type: String,
      enum: ["Post", "Comment", "Reel", "Story", "User"],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String, // Image/video thumbnail for the notification
    },
    is_read: {
      type: Boolean,
      default: false,
      index: true,
    },
    read_at: {
      type: Date,
    },
    action_url: {
      type: String, // Deep link or URL to navigate
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed, // Additional data
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
notificationSchema.index({ recipient_id: 1, is_read: 1, createdAt: -1 });
notificationSchema.index({ recipient_id: 1, type: 1, createdAt: -1 });

// Delete old read notifications after 30 days (optional cleanup)
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { is_read: true } }
);

export const Notification = mongoose.model("Notification", notificationSchema);
