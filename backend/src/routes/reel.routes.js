import { Router } from 'express';
import {
  commentOnReel,
  deleteReel,
  getReelComments,
  getReelDetails,
  getUserReels,
  getUserSavedReels,
  reportReel,
  saveReel,
  toggleLikeReel,
  unsaveReel,
  uploadReel,
  viewReel,
} from '../controllers/reel.controller.js';
import { verifyJwt, verifyJwtOptional } from '../middleware/auth.middleware.js';
import { handleUploadError, uploadSingle } from '../middleware/upload.middleware.js';

const router = Router();

// Reel routes
router.route('/upload').post(verifyJwt, uploadSingle, handleUploadError, uploadReel);
router.route('/delete/:reelId').delete(verifyJwt, deleteReel);
router.route('/details/:reelId').get(verifyJwtOptional, getReelDetails);

// User reels
router.route('/user/:userId').get(verifyJwt, getUserReels);

// Like/Unlike
router.route('/toggle-like/:reelId').post(verifyJwt, toggleLikeReel);

// Comments
router.route('/comment/:reelId').post(verifyJwt, commentOnReel);
router.route('/comments/:reelId').get(verifyJwt, getReelComments);

// Save/Unsave
router.route('/save/:reelId').post(verifyJwt, saveReel);
router.route('/unsave/:reelId').delete(verifyJwt, unsaveReel);
router.route('/saved').get(verifyJwt, getUserSavedReels);

// Report
router.route('/report/:reelId').post(verifyJwt, reportReel);

// View tracking
router.route('/view/:reelId').post(verifyJwt, viewReel);

export default router;
