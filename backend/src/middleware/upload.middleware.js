import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  },
});

// File filter to accept images, videos, audio, and documents
const fileFilter = (req, file, cb) => {
  // Allowed image formats (SVG excluded — XSS risk via inline <script> tags)
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  // Allowed video formats
  const videoTypes = /mp4|mov|avi|mkv|webm|flv/;
  // Allowed audio formats
  const audioTypes = /mp3|wav|ogg|webm|m4a|aac|flac/;
  // Allowed document formats
  const documentTypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|rtf|odt|ods|odp|zip|rar|7z/;

  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  // Check if file is image
  const isImage = imageTypes.test(extname.replace('.', '')) && mimetype.startsWith('image/');
  // Check if file is video
  const isVideo = videoTypes.test(extname.replace('.', '')) && mimetype.startsWith('video/');
  // Check if file is audio
  const isAudio = audioTypes.test(extname.replace('.', '')) && mimetype.startsWith('audio/');
  // Check if file is document
  const isDocument =
    documentTypes.test(extname.replace('.', '')) &&
    (mimetype.startsWith('application/') ||
      mimetype.startsWith('text/') ||
      mimetype === 'application/pdf' ||
      mimetype === 'application/msword' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/vnd.ms-excel' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimetype === 'application/vnd.ms-powerpoint' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      mimetype === 'application/zip' ||
      mimetype === 'application/x-rar-compressed' ||
      mimetype === 'application/x-7z-compressed');

  if (isImage || isVideo || isAudio || isDocument) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Allowed: images (jpeg, jpg, png, gif, webp), videos (mp4, mov, avi, mkv, webm, flv), audio (mp3, wav, ogg, webm, m4a, aac, flac), documents (pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, zip, rar).'
      ),
      false
    );
  }
};

// File size limits: 50MB for general uploads, keeps server safe from abuse
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Max 10 files per request
  },
});

// Middleware for single file upload
export const uploadSingle = upload.single('file');

// Middleware for cover photo upload
export const uploadCoverPhoto = upload.single('coverPhoto');

// Middleware for multiple files upload (no limit per client request)
export const uploadMultiple = upload.array('files');

// Middleware for chat media (field name 'media')
export const uploadChatMedia = upload.array('media');

// Middleware for group avatar upload
export const uploadGroupAvatar = upload.single('avatar');

// Middleware for mixed uploads (single image + multiple images)
export const uploadMixed = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 },
  { name: 'videos', maxCount: 5 },
]);

// Error handling middleware for multer
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum file size is 50MB.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files per upload.',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

export default upload;
