import mongoose from "mongoose";

const searchHistorySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
    },
    search_type: {
      type: String,
      enum: ["global", "users", "pages", "hashtags", "posts"],
      default: "global",
    },
    results_count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for user's recent searches
searchHistorySchema.index({ user_id: 1, createdAt: -1 });

export const SearchHistory = mongoose.model("SearchHistory", searchHistorySchema);
