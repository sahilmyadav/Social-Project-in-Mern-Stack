import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import redis from '../utils/redis.config.js';

const AUTH_USER_CACHE_TTL = 60; // 60 seconds

/**
 * Fetch user by ID, with a short Redis cache to avoid DB hit on every request.
 */
async function getCachedUser(userId) {
  const cacheKey = `auth_user:${userId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_err) {
    // Redis unavailable — fall through to DB
  }

  const user = await User.findById(userId).select('-password -refreshToken').lean();
  if (user) {
    try {
      await redis.set(cacheKey, JSON.stringify(user), 'EX', AUTH_USER_CACHE_TTL);
    } catch (_err) {
      // Non-critical
    }
  }
  return user;
}

const verifyJwt = asyncHandler(async (req, _, next) => {
  try {
    const token = req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(401, 'Unauthorized request');
    }

    const decodeToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await getCachedUser(decodeToken?._id);

    if (!user) {
      throw new ApiError(401, 'Invalid AccessToken');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token has expired. Please login again.');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid token. Please login again.');
    }

    throw new ApiError(401, error?.message || 'Invalid access token');
  }
});

const verifyJwtOptional = asyncHandler(async (req, _, next) => {
  try {
    const token = req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return next();
    }

    try {
      const decodeToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await getCachedUser(decodeToken?._id);

      if (user) {
        req.user = user;
      }
    } catch (_ignore) {
      // Ignore token errors for optional auth
    }

    next();
  } catch (error) {
    next();
  }
});

export { verifyJwt, verifyJwtOptional };
