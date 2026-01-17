import express from "express";
import {
  registerUser,
  verifyRegisterOtp,
  loginUser,
  verifyLoginOtp,
  logOutUser,
  getCurrentUser,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteUser,
  updateProfile,
  updatePrivacySettings,
  unlockAccount,
  resetPasswordForTesting,
  getUserProfile,
  updateProfileImage,
  blockUser,
  unblockUser,
  getBlockedUsers
} from "../controllers/user.controller.js";
import { verifyJwt, verifyJwt as verifyRoute } from "../middleware/auth.middleware.js"; // use this to protect routes
import { uploadSingle } from "../middleware/upload.middleware.js";

const router = express.Router();

// unprotected routes
router.route("/register").post(registerUser);
router.route("/verify-register").post(verifyRegisterOtp);
router.route("/login").post(loginUser);
router.route("/verify-login").post(verifyLoginOtp);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/forgot-password").post(forgotPassword);
router.route("/reset-password").post(resetPassword);
router.route("/unlock-account").post(unlockAccount); // For development/testing
router.route("/reset-password-testing").post(resetPasswordForTesting); // For development/testing

// Public profile routes
router.route("/profile/:userId").get(verifyJwt, getUserProfile);

// protected routes
router.route("/logout").post(verifyRoute, logOutUser);
router.route("/current-user").get(verifyRoute, getCurrentUser);
router.route("/change-password").post(verifyRoute, changePassword);
router.route("/delete/:id").delete(verifyRoute, deleteUser);
router.route("/update-profile-picture").put(verifyJwt, uploadSingle, updateProfileImage);
// router.route("/update-cover-photo").put(verifyRoute, updateCoverPhoto);
router.route("/update-profile").put(verifyRoute, updateProfile);
router.route("/privacy-settings").put(verifyRoute, updatePrivacySettings);

// Block/Unblock routes
router.route("/block/:userId").post(verifyRoute, blockUser);
router.route("/unblock/:userId").post(verifyRoute, unblockUser);
router.route("/blocked-list").get(verifyRoute, getBlockedUsers);

export { router as userRoutes };
