import mongoose from 'mongoose';

const liveStreamSchema = new mongoose.Schema({
    streamerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    thumbnail: {
        type: String, // URL to thumbnail image
    },
    status: {
        type: String,
        enum: ['waiting', 'live', 'ended'],
        default: 'waiting',
        index: true
    },
    viewerCount: {
        type: Number,
        default: 0
    },
    startedAt: {
        type: Date
    },
    endedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for finding active streams
liveStreamSchema.index({ status: 1, createdAt: -1 });
liveStreamSchema.index({ streamerId: 1, status: 1 });

export const LiveStream = mongoose.model('LiveStream', liveStreamSchema);
