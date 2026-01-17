import mongoose from "mongoose";

const hashtagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    usage_count: {
      type: Number,
      default: 0,
      index: true,
    },
    last_used_at: {
      type: Date,
      default: Date.now,
    },
    trending_score: {
      type: Number,
      default: 0,
      index: true,
    },
    related_hashtags: [String],
  },
  { timestamps: true }
);

// Index for trending hashtags
hashtagSchema.index({ trending_score: -1, usage_count: -1 });
hashtagSchema.index({ name: "text" });

export const Hashtag = mongoose.model("Hashtag", hashtagSchema);
