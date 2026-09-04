import mongoose from 'mongoose';

const liveStreamCommentSchema = new mongoose.Schema({
    liveStreamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LiveStream',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    }
}, {
    timestamps: true
});

liveStreamCommentSchema.index({ liveStreamId: 1, createdAt: -1 });

export const LiveStreamComment = mongoose.model('LiveStreamComment', liveStreamCommentSchema);
