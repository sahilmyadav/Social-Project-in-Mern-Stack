import { Router } from "express";
import {
  uploadStory,
  deleteStory,
  getUserStories,
  getAllStories,
  cleanupExpiredStories,
  viewStory,
  getStoryViewers,
} from "../controllers/story.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";
import { uploadSingle, handleUploadError } from "../middleware/upload.middleware.js";

const router = Router();

// Story routes
router.route("/upload").post(verifyJwt, uploadSingle, handleUploadError, uploadStory);
router.route("/delete/:storyId").delete(verifyJwt, deleteStory);
router.route("/feed").get(verifyJwt, getAllStories); // Get all stories (feed)
router.route("/user/:userId").get(verifyJwt, getUserStories); // Get specific user's stories

// View tracking routes
router.route("/view/:storyId").post(verifyJwt, viewStory);
router.route("/viewers/:storyId").get(verifyJwt, getStoryViewers);

router.route("/get-all-stories").get(verifyJwt, getAllStories); // Get all stories (feed)
// Cleanup route (can be called manually or by cron job)
router.route("/cleanup").post(cleanupExpiredStories);

export default router;
