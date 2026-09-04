/**
 * Express request-validation middleware.
 *
 * Provides reusable validators for common route patterns.
 * Usage:
 *
 *   import { validatePagination, validateObjectId } from '../middleware/validate.js';
 *   router.get('/posts', validatePagination, getPostsHandler);
 *   router.get('/posts/:postId', validateObjectId('postId'), getPostHandler);
 */

import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { PAGINATION } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';

/**
 * Zod schema validation middleware factory.
 * Validates req.body against the given Zod schema.
 *
 * Usage:
 *   import { validateBody } from '../middleware/validate.js';
 *   import { registerSchema } from '../schemas/auth.schema.js';
 *   router.post('/register', validateBody(registerSchema), registerUser);
 */
export function validateBody(schema) {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.issues.map((e) => e.message).join(', ');
        return next(new ApiError(400, messages));
      }
      next(err);
    }
  };
}

/**
 * Validates req.query against the given Zod schema.
 */
export function validateQuery(schema) {
  return (req, _res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.issues.map((e) => e.message).join(', ');
        return next(new ApiError(400, messages));
      }
      next(err);
    }
  };
}

/**
 * Validates and normalizes pagination query params.
 * Attaches parsed `req.pagination` = { page, limit, skip }.
 */
export function validatePagination(req, _res, next) {
  const page = Math.max(1, parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE);
  const rawLimit = parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT;
  const limit = Math.min(rawLimit, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  req.pagination = { page, limit, skip };
  next();
}

/**
 * Returns middleware that validates `req.params[paramName]` is a valid MongoDB ObjectId.
 */
export function validateObjectId(paramName) {
  return (req, _res, next) => {
    const value = req.params[paramName];
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
      return next(new ApiError(400, `Invalid ${paramName}`));
    }
    next();
  };
}

/**
 * Returns middleware that validates required body fields exist.
 * @param {string[]} fields - List of required field names.
 */
export function requireFields(...fields) {
  return (req, _res, next) => {
    const missing = fields.filter((f) => req.body[f] == null || req.body[f] === '');
    if (missing.length > 0) {
      return next(new ApiError(400, `Missing required field(s): ${missing.join(', ')}`));
    }
    next();
  };
}

/**
 * Returns middleware that trims and enforces max length on body fields.
 * @param {{ field: string, max: number }[]} rules
 */
export function validateLength(...rules) {
  return (req, _res, next) => {
    for (const { field, max } of rules) {
      const value = req.body[field];
      if (typeof value === 'string') {
        req.body[field] = value.trim();
        if (req.body[field].length > max) {
          return next(new ApiError(400, `${field} must be at most ${max} characters`));
        }
      }
    }
    next();
  };
}
