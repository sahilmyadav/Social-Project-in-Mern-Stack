import mongoose from "mongoose";

const chatThreadSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatMessage",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
    isArchived: {
      type: Map,
      of: Boolean,
      default: {},
    },
    isPinned: {
      type: Map,
      of: Boolean,
      default: {},
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
chatThreadSchema.index({ participants: 1, isDeleted: 1 });
chatThreadSchema.index({ lastMessageAt: -1 });

export const ChatThread = mongoose.model("ChatThread", chatThreadSchema);
