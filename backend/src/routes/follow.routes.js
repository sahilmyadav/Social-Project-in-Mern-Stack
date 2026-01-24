import express from "express";
import {
  sendFollowRequest,
  acceptFollowRequest,
  rejectFollowRequest,
  removeFollow,
  unfollowUser,
  removeFollowRequest,
  cancelFollowRequestByUserId,
  getPendingRequests,
  getFollowStatus,
  followBack,
  getFollowSuggestions,
  totalFollowers,
  totalFollowing,
  getFollowers,
  getFollowing,
} from "../controllers/follow.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJwt);

// Send follow request (auto-approve if public account)
router.post("/request/:targetUserId", sendFollowRequest);

// Accept pending follow request
router.post("/accept/:requestId", acceptFollowRequest);

// Reject pending follow request
router.post("/reject/:requestId", rejectFollowRequest);

// Get pending follow requests
router.get("/pending-requests", getPendingRequests);

// remove follow request if pending request exists (by requestId)
router.delete("/remove-request/:requestId", removeFollowRequest);

// Cancel follow request (by userId - for frontend)
router.delete("/cancel/:userId", cancelFollowRequestByUserId);

// Unfollow or remove follower
router.delete("/remove/:targetUserId", removeFollow);

// Dedicated unfollow endpoint (simpler alternative)
router.delete("/unfollow/:targetUserId", unfollowUser);

// Get follow relationship status
router.get("/status/:targetUserId", getFollowStatus);

// Follow back a user
router.post("/follow-back/:targetUserId", followBack);

// Get follow suggestions
router.get("/suggestions", getFollowSuggestions);

// Get total followers || following
router.route("/total-followers").get(totalFollowers);
router.route("/total-following").get(totalFollowing);

// Get followers and following lists
router.get("/followers/:userId", getFollowers);
router.get("/following/:userId", getFollowing);

export { router as followRoutes };
