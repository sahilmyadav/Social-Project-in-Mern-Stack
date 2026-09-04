import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import logger from './logger.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const POSTS_DIR = path.join(UPLOADS_DIR, 'posts');
const REELS_DIR = path.join(UPLOADS_DIR, 'reels');
const STORIES_DIR = path.join(UPLOADS_DIR, 'stories');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const COVERS_DIR = path.join(UPLOADS_DIR, 'covers');
const GENERALS_DIR = path.join(UPLOADS_DIR, 'generals');

const MAX_FILE_SIZE = {
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  avatar: 5 * 1024 * 1024,
};

const ALLOWED_EXTENSIONS = {
  // SVG excluded — can contain inline <script> tags (XSS vector)
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  video: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
  audio: ['.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac', '.flac'],
  document: [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.txt',
    '.csv',
    '.rtf',
    '.zip',
    '.rar',
    '.7z',
  ],
};

// Image compression settings by content type
const COMPRESSION_SETTINGS = {
  avatar: { maxWidth: 400, maxHeight: 400, quality: 80 },
  cover: { maxWidth: 1200, maxHeight: 400, quality: 85 },
  post: { maxWidth: 1080, maxHeight: 1350, quality: 85 },
  story: { maxWidth: 1080, maxHeight: 1920, quality: 80 },
  reel: { maxWidth: 1080, maxHeight: 1920, quality: 80 }, // For thumbnails
  general: { maxWidth: 1200, maxHeight: 1200, quality: 85 },
};

const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

[POSTS_DIR, REELS_DIR, STORIES_DIR, AVATARS_DIR, COVERS_DIR, GENERALS_DIR].forEach(
  ensureDirectoryExists
);

const generateUniqueFileName = (userId, originalName, type) => {
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(8).toString('hex');
  const originalExt = path.extname(originalName).toLowerCase();
  // Keep original extension for videos, audio, and documents; convert images to .jpg for compression
  const isCompressibleImage =
    ALLOWED_EXTENSIONS.image.includes(originalExt) &&
    originalExt !== '.gif' &&
    originalExt !== '.svg';
  const ext = isCompressibleImage ? '.jpg' : originalExt;
  const safeUserId = String(userId).replace(/[^a-zA-Z0-9]/g, '');
  return `${type}_${safeUserId}_${timestamp}_${randomStr}${ext}`;
};

// Compress image using sharp
const compressImage = async (inputPath, outputPath, contentType) => {
  const settings = COMPRESSION_SETTINGS[contentType] || COMPRESSION_SETTINGS.general;

  try {
    await sharp(inputPath)
      .resize(settings.maxWidth, settings.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: settings.quality, progressive: true })
      .toFile(outputPath);

    return true;
  } catch (error) {
    logger.error('[Compression] Error compressing image', { error: error.message });
    return false;
  }
};

/**
 * Compress and optimize video for fast mobile streaming (like Instagram).
 * - Re-encodes to H.264 at ~2.5 Mbps (from raw 10-18 Mbps phone camera)
 * - Scales to 720p max width (phones don't need 1080p for reels)
 * - Moves moov atom to front (faststart) for instant playback
 * - AAC audio at 128k
 *
 * A 30s reel goes from ~40MB → ~5-8MB, loading in 1-2s instead of 30s+.
 * If ffmpeg is not available, the original file is kept as-is.
 */
const compressVideo = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.mp4' && ext !== '.mov' && ext !== '.webm') return false;

  const tempOutput = filePath + '.compressed.mp4';
  const startTime = Date.now();

  try {
    // Get original file size for logging
    const originalSize = (await fs.promises.stat(filePath)).size;

    await execFileAsync('ffmpeg', [
      '-i', filePath,
      '-c:v', 'libx264',          // H.264 — universal browser support
      '-preset', 'fast',           // Fast encoding (good balance of speed vs compression)
      '-crf', '28',                // Constant quality (28 = good quality, small file)
      '-maxrate', '2500k',         // Cap bitrate at 2.5 Mbps (Instagram-level)
      '-bufsize', '5000k',         // Buffer size for rate control
      '-vf', 'scale=720:-2',       // Scale to 720p width, auto height (even number)
      '-c:a', 'aac',               // AAC audio
      '-b:a', '128k',              // 128kbps audio
      '-ac', '2',                  // Stereo
      '-movflags', '+faststart',   // Moov atom at front for instant playback
      '-pix_fmt', 'yuv420p',       // Maximum compatibility
      '-y',                        // Overwrite output
      tempOutput,
    ], { timeout: 300000 }); // 5 minute timeout for longer videos

    // Verify output is valid
    const newStats = await fs.promises.stat(tempOutput);
    if (newStats.size > 0) {
      await fs.promises.rename(tempOutput, filePath);
      const savedMB = ((originalSize - newStats.size) / 1024 / 1024).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`[Storage] Video compressed: ${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(newStats.size / 1024 / 1024).toFixed(1)}MB (saved ${savedMB}MB) in ${elapsed}s`, { file: path.basename(filePath) });
      return true;
    } else {
      await fs.promises.unlink(tempOutput).catch(() => {});
      logger.warn('[Storage] Video compression produced empty file, keeping original');
      return false;
    }
  } catch (error) {
    // Clean up temp file
    try { await fs.promises.unlink(tempOutput).catch(() => {}); } catch (_) {}

    if (error.code === 'ENOENT') {
      logger.warn('[Storage] ffmpeg not found — video compression skipped. Install ffmpeg for smaller, faster-loading videos.');
    } else {
      logger.warn('[Storage] Video compression failed (using original):', { error: error.message });
    }
    return false;
  }
};

