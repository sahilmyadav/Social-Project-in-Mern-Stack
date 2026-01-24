import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema(
  {
    admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "user_verify",
        "user_ban",
        "user_unban",
        "user_delete",
        "content_remove",
        "report_resolve",
        "global_notification",
        "maintenance_toggle",
        "app_version_update",
        "other",
      ],
    },
    target_type: {
      type: String,
      enum: ["User", "Post", "Reel", "Story", "Report", "System"],
    },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    ip_address: {
      type: String,
    },
    user_agent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
adminLogSchema.index({ admin_id: 1, createdAt: -1 });
adminLogSchema.index({ action: 1, createdAt: -1 });
adminLogSchema.index({ target_type: 1, target_id: 1 });

export const AdminLog = mongoose.model("AdminLog", adminLogSchema);
