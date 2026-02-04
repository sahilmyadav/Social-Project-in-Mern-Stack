import mongoose from "mongoose";

const followerSchema = new mongoose.Schema(
  {
    follower_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    following_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["requested", "accepted"],
      default: "requested",
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

// Prevent duplicate follow request
followerSchema.index(
  { follower_id: 1, following_id: 1 },
  { unique: true }
);

// Performance indexes for common queries
followerSchema.index({ follower_id: 1, status: 1 }); // Get who I follow (accepted)
followerSchema.index({ following_id: 1, status: 1 }); // Get my followers (accepted)
followerSchema.index({ following_id: 1, follower_id: 1, status: 1 }); // Check follow relationship

export const Followers = mongoose.model("Followers", followerSchema);
