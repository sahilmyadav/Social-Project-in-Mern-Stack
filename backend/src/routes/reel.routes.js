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
import { validateBody, validateObjectId } from '../middleware/validate.js';
import { reelCommentSchema, reportReelSchema, uploadReelSchema } from '../schemas/reel.schema.js';

const router = Router();

// Reel routes
router
  .route('/upload')
  .post(verifyJwt, uploadSingle, handleUploadError, validateBody(uploadReelSchema), uploadReel);
router.route('/delete/:reelId').delete(verifyJwt, validateObjectId('reelId'), deleteReel);
router.route('/details/:reelId').get(verifyJwtOptional, validateObjectId('reelId'), getReelDetails);

// User reels
router.route('/user/:userId').get(verifyJwt, validateObjectId('userId'), getUserReels);

// Like/Unlike
router.route('/toggle-like/:reelId').post(verifyJwt, validateObjectId('reelId'), toggleLikeReel);

// Comments
router
  .route('/comment/:reelId')
  .post(verifyJwt, validateObjectId('reelId'), validateBody(reelCommentSchema), commentOnReel);
router.route('/comments/:reelId').get(verifyJwt, validateObjectId('reelId'), getReelComments);

// Save/Unsave
router.route('/save/:reelId').post(verifyJwt, validateObjectId('reelId'), saveReel);
router.route('/unsave/:reelId').delete(verifyJwt, validateObjectId('reelId'), unsaveReel);
router.route('/saved').get(verifyJwt, getUserSavedReels);

// Report
router
  .route('/report/:reelId')
  .post(verifyJwt, validateObjectId('reelId'), validateBody(reportReelSchema), reportReel);

// View tracking
router.route('/view/:reelId').post(verifyJwt, validateObjectId('reelId'), viewReel);

export default router;
