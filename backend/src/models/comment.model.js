import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    target_type: {
      type: String,
      enum: ["post", "reel"],
      required: true,
    },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 2200,
    },
    reply_to_comment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    reply_to_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    media: {
      type: String, // URL to attached media
    },
    likes_count: {
      type: Number,
      default: 0,
    },
    replies_count: {
      type: Number,
      default: 0,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    is_edited: {
      type: Boolean,
      default: false,
    },
    edited_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
commentSchema.index({ target_type: 1, target_id: 1, createdAt: -1 });
commentSchema.index({ reply_to_comment_id: 1 });
commentSchema.index({ user_id: 1 });

export const Comment = mongoose.model("Comment", commentSchema);
