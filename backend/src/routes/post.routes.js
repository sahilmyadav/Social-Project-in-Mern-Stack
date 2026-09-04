import { Router } from 'express';
import {
  commentOnPost,
  deleteComment,
  deletePost,
  getAllComments,
  getExplorePosts,
  getPostDetails,
  getPostViews,
  getUserSavedPosts,
  likePost,
  reportPost,
  savePost,
  sharePost,
  totalPostCount,
  trackPostView,
  unlikePost,
  unsavePost,
  uploadPost,
} from '../controllers/post.controller.js';
import { verifyJwt, verifyJwtOptional } from '../middleware/auth.middleware.js';
import { handleUploadError, uploadMultiple } from '../middleware/upload.middleware.js';
import { validateBody, validateObjectId } from '../middleware/validate.js';
import { commentSchema, reportSchema, uploadPostSchema } from '../schemas/post.schema.js';

const router = Router();

// Post routes - uploadMultiple handles file uploads
router
  .route('/upload')
  .post(verifyJwt, uploadMultiple, handleUploadError, validateBody(uploadPostSchema), uploadPost);

// seaerch posts b title route will be here -
// router.route("/search").get(verifyJwt, getPostDetails);
router.route('/delete/:postId').delete(verifyJwt, validateObjectId('postId'), deletePost);
router.route('/details/:postId').get(verifyJwtOptional, validateObjectId('postId'), getPostDetails);
router.route('/like/:postId').post(verifyJwt, validateObjectId('postId'), likePost);
router.route('/unlike/:postId').delete(verifyJwt, validateObjectId('postId'), unlikePost);
router
  .route('/comment/:postId')
  .post(verifyJwt, validateObjectId('postId'), validateBody(commentSchema), commentOnPost);
router.route('/comment/:commentId').delete(verifyJwt, validateObjectId('commentId'), deleteComment);
router.route('/share/:postId').post(verifyJwt, validateObjectId('postId'), sharePost);
router.route('/save/:postId').post(verifyJwt, validateObjectId('postId'), savePost);
router.route('/unsave/:postId').delete(verifyJwt, validateObjectId('postId'), unsavePost);

router.route('/user-saved-posts').get(verifyJwt, getUserSavedPosts);
// router.route("/unsaved/:postId").post(verifyJwt,)
router.route('/report/:postId').post(verifyJwt, validateBody(reportSchema), reportPost);

router.route('/save/user-saved-posts').get(verifyJwt, getUserSavedPosts);

router.route('/totalPostCount').get(verifyJwt, totalPostCount);

router.route('/comments/:postId').get(verifyJwt, getAllComments);

// Explore posts - discover posts from users you're not following
router.route('/explore').get(verifyJwt, getExplorePosts);

// Post view tracking
router.route('/view/:postId').post(verifyJwt, trackPostView);
router.route('/views/:postId').get(verifyJwt, getPostViews);

export default router;
