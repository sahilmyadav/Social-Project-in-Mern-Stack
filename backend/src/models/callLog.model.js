import mongoose from "mongoose";

const callLogSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    callType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatThread",
    },
    status: {
      type: String,
      enum: ["initiated", "ringing", "answered", "rejected", "missed", "ended", "failed"],
      default: "initiated",
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    duration: {
      type: Number, // Duration in seconds
      default: 0,
    },
    // Encryption key for this call session
    encryptionKey: {
      type: String,
    },
    // Call quality metrics
    quality: {
      avgBitrate: Number,
      packetLoss: Number,
      jitter: Number,
      latency: Number,
    },
    // WebRTC connection data (for reconnection)
    connectionData: {
      type: String, // Encrypted WebRTC session data
    },
    // Rejection/End reason
    endReason: {
      type: String,
      enum: ["normal", "busy", "declined", "no_answer", "network_error", "timeout"],
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

// Indexes
callLogSchema.index({ callerId: 1, createdAt: -1 });
callLogSchema.index({ receiverId: 1, createdAt: -1 });
callLogSchema.index({ status: 1 });

export const CallLog = mongoose.model("CallLog", callLogSchema);
