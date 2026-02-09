/**
 * Barrel re-export — keeps existing import paths working.
 * Actual logic lives in auth.controller.js, profile.controller.js, and services/auth.service.js.
 */
export {
  changePassword,
  forgotPassword,
  loginUser,
  logOutUser,
  refreshAccessToken,
  registerUser,
  resendRegistrationOtp,
  resetPassword,
  verifyLoginOtp,
  verifyRegisterOtp,
} from './auth.controller.js';

export { generateAccessAndRefreshTokens, generateOTP } from '../services/auth.service.js';

export {
  blockUser,
  checkUsernameAvailability,
  completeProfile,
  deleteCoverPhoto,
  deleteProfileImage,
  deleteUser,
  getBlockedUsers,
  getCurrentUser,
  getUserProfile,
  requestEmailChange,
  requestPhoneChange,
  unblockUser,
  updateCoverPhoto,
  updatePrivacySettings,
  updateProfile,
  updateProfileImage,
  verifyEmailChange,
  verifyPhoneChange,
} from './profile.controller.js';
