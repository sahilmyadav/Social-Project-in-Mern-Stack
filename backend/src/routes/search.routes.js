import { Router } from "express";
import {
  globalSearch,
  searchUsers,
  searchPages,
  searchHashtags,
  getTrending,
  getSearchHistory,
  clearSearchHistory,
} from "../controllers/search.controller.js";
import { verifyJwt, verifyJwtOptional } from "../middleware/auth.middleware.js";

const router = Router();

// Public search routes (optional auth for personalization)
router.route("/global").get(verifyJwtOptional, globalSearch);
router.route("/users").get(verifyJwtOptional, searchUsers);
router.route("/pages").get(verifyJwtOptional, searchPages);
router.route("/hashtags").get(verifyJwtOptional, searchHashtags);
router.route("/trending").get(verifyJwtOptional, getTrending);

// Protected routes (require authentication)
router.route("/history").get(verifyJwt, getSearchHistory);
router.route("/history").delete(verifyJwt, clearSearchHistory);

export default router;
