/**
 * Authentication service — shared helpers for token + OTP generation.
 */
import crypto from 'crypto';
import { User } from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt (CSPRNG) — never Math.random().
 */
export function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash an OTP string using SHA-256 for safe Redis/DB storage.
 */
export function hashOTP(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Generate a fresh access + refresh token pair, saving the refresh token on the user doc.
 */
export async function generateAccessAndRefreshTokens(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    logger.error('Token generation error', { error: error?.message });
    throw new ApiError(
      500,
      error?.message || 'Something went wrong while generating refresh and access tokens'
    );
  }
}
