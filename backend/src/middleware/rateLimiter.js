/**
 * Rate Limiter Module
 *
 * Provides configurable rate limiting for API endpoints.
 * Currently DISABLED by default per client request.
 *
 * To enable:
 *   1. Set environment variable ENABLE_RATE_LIMIT=true
 *   2. Uncomment the app.use() lines in app.js (search "RATE_LIMIT")
 *
 * All limiters are pre-configured and ready to use.
 */

import rateLimit from 'express-rate-limit';

const isEnabled = process.env.ENABLE_RATE_LIMIT === 'true';

/**
 * Create a rate limiter that is either active or a no-op passthrough
 * depending on the ENABLE_RATE_LIMIT flag.
 */
const createLimiter = (options) => {
  if (!isEnabled) {
    // Return a passthrough middleware when rate limiting is disabled.
    return (_req, _res, next) => next();
  }
  return rateLimit(options);
};

/**
 * General API rate limiter — 500 requests per 15 minutes.
 */
export const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
  skip: (req) => req.path.startsWith('/uploads'),
});

/**
 * Auth rate limiter — 10 attempts per 15 minutes.
 * Protects login, registration, forgot-password.
 */
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
});

/**
 * Upload rate limiter — 50 uploads per hour.
 */
export const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Upload limit exceeded. Try again in an hour.' },
});

/**
 * Search rate limiter — 60 searches per minute.
 * Prevents abuse/scraping of search endpoints.
 */
export const searchLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many search requests. Please slow down.' },
});
