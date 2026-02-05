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

// File filter to accept images, videos, and documents
const fileFilter = (req, file, cb) => {
  // Allowed image formats
  const imageTypes = /jpeg|jpg|png|gif|webp|svg/;
  // Allowed video formats
  const videoTypes = /mp4|mov|avi|mkv|webm|flv/;
  // Allowed document formats
  const documentTypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|rtf|odt|ods|odp|zip|rar|7z/;

  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  // Check if file is image
  const isImage = imageTypes.test(extname.replace('.', '')) && mimetype.startsWith('image/');
  // Check if file is video
  const isVideo = videoTypes.test(extname.replace('.', '')) && mimetype.startsWith('video/');
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

  if (isImage || isVideo || isDocument) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Allowed: images (jpeg, jpg, png, gif, webp, svg), videos (mp4, mov, avi, mkv, webm, flv), documents (pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, zip, rar).'
      ),
      false
    );
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: Infinity, // No file size limit
  },
});

// Middleware for single file upload
export const uploadSingle = upload.single('file');

// Middleware for cover photo upload
export const uploadCoverPhoto = upload.single('coverPhoto');

// Middleware for multiple files upload (max 10 files)
export const uploadMultiple = upload.array('files', 10);

// Middleware for chat media (field name 'media', max 5 files)
export const uploadChatMedia = upload.array('media', 5);

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
        message: 'File upload failed. Please try again.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files.',
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
