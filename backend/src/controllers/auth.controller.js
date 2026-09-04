/**
 * Auth controller — registration, login, OTP, tokens, passwords.
 */
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { COOKIE_OPTIONS } from '../config/constants.js';
import { User } from '../models/user.model.js';
import { generateAccessAndRefreshTokens, generateOTP } from '../services/auth.service.js';
import emailService from '../services/email.service.js';
import smsService from '../services/sms.service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';
import redis from '../utils/redis.config.js';

// ─── Register ────────────────────────────────────────────────────
export const registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, password, gender, dob } = req.body;

  if (!firstName?.trim() || !lastName?.trim() || !password?.trim()) {
    throw new ApiError(400, 'First name, last name, and password are required');
  }

  if (!password || password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  if (!email && !phone) {
    throw new ApiError(400, 'Either email or phone number is required');
  }

  if (gender && !['male', 'female', 'other', 'prefer_not_to_say'].includes(gender)) {
    throw new ApiError(400, 'Invalid gender value');
  }

  if (dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 16) {
      throw new ApiError(400, 'You must be at least 16 years old to create an account');
    }
  }

  const query = [];
  if (email) query.push({ email });
  if (phone) query.push({ phone });

  const existedUser = await User.findOne({ $or: query });
  if (existedUser) {
    throw new ApiError(409, 'User with this email or phone already exists');
  }

  const identifier = email || phone;
  const rateLimitKey = `ratelimit:registration:${identifier}`;
  const attemptCount = await redis.incr(rateLimitKey);
  if (attemptCount === 1) await redis.expire(rateLimitKey, 2 * 60);
  if (attemptCount > 3) {
    throw new ApiError(429, 'Too many registration attempts. Please try again later.');
  }

  const otp = generateOTP();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  const hashedPassword = await bcrypt.hash(password, 10);

  const registrationData = {
    firstName,
    lastName,
    email: email || null,
    phone: phone || null,
    hashedPassword,
    hashedOtp,
    otpCreatedAt: Date.now(),
    gender: gender || null,
    dob: dob || null,
  };

  const redisKey = `registration:${identifier}`;
  await redis.setex(redisKey, 10 * 60, JSON.stringify(registrationData));

  try {
    if (email) {
      await emailService.sendOTPEmail(email, otp, 'registration');
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { otpSent: true, identifier: email, method: 'email', expiresIn: 600 },
            'OTP sent to your email. Please verify within 10 minutes.'
          )
        );
    } else if (phone) {
      await smsService.sendOTP(phone, otp, 'registration');
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { otpSent: true, identifier: phone, method: 'sms', expiresIn: 600 },
            'OTP sent to your phone. Please verify within 10 minutes.'
          )
        );
    }
  } catch (error) {
    await redis.del(redisKey);
    throw new ApiError(500, error?.message || 'Failed to send OTP. Please try again.');
  }
});

