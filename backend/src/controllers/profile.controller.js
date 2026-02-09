/**
 * Profile controller — user profile, images, privacy, blocking, email/phone change.
 */
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Followers } from '../models/followers.model.js';
import { Post } from '../models/post.model.js';
import { Reel } from '../models/reel.model.js';
import { Save } from '../models/save.model.js';
import { User } from '../models/user.model.js';
import { generateOTP } from '../services/auth.service.js';
import emailService from '../services/email.service.js';
import smsService from '../services/sms.service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { saveFileLocally } from '../utils/localStorage.js';
import logger from '../utils/logger.js';
import redis from '../utils/redis.config.js';

/** Fields to exclude from user responses. */
const SAFE_SELECT = '-password -refreshToken -otp';

// ─── Get Current User ────────────────────────────────────────────
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(SAFE_SELECT);
  if (!user) throw new ApiError(404, 'User not found');

  const [followersCount, followingCount, totalPosts, totalReels, totalSavedPosts] =
    await Promise.all([
      Followers.countDocuments({ following_id: user._id, status: 'accepted' }),
      Followers.countDocuments({ follower_id: user._id, status: 'accepted' }),
      Post.countDocuments({ user_id: user._id, is_deleted: false }),
      Reel.countDocuments({ user_id: user._id, is_deleted: false }),
      Save.countDocuments({ user_id: user._id }),
    ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...user.toObject(),
        followersCount,
        followingCount,
        totalPosts,
        totalReels,
        totalSavedPosts,
      },
      'User fetched successfully'
    )
  );
});

// ─── Get User Profile ────────────────────────────────────────────
export const getUserProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) throw new ApiError(400, 'User ID is required');

  const isValidObjectId = mongoose.Types.ObjectId.isValid(userId);

  let user;
  if (isValidObjectId) {
    user = await User.findById(userId).select(
      'firstName lastName username bio avatar profileImage coverPhoto isVerified profile_type isPrivate allowDownloads status blockedUsers'
    );
  }
  if (!user) {
    user = await User.findOne({ username: userId }).select(
      'firstName lastName username bio avatar profileImage coverPhoto isVerified profile_type isPrivate allowDownloads status blockedUsers'
    );
  }
  if (!user) throw new ApiError(404, 'User not found');

  const profileUserId = user._id;
  if (user.status !== 'active') throw new ApiError(403, 'This account is not available');

  const currentUserId = req.user?._id;

  if (currentUserId && currentUserId.toString() !== profileUserId.toString()) {
    const currentUser = await User.findById(currentUserId).select('blockedUsers').lean();
    const hasBlockedThem = currentUser?.blockedUsers?.some(
      (id) => id.toString() === profileUserId.toString()
    );
    const theyBlockedYou = user.blockedUsers?.some(
      (id) => id.toString() === currentUserId.toString()
    );
    if (hasBlockedThem || theyBlockedYou) throw new ApiError(404, 'User not found');
  }

  const [
    followersCount,
    followingCount,
    postsCount,
    reelsCount,
    followRecord,
    reverseFollowRecord,
  ] = await Promise.all([
    Followers.countDocuments({ following_id: profileUserId, status: 'accepted' }),
    Followers.countDocuments({ follower_id: profileUserId, status: 'accepted' }),
    Post.countDocuments({ user_id: profileUserId, is_deleted: false }),
    Reel.countDocuments({ user_id: profileUserId, is_deleted: false }),
    currentUserId && currentUserId.toString() !== profileUserId.toString()
      ? Followers.findOne({ follower_id: currentUserId, following_id: profileUserId })
          .select('status')
          .lean()
      : null,
    currentUserId && currentUserId.toString() !== profileUserId.toString()
      ? Followers.findOne({
          follower_id: profileUserId,
          following_id: currentUserId,
          status: 'accepted',
        })
          .select('status')
          .lean()
      : null,
  ]);

  let isFollowing = false,
    isPending = false,
    followsYou = false;
  if (followRecord) {
    isFollowing = followRecord.status === 'accepted';
    isPending = followRecord.status === 'requested';
  }
  if (reverseFollowRecord) followsYou = true;

  const profileData = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    username: user.username,
    bio: user.bio || '',
    profilePicture: user.profileImage || user.avatar,
    avatar: user.avatar,
    coverPhoto: user.coverPhoto,
    followersCount,
    followingCount,
    postsCount,
    reelsCount,
    isVerified: user.isVerified,
    profile_type: user.profile_type,
    isPrivate: user.isPrivate,
    allowDownloads: user.allowDownloads,
    isFollowing,
    isPending,
    followsYou,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, profileData, 'User profile retrieved successfully'));
});

