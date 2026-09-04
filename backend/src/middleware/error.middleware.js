import logger from '../utils/logger.js';

const errorMiddleware = (err, req, res, next) => {
  logger.error('Error caught in middleware:', {
    message: err.message,
    statusCode: err.statusCode,
    url: req.url,
    method: req.method,
  });

  const status = err.statusCode || 500;
  const message = err.message || 'Something went wrong';

  // Ensure response hasn't been sent already
  if (res.headersSent) {
    logger.error('Headers already sent, cannot send error response');
    return next(err);
  }

  const errorResponse = {
    success: false,
    statusCode: status,
    message,
    error: message, // Include error field for frontend compatibility
    errors: err.errors || [],
    // Optionally include stack trace (for development only)
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  };

  res.status(status).json(errorResponse);
};

export default errorMiddleware;
