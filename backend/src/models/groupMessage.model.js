import mongoose from 'mongoose';

/**
 * Group Message Model
 * Messages for group chats with all WhatsApp/Instagram features
 */

const groupMessageSchema = new mongoose.Schema(
  {
    // Group reference
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupChat',
      required: true,
      index: true,
    },
    // Sender
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Message type
    messageType: {
      type: String,
      enum: [
        'text',
        'image',
        'video',
        'audio',
        'voice',
        'file',
        'document',
        'sticker',
        'gif',
        'location',
        'live_location',
        'contact',
        'shared_post',
        'shared_reel',
        'shared_story',
        'poll',
        'system', // For system messages like "User joined"
      ],
      default: 'text',
    },
    // Text content (encrypted)
    encryptedContent: {
      type: String,
    },
    // Plain text for system messages
    systemMessage: {
      type: String,
    },
    systemMessageType: {
      type: String,
      enum: [
        'group_created',
        'member_added',
        'member_removed',
        'member_left',
        'admin_promoted',
        'admin_demoted',
        'group_name_changed',
        'group_photo_changed',
        'group_description_changed',
        'settings_changed',
        'message_pinned',
        'message_unpinned',
        'call_started',
        'call_ended',
        'call_missed',
      ],
    },
    // Media files
    media: [
      {
        type: {
          type: String,
          enum: ['image', 'video', 'audio', 'voice', 'file', 'document', 'sticker', 'gif'],
        },
        url: String,
        publicId: String,
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        duration: Number, // For audio/video in seconds
        thumbnail: String,
        width: Number,
        height: Number,
        // For documents
        pageCount: Number,
        // Voice message specific
        waveform: [Number], // Audio waveform data
      },
    ],
    // Location data - only set when messageType is 'location' or 'live_location'
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: [Number], // [longitude, latitude]
      address: String,
      name: String,
      // Live location
      isLive: Boolean,
      expiresAt: Date,
      lastUpdated: Date,
    },
    // Contact sharing
    contact: {
      name: String,
      phone: String,
      email: String,
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    // Shared content (posts/reels/stories)
    sharedContent: {
      contentType: {
        type: String,
        enum: ['post', 'reel', 'story', 'profile'],
      },
      contentId: {
        type: mongoose.Schema.Types.ObjectId,
      },
      // Cached preview data
      preview: {
        thumbnail: String,
        caption: String,
        author: {
          _id: mongoose.Schema.Types.ObjectId,
          username: String,
          profileImage: String,
        },
      },
    },
    // Poll
    poll: {
      question: String,
      options: [
        {
          id: String,
          text: String,
          votes: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User',
            },
          ],
        },
      ],
      allowMultiple: {
        type: Boolean,
        default: false,
      },
      expiresAt: Date,
      isAnonymous: {
        type: Boolean,
        default: false,
      },
    },
    // Reply to another message
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupMessage',
    },
    // Mentions (@user)
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Reactions (like WhatsApp)
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        emoji: String,
        reactedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Read by (for group read receipts)
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Delivered to
    deliveredTo: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Forwarded
    isForwarded: {
      type: Boolean,
      default: false,
    },
    forwardedFrom: {
      groupId: mongoose.Schema.Types.ObjectId,
      messageId: mongoose.Schema.Types.ObjectId,
    },
    forwardCount: {
      type: Number,
      default: 0,
    },
    // Edited
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    editHistory: [
      {
        content: String,
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Starred/Saved by users
    starredBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Deleted
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Delete for specific users only
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Pinned
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    pinnedAt: {
      type: Date,
    },
    // Disappearing message
    expiresAt: {
      type: Date,
    },
    // Scheduled message
    scheduledFor: {
      type: Date,
    },
    isScheduled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
groupMessageSchema.index({ groupId: 1, createdAt: -1 });
groupMessageSchema.index({ groupId: 1, senderId: 1 });
groupMessageSchema.index({ mentions: 1 });
groupMessageSchema.index({ starredBy: 1 });
groupMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for disappearing messages
groupMessageSchema.index({ encryptedContent: 'text', systemMessage: 'text' }); // For search

// 2dsphere index for location queries - sparse to only index documents with valid GeoJSON
groupMessageSchema.index({ 'location.coordinates': '2dsphere' }, { sparse: true });

// Virtual for reaction count
groupMessageSchema.virtual('reactionCount').get(function () {
  return this.reactions?.length || 0;
});

// Virtual for read count
groupMessageSchema.virtual('readCount').get(function () {
  return this.readBy?.length || 0;
});

groupMessageSchema.set('toJSON', { virtuals: true });
groupMessageSchema.set('toObject', { virtuals: true });

export const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);
