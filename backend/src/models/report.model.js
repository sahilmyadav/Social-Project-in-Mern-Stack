import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    target_type: {
      type: String,
      enum: ["post", "reel", "story", "comment", "user"],
      required: true,
    },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "spam",
        "inappropriate",
        "harassment",
        "violence",
        "hate_speech",
        "false_information",
        "intellectual_property",
        "other",
      ],
    },
    details: {
      type: String,
      maxlength: 500,
    },
    attachments: [String], // URLs to evidence
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

reportSchema.index({ target_type: 1, target_id: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model("Report", reportSchema);