// ─── Verify Register OTP ────────────────────────────────────────
export const verifyRegisterOtp = asyncHandler(async (req, res) => {
  const { identifier, otp } = req.body;

  if (!identifier?.trim()) throw new ApiError(400, 'identifier is required');
  if (!otp?.trim()) throw new ApiError(400, 'OTP is required');

  const redisKey = `registration:${identifier}`;
  const registrationDataJson = await redis.get(redisKey);
  if (!registrationDataJson) {
    throw new ApiError(
      400,
      'OTP has expired or registration session not found. Please register again.'
    );
  }

  const registrationData = JSON.parse(registrationDataJson);

  const otpAge = Date.now() - registrationData.otpCreatedAt;
  if (otpAge > 3 * 60 * 1000) {
    await redis.del(redisKey);
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  if (hashedOtp !== registrationData.hashedOtp) {
    throw new ApiError(400, 'Invalid OTP');
  }

  const q = [];
  if (registrationData.email) q.push({ email: registrationData.email });
  if (registrationData.phone) q.push({ phone: registrationData.phone });
  const existingUser = await User.findOne({ $or: q });
  if (existingUser) {
    await redis.del(redisKey);
    throw new ApiError(409, 'User already exists');
  }

  const user = await User.create({
    firstName: registrationData.firstName,
    lastName: registrationData.lastName,
    email: registrationData.email || undefined,
    phone: registrationData.phone || undefined,
    password: registrationData.hashedPassword,
    gender: registrationData.gender || undefined,
    dob: registrationData.dob ? new Date(registrationData.dob) : undefined,
    status: 'active',
    profileCompleted: false,
    username: `user_${Date.now()}`,
  });

  await redis.del(redisKey);
  await redis.del(`ratelimit:registration:${identifier}`);

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
  const createdUser = await User.findById(user._id).select('-password -refreshToken');

  return res
    .status(201)
    .cookie('accessToken', accessToken, COOKIE_OPTIONS)
    .cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
    .json(
      new ApiResponse(
        201,
        { user: createdUser, accessToken, refreshToken, profileCompleted: false },
        'Account created successfully. Please complete your profile.'
      )
    );
});

// ─── Resend Registration OTP ─────────────────────────────────────
export const resendRegistrationOtp = asyncHandler(async (req, res) => {
  const { email, phone } = req.body;
  const identifier = email || phone;

  if (!identifier?.trim()) throw new ApiError(400, 'Email or phone is required');

  const resendRateLimitKey = `ratelimit:resend:${identifier}`;
  const resendCount = await redis.incr(resendRateLimitKey);
  if (resendCount === 1) await redis.expire(resendRateLimitKey, 15 * 60);
  if (resendCount > 5) throw new ApiError(429, 'Too many resend attempts. Please try again later.');

  const redisKey = `registration:${identifier}`;
  const registrationDataJson = await redis.get(redisKey);
  if (!registrationDataJson) {
    throw new ApiError(
      404,
      'Registration session not found or expired. Please start registration again.'
    );
  }

  const registrationData = JSON.parse(registrationDataJson);
  const otp = generateOTP();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  registrationData.hashedOtp = hashedOtp;
  registrationData.otpCreatedAt = Date.now();
  await redis.setex(redisKey, 10 * 60, JSON.stringify(registrationData));

  try {
    if (email || registrationData.email) {
      const addr = email || registrationData.email;
      await emailService.sendOTPEmail(addr, otp, 'registration');
      logger.info('OTP resent to email', { email: addr });
      return res
        .status(200)
        .json(
          new ApiResponse(200, { otpSent: true, method: 'email' }, 'New OTP sent to your email')
        );
    } else if (phone || registrationData.phone) {
      const num = phone || registrationData.phone;
      await smsService.sendOTP(num, otp, 'registration');
      logger.info('OTP resent to phone');
      return res
        .status(200)
        .json(new ApiResponse(200, { otpSent: true, method: 'sms' }, 'New OTP sent to your phone'));
    }
  } catch (error) {
    logger.error('Failed to resend OTP', { error: error?.message });
    throw new ApiError(500, error?.message || 'Failed to resend OTP. Please try again.');
  }
});

// ─── Login ───────────────────────────────────────────────────────
export const loginUser = asyncHandler(async (req, res) => {
  const { email, phone, password } = req.body;

  if (!email && !phone) throw new ApiError(400, 'Email or phone is required');
  if (!password) throw new ApiError(400, 'Password is required');

  const query = [];
  if (email) query.push({ email: email.toLowerCase().trim() });
  if (phone) query.push({ phone: phone.trim() });

  const user = await User.findOne({ $or: query }).select('+password');
  if (!user) throw new ApiError(404, 'User does not exist');

  const emailMatch = email && user.email?.toLowerCase() === email.toLowerCase();
  const phoneMatch = phone && user.phone === phone;
  if (!emailMatch && !phoneMatch) {
    logger.error('Login query mismatch — found wrong user', {
      requestedEmail: email,
      foundEmail: user.email,
    });
    throw new ApiError(404, 'User does not exist');
  }

  if (user.isLocked()) {
    const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(
      423,
      `Account is temporarily locked. Please try again in ${lockTimeRemaining} minutes.`
    );
  }

  if (user.lockUntil && user.lockUntil <= Date.now()) {
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save({ validateBeforeSave: false });
  }

  if (user.status !== 'active')
    throw new ApiError(403, 'Account is not active. Please contact administrator.');

  const isMatch = await user.isPasswordCorrect(password);
  if (!isMatch) {
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
    await user.save({ validateBeforeSave: false });
    throw new ApiError(401, 'Invalid user credentials');
  }

  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save({ validateBeforeSave: false });

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
  const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

  return res
    .status(200)
    .cookie('accessToken', accessToken, COOKIE_OPTIONS)
    .cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        'User logged in successfully'
      )
    );
});

