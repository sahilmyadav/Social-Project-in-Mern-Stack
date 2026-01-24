import express from "express";
import {
    likeComment,
    replyToComment,
    getCommentReplies,
    editComment,
    deleteComment,
    unlikeComment,
    getCommentDetails,
} from "../controllers/comment.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyJwt);

// Like/Unlike comment (toggle)
router.route("/like/:commentId").post(likeComment);

// Unlike comment (explicit)
router.route("/unlike/:commentId").delete(unlikeComment);

// Reply to comment
router.route("/reply/:commentId").post(replyToComment);

// Get comment replies with pagination
router.route("/replies/:commentId").get(getCommentReplies);

// Edit comment
router.route("/edit/:commentId").put(editComment);

// Delete comment
router.route("/delete/:commentId").delete(deleteComment);

// Get comment details
router.route("/:commentId").get(getCommentDetails);

export { router as commentRoutes };
