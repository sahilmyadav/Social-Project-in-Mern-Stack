import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const POSTS_DIR = path.join(UPLOADS_DIR, 'posts');
const REELS_DIR = path.join(UPLOADS_DIR, 'reels');
const STORIES_DIR = path.join(UPLOADS_DIR, 'stories');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const COVERS_DIR = path.join(UPLOADS_DIR, 'covers');

const MAX_FILE_SIZE = {
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  avatar: 5 * 1024 * 1024,
};

const ALLOWED_EXTENSIONS = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
  video: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
};

const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

[POSTS_DIR, REELS_DIR, STORIES_DIR, AVATARS_DIR, COVERS_DIR].forEach(ensureDirectoryExists);

const generateUniqueFileName = (userId, originalName, type) => {
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName).toLowerCase();
  const safeUserId = String(userId).replace(/[^a-zA-Z0-9]/g, '');
  return `${type}_${safeUserId}_${timestamp}_${randomStr}${ext}`;
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

  const maxSize = fileType === 'video' ? MAX_FILE_SIZE.video : MAX_FILE_SIZE.image;
  if (file.size && file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit` };
  }

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
  };
  return dirs[contentType] || UPLOADS_DIR;
};

const saveFileLocally = async (fileOrPath, userId, contentType = 'post') => {
  try {
    // Handle both file object and file path
    let tempFilePath;
    let originalName;
    let fileSize;

    if (typeof fileOrPath === 'string') {
      tempFilePath = fileOrPath;
      originalName = path.basename(fileOrPath);
    } else if (fileOrPath && fileOrPath.path) {
      tempFilePath = fileOrPath.path;
      originalName = fileOrPath.originalname || path.basename(fileOrPath.path);
      fileSize = fileOrPath.size;
    } else {
      console.error('[Storage] Invalid file input:', fileOrPath);
      return null;
    }

    if (!tempFilePath) {
      console.error('[Storage] No file path provided');
      return null;
    }

    if (!fs.existsSync(tempFilePath)) {
      console.error('[Storage] Temp file does not exist:', fileOrPath);
      return null;
    }

    const stats = fs.statSync(tempFilePath);
    const fileName = generateUniqueFileName(userId, originalName, contentType);
    const targetDir = getTargetDirectory(contentType);
    const targetPath = path.join(targetDir, fileName);

    ensureDirectoryExists(targetDir);

    await fs.promises.copyFile(tempFilePath, targetPath);

    try {
      await fs.promises.unlink(tempFilePath);
    } catch (unlinkErr) {
      console.warn('[Storage] Could not delete temp file:', unlinkErr.message);
    }

    const folderName = contentType === 'avatar' ? 'avatars' : `${contentType}s`;
    const relativePath = `/uploads/${folderName}/${fileName}`;

    return {
      fileName,
      filePath: targetPath,
      relativePath,
      url: relativePath,
      secure_url: relativePath,
      size: stats.size,
      public_id: `${contentType}_${fileName}`,
    };
  } catch (error) {
    console.error('[Storage] Error saving file:', error);

    if (tempFilePath) {
      try {
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath);
        }
      } catch (cleanupErr) {
        console.error('[Storage] Cleanup error:', cleanupErr.message);
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
    console.warn('[Storage] Some files failed to save:', errors);
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
      console.log('[Storage] File deleted:', filePath);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Storage] Error deleting file:', error);
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
      console.error(`[Storage] Error reading ${key} directory:`, err);
    }
  }

  return stats;
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
  saveFileLocally,
  saveMultipleFilesLocally,
  STORIES_DIR,
  UPLOADS_DIR,
  validateFile,
};
