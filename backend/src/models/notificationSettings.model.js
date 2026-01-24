import mongoose from "mongoose";

const notificationSettingsSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    fcm_tokens: [
      {
        token: String,
        device_type: {
          type: String,
          enum: ["ios", "android", "web"],
        },
        device_id: String,
        created_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    preferences: {
      push: {
        enabled: {
          type: Boolean,
          default: true,
        },
        likes: {
          type: Boolean,
          default: true,
        },
        comments: {
          type: Boolean,
          default: true,
        },
        shares: {
          type: Boolean,
          default: true,
        },
        follows: {
          type: Boolean,
          default: true,
        },
        mentions: {
          type: Boolean,
          default: true,
        },
        live_invites: {
          type: Boolean,
          default: true,
        },
      },
      email: {
        enabled: {
          type: Boolean,
          default: true,
        },
        likes: {
          type: Boolean,
          default: false,
        },
        comments: {
          type: Boolean,
          default: true,
        },
        shares: {
          type: Boolean,
          default: false,
        },
        follows: {
          type: Boolean,
          default: true,
        },
        mentions: {
          type: Boolean,
          default: true,
        },
        digest: {
          type: Boolean,
          default: true, // Weekly digest email
        },
      },
      in_app: {
        enabled: {
          type: Boolean,
          default: true,
        },
        sound: {
          type: Boolean,
          default: true,
        },
        vibration: {
          type: Boolean,
          default: true,
        },
      },
    },
    do_not_disturb: {
      enabled: {
        type: Boolean,
        default: false,
      },
      start_time: String, // Format: "22:00"
      end_time: String, // Format: "08:00"
    },
  },
  {
    timestamps: true,
  }
);

export const NotificationSettings = mongoose.model(
  "NotificationSettings",
  notificationSettingsSchema
);
