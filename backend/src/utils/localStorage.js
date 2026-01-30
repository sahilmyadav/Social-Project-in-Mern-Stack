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

const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDirectoryExists(POSTS_DIR);
ensureDirectoryExists(REELS_DIR);
ensureDirectoryExists(STORIES_DIR);
ensureDirectoryExists(AVATARS_DIR);

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

const saveFileLocally = async (tempFilePath, userId, contentType = 'post') => {
  try {
    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
      return null;
    }

    const originalName = path.basename(tempFilePath);
    const fileName = generateUniqueFileName(userId, originalName, contentType);

    let targetDir;
    switch (contentType) {
      case 'post':
        targetDir = POSTS_DIR;
        break;
      case 'reel':
        targetDir = REELS_DIR;
        break;
      case 'story':
        targetDir = STORIES_DIR;
        break;
      case 'avatar':
        targetDir = AVATARS_DIR;
        break;
      default:
        targetDir = UPLOADS_DIR;
    }

    const targetPath = path.join(targetDir, fileName);

    fs.copyFileSync(tempFilePath, targetPath);
    fs.unlinkSync(tempFilePath);

    const stats = fs.statSync(targetPath);
    const relativePath = `/uploads/${contentType}s/${fileName}`;

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
    console.error('Error saving file locally:', error);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    return null;
  }
};

const saveMultipleFilesLocally = async (files, userId, contentType = 'post') => {
  const results = [];

  for (const file of files) {
    const result = await saveFileLocally(file.path, userId, contentType);
    if (result) {
      result.mimetype = file.mimetype;
      result.originalName = file.originalname;
      result.type = getFileType(file.mimetype);
      results.push(result);
    }
  }

  return results;
};

const deleteLocalFile = (filePath) => {
  try {
    const fullPath = filePath.startsWith('/uploads')
      ? path.join(UPLOADS_DIR, '..', filePath)
      : filePath;

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

const getVideoDuration = async (filePath) => {
  return null;
};

const getImageDimensions = async (filePath) => {
  return { width: null, height: null };
};

export {
  AVATARS_DIR,
  deleteLocalFile,
  generateUniqueFileName,
  getFileType,
  POSTS_DIR,
  REELS_DIR,
  saveFileLocally,
  saveMultipleFilesLocally,
  STORIES_DIR,
  UPLOADS_DIR,
};