// OTP-based login is disabled; kept as a clear 501 for API consumers.
export const verifyLoginOtp = asyncHandler(async (_req, res) => {
  return res
    .status(501)
    .json(new ApiResponse(501, null, 'OTP login is currently disabled. Please use direct login.'));
});

// ─── Logout ──────────────────────────────────────────────────────
export const logOutUser = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, 'Unauthorized request');

  let decodedToken;
  try {
    decodedToken = jwt.decode(incomingRefreshToken);
  } catch {
    decodedToken = null;
  }

  if (decodedToken?._id) {
    await User.findByIdAndUpdate(decodedToken._id, { $unset: { refreshToken: 1 } });
  }

  return res
    .status(200)
    .clearCookie('accessToken', COOKIE_OPTIONS)
    .clearCookie('refreshToken', COOKIE_OPTIONS)
    .json(new ApiResponse(200, {}, 'User logged out'));
});

// ─── Refresh Token ───────────────────────────────────────────────
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, 'Unauthorized request');

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id).select('+refreshToken');
    if (!user) throw new ApiError(401, 'Invalid refresh token');
    if (incomingRefreshToken !== user.refreshToken)
      throw new ApiError(401, 'Refresh token is expired or used');

    const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    return res
      .status(200)
      .cookie('accessToken', accessToken, COOKIE_OPTIONS)
      .cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          'Access token refreshed'
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid refresh token');
  }
});

// ─── Forgot Password ────────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email, phone } = req.body;
  if (!email && !phone) throw new ApiError(400, 'Email or phone is required');

  const query = [];
  if (email) query.push({ email: email.toLowerCase().trim() });
  if (phone) query.push({ phone: phone.trim() });

  const user = await User.findOne({ $or: query });
  if (!user) throw new ApiError(404, 'User not found with this email or phone');

  const emailMatch = email && user.email?.toLowerCase() === email.toLowerCase().trim();
  const phoneMatch = phone && user.phone === phone.trim();
  if (!emailMatch && !phoneMatch)
    throw new ApiError(404, 'User not found with this email or phone');

  const resetToken = jwt.sign({ userId: user._id }, process.env.RESET_SECRET, { expiresIn: '15m' });

  if (typeof emailService.isConfigured === 'function' && !emailService.isConfigured()) {
    throw new ApiError(500, 'Email service not configured');
  }

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  await emailService.sendPasswordResetEmail(user.email, resetUrl);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { message: 'Password reset link sent to your email', email: user.email, expiresIn: 900 },
        'Password reset link sent'
      )
    );
});

// ─── Reset Password ─────────────────────────────────────────────
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const { newPassword } = req.body;

  if (!token) throw new ApiError(400, 'Reset token is required');
  if (!newPassword) throw new ApiError(400, 'New password is required');
  if (newPassword.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.RESET_SECRET);
  } catch {
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  const user = await User.findById(decoded.userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');

  user.password = newPassword;
  await user.save();

  return res.status(200).json(new ApiResponse(200, {}, 'Password reset successfully'));
});

// ─── Change Password ─────────────────────────────────────────────
export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword)
    throw new ApiError(400, 'Current and new passwords are required');

  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');

  const isMatch = await user.isPasswordCorrect(currentPassword);
  if (!isMatch) throw new ApiError(401, 'Current password is incorrect');

  user.password = newPassword;
  await user.save();

  return res.status(200).json(new ApiResponse(200, {}, 'Password changed successfully'));
});
