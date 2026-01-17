import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
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
    media: [
      {
        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        thumbnail: String,
        width: Number,
        height: Number,
        duration: Number, // For videos
      },
    ],
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    location: {
      name: String,
      latitude: Number,
      longitude: Number,
    },
    visibility: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
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
    saves_count: {
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

// Indexes for performance
postSchema.index({ user_id: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });

export const Post = mongoose.model("Post", postSchema);
