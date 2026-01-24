# Backend Dockerfile
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

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeuser
RUN mkdir -p /app/uploads && chown -R nodeuser:nodejs /app/uploads

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs . .

RUN mkdir -p /app/uploads && chown -R nodeuser:nodejs /app/uploads

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000
USER nodeuser

CMD ["node", "src/index.js"]
