/**
 * Environment variable validation.
 *
 * Call validateEnv() at application startup (before routes are registered).
 * Fails fast on missing critical variables, warns on missing optional ones.
 *
 * Centralizes all process.env reads for secrets so they aren't scattered.
 */

import logger from '../utils/logger.js';

// Variables that MUST exist — server will not start without them.
const REQUIRED = ['MONGO_URL', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET'];

// Variables that SHOULD exist — server starts but logs a warning.
const RECOMMENDED = ['ENCRYPTION_KEY', 'SMTP_USER', 'SMTP_PASS', 'REDIS_URL'];

// Secrets that must not be default/placeholder values in production.
const WEAK_VALUE_PATTERNS = [
  /^change[-_]?this/i,
  /^your[-_]/i,
  /^CHANGE_ME/i,
  /^secret$/i,
  /^password$/i,
  /^123456/,
];

/**
 * Validate environment variables on startup.
 * @throws {Error} if a required variable is missing in production
 */
export const validateEnv = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const missing = [];
  const weak = [];

  // Check required variables
  for (const key of REQUIRED) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    if (isProd) {
      logger.error(msg);
      throw new Error(msg);
    }
    logger.warn(msg);
  }

  // Check recommended variables
  for (const key of RECOMMENDED) {
    if (!process.env[key]) {
      logger.warn(`Recommended env var not set: ${key}`);
    }
  }

  // Check for weak/placeholder values on secrets
  const secretKeys = [
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
    'ENCRYPTION_KEY',
    'RESET_SECRET',
  ];
  for (const key of secretKeys) {
    const val = process.env[key];
    if (val && WEAK_VALUE_PATTERNS.some((p) => p.test(val))) {
      weak.push(key);
    }
  }

  if (weak.length > 0) {
    const msg = `Weak/placeholder secret values detected: ${weak.join(', ')} — change before production`;
    if (isProd) {
      logger.error(msg);
      throw new Error(msg);
    }
    logger.warn(msg);
  }

  logger.info('Environment validation passed', {
    nodeEnv: process.env.NODE_ENV || 'development',
    requiredOk: REQUIRED.length - missing.length,
    requiredMissing: missing.length,
    weakSecrets: weak.length,
  });
};