// ─── Update Profile ──────────────────────────────────────────────
export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let {
    firstName,
    lastName,
    username,
    bio,
    profile_type,
    coverPhoto,
    isPrivate,
    dateOfBirth,
    allowDownloads,
  } = req.body;

  if (profile_type === 'private' || profile_type === 'public') {
    isPrivate = profile_type === 'private';
    profile_type = undefined;
  }

  if (isPrivate !== undefined && typeof isPrivate !== 'boolean')
    throw new ApiError(400, 'isPrivate must be a boolean value');
  if (profile_type && !['personal', 'business'].includes(profile_type))
    throw new ApiError(400, 'profile_type must be either "personal" or "business"');

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  if (username) {
    const normalizedUsername = username.toLowerCase().trim();
    if (normalizedUsername !== user.username) {
      const existingUser = await User.findOne({
        username: normalizedUsername,
        _id: { $ne: userId },
      });
      if (existingUser) throw new ApiError(400, 'This username is already taken');
      user.username = normalizedUsername;
    }
  }

  if (firstName) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (bio !== undefined) user.bio = bio;
  if (profile_type) user.profile_type = profile_type;
  if (coverPhoto) user.coverPhoto = coverPhoto;
  if (dateOfBirth) user.dob = dateOfBirth;
  if (allowDownloads !== undefined) user.allowDownloads = allowDownloads;

  if (isPrivate !== undefined) {
    const oldPrivacy = user.isPrivate;
    user.isPrivate = isPrivate;
    if (oldPrivacy === true && isPrivate === false) {
      await Followers.updateMany(
        { following_id: userId, status: 'requested' },
        { $set: { status: 'accepted' } }
      );
    }
  }

  await user.save();
  const updatedUser = await User.findById(userId).select(SAFE_SELECT);
  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, 'Profile updated successfully'));
});

// ─── Profile Image ───────────────────────────────────────────────
export const updateProfileImage = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiError(400, 'Please provide user ID first');

  const file = req.file || req.files?.file || req.files?.[0];
  if (!file) throw new ApiError(400, 'At least one media file (image/video) is required');

  const result = await saveFileLocally(file, userId.toString(), 'avatar');
  if (!result) throw new ApiError(500, 'Failed to upload profile image');

  const user = await User.findByIdAndUpdate(
    userId,
    { profileImage: result.url, avatar: result.url },
    { new: true }
  ).select(SAFE_SELECT);
  return res.status(200).json(new ApiResponse(200, user, 'Profile image updated successfully'));
});

// ─── Cover Photo ─────────────────────────────────────────────────
export const updateCoverPhoto = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiError(400, 'Please provide user ID first');

  const file = req.file || req.files?.coverPhoto?.[0] || req.files?.[0];
  if (!file) throw new ApiError(400, 'Cover photo is required');

  const result = await saveFileLocally(file, userId.toString(), 'cover');
  if (!result) throw new ApiError(500, 'Failed to upload cover photo');

  const user = await User.findByIdAndUpdate(
    userId,
    { coverPhoto: result.url },
    { new: true }
  ).select(SAFE_SELECT);
  return res.status(200).json(new ApiResponse(200, user, 'Cover photo updated successfully'));
});

export const deleteProfileImage = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiError(400, 'Please provide user ID first');

  const user = await User.findByIdAndUpdate(
    userId,
    { profileImage: null, avatar: null },
    { new: true }
  ).select(SAFE_SELECT);
  return res.status(200).json(new ApiResponse(200, user, 'Profile image deleted successfully'));
});

