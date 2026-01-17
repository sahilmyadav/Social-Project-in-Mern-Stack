import mongoose from "mongoose";

const saveSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    target_type: {
      type: String,
      enum: ["post", "reel"],
      required: true,
    },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    collection_name: {
      type: String,
      default: "All",
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

// Prevent duplicate saves
saveSchema.index({ user_id: 1, target_type: 1, target_id: 1 }, { unique: true });

export const Save = mongoose.model("Save", saveSchema);
