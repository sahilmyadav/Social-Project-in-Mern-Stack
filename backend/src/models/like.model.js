import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    target_type: {
      type: String,
      enum: ["post", "reel", "comment"],
      required: true,
    },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

// Composite index to prevent duplicate likes
likeSchema.index({ user_id: 1, target_type: 1, target_id: 1 }, { unique: true });
likeSchema.index({ target_type: 1, target_id: 1 });

export const Like = mongoose.model("Like", likeSchema);
