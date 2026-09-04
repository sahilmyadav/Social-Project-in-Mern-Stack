import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Simple health check for load balancers and Docker
router.get('/api/v1/health', (_, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Detailed health check for monitoring
router.get('/api/v1/health/detailed', async (_, res) => {
  try {
    const healthInfo = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      },
    };

    res.status(200).json(healthInfo);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
    });
  }
});

// Legacy health check endpoint
router.route('/health-check').get((_, res) => res.json({ msg: 'Server is Healthy' }));

export { router as healthRoutes };
