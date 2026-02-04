import mongoose from "mongoose";

const reelViewSchema = new mongoose.Schema(
  {
    reel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Compound unique index to ensure one view per user per reel
reelViewSchema.index({ reel_id: 1, user_id: 1 }, { unique: true });

// Index for counting views per reel
reelViewSchema.index({ reel_id: 1 });

export const ReelView = mongoose.model("ReelView", reelViewSchema);
