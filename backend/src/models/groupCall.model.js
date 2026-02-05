import mongoose from 'mongoose';

/**
 * Group Call Model
 * Complete WhatsApp/Instagram-like group voice & video calling
 */

// Participant in a group call
const callParticipantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Participant status
    status: {
      type: String,
      enum: ['invited', 'ringing', 'joined', 'declined', 'missed', 'left', 'removed', 'failed'],
      default: 'invited',
    },
    // Timestamps
    invitedAt: {
      type: Date,
      default: Date.now,
    },
    joinedAt: {
      type: Date,
    },
    leftAt: {
      type: Date,
    },
    // Duration in call (seconds)
    duration: {
      type: Number,
      default: 0,
    },
    // Media states
    isAudioEnabled: {
      type: Boolean,
      default: true,
    },
    isVideoEnabled: {
      type: Boolean,
      default: false,
    },
    isScreenSharing: {
      type: Boolean,
      default: false,
    },
    isSpeaking: {
      type: Boolean,
      default: false,
    },
    // Hand raised
    isHandRaised: {
      type: Boolean,
      default: false,
    },
    handRaisedAt: {
      type: Date,
    },
    // Role in call
    role: {
      type: String,
      enum: ['host', 'co-host', 'participant'],
      default: 'participant',
    },
    // Connection quality
    connectionQuality: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'disconnected'],
      default: 'good',
    },
    // WebRTC peer ID
    peerId: {
      type: String,
    },
    // Device info
    device: {
      type: {
        type: String,
        enum: ['mobile', 'desktop', 'tablet', 'web'],
      },
      os: String,
      browser: String,
    },
  },
  { _id: false }
);

// Main group call schema
const groupCallSchema = new mongoose.Schema(
  {
    // Unique call identifier
    callId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Group reference
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupChat',
      required: true,
    },
    // Call type
    callType: {
      type: String,
      enum: ['audio', 'video'],
      required: true,
    },
    // Initiator/Host
    initiator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // All participants
    participants: [callParticipantSchema],
    // Call status
    status: {
      type: String,
      enum: ['initiating', 'ringing', 'ongoing', 'ended', 'failed', 'cancelled'],
      default: 'initiating',
    },
    // Timestamps
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    scheduledFor: {
      type: Date,
    },
    // Total duration (seconds)
    duration: {
      type: Number,
      default: 0,
    },
    // End reason
    endReason: {
      type: String,
      enum: [
        'completed',
        'no_answer',
        'declined_all',
        'cancelled',
        'network_error',
        'timeout',
        'ended_by_host',
        'ended_by_system',
      ],
    },
    // Call settings
    settings: {
      // Max participants
      maxParticipants: {
        type: Number,
        default: 8, // Like WhatsApp
      },
      // Waiting room
      waitingRoomEnabled: {
        type: Boolean,
        default: false,
      },
      // Mute on join
      muteOnJoin: {
        type: Boolean,
        default: false,
      },
      // Video off on join
      videoOffOnJoin: {
        type: Boolean,
        default: false,
      },
      // Recording enabled
      recordingEnabled: {
        type: Boolean,
        default: false,
      },
      // Only host can unmute participants
      hostOnlyUnmute: {
        type: Boolean,
        default: false,
      },
      // Allow screen sharing
      screenSharingAllowed: {
        type: Boolean,
        default: true,
      },
      // Chat during call
      chatEnabled: {
        type: Boolean,
        default: true,
      },
    },
    // Recording
    recording: {
      isRecording: {
        type: Boolean,
        default: false,
      },
      startedAt: Date,
      endedAt: Date,
      url: String,
      publicId: String,
      size: Number,
      duration: Number,
    },
    // Waiting room
    waitingRoom: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        joinedWaitingAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Call quality metrics
    metrics: {
      peakParticipants: {
        type: Number,
        default: 0,
      },
      totalJoins: {
        type: Number,
        default: 0,
      },
      avgDuration: {
        type: Number,
        default: 0,
      },
      avgQuality: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor'],
      },
    },
    // Room/Channel info for WebRTC
    roomData: {
      roomId: String,
      encryptionKey: String, // For E2E encryption
      iceServers: [
        {
          urls: [String],
          username: String,
          credential: String,
        },
      ],
    },
    // Related message in group (call notification)
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupMessage',
    },
    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
groupCallSchema.index({ groupId: 1, createdAt: -1 });
groupCallSchema.index({ initiator: 1, createdAt: -1 });
groupCallSchema.index({ 'participants.user': 1 });
groupCallSchema.index({ status: 1, createdAt: -1 });
groupCallSchema.index({ scheduledFor: 1 });

// Virtual for active participants count
groupCallSchema.virtual('activeParticipantsCount').get(function () {
  return this.participants?.filter((p) => p.status === 'joined').length || 0;
});

// Instance methods
groupCallSchema.methods.addParticipant = async function (userId, role = 'participant') {
  const existing = this.participants.find((p) => p.user.toString() === userId.toString());
  if (existing) {
    existing.status = 'invited';
    existing.invitedAt = new Date();
  } else {
    this.participants.push({
      user: userId,
      role,
      status: 'invited',
      invitedAt: new Date(),
    });
  }
  return this.save();
};

groupCallSchema.methods.joinCall = async function (userId, peerId) {
  const participant = this.participants.find((p) => p.user.toString() === userId.toString());
  if (participant) {
    participant.status = 'joined';
    participant.joinedAt = new Date();
    participant.peerId = peerId;

    // Update metrics
    this.metrics.totalJoins = (this.metrics.totalJoins || 0) + 1;
    const activeCount = this.participants.filter((p) => p.status === 'joined').length;
    if (activeCount > (this.metrics.peakParticipants || 0)) {
      this.metrics.peakParticipants = activeCount;
    }

    // Start call if first participant
    if (!this.startedAt && this.status !== 'ongoing') {
      this.startedAt = new Date();
      this.status = 'ongoing';
    }
  }
  return this.save();
};

groupCallSchema.methods.leaveCall = async function (userId) {
  const participant = this.participants.find((p) => p.user.toString() === userId.toString());
  if (participant) {
    participant.status = 'left';
    participant.leftAt = new Date();
    if (participant.joinedAt) {
      participant.duration = Math.floor((new Date() - participant.joinedAt) / 1000);
    }
  }

  // End call if no active participants
  const activeCount = this.participants.filter((p) => p.status === 'joined').length;
  if (activeCount === 0 && this.status === 'ongoing') {
    this.status = 'ended';
    this.endedAt = new Date();
    this.endReason = 'completed';
    if (this.startedAt) {
      this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
    }
  }

  return this.save();
};

groupCallSchema.methods.endCall = async function (reason = 'ended_by_host') {
  this.status = 'ended';
  this.endedAt = new Date();
  this.endReason = reason;
  if (this.startedAt) {
    this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
  }

  // Mark all active participants as left
  this.participants.forEach((p) => {
    if (p.status === 'joined') {
      p.status = 'left';
      p.leftAt = new Date();
      if (p.joinedAt) {
        p.duration = Math.floor((new Date() - p.joinedAt) / 1000);
      }
    } else if (p.status === 'ringing' || p.status === 'invited') {
      p.status = 'missed';
    }
  });

  return this.save();
};

groupCallSchema.set('toJSON', { virtuals: true });
groupCallSchema.set('toObject', { virtuals: true });

export const GroupCall = mongoose.model('GroupCall', groupCallSchema);
