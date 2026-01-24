// redis.config.js
import Redis from 'ioredis';

let redis;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Check if it's a secure Redis URL (like Upstash)
const isSecureRedis = redisUrl.startsWith('rediss://');

if (isSecureRedis) {
  // ✅ Production with Upstash or other TLS Redis
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    tls: {},
  });
} else {
  // ✅ Local development or Docker Redis
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

export default redis;
