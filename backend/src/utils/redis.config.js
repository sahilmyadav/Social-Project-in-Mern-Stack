// redis.config.js
import Redis from "ioredis";

let redis;

if (process.env.REDIS_URL) {
  // ✅ Production / Render / Upstash
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    tls: {}, // required for Upstash
  });
} else {
  // ✅ Local development
  redis = new Redis({
    host: "127.0.0.1",
    port: 6379,
  });
}

redis.on("connect", () => {
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

export default redis;
