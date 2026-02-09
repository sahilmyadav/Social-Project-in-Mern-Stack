// redis.config.js
import Redis from 'ioredis';
import logger from './logger.js';

let redis;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Check if it's a secure Redis URL (like Upstash)
const isSecureRedis = redisUrl.startsWith('rediss://');

if (isSecureRedis) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    tls: {},
  });
} else {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err.message);
});

export default redis;
