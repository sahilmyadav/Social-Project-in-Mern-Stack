import crypto from 'crypto';
import { GroupCall } from '../models/groupCall.model.js';
import { GroupChat } from '../models/groupChat.model.js';
import { GroupMessage } from '../models/groupMessage.model.js';
import { Notification } from '../models/notification.model.js';
import { User } from '../models/user.model.js';
import { getIO } from '../socket/socket.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Initiate a group call
 */
export const initiateGroupCall = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;
  const { callType = 'audio', settings = {} } = req.body;

  // Validate group and membership
  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  }).populate('members.user', 'firstName lastName username profileImage avatar');

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  // Check if there's an active call in this group
  const existingCall = await GroupCall.findOne({
    groupId,
    status: { $in: ['initiated', 'ringing', 'ongoing'] },
  });

  if (existingCall) {
    throw new ApiError(400, 'There is already an active call in this group');
  }

  // Generate unique call ID
  const callId = `grp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

  // Create call with initiator
  const call = await GroupCall.create({
    callId,
    groupId,
    callType,
    initiator: userId,
    participants: [
      {
        user: userId,
        status: 'connected',
        joinedAt: new Date(),
        role: 'host',
        isAudioEnabled: true,
        isVideoEnabled: callType === 'video',
      },
    ],
    status: 'ringing',
    settings: {
      maxParticipants: settings.maxParticipants || 8,
      waitingRoomEnabled: settings.waitingRoomEnabled || false,
      muteOnJoin: settings.muteOnJoin || false,
      recordingEnabled: settings.recordingEnabled || false,
      screenSharingAllowed: settings.screenSharingAllowed !== false,
    },
    startedAt: new Date(),
    metrics: {
      peakParticipants: 1,
      totalJoins: 1,
    },
  });

  // Create system message in group
  const initiatorUser = await User.findById(userId).select('firstName lastName');
  await GroupMessage.create({
    groupId,
    senderId: userId,
    messageType: 'system',
    systemMessage: `${initiatorUser.firstName} ${initiatorUser.lastName} started a ${callType} call`,
    systemMessageType: 'call_started',
  });

  // Notify all group members
  const io = getIO();
  if (io) {
    group.members.forEach((member) => {
      if (member.user._id.toString() !== userId.toString()) {
        const memberSettings = member.settings || {};
        if (!memberSettings.muteCalls) {
          io.to(member.user._id.toString()).emit('incomingGroupCall', {
            callId: call.callId,
            groupId,
            groupName: group.name,
            groupAvatar: group.avatar,
            callType,
            initiator: {
              _id: userId,
              firstName: initiatorUser.firstName,
              lastName: initiatorUser.lastName,
            },
          });
        }
      }
    });
  }

  // Create notifications for members
  const notifications = group.members
    .filter((m) => m.user._id.toString() !== userId.toString())
    .map((member) => ({
      user_id: member.user._id,
      sender_id: userId,
      type: 'group_call',
      message: `${callType} call started in ${group.name}`,
      data: { groupId, callId: call.callId },
    }));

  await Notification.insertMany(notifications);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        callId: call.callId,
        groupId,
        callType,
        status: call.status,
        settings: call.settings,
      },
      'Group call initiated'
    )
  );
});

/**
 * Join a group call
 */
export const joinGroupCall = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { callId } = req.params;
  const { peerId } = req.body;

  const call = await GroupCall.findOne({
    callId,
    status: { $in: ['ringing', 'ongoing'] },
  });

  if (!call) {
    throw new ApiError(404, 'Call not found or has ended');
  }

  // Validate group membership
  const group = await GroupChat.findOne({
    _id: call.groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(403, 'You are not a member of this group');
  }

  // Check if waiting room is enabled
  if (call.settings.waitingRoomEnabled) {
    // Check if user is in waiting room
    const inWaitingRoom = call.waitingRoom.find((w) => w.user.toString() === userId.toString());

    if (!inWaitingRoom) {
      // Add to waiting room
      call.waitingRoom.push({
        user: userId,
        requestedAt: new Date(),
      });
      await call.save();

      // Notify host
      const io = getIO();
      if (io) {
        const user = await User.findById(userId).select('firstName lastName profileImage');
        io.to(call.initiator.toString()).emit('waitingRoomJoin', {
          callId,
          user: {
            _id: userId,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImage: user.profileImage,
          },
        });
      }

      return res
        .status(200)
        .json(new ApiResponse(200, { status: 'waiting' }, 'You are in the waiting room'));
    }
  }

  // Check max participants
  const activeParticipants = call.participants.filter((p) => p.status === 'connected');
  if (activeParticipants.length >= call.settings.maxParticipants) {
    throw new ApiError(400, 'Call is at maximum capacity');
  }

  // Add participant or update existing
  const existingParticipant = call.participants.find(
    (p) => p.user.toString() === userId.toString()
  );

  if (existingParticipant) {
    existingParticipant.status = 'connected';
    existingParticipant.joinedAt = new Date();
    existingParticipant.leftAt = null;
    existingParticipant.peerId = peerId;
    existingParticipant.isAudioEnabled = !call.settings.muteOnJoin;
    existingParticipant.isVideoEnabled = call.callType === 'video';
  } else {
    call.participants.push({
      user: userId,
      status: 'connected',
      joinedAt: new Date(),
      peerId,
      role: call.initiator.toString() === userId.toString() ? 'host' : 'participant',
      isAudioEnabled: !call.settings.muteOnJoin,
      isVideoEnabled: call.callType === 'video',
    });
    call.metrics.totalJoins += 1;
  }

  // Remove from waiting room if present
  call.waitingRoom = call.waitingRoom.filter((w) => w.user.toString() !== userId.toString());

  // Update status to ongoing if this is the second participant
  if (
    call.status === 'ringing' &&
    call.participants.filter((p) => p.status === 'connected').length >= 2
  ) {
    call.status = 'ongoing';
  }

  // Update peak participants
  const currentConnected = call.participants.filter((p) => p.status === 'connected').length;
  if (currentConnected > call.metrics.peakParticipants) {
    call.metrics.peakParticipants = currentConnected;
  }

  await call.save();

  // Get all connected participants with user info
  const populatedCall = await GroupCall.findById(call._id)
    .populate('participants.user', 'firstName lastName username profileImage avatar')
    .populate('initiator', 'firstName lastName username profileImage');

  // Notify other participants
  const io = getIO();
  if (io) {
    const user = await User.findById(userId).select('firstName lastName profileImage');

    call.participants
      .filter((p) => p.status === 'connected' && p.user.toString() !== userId.toString())
      .forEach((participant) => {
        io.to(participant.user.toString()).emit('participantJoined', {
          callId,
          participant: {
            _id: userId,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImage: user.profileImage,
            peerId,
          },
        });
      });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        callId: call.callId,
        groupId: call.groupId,
        callType: call.callType,
        status: call.status,
        participants: populatedCall.participants.filter((p) => p.status === 'connected'),
        settings: call.settings,
        initiator: populatedCall.initiator,
      },
      'Joined call successfully'
    )
  );
});

/**
 * Leave a group call
 */
export const leaveGroupCall = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { callId } = req.params;

  const call = await GroupCall.findOne({
    callId,
    'participants.user': userId,
    status: { $in: ['ringing', 'ongoing'] },
  });

  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  const participant = call.participants.find((p) => p.user.toString() === userId.toString());

  if (!participant) {
    throw new ApiError(400, 'You are not in this call');
  }

  // Update participant status
  participant.status = 'left';
  participant.leftAt = new Date();

  // Check if all participants have left
  const remainingParticipants = call.participants.filter((p) => p.status === 'connected');

  if (remainingParticipants.length === 0) {
    call.status = 'ended';
    call.endedAt = new Date();
    call.endReason = 'all_left';

    // Calculate duration
    call.duration = Math.floor((call.endedAt - call.startedAt) / 1000);
  }

  await call.save();

  // Notify remaining participants
  const io = getIO();
  if (io) {
    const user = await User.findById(userId).select('firstName lastName');

    remainingParticipants.forEach((p) => {
      io.to(p.user.toString()).emit('participantLeft', {
        callId,
        userId,
        userName: `${user.firstName} ${user.lastName}`,
      });
    });

    if (call.status === 'ended') {
      const group = await GroupChat.findById(call.groupId);
      group.members.forEach((member) => {
        io.to(member.user.toString()).emit('groupCallEnded', {
          callId,
          groupId: call.groupId,
          duration: call.duration,
        });
      });

      // Create system message
      await GroupMessage.create({
        groupId: call.groupId,
        senderId: call.initiator,
        messageType: 'system',
        systemMessage: `Call ended (${formatDuration(call.duration)})`,
        systemMessageType: 'call_ended',
      });
    }
  }

  return res.status(200).json(new ApiResponse(200, null, 'Left call successfully'));
});

/**
 * End a group call (host only)
 */
export const endGroupCall = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { callId } = req.params;

  const call = await GroupCall.findOne({
    callId,
    status: { $in: ['ringing', 'ongoing'] },
  });

  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // Check if user is host or admin
  const isHost = call.initiator.toString() === userId.toString();
  const group = await GroupChat.findById(call.groupId);
  const isAdmin = group?.isAdmin(userId);

  if (!isHost && !isAdmin) {
    throw new ApiError(403, 'Only the host or group admin can end the call');
  }

  // End call
  call.status = 'ended';
  call.endedAt = new Date();
  call.endReason = 'host_ended';
  call.duration = Math.floor((call.endedAt - call.startedAt) / 1000);

  // Mark all participants as left
  call.participants.forEach((p) => {
    if (p.status === 'connected') {
      p.status = 'left';
      p.leftAt = new Date();
    }
  });

  await call.save();

  // Notify all group members
  const io = getIO();
  if (io) {
    group.members.forEach((member) => {
      io.to(member.user.toString()).emit('groupCallEnded', {
        callId,
        groupId: call.groupId,
        duration: call.duration,
        endReason: 'host_ended',
      });
    });
  }

  // Create system message
  await GroupMessage.create({
    groupId: call.groupId,
    senderId: userId,
    messageType: 'system',
    systemMessage: `Call ended (${formatDuration(call.duration)})`,
    systemMessageType: 'call_ended',
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        duration: call.duration,
        peakParticipants: call.metrics.peakParticipants,
      },
      'Call ended'
    )
  );
});

/**
 * Toggle audio/video/screen share
 */
export const toggleMediaState = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { callId } = req.params;
  const { mediaType, enabled } = req.body;

  if (!['audio', 'video', 'screenShare'].includes(mediaType)) {
    throw new ApiError(400, 'Invalid media type');
  }

  const call = await GroupCall.findOne({
    callId,
    'participants.user': userId,
    'participants.status': 'connected',
    status: 'ongoing',
  });

  if (!call) {
    throw new ApiError(404, 'Call not found or you are not in it');
  }

  const participant = call.participants.find(
    (p) => p.user.toString() === userId.toString() && p.status === 'connected'
  );

  if (!participant) {
    throw new ApiError(400, 'You are not in this call');
  }

  // Update media state
  switch (mediaType) {
    case 'audio':
      participant.isAudioEnabled = enabled;
      break;
    case 'video':
      participant.isVideoEnabled = enabled;
      break;
    case 'screenShare':
      if (enabled && !call.settings.screenSharingAllowed) {
        throw new ApiError(403, 'Screen sharing is not allowed in this call');
      }
      // Only one person can screen share at a time
      if (enabled) {
        const currentSharer = call.participants.find(
          (p) => p.isScreenSharing && p.user.toString() !== userId.toString()
        );
        if (currentSharer) {
          throw new ApiError(400, 'Someone else is already sharing their screen');
        }
      }
      participant.isScreenSharing = enabled;
      break;
  }

  await call.save();

  // Notify other participants
  const io = getIO();
  if (io) {
    call.participants
      .filter((p) => p.status === 'connected')
      .forEach((p) => {
        io.to(p.user.toString()).emit('mediaStateChanged', {
          callId,
          userId,
          mediaType,
          enabled,
        });
      });
  }

  return res.status(200).json(new ApiResponse(200, { mediaType, enabled }, 'Media state updated'));
});

/**
 * Admit user from waiting room
 */
export const admitFromWaitingRoom = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { callId } = req.params;
  const { waitingUserId, admit = true } = req.body;

  const call = await GroupCall.findOne({
    callId,
    status: { $in: ['ringing', 'ongoing'] },
  });

  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // Check if requester is host
  if (call.initiator.toString() !== userId.toString()) {
    throw new ApiError(403, 'Only the host can admit users');
  }

  const waitingEntry = call.waitingRoom.find((w) => w.user.toString() === waitingUserId);

  if (!waitingEntry) {
    throw new ApiError(404, 'User not in waiting room');
  }

  // Remove from waiting room
  call.waitingRoom = call.waitingRoom.filter((w) => w.user.toString() !== waitingUserId);

  const io = getIO();

  if (admit) {
    // Add as participant
    call.participants.push({
      user: waitingUserId,
      status: 'connected',
      joinedAt: new Date(),
      role: 'participant',
      isAudioEnabled: !call.settings.muteOnJoin,
      isVideoEnabled: call.callType === 'video',
    });
    call.metrics.totalJoins += 1;

    // Update peak if needed
    const currentConnected = call.participants.filter((p) => p.status === 'connected').length;
    if (currentConnected > call.metrics.peakParticipants) {
      call.metrics.peakParticipants = currentConnected;
    }

    await call.save();

    // Notify admitted user
    if (io) {
      io.to(waitingUserId).emit('admittedToCall', { callId });
    }
  } else {
    await call.save();

    // Notify rejected user
    if (io) {
      io.to(waitingUserId).emit('callAdmissionDenied', { callId });
    }
  }

  return res.status(200).json(new ApiResponse(200, null, admit ? 'User admitted' : 'User denied'));
});

/**
 * Raise/lower hand
 */
export const toggleHandRaise = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { callId } = req.params;
  const { raised } = req.body;

  const call = await GroupCall.findOne({
    callId,
    'participants.user': userId,
    'participants.status': 'connected',
    status: 'ongoing',
  });

  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  const participant = call.participants.find(
    (p) => p.user.toString() === userId.toString() && p.status === 'connected'
  );

  if (!participant) {
    throw new ApiError(400, 'You are not in this call');
  }

  participant.isHandRaised = raised;
  if (raised) {
    participant.handRaisedAt = new Date();
  } else {
    participant.handRaisedAt = null;
  }

  await call.save();

  // Notify all participants
  const io = getIO();
  if (io) {
    call.participants
      .filter((p) => p.status === 'connected')
      .forEach((p) => {
        io.to(p.user.toString()).emit('handRaised', {
          callId,
          userId,
          raised,
        });
      });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { raised }, raised ? 'Hand raised' : 'Hand lowered'));
});

/**
 * Mute/unmute a participant (host only)
 */
export const muteParticipant = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { callId } = req.params;
  const { targetUserId, muted } = req.body;

  const call = await GroupCall.findOne({
    callId,
    status: 'ongoing',
  });

  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // Check if requester is host or co-host
  const requesterParticipant = call.participants.find(
    (p) => p.user.toString() === userId.toString() && p.status === 'connected'
  );

  if (!requesterParticipant || !['host', 'co-host'].includes(requesterParticipant.role)) {
    throw new ApiError(403, 'Only host or co-host can mute participants');
  }

  const targetParticipant = call.participants.find(
    (p) => p.user.toString() === targetUserId && p.status === 'connected'
  );

  if (!targetParticipant) {
    throw new ApiError(404, 'Participant not found');
  }

  targetParticipant.isAudioEnabled = !muted;
  await call.save();

  // Notify all participants
  const io = getIO();
  if (io) {
    call.participants
      .filter((p) => p.status === 'connected')
      .forEach((p) => {
        io.to(p.user.toString()).emit('participantMuted', {
          callId,
          userId: targetUserId,
          muted,
          by: userId,
        });
      });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, muted ? 'Participant muted' : 'Participant unmuted'));
});

/**
 * Start/stop recording (host only)
 */
export const toggleRecording = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { callId } = req.params;
  const { record } = req.body;

  const call = await GroupCall.findOne({
    callId,
    status: 'ongoing',
  });

  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // Check if requester is host
  if (call.initiator.toString() !== userId.toString()) {
    throw new ApiError(403, 'Only the host can control recording');
  }

  if (!call.settings.recordingEnabled && record) {
    throw new ApiError(400, 'Recording is not enabled for this call');
  }

  if (record) {
    call.recording = {
      isRecording: true,
      startedAt: new Date(),
      startedBy: userId,
    };
  } else if (call.recording?.isRecording) {
    call.recording.isRecording = false;
    call.recording.stoppedAt = new Date();
    // In production, you would save the recording file here
  }

  await call.save();

  // Notify all participants
  const io = getIO();
  if (io) {
    call.participants
      .filter((p) => p.status === 'connected')
      .forEach((p) => {
        io.to(p.user.toString()).emit('recordingStateChanged', {
          callId,
          isRecording: record,
          startedBy: userId,
        });
      });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isRecording: record },
        record ? 'Recording started' : 'Recording stopped'
      )
    );
});

/**
 * Get call info
 */
export const getCallInfo = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { callId } = req.params;

  const call = await GroupCall.findOne({ callId })
    .populate('participants.user', 'firstName lastName username profileImage avatar')
    .populate('initiator', 'firstName lastName username profileImage')
    .populate('waitingRoom.user', 'firstName lastName username profileImage');

  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // Check if user is member of the group
  const group = await GroupChat.findOne({
    _id: call.groupId,
    'members.user': userId,
  });

  if (!group) {
    throw new ApiError(403, 'You are not a member of this group');
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        callId: call.callId,
        groupId: call.groupId,
        callType: call.callType,
        status: call.status,
        initiator: call.initiator,
        participants: call.participants.filter((p) => p.status === 'connected'),
        waitingRoom: call.initiator.toString() === userId.toString() ? call.waitingRoom : undefined,
        settings: call.settings,
        startedAt: call.startedAt,
        duration:
          call.status === 'ongoing'
            ? Math.floor((Date.now() - call.startedAt) / 1000)
            : call.duration,
        recording: call.recording?.isRecording ? { isRecording: true } : null,
      },
      'Call info fetched'
    )
  );
});

/**
 * Get call history for a group
 */
export const getGroupCallHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;
  const { limit = 20, skip = 0 } = req.query;

  // Validate group membership
  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  const calls = await GroupCall.find({
    groupId,
    status: { $in: ['ended', 'missed'] },
  })
    .populate('initiator', 'firstName lastName username profileImage')
    .sort({ startedAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();

  const total = await GroupCall.countDocuments({
    groupId,
    status: { $in: ['ended', 'missed'] },
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        calls: calls.map((call) => ({
          callId: call.callId,
          callType: call.callType,
          initiator: call.initiator,
          startedAt: call.startedAt,
          duration: call.duration,
          participantCount: call.metrics?.peakParticipants,
          status: call.status,
        })),
        total,
        hasMore: parseInt(skip) + parseInt(limit) < total,
      },
      'Call history fetched'
    )
  );
});

/**
 * Check for active call in group
 */
export const getActiveCall = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;

  // Validate group membership
  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  const activeCall = await GroupCall.findOne({
    groupId,
    status: { $in: ['ringing', 'ongoing'] },
  })
    .populate('participants.user', 'firstName lastName username profileImage avatar')
    .populate('initiator', 'firstName lastName username profileImage');

  if (!activeCall) {
    return res.status(200).json(new ApiResponse(200, null, 'No active call'));
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        callId: activeCall.callId,
        callType: activeCall.callType,
        status: activeCall.status,
        initiator: activeCall.initiator,
        participantCount: activeCall.participants.filter((p) => p.status === 'connected').length,
        startedAt: activeCall.startedAt,
      },
      'Active call found'
    )
  );
});

// Helper function
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default {
  initiateGroupCall,
  joinGroupCall,
  leaveGroupCall,
  endGroupCall,
  toggleMediaState,
  admitFromWaitingRoom,
  toggleHandRaise,
  muteParticipant,
  toggleRecording,
  getCallInfo,
  getGroupCallHistory,
  getActiveCall,
};
