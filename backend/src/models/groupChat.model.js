import mongoose from 'mongoose';

/**
 * Group Chat Model
 * Complete WhatsApp/Instagram-like group chat functionality
 */

// Member schema for group participants
const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // User-specific settings
    nickname: {
      type: String,
      maxlength: 50,
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    mutedUntil: {
      type: Date,
    },
    lastSeen: {
      type: Date,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    // Notification settings
    notifications: {
      type: String,
      enum: ['all', 'mentions', 'none'],
      default: 'all',
    },
  },
  { _id: false }
);

// Group settings schema
const groupSettingsSchema = new mongoose.Schema(
  {
    // Who can edit group info
    editGroupInfo: {
      type: String,
      enum: ['admins', 'everyone'],
      default: 'admins',
    },
    // Who can send messages
    sendMessages: {
      type: String,
      enum: ['admins', 'everyone'],
      default: 'everyone',
    },
    // Who can add members
    addMembers: {
      type: String,
      enum: ['admins', 'everyone'],
      default: 'everyone',
    },
    // Approval required for new members
    approvalRequired: {
      type: Boolean,
      default: false,
    },
    // Link sharing enabled
    linkSharingEnabled: {
      type: Boolean,
      default: true,
    },
    // Message disappearing
    disappearingMessages: {
      enabled: {
        type: Boolean,
        default: false,
      },
      duration: {
        type: Number, // Duration in seconds (24h = 86400, 7d = 604800, 90d = 7776000)
        default: 86400,
      },
    },
    // Pinned messages limit
    maxPinnedMessages: {
      type: Number,
      default: 3,
    },
    // Max members
    maxMembers: {
      type: Number,
      default: 256,
    },
    // Slow mode (time between messages in seconds)
    slowMode: {
      enabled: {
        type: Boolean,
        default: false,
      },
      interval: {
        type: Number, // Seconds between messages
        default: 0,
      },
    },
  },
  { _id: false }
);

// Main group chat schema
const groupChatSchema = new mongoose.Schema(
  {
    // Group basic info
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 512,
    },
    // Group images
    avatar: {
      type: String, // URL to group avatar
    },
    avatarPublicId: {
      type: String,
    },
    // Group type
    type: {
      type: String,
      enum: ['private', 'public'],
      default: 'private',
    },
    // Creator
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Members
    members: [memberSchema],
    // Pending join requests (for approval-required groups)
    pendingRequests: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        message: String,
      },
    ],
    // Group settings
    settings: {
      type: groupSettingsSchema,
      default: () => ({}),
    },
    // Associated chat thread for messages
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatThread',
    },
    // Invite link
    inviteLink: {
      code: {
        type: String,
        unique: true,
        sparse: true,
      },
      createdAt: {
        type: Date,
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      expiresAt: {
        type: Date,
      },
      usageLimit: {
        type: Number,
      },
      usageCount: {
        type: Number,
        default: 0,
      },
    },
    // Pinned messages
    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GroupMessage',
      },
    ],
    // Last activity
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupMessage',
    },
    // Stats
    totalMessages: {
      type: Number,
      default: 0,
    },
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
groupChatSchema.index({ 'members.user': 1, isDeleted: 1 });
groupChatSchema.index({ createdBy: 1 });
groupChatSchema.index({ lastMessageAt: -1 });
groupChatSchema.index({ name: 'text', description: 'text' });

// Virtual for member count
groupChatSchema.virtual('memberCount').get(function () {
  return this.members?.length || 0;
});

// Instance methods
groupChatSchema.methods.isAdmin = function (userId) {
  const member = this.members.find((m) => m.user.toString() === userId.toString());
  return member?.role === 'admin';
};

groupChatSchema.methods.isModerator = function (userId) {
  const member = this.members.find((m) => m.user.toString() === userId.toString());
  return member?.role === 'moderator' || member?.role === 'admin';
};

groupChatSchema.methods.isMember = function (userId) {
  return this.members.some((m) => m.user.toString() === userId.toString());
};

groupChatSchema.methods.canSendMessage = function (userId) {
  if (!this.isMember(userId)) return false;
  if (this.settings.sendMessages === 'everyone') return true;
  return this.isModerator(userId);
};

groupChatSchema.methods.canAddMembers = function (userId) {
  if (!this.isMember(userId)) return false;
  if (this.settings.addMembers === 'everyone') return true;
  return this.isModerator(userId);
};

groupChatSchema.methods.canEditGroupInfo = function (userId) {
  if (!this.isMember(userId)) return false;
  if (this.settings.editGroupInfo === 'everyone') return true;
  return this.isAdmin(userId);
};

// Generate invite code
groupChatSchema.methods.generateInviteLink = async function (userId, options = {}) {
  const code = generateInviteCode();
  this.inviteLink = {
    code,
    createdAt: new Date(),
    createdBy: userId,
    expiresAt: options.expiresAt,
    usageLimit: options.usageLimit,
    usageCount: 0,
  };
  await this.save();
  return code;
};

// Helper function to generate invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 22; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Ensure toJSON includes virtuals
groupChatSchema.set('toJSON', { virtuals: true });
groupChatSchema.set('toObject', { virtuals: true });

export const GroupChat = mongoose.model('GroupChat', groupChatSchema);
