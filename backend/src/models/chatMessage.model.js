import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatThread",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "video", "audio", "file", "reaction", "shared_post", "shared_reel"],
      default: "text",
    },
    // Encrypted message content
    encryptedContent: {
      type: String,
      required: function () {
        return this.messageType === "text" || this.messageType === "reaction";
      },
    },
    // Media files (images, videos, audio, files)
    media: [
      {
        type: {
          type: String,
          enum: ["image", "video", "audio", "file"],
        },
        url: String,
        filename: String,
        size: Number,
        duration: Number, // For audio/video
        thumbnail: String, // For video
        publicId: String,
      },
    ],
    // Shared content (posts/reels)
    sharedContent: {
      contentType: {
        type: String,
        enum: ["post", "reel"],
      },
      contentId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "sharedContent.contentType",
      },
      // Cached content data for preview (in case original is deleted)
      contentData: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
    // Reply to another message
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatMessage",
    },
    // Message status
    status: {
      type: String,
      enum: ["sending", "sent", "delivered", "seen", "failed"],
      default: "sent",
    },
    deliveredAt: {
      type: Date,
    },
    seenAt: {
      type: Date,
    },
    // Edit history
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    // Deletion
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
chatMessageSchema.index({ threadId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1, receiverId: 1 });
chatMessageSchema.index({ status: 1 });

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
