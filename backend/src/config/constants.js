/**
 * Application-wide constants.
 * Centralizes magic numbers and repeated config values.
 */

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

export const OTP = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
  MAX_RESEND_ATTEMPTS: 5,
  RESEND_WINDOW_MINUTES: 15,
};

export const AUTH = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_DURATION_MINUTES: 30,
  PASSWORD_RESET_EXPIRY_MINUTES: 60,
};

export const UPLOAD = {
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10 MB
  MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
};

export const STORY = {
  EXPIRY_HOURS: 24,
  CLEANUP_INTERVAL_HOURS: 1,
};

export const CONTENT_TYPES = {
  POST: 'post',
  REEL: 'reel',
  STORY: 'story',
  COMMENT: 'comment',
};

export const NOTIFICATION_TYPES = {
  LIKE: 'like',
  COMMENT: 'comment',
  FOLLOW: 'follow',
  SHARE: 'share',
  TAG: 'tag',
  MENTION: 'mention',
};

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

// ─── Search ─────────────────────────────────────────────────────
export const SEARCH = {
  MAX_QUERY_LENGTH: 200,
  TRENDING_LIMIT: 10,
  HISTORY_LIMIT: 10,
};

// ─── Redis Key Prefixes ─────────────────────────────────────────
export const REDIS_KEYS = {
  ONLINE_USER: 'online:',
  SESSION: 'session:',
  TYPING: 'typing:',
  OTP: 'otp:',
};
