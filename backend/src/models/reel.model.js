import mongoose from "mongoose";

const reelSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    caption: {
      type: String,
      maxlength: 2200,
    },
    media: {
      url: {
        type: String,
        required: true,
      },
      thumbnail: String,
      duration: Number,
      width: Number,
      height: Number,
    },
    music_id: {
      type: String, // Reference to music/audio library
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likes_count: {
      type: Number,
      default: 0,
    },
    comments_count: {
      type: Number,
      default: 0,
    },
    shares_count: {
      type: Number,
      default: 0,
    },
    views_count: {
      type: Number,
      default: 0,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes for feed and discovery
reelSchema.index({ user_id: 1, createdAt: -1 });
reelSchema.index({ createdAt: -1 });
reelSchema.index({ views_count: -1 });

export const Reel = mongoose.model("Reel", reelSchema);
