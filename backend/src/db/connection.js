import mongoose from 'mongoose';
import logger from '../utils/logger.js';
const DB_NAME = process.env.DB_NAME || 'ProjectDB';

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(process.env.MONGO_URL, {
      dbName: process.env.DB_NAME,
    });

    logger.info(`MongoDB Connected — host: ${connectionInstance.connection.host}`);
  } catch (error) {
    logger.error('MongoDB connection failed', error);
    process.exit(1);
  }
};

export default connectDB;
