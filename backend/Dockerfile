# Backend Dockerfile — optimized for 12-core / 46GB VPS
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Production
FROM base AS runner
WORKDIR /app

# ffmpeg is needed for video compression + faststart on upload
RUN apk add --no-cache ffmpeg

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeuser
RUN mkdir -p /app/uploads && chown -R nodeuser:nodejs /app/uploads

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs . .

RUN mkdir -p /app/uploads && chown -R nodeuser:nodejs /app/uploads

ENV NODE_ENV=production
ENV PORT=5000
# Increase libuv thread pool for I/O-heavy operations (sharp, fs, crypto)
ENV UV_THREADPOOL_SIZE=16
# Node.js memory — allow up to 4GB per worker (cluster will fork multiple)
ENV NODE_OPTIONS="--max-old-space-size=4096"

EXPOSE 5000
USER nodeuser

# Default: single process. Override in docker-compose for cluster mode.
CMD ["node", "src/index.js"]
