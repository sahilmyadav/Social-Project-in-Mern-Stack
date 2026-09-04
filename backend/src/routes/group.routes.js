import { Router } from 'express';
import {
  addMembers,
  createGroup,
  deleteGroup,
  deleteGroupMessage,
  forwardMessage,
  generateInviteLink,
  getGroupDetails,
  getGroupMedia,
  getGroupMessages,
  getMyGroups,
  getStarredMessages,
  joinViaInvite,
  reactToMessage,
  removeMember,
  searchGroupMessages,
  sendGroupMessage,
  starMessage,
  togglePinMessage,
  updateGroup,
  updateMemberRole,
  voteOnPoll,
} from '../controllers/group.controller.js';
import {
  admitFromWaitingRoom,
  endGroupCall,
  getActiveCall,
  getCallInfo,
  getGroupCallHistory,
  initiateGroupCall,
  joinGroupCall,
  leaveGroupCall,
  muteParticipant,
  toggleHandRaise,
  toggleMediaState,
  toggleRecording,
} from '../controllers/groupCall.controller.js';
import { verifyJwt } from '../middleware/auth.middleware.js';
import {
  handleUploadError,
  uploadGroupAvatar,
  uploadMultiple,
} from '../middleware/upload.middleware.js';

const router = Router();

// All routes require authentication
router.use(verifyJwt);

// ==================== GROUP MANAGEMENT ====================

// Create a new group
router.route('/').post(uploadGroupAvatar, handleUploadError, createGroup);

// Get user's groups
router.route('/').get(getMyGroups);

// Get single group details
router.route('/:groupId').get(getGroupDetails);

// Update group info (name, description, avatar, settings)
router.route('/:groupId').put(uploadGroupAvatar, handleUploadError, updateGroup);

// Delete group
router.route('/:groupId').delete(deleteGroup);

// ==================== MEMBER MANAGEMENT ====================

// Add members to group
router.route('/:groupId/members').post(addMembers);

// Remove member from group (or leave)
router.route('/:groupId/members/:memberId').delete(removeMember);

// Update member role (promote/demote)
router.route('/:groupId/members/:memberId/role').put(updateMemberRole);

// ==================== INVITE LINKS ====================

// Generate invite link
router.route('/:groupId/invite').post(generateInviteLink);

// Join via invite link
router.route('/join/:code').post(joinViaInvite);

// ==================== MESSAGES ====================

// Send message to group
router.route('/:groupId/messages').post(uploadMultiple, handleUploadError, sendGroupMessage);

// Get group messages with pagination
router.route('/:groupId/messages').get(getGroupMessages);

// React to message
router.route('/:groupId/messages/:messageId/react').post(reactToMessage);

// Delete message
router.route('/:groupId/messages/:messageId').delete(deleteGroupMessage);

// Forward message
router.route('/messages/:messageId/forward').post(forwardMessage);

// Pin/Unpin message
router.route('/:groupId/messages/:messageId/pin').put(togglePinMessage);

// Star message
router.route('/:groupId/messages/:messageId/star').put(starMessage);

// Vote on poll
router.route('/:groupId/messages/:messageId/vote').post(voteOnPoll);

// Search messages
router.route('/:groupId/search').get(searchGroupMessages);

// Get starred messages
router.route('/:groupId/starred').get(getStarredMessages);

// Get media gallery
router.route('/:groupId/media').get(getGroupMedia);

// ==================== GROUP CALLS ====================

// Initiate group call
router.route('/:groupId/call').post(initiateGroupCall);

// Get active call in group
router.route('/:groupId/call/active').get(getActiveCall);

// Get call history for group
router.route('/:groupId/call/history').get(getGroupCallHistory);

// Join group call
router.route('/call/:callId/join').post(joinGroupCall);

// Leave group call
router.route('/call/:callId/leave').post(leaveGroupCall);

// End group call (host only)
router.route('/call/:callId/end').post(endGroupCall);

// Get call info
router.route('/call/:callId').get(getCallInfo);

// Toggle audio/video/screen share
router.route('/call/:callId/media').put(toggleMediaState);

// Admit from waiting room (host only)
router.route('/call/:callId/admit').post(admitFromWaitingRoom);

// Raise/lower hand
router.route('/call/:callId/hand').put(toggleHandRaise);

// Mute participant (host only)
router.route('/call/:callId/mute').post(muteParticipant);

// Toggle recording (host only)
router.route('/call/:callId/recording').put(toggleRecording);

export default router;
