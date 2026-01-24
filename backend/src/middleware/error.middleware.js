const errorMiddleware = (err, req, res, next) => {
  // Log error for debugging
  console.error("Error caught in middleware:");
  console.error({
    message: err.message,
    statusCode: err.statusCode,
    // stack: err.stack, // Optional: uncomment if needed for prod debugging in logs
    url: req.url,
    method: req.method,
    // body: req.body // ❌ REMOVED for security (don't log passwords/tokens)
  });

  const status = err.statusCode || 500;
  const message = err.message || "Something went wrong";

  // Ensure response hasn't been sent already
  if (res.headersSent) {
    console.error("Headers already sent, cannot send error response");
    return next(err);
  }

  const errorResponse = {
    success: false,
    statusCode: status,
    message,
    error: message, // Include error field for frontend compatibility
    errors: err.errors || [],
    // Optionally include stack trace (for development only)
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  };

  res.status(status).json(errorResponse);
};

export default errorMiddleware;
