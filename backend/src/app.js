import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import fs from 'fs';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import errorMiddleware from './middleware/error.middleware.js';
import { checkMaintenanceMode } from './middleware/maintenance.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      // Never compress video files — they're already compressed and this wastes CPU + adds latency
      const url = req.url || '';
      if (/\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(url)) return false;
      const contentType = res.getHeader('Content-Type');
      if (typeof contentType === 'string' && contentType.startsWith('video/')) return false;
      return compression.filter(req, res);
    },
  })
);

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : true;

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['set-cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(cookieParser());
// express-mongo-sanitize middleware disabled — incompatible with Express v5
// (req.query is a getter in Express 5, mongoSanitize tries to set it and crashes)
// Instead, sanitize only req.body and req.params manually:
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});
app.use(express.static('public'));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// ─── Rate Limiting ──────────────────────────────────────────────
// Rate limiting is DISABLED per client request.
// The rate limiter module exists at middleware/rateLimiter.js
// and can be re-enabled if needed in the future.

// Redirect legacy storys path to stories (for old URLs in database)
app.use('/uploads/storys', (req, res) => {
  res.redirect(301, `/uploads/stories${req.url}`);
});

const uploadsPath = path.join(__dirname, '../uploads');

// Video streaming with range request support (progressive loading like Instagram)
app.get('/uploads/:folder/:filename', (req, res, next) => {
  const { folder, filename } = req.params;
  // Sanitize folder/filename to prevent path traversal
  if (folder.includes('..') || filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  const filePath = path.join(uploadsPath, folder, filename);
  const ext = path.extname(filePath).toLowerCase();

  // Only handle video files with range requests
  if (!['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) {
    return next();
  }

  // Check if file exists and get stats in one call
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return res.status(404).json({ error: 'File not found' });
  }

  const fileSize = stat.size;
  const range = req.headers.range;

  // Set content type
  const contentType =
    ext === '.mp4'
      ? 'video/mp4'
      : ext === '.webm'
        ? 'video/webm'
        : ext === '.mov'
          ? 'video/quicktime'
          : 'video/mp4';

  if (range) {
    // Parse range header
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);

    // Validate start position
    if (isNaN(start) || start < 0 || start >= fileSize) {
      res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
      return res.end();
    }

    // For initial request (start=0), send a larger first chunk (2MB) for fast playback start
    // For subsequent requests, respect the requested range or send 1MB chunks
    const INITIAL_CHUNK = 2 * 1024 * 1024; // 2MB — enough for moov atom + first frames
    const STREAM_CHUNK = 1024 * 1024;       // 1MB for ongoing streaming
    const maxChunk = start === 0 ? INITIAL_CHUNK : STREAM_CHUNK;
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : Math.min(start + maxChunk, fileSize - 1);
    const chunkSize = end - start + 1;

    // Create read stream for the requested range
    const file = fs.createReadStream(filePath, { start, end });

    // Handle stream errors gracefully
    file.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      } else {
        res.end();
      }
    });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, immutable',
    });

    file.pipe(res);
  } else {
    // No range requested, send full file with accept-ranges header
    const file = fs.createReadStream(filePath);

    file.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      } else {
        res.end();
      }
    });

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=604800, immutable',
    });

    file.pipe(res);
  }
});
app.use(
  '/uploads',
  express.static(uploadsPath, {
    maxAge: '7d',
    etag: true,
    lastModified: true,
    immutable: true,
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
        res.setHeader('Content-Type', `image/${ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)}`);
      } else if (['.mp4', '.webm', '.mov'].includes(ext)) {
        res.setHeader('Content-Type', `video/${ext.slice(1)}`);
        res.setHeader('Accept-Ranges', 'bytes');
      }
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

app.use(checkMaintenanceMode);

app.get('', (req, res) => res.json({ msg: 'API Is Running', version: '1.0.0' }));
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// routes
import adminRoutes from './routes/admin.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { commentRoutes } from './routes/comment.routes.js';
import feedRoutes from './routes/feed.routes.js';
import { followRoutes } from './routes/follow.routes.js';
import groupRoutes from './routes/group.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import liveStreamRoutes from './routes/liveStream.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import postRoutes from './routes/post.routes.js';
import reelRoutes from './routes/reel.routes.js';
import searchRoutes from './routes/search.routes.js';
import storyRoutes from './routes/story.routes.js';
import systemRoutes from './routes/system.routes.js';
import { userRoutes } from './routes/user.routes.js';
import webrtcRoutes from './routes/webrtc.routes.js';

app.use('/api/v1/users', userRoutes);
app.use('/api/v1/follow', followRoutes);
app.use('/api/v1/post', postRoutes);
app.use('/api/v1/story', storyRoutes);
app.use('/api/v1/reel', reelRoutes);
app.use('/api/v1/feed', feedRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/group', groupRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/system', systemRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/comment', commentRoutes);
app.use('/api/v1/live', liveStreamRoutes);
app.use('/api/v1/webrtc', webrtcRoutes);
app.use(healthRoutes);

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use(errorMiddleware);

export { app as Server };
