/**
 * Admin authorization middleware.
 *
 * Must be used AFTER verifyJwt so that req.user is populated.
 * Reusable across all admin routes — no inline checks needed.
 */

import ApiError from '../utils/ApiError.js';

export const requireAdmin = (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (req.user.userType !== 'admin') {
    return next(new ApiError(403, 'Access denied. Admin privileges required.'));
  }

  next();
};