const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'file';
};

const validateFile = (file, contentType) => {
  const ext = path.extname(file.originalname || file.path).toLowerCase();
  const fileType = getFileType(file.mimetype);

  if (contentType === 'reel' && fileType !== 'video') {
    return { valid: false, error: 'Reels must be video files' };
  }

  if (contentType === 'avatar' && fileType !== 'image') {
    return { valid: false, error: 'Avatar must be an image file' };
  }

  const allowedExts = [...ALLOWED_EXTENSIONS.image, ...ALLOWED_EXTENSIONS.video];
  if (!allowedExts.includes(ext)) {
    return { valid: false, error: `File type ${ext} is not allowed` };
  }

  // No file size limits per client request

  return { valid: true };
};

const getTargetDirectory = (contentType) => {
  const dirs = {
    post: POSTS_DIR,
    reel: REELS_DIR,
    story: STORIES_DIR,
    avatar: AVATARS_DIR,
    avatars: AVATARS_DIR,
    cover: COVERS_DIR,
    covers: COVERS_DIR,
    general: GENERALS_DIR,
  };
  return dirs[contentType] || GENERALS_DIR;
};

const saveFileLocally = async (fileOrPath, userId, contentType = 'post') => {
  try {
    // Handle both file object and file path
    let tempFilePath;
    let originalName;
    let fileSize;
    let mimetype;

    if (typeof fileOrPath === 'string') {
      tempFilePath = fileOrPath;
      originalName = path.basename(fileOrPath);
    } else if (fileOrPath && fileOrPath.path) {
      tempFilePath = fileOrPath.path;
      originalName = fileOrPath.originalname || path.basename(fileOrPath.path);
      fileSize = fileOrPath.size;
      mimetype = fileOrPath.mimetype;
    } else {
      logger.error('[Storage] Invalid file input:', { input: fileOrPath });
      return null;
    }

    if (!tempFilePath) {
      logger.error('[Storage] No file path provided');
      return null;
    }

    if (!fs.existsSync(tempFilePath)) {
      logger.error('[Storage] Temp file does not exist:', { path: fileOrPath });
      return null;
    }

    const originalExt = path.extname(originalName).toLowerCase();
    const isImage =
      ALLOWED_EXTENSIONS.image.includes(originalExt) &&
      originalExt !== '.gif' &&
      originalExt !== '.svg';
    const isVideo = ALLOWED_EXTENSIONS.video.includes(originalExt);

    const fileName = generateUniqueFileName(userId, originalName, contentType);
    const targetDir = getTargetDirectory(contentType);
    const targetPath = path.join(targetDir, fileName);

    ensureDirectoryExists(targetDir);

    // Compress images, process videos with faststart
    if (isImage) {
      const compressed = await compressImage(tempFilePath, targetPath, contentType);
      if (!compressed) {
        // Fallback to copy if compression fails
        await fs.promises.copyFile(tempFilePath, targetPath);
        logger.warn('[Storage] Compression failed, using original file');
      }
    } else {
      await fs.promises.copyFile(tempFilePath, targetPath);

      // For video files (reels, stories), compress + optimize for fast streaming
      // This re-encodes to H.264 ~2.5Mbps with faststart (like Instagram)
      if (isVideo && (contentType === 'reel' || contentType === 'story')) {
        await compressVideo(targetPath);
      }
    }

    try {
      await fs.promises.unlink(tempFilePath);
    } catch (unlinkErr) {
      logger.warn('[Storage] Could not delete temp file:', { error: unlinkErr.message });
    }

    // Map content type to correct folder name
    const folderNameMap = {
      avatar: 'avatars',
      post: 'posts',
      reel: 'reels',
      story: 'stories',
      cover: 'covers',
      general: 'generals',
    };
    const folderName = folderNameMap[contentType] || `${contentType}s`;
    const relativePath = `/uploads/${folderName}/${fileName}`;

    // Get final file stats after processing
    const finalStats = fs.statSync(targetPath);

    return {
      fileName,
      filePath: targetPath,
      relativePath,
      url: relativePath,
      secure_url: relativePath,
      size: finalStats.size,
      public_id: `${contentType}_${fileName}`,
    };
  } catch (error) {
    logger.error('[Storage] Error saving file:', { error: error.message });

    if (tempFilePath) {
      try {
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath);
        }
      } catch (cleanupErr) {
        logger.error('[Storage] Cleanup error:', { error: cleanupErr.message });
      }
    }

    return null;
  }
};

