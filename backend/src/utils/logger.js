/**
 * Structured Logger — drop-in wrapper around console.
 *
 * Adds ISO timestamp, log level, and structured context to every message.
 * In PR5 this will be replaced with a proper logging library (pino/winston).
 * For now it preserves existing console behavior while adding structure.
 *
 * Usage:
 *   import logger from '../utils/logger.js';
 *   logger.info('Server started', { port: 5000 });
 *   logger.error('DB connection failed', { error: err.message });
 *   logger.warn('Missing env var', { key: 'ENCRYPTION_KEY' });
 */

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = () => {
  const env = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
  return LEVELS[env] ?? LEVELS.info;
};

const formatMessage = (level, message, meta = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    pid: process.pid,
    ...meta,
  };
  return JSON.stringify(entry);
};

const logger = {
  error(message, meta = {}) {
    if (currentLevel() >= LEVELS.error) {
      console.error(formatMessage('error', message, meta));
    }
  },

  warn(message, meta = {}) {
    if (currentLevel() >= LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  info(message, meta = {}) {
    if (currentLevel() >= LEVELS.info) {
      console.info(formatMessage('info', message, meta));
    }
  },

  debug(message, meta = {}) {
    if (currentLevel() >= LEVELS.debug) {
      console.debug(formatMessage('debug', message, meta));
    }
  },
};

export default logger;
