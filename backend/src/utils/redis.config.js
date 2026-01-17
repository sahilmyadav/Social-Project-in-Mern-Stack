// redis.config.js
import Redis from 'ioredis';

let redis;

if (process.env.REDIS_URL) {
  // Check if it's a secure connection (Upstash/cloud) or local Docker
  const isSecure = process.env.REDIS_URL.startsWith('rediss://');

  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    retryDelayOnClusterDown: 100,
    ...(isSecure && { tls: {} }), // Only use TLS for secure connections (Upstash)
  });
} else {
  // ✅ Local development
  redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
  });
}

redis.on('connect', () => {});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

export default redis;