const saveMultipleFilesLocally = async (files, userId, contentType = 'post') => {
  if (!files || files.length === 0) {
    return [];
  }

  const results = [];
  const errors = [];

  const savePromises = files.map(async (file, index) => {
    try {
      const validation = validateFile(file, contentType);
      if (!validation.valid) {
        errors.push({ index, error: validation.error });
        return null;
      }

      const result = await saveFileLocally(file.path, userId, contentType);
      if (result) {
        result.mimetype = file.mimetype;
        result.originalName = file.originalname;
        result.type = getFileType(file.mimetype);
        return result;
      }
      return null;
    } catch (err) {
      errors.push({ index, error: err.message });
      return null;
    }
  });

  const savedFiles = await Promise.all(savePromises);

  savedFiles.forEach((file) => {
    if (file) results.push(file);
  });

  if (errors.length > 0) {
    logger.warn('[Storage] Some files failed to save:', { errors });
  }

  return results;
};

const deleteLocalFile = async (filePath) => {
  try {
    if (!filePath) return false;

    let fullPath = filePath;
    if (filePath.startsWith('/uploads')) {
      fullPath = path.join(UPLOADS_DIR, '..', filePath);
    }

    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('[Storage] Error deleting file:', { error: error.message });
    return false;
  }
};

const deleteMultipleFiles = async (filePaths) => {
  const results = await Promise.all(filePaths.map((fp) => deleteLocalFile(fp)));
  return results.filter(Boolean).length;
};

const getStorageStats = async () => {
  const stats = {
    posts: { count: 0, size: 0 },
    reels: { count: 0, size: 0 },
    stories: { count: 0, size: 0 },
    avatars: { count: 0, size: 0 },
  };

  const dirs = { posts: POSTS_DIR, reels: REELS_DIR, stories: STORIES_DIR, avatars: AVATARS_DIR };

  for (const [key, dir] of Object.entries(dirs)) {
    try {
      if (fs.existsSync(dir)) {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
          if (file.startsWith('.')) continue;
          const filePath = path.join(dir, file);
          const fileStat = await fs.promises.stat(filePath);
          if (fileStat.isFile()) {
            stats[key].count++;
            stats[key].size += fileStat.size;
          }
        }
      }
    } catch (err) {
      logger.error(`[Storage] Error reading ${key} directory:`, { error: err.message });
    }
  }

  return stats;
};

/**
 * Upload a file with automatic category detection from path.
 * Wraps saveFileLocally with path-based content type inference.
 */
const uploadFile = async (localFilePath, category = 'general') => {
  let contentType = category;
  if (localFilePath && typeof localFilePath === 'string') {
    if (localFilePath.includes('avatar') || localFilePath.includes('profile')) {
      contentType = 'avatar';
    } else if (localFilePath.includes('cover')) {
      contentType = 'cover';
    } else if (localFilePath.includes('story') || localFilePath.includes('stories')) {
      contentType = 'story';
    } else if (localFilePath.includes('reel')) {
      contentType = 'reel';
    } else if (localFilePath.includes('post')) {
      contentType = 'post';
    }
  }

  const result = await saveFileLocally(localFilePath, 'user', contentType);
  if (result) {
    const ext = localFilePath ? localFilePath.toLowerCase() : '';
    result.resource_type = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].some((e) => ext.endsWith(e))
      ? 'video'
      : 'image';
  }
  return result;
};

/**
 * Remove a file by its public_id (file path).
 */
const removeFile = async (publicId) => {
  if (!publicId) return null;
  const result = await deleteLocalFile(publicId);
  return result ? { result: 'ok' } : null;
};

export {
    AVATARS_DIR,
    deleteLocalFile,
    deleteMultipleFiles,
    generateUniqueFileName,
    getFileType,
    getStorageStats,
    POSTS_DIR,
    REELS_DIR,
    removeFile,
    saveFileLocally,
    saveMultipleFilesLocally,
    STORIES_DIR,
    uploadFile,
    UPLOADS_DIR,
    validateFile
};
