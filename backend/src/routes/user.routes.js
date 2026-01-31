import express from 'express';
import {
  blockUser,
  changePassword,
  checkUsernameAvailability,
  completeProfile,
  deleteUser,
  forgotPassword,
  getBlockedUsers,
  getCurrentUser,
  getUserProfile,
  loginUser,
  logOutUser,
  refreshAccessToken,
  registerUser,
  requestEmailChange,
  requestPhoneChange,
  resendRegistrationOtp,
  resetPassword,
  resetPasswordForTesting,
  unblockUser,
  unlockAccount,
  updateCoverPhoto,
  updatePrivacySettings,
  updateProfile,
  updateProfileImage,
  verifyEmailChange,
  verifyLoginOtp,
  verifyPhoneChange,
  verifyRegisterOtp,
} from '../controllers/user.controller.js';
import { verifyJwt, verifyJwt as verifyRoute } from '../middleware/auth.middleware.js'; // use this to protect routes
import upload, { uploadCoverPhoto, uploadSingle } from '../middleware/upload.middleware.js';

const router = express.Router();

// unprotected routes
router.route('/register').post(registerUser);
router.route('/verify-register').post(verifyRegisterOtp);
router.route('/resend-otp').post(resendRegistrationOtp);
router.route('/login').post(loginUser);
router.route('/verify-login').post(verifyLoginOtp);
router.route('/refresh-token').post(refreshAccessToken);
router.route('/forgot-password').post(forgotPassword);
router.route('/reset-password').post(resetPassword);
router.route('/unlock-account').post(unlockAccount); // For development/testing
router.route('/reset-password-testing').post(resetPasswordForTesting); // For development/testing

// Username availability check (public)
router.route('/check-username').get(checkUsernameAvailability);

// Public profile routes
router.route('/profile/:userId').get(verifyJwt, getUserProfile);

// protected routes
router.route('/logout').post(verifyRoute, logOutUser);
router.route('/current-user').get(verifyRoute, getCurrentUser);
router.route('/change-password').post(verifyRoute, changePassword);
router.route('/delete/:id').delete(verifyRoute, deleteUser);
router.route('/update-profile-picture').put(verifyJwt, uploadSingle, updateProfileImage);
router.route('/update-cover-photo').put(verifyJwt, uploadCoverPhoto, updateCoverPhoto);
router.route('/update-profile').put(verifyRoute, updateProfile);
router.route('/privacy-settings').put(verifyRoute, updatePrivacySettings);

// Profile setup (after registration)
router.route('/complete-profile').post(
  verifyRoute,
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'coverPhoto', maxCount: 1 },
  ]),
  completeProfile
);

// Block/Unblock routes
router.route('/block/:userId').post(verifyRoute, blockUser);
router.route('/unblock/:userId').post(verifyRoute, unblockUser);
router.route('/blocked-list').get(verifyRoute, getBlockedUsers);

// Email and Phone Change with OTP verification
router.route('/request-email-change').post(verifyRoute, requestEmailChange);
router.route('/verify-email-change').post(verifyRoute, verifyEmailChange);
router.route('/request-phone-change').post(verifyRoute, requestPhoneChange);
router.route('/verify-phone-change').post(verifyRoute, verifyPhoneChange);

export { router as userRoutes };