export const deleteCoverPhoto = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiError(400, 'Please provide user ID first');

  const user = await User.findByIdAndUpdate(userId, { coverPhoto: null }, { new: true }).select(
    SAFE_SELECT
  );
  return res.status(200).json(new ApiResponse(200, user, 'Cover photo deleted successfully'));
});

// ─── Block / Unblock ─────────────────────────────────────────────
export const blockUser = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { userId } = req.params;

  if (!userId) throw new ApiError(400, 'User ID is required');
  if (currentUserId.toString() === userId.toString())
    throw new ApiError(400, 'You cannot block yourself');

  const userToBlock = await User.findById(userId);
  if (!userToBlock) throw new ApiError(404, 'User not found');

  const currentUser = await User.findById(currentUserId);
  if (currentUser.blockedUsers.includes(userId)) throw new ApiError(400, 'User is already blocked');

  currentUser.blockedUsers.push(userId);
  await currentUser.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        blockedUserId: userId,
        blockedUser: {
          _id: userToBlock._id,
          firstName: userToBlock.firstName,
          lastName: userToBlock.lastName,
          username: userToBlock.username,
          profileImage: userToBlock.profileImage || userToBlock.avatar,
        },
      },
      'User blocked successfully'
    )
  );
});

export const unblockUser = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { userId } = req.params;

  if (!userId) throw new ApiError(400, 'User ID is required');

  const userToUnblock = await User.findById(userId);
  if (!userToUnblock) throw new ApiError(404, 'User not found');

  const currentUser = await User.findById(currentUserId);
  if (!currentUser.blockedUsers.includes(userId)) throw new ApiError(400, 'User is not blocked');

  currentUser.blockedUsers = currentUser.blockedUsers.filter(
    (id) => id.toString() !== userId.toString()
  );
  await currentUser.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { unblockedUserId: userId }, 'User unblocked successfully'));
});

