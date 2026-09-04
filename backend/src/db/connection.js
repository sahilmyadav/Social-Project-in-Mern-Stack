import mongoose from 'mongoose';
import logger from '../utils/logger.js';
const DB_NAME = process.env.DB_NAME || 'ProjectDB';

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(process.env.MONGO_URL, {
      dbName: process.env.DB_NAME,
      // ─── Connection Pool (tuned for cluster mode with 6 workers) ───
      maxPoolSize: 20,          // 20 connections per worker × 6 workers = 120 total
      minPoolSize: 5,           // Keep 5 warm connections per worker
      maxIdleTimeMS: 30000,     // Close idle connections after 30s
      // ─── Timeouts ───
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      // ─── Performance ───
      retryWrites: true,
      retryReads: true,
      w: 'majority',
    });

    logger.info(`MongoDB Connected — host: ${connectionInstance.connection.host}`);
  } catch (error) {
    logger.error('MongoDB connection failed', error);
    process.exit(1);
  }
};

export default connectDB;
