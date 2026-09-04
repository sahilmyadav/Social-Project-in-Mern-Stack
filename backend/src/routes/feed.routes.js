import { Router } from "express";
import {
  getHomeFeed,
  getReelsFeed,
  getStoriesFeed,
  getUserPosts,
} from "../controllers/feed.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";

const router = Router();

// Feed routes - all require authentication
router.route("/home").get(verifyJwt, getHomeFeed);
router.route("/reels").get(verifyJwt, getReelsFeed);
router.route("/stories").get(verifyJwt, getStoriesFeed);
router.route("/posts/:userId").get(verifyJwt, getUserPosts);

export default router;
