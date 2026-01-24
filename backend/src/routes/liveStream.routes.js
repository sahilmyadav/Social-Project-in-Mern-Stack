import express from 'express';
import {
    createLiveStream,
    startLiveStream,
    endLiveStream,
    getLiveStreamDetails,
    getActiveLiveStreams,
    getAllLiveStreams,
    joinLiveStream,
    leaveLiveStream,
    sendLiveComment,
    getLiveComments,
    getLiveStreamViewers,
    getUserLiveStreams,
    deleteLiveStream
} from '../controllers/liveStream.controller.js';
import { verifyJwt } from '../middleware/auth.middleware.js';
import { uploadSingle } from '../middleware/upload.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJwt);

// Create live stream (with optional thumbnail)
router.post('/create', uploadSingle, createLiveStream);

// Start live stream
router.post('/start/:streamId', startLiveStream);

// End live stream
router.post('/end/:streamId', endLiveStream);

// Get live stream details
router.get('/details/:streamId', getLiveStreamDetails);

// Get active live streams (from followed users)
router.get('/active', getActiveLiveStreams);

// Get all public live streams
router.get('/all', getAllLiveStreams);

// Get user's live stream history
router.get('/user/:userId', getUserLiveStreams);

// Join live stream
router.post('/join/:streamId', joinLiveStream);

// Leave live stream
router.post('/leave/:streamId', leaveLiveStream);

// Get live stream viewers
router.get('/viewers/:streamId', getLiveStreamViewers);

// Send comment
router.post('/comment/:streamId', sendLiveComment);

// Get comments
router.get('/comments/:streamId', getLiveComments);

// Delete live stream
router.delete('/delete/:streamId', deleteLiveStream);

export default router;
