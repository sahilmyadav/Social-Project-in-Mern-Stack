import express from 'express';
import {
  blockUser,
  changePassword,
  checkUsernameAvailability,
  completeProfile,
  deleteCoverPhoto,
  deleteProfileImage,
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
  unblockUser,
  updateCoverPhoto,
  updatePrivacySettings,
  updateProfile,
  updateProfileImage,
  verifyEmailChange,
  verifyLoginOtp,
  verifyPhoneChange,
  verifyRegisterOtp,
} from '../controllers/user.controller.js';
import { verifyJwt } from '../middleware/auth.middleware.js';
import upload, { uploadCoverPhoto, uploadSingle } from '../middleware/upload.middleware.js';
import { validateBody, validateObjectId } from '../middleware/validate.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  privacySettingsSchema,
  registerSchema,
  requestEmailChangeSchema,
  requestPhoneChangeSchema,
  resendOtpSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailChangeSchema,
  verifyOtpSchema,
  verifyPhoneChangeSchema,
} from '../schemas/auth.schema.js';

const router = express.Router();

// unprotected routes
router.route('/register').post(validateBody(registerSchema), registerUser);
router.route('/verify-register').post(validateBody(verifyOtpSchema), verifyRegisterOtp);
router.route('/resend-otp').post(validateBody(resendOtpSchema), resendRegistrationOtp);
router.route('/login').post(validateBody(loginSchema), loginUser);
router.route('/verify-login').post(validateBody(verifyOtpSchema), verifyLoginOtp);
router.route('/refresh-token').post(refreshAccessToken);
router.route('/forgot-password').post(validateBody(forgotPasswordSchema), forgotPassword);
router.route('/reset-password').post(validateBody(resetPasswordSchema), resetPassword);

router.route('/check-username').get(checkUsernameAvailability);

router.route('/profile/:userId').get(verifyJwt, getUserProfile);

router.route('/logout').post(verifyJwt, logOutUser);
router.route('/current-user').get(verifyJwt, getCurrentUser);
router
  .route('/change-password')
  .post(verifyJwt, validateBody(changePasswordSchema), changePassword);
router.route('/delete/:id').delete(verifyJwt, validateObjectId('id'), deleteUser);
router.route('/update-profile-picture').put(verifyJwt, uploadSingle, updateProfileImage);
router.route('/update-cover-photo').put(verifyJwt, uploadCoverPhoto, updateCoverPhoto);
router.route('/delete-profile-picture').delete(verifyJwt, deleteProfileImage);
router.route('/delete-cover-photo').delete(verifyJwt, deleteCoverPhoto);
router.route('/update-profile').put(verifyJwt, validateBody(updateProfileSchema), updateProfile);
router
  .route('/privacy-settings')
  .put(verifyJwt, validateBody(privacySettingsSchema), updatePrivacySettings);

router.route('/complete-profile').post(
  verifyJwt,
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'coverPhoto', maxCount: 1 },
  ]),
  completeProfile
);

// Block/Unblock routes
router.route('/block/:userId').post(verifyJwt, validateObjectId('userId'), blockUser);
router.route('/unblock/:userId').post(verifyJwt, validateObjectId('userId'), unblockUser);
router.route('/blocked-list').get(verifyJwt, getBlockedUsers);

router
  .route('/request-email-change')
  .post(verifyJwt, validateBody(requestEmailChangeSchema), requestEmailChange);
router
  .route('/verify-email-change')
  .post(verifyJwt, validateBody(verifyEmailChangeSchema), verifyEmailChange);
router
  .route('/request-phone-change')
  .post(verifyJwt, validateBody(requestPhoneChangeSchema), requestPhoneChange);
router
  .route('/verify-phone-change')
  .post(verifyJwt, validateBody(verifyPhoneChangeSchema), verifyPhoneChange);

export { router as userRoutes };
