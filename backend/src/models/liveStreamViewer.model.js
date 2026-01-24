import mongoose from 'mongoose';

const liveStreamViewerSchema = new mongoose.Schema({
    liveStreamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LiveStream',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    leftAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Compound index for unique viewer per stream
liveStreamViewerSchema.index({ liveStreamId: 1, userId: 1 }, { unique: true });

export const LiveStreamViewer = mongoose.model('LiveStreamViewer', liveStreamViewerSchema);
