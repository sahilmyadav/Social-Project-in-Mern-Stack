import { Router } from 'express';
import {
  createOrGetThread,
  deleteCallLog,
  deleteMessage,
  deleteThread,
  editMessage,
  endCall,
  getAllThreads,
  getCallHistory,
  getMessages,
  getUnreadCount,
  markMessagesAsSeen,
  requestCall,
  sendMessage,
  uploadChatMedia,
} from '../controllers/chat.controller.js';
import { verifyJwt } from '../middleware/auth.middleware.js';
import {
  handleUploadError,
  uploadChatMedia as uploadMediaMiddleware,
  uploadMultiple,
} from '../middleware/upload.middleware.js';
import { validateBody, validateObjectId } from '../middleware/validate.js';
import { editMessageSchema } from '../schemas/chat.schema.js';

const router = Router();

// All routes require authentication
router.use(verifyJwt);

// Get all threads (NEW)
router.route('/threads').get(getAllThreads);

// Unread count
router.route('/unread-count').get(getUnreadCount);

// Thread routes
router.route('/thread/:receiverId').post(validateObjectId('receiverId'), createOrGetThread);
router.route('/thread/delete/:threadId').delete(validateObjectId('threadId'), deleteThread);

// Message routes
router
  .route('/message/send/:threadId')
  .post(validateObjectId('threadId'), uploadMediaMiddleware, handleUploadError, sendMessage);
router.route('/message/delete/:messageId').delete(validateObjectId('messageId'), deleteMessage);
router
  .route('/message/edit/:messageId')
  .put(validateObjectId('messageId'), validateBody(editMessageSchema), editMessage);
router.route('/messages/:threadId').get(validateObjectId('threadId'), getMessages);
router.route('/messages/seen/:threadId').put(validateObjectId('threadId'), markMessagesAsSeen);

// Media upload route
router.route('/media/upload').post(uploadMultiple, handleUploadError, uploadChatMedia);

// Call routes
router.route('/call/request/:receiverId').post(requestCall);
router.route('/call/end/:callId').post(endCall);
router.route('/call/history').get(getCallHistory);
router.route('/call/delete/:callId').delete(deleteCallLog);

export default router;