export const getBlockedUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const currentUser = await User.findById(currentUserId).select('blockedUsers').populate({
    path: 'blockedUsers',
    select: 'firstName lastName username profileImage avatar bio isVerified',
    options: { skip, limit },
  });
  if (!currentUser) throw new ApiError(404, 'User not found');

  const totalBlocked = currentUser.blockedUsers.length;
  const totalPages = Math.ceil(totalBlocked / limit);

  const blockedUsers = currentUser.blockedUsers.map((u) => ({
    _id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`,
    username: u.username,
    profileImage: u.profileImage || u.avatar,
    bio: u.bio,
    isVerified: u.isVerified,
  }));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        blockedUsers,
        pagination: {
          currentPage: page,
          totalPages,
          totalBlocked,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Blocked users retrieved successfully'
    )
  );
});

// ─── Privacy Settings ────────────────────────────────────────────
export const updatePrivacySettings = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { profile_type, isPrivate, allowDownloads } = req.body;

  if (profile_type && !['personal', 'business'].includes(profile_type))
    throw new ApiError(400, 'profile_type must be either "personal" or "business"');
  if (isPrivate !== undefined && typeof isPrivate !== 'boolean')
    throw new ApiError(400, 'isPrivate must be a boolean value');
  if (allowDownloads !== undefined && typeof allowDownloads !== 'boolean')
    throw new ApiError(400, 'allowDownloads must be a boolean value');

  const updateData = {};
  if (profile_type !== undefined) updateData.profile_type = profile_type;
  if (isPrivate !== undefined) updateData.isPrivate = isPrivate;
  if (allowDownloads !== undefined) updateData.allowDownloads = allowDownloads;

  if (Object.keys(updateData).length === 0)
    throw new ApiError(400, 'No privacy settings provided to update');

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const oldIsPrivate = user.isPrivate;
  Object.assign(user, updateData);
  await user.save();

  if (oldIsPrivate === true && isPrivate === false) {
    await Followers.updateMany(
      { following_id: userId, status: 'requested' },
      { $set: { status: 'accepted' } }
    );
  }

  const updatedUser = await User.findById(userId).select(SAFE_SELECT);
  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, 'Privacy settings updated successfully'));
});

// ─── Username ────────────────────────────────────────────────────
export const checkUsernameAvailability = asyncHandler(async (req, res) => {
  const { username } = req.query;
  if (!username) throw new ApiError(400, 'Username is required');

  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json(
      new ApiResponse(
        400,
        {
          available: false,
          message:
            'Username must be 3-30 characters and contain only letters, numbers, and underscores',
        },
        'Invalid username format'
      )
    );
  }

  const reservedUsernames = [
    'admin',
    'administrator',
    'root',
    'system',
    'support',
    'help',
    'api',
    'www',
    'mail',
    'ftp',
    'blog',
    'dev',
    'stage',
    'test',
    'official',
    'verified',
    'staff',
    'team',
    'info',
    'contact',
    'about',
    'terms',
    'privacy',
    'settings',
    'profile',
    'user',
    'login',
    'signup',
    'register',
    'logout',
    'auth',
    'account',
  ];

  if (reservedUsernames.includes(username.toLowerCase())) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { available: false, message: 'This username is reserved and cannot be used' },
          'Username is reserved'
        )
      );
  }

  const existingUser = await User.findOne({ username: username.toLowerCase() });
  const isAvailable = !existingUser;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        available: isAvailable,
        message: isAvailable ? 'Username is available' : 'Username is already taken',
        suggestions: !isAvailable
          ? [
              `${username}_${Math.floor(Math.random() * 999)}`,
              `${username}${new Date().getFullYear()}`,
              `${username}_official`,
            ]
          : undefined,
      },
      isAvailable ? 'Username available' : 'Username taken'
    )
  );
});

// ─── Complete Profile ────────────────────────────────────────────
export const completeProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { username, bio, interests } = req.body;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.profileCompleted)
    throw new ApiError(
      400,
      'Profile already completed. Use update-profile endpoint to make changes.'
    );
  if (!username) throw new ApiError(400, 'Username is required');

  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(username))
    throw new ApiError(
      400,
      'Username must be 3-30 characters and contain only letters, numbers, and underscores'
    );

  const existingUsername = await User.findOne({
    username: username.toLowerCase(),
    _id: { $ne: userId },
  });
  if (existingUsername) throw new ApiError(400, 'Username is already taken');

  user.username = username.toLowerCase();
  if (bio !== undefined) user.bio = bio;

  if (interests !== undefined) {
    let parsedInterests = interests;
    if (typeof interests === 'string') {
      try {
        parsedInterests = JSON.parse(interests);
      } catch {
        parsedInterests = [];
      }
    }
    if (Array.isArray(parsedInterests)) {
      user.interests = parsedInterests.filter((i) => typeof i === 'string' && i.trim().length > 0);
    }
  }

  if (req.files?.profilePicture?.[0]) {
    const profilePictureUpload = await saveFileLocally(req.files.profilePicture[0].path);
    if (profilePictureUpload) {
      user.profileImage = profilePictureUpload.secure_url;
      user.avatar = profilePictureUpload.secure_url;
    }
  }

  if (req.files?.coverPhoto?.[0]) {
    const coverPhotoUpload = await saveFileLocally(req.files.coverPhoto[0].path);
    if (coverPhotoUpload) user.coverPhoto = coverPhotoUpload.secure_url;
  }

  user.profileCompleted = true;
  await user.save();
  const updatedUser = await User.findById(userId).select(SAFE_SELECT);
  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, 'Profile completed successfully'));
});

// ─── Delete User ─────────────────────────────────────────────────
export const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  if (req.user._id.toString() !== userId)
    throw new ApiError(403, 'You can only delete your own account');

  const user = await User.findByIdAndDelete(userId);
  if (!user) throw new ApiError(404, 'User not found');

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  return res.status(200).json(new ApiResponse(200, {}, 'Account deleted successfully'));
});

// ─── Email Change ────────────────────────────────────────────────
export const requestEmailChange = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { newEmail } = req.body;

  if (!newEmail) throw new ApiError(400, 'New email is required');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) throw new ApiError(400, 'Please enter a valid email address');

  const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
  if (existingUser) throw new ApiError(400, 'This email is already registered');

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const otp = generateOTP();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  await redis.set(
    `email_change:${userId}`,
    JSON.stringify({ newEmail: newEmail.toLowerCase(), hashedOtp, expiry: otpExpiry }),
    'EX',
    600
  );

  if (user.email) {
    try {
      await emailService.sendOTPEmail(user.email, otp, 'email_change');
    } catch (e) {
      logger.error('Error sending email OTP for email change', { error: e?.message });
    }
  }
  if (user.phone) {
    try {
      await smsService.sendOTP(user.phone, otp, 'email_change');
    } catch (e) {
      logger.error('Error sending SMS OTP for email change', { error: e?.message });
    }
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Verification code sent to your email and phone'));
});

export const verifyEmailChange = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { newEmail, otp } = req.body;

  if (!newEmail || !otp) throw new ApiError(400, 'New email and OTP are required');

  const storedData = await redis.get(`email_change:${userId}`);
  if (!storedData) throw new ApiError(400, 'Verification code expired. Please request a new one.');

  const { newEmail: storedEmail, hashedOtp: storedHashedOtp, expiry } = JSON.parse(storedData);

  const incomingHash = crypto.createHash('sha256').update(otp).digest('hex');
  if (incomingHash !== storedHashedOtp) throw new ApiError(400, 'Invalid verification code');
  if (newEmail.toLowerCase() !== storedEmail)
    throw new ApiError(400, 'Email mismatch. Please try again.');
  if (new Date() > new Date(expiry)) {
    await redis.del(`email_change:${userId}`);
    throw new ApiError(400, 'Verification code expired. Please request a new one.');
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  user.email = newEmail.toLowerCase();
  await user.save();
  await redis.del(`email_change:${userId}`);

  const updatedUser = await User.findById(userId).select(SAFE_SELECT);
  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, 'Email updated successfully'));
});

// ─── Phone Change ────────────────────────────────────────────────
export const requestPhoneChange = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { newPhone } = req.body;

  if (!newPhone) throw new ApiError(400, 'New phone number is required');
  const cleanPhone = newPhone.replace(/\s+/g, '').replace(/-/g, '');

  const existingUser = await User.findOne({ phone: cleanPhone });
  if (existingUser) throw new ApiError(400, 'This phone number is already registered');

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const otp = generateOTP();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  await redis.set(
    `phone_change:${userId}`,
    JSON.stringify({ newPhone: cleanPhone, hashedOtp, expiry: otpExpiry }),
    'EX',
    600
  );

  if (user.email) {
    try {
      await emailService.sendOTPEmail(user.email, otp, 'phone_change');
    } catch (e) {
      logger.error('Error sending email OTP for phone change', { error: e?.message });
    }
  }
  if (user.phone) {
    try {
      await smsService.sendOTP(user.phone, otp, 'phone_change');
    } catch (e) {
      logger.error('Error sending SMS OTP for phone change', { error: e?.message });
    }
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Verification code sent to your email and phone'));
});

export const verifyPhoneChange = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { newPhone, otp } = req.body;

  if (!newPhone || !otp) throw new ApiError(400, 'New phone number and OTP are required');
  const cleanPhone = newPhone.replace(/\s+/g, '').replace(/-/g, '');

  const storedData = await redis.get(`phone_change:${userId}`);
  if (!storedData) throw new ApiError(400, 'Verification code expired. Please request a new one.');

  const { newPhone: storedPhone, hashedOtp: storedHashedOtp, expiry } = JSON.parse(storedData);

  const incomingHash = crypto.createHash('sha256').update(otp).digest('hex');
  if (incomingHash !== storedHashedOtp) throw new ApiError(400, 'Invalid verification code');
  if (cleanPhone !== storedPhone)
    throw new ApiError(400, 'Phone number mismatch. Please try again.');
  if (new Date() > new Date(expiry)) {
    await redis.del(`phone_change:${userId}`);
    throw new ApiError(400, 'Verification code expired. Please request a new one.');
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  user.phone = cleanPhone;
  await user.save();
  await redis.del(`phone_change:${userId}`);

  const updatedUser = await User.findById(userId).select(SAFE_SELECT);
  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, 'Phone number updated successfully'));
});
