import { Router } from 'express';
import {
  createOrGetThread,
  deleteMessage,
  deleteThread,
  editMessage,
  endCall,
  getAllThreads,
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

const router = Router();

// All routes require authentication
router.use(verifyJwt);

// Get all threads (NEW)
router.route('/threads').get(getAllThreads);

// Unread count
router.route('/unread-count').get(getUnreadCount);

// Thread routes
router.route('/thread/:receiverId').post(createOrGetThread);
router.route('/thread/delete/:threadId').delete(deleteThread);

// Message routes
router.route('/message/send/:threadId').post(uploadMediaMiddleware, handleUploadError, sendMessage);
router.route('/message/delete/:messageId').delete(deleteMessage);
router.route('/message/edit/:messageId').put(editMessage);
router.route('/messages/:threadId').get(getMessages);
router.route('/messages/seen/:threadId').put(markMessagesAsSeen);

// Media upload route
router.route('/media/upload').post(uploadMultiple, handleUploadError, uploadChatMedia);

// Call routes
router.route('/call/request/:receiverId').post(requestCall);
router.route('/call/end/:callId').post(endCall);

export default router;
