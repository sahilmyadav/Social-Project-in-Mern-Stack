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

export const Followers = mongoose.model("Followers", followerSchema);
