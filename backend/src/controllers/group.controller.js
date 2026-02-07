import { GroupChat } from '../models/groupChat.model.js';
import { GroupMessage } from '../models/groupMessage.model.js';
import { Notification } from '../models/notification.model.js';
import { Post } from '../models/post.model.js';
import { Reel } from '../models/reel.model.js';
import { Story } from '../models/story.model.js';
import { User } from '../models/user.model.js';
import { getIO } from '../socket/socket.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { decryptMessage, encryptMessage } from '../utils/encryption.js';
import { deleteOnCloudinary, uploadOnCloudinary } from '../utils/localStorage.js';

// ==================== GROUP MANAGEMENT ====================

/**
 * Create a new group
 */
export const createGroup = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { name, description, type = 'private' } = req.body;

  // Parse memberIds - it comes as JSON string from FormData
  let memberIds = req.body.memberIds;
  if (typeof memberIds === 'string') {
    try {
      memberIds = JSON.parse(memberIds);
    } catch (e) {
      memberIds = [];
    }
  }

  if (!name || name.trim().length < 1) {
    throw new ApiError(400, 'Group name is required');
  }

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 1) {
    throw new ApiError(400, 'At least 1 member is required to create a group');
  }

  // Validate all member IDs exist
  const validMembers = await User.find({ _id: { $in: memberIds } }).select('_id');
  if (validMembers.length !== memberIds.length) {
    throw new ApiError(400, 'Some member IDs are invalid');
  }

  // Handle avatar upload if provided
  let avatarUrl = null;
  let avatarPublicId = null;
  if (req.file) {
    const uploadResult = await uploadOnCloudinary(req.file.path);
    if (uploadResult) {
      avatarUrl = uploadResult.secure_url || uploadResult.url;
      avatarPublicId = uploadResult.public_id;
    }
  }

  // Create group with creator as admin
  const members = [
    {
      user: userId,
      role: 'admin',
      joinedAt: new Date(),
    },
    ...memberIds.map((id) => ({
      user: id,
      role: 'member',
      addedBy: userId,
      joinedAt: new Date(),
    })),
  ];

  const group = await GroupChat.create({
    name: name.trim(),
    description: description?.trim(),
    avatar: avatarUrl,
    avatarPublicId,
    type,
    createdBy: userId,
    members,
    lastMessageAt: new Date(),
  });

  // Create system message for group creation
  const systemMessage = await GroupMessage.create({
    groupId: group._id,
    senderId: userId,
    messageType: 'system',
    systemMessage: `Group "${name}" created`,
    systemMessageType: 'group_created',
  });

  group.lastMessage = systemMessage._id;
  await group.save();

  // Populate for response
  const populatedGroup = await GroupChat.findById(group._id)
    .populate('members.user', 'firstName lastName username profileImage avatar isOnline')
    .populate('createdBy', 'firstName lastName username profileImage');

  // Notify all members via socket
  const io = getIO();
  if (io) {
    memberIds.forEach((memberId) => {
      io.to(memberId.toString()).emit('groupCreated', {
        group: populatedGroup,
      });
    });
  }

  // Create notifications for added members
  const notifications = memberIds.map((memberId) => ({
    recipient_id: memberId,
    sender_id: userId,
    type: 'group_added',
    title: 'Added to Group',
    message: `You were added to group "${name}"`,
    reference_id: group._id,
    reference_type: 'Group',
    metadata: { groupId: group._id },
  }));

  try {
    await Notification.insertMany(notifications);
  } catch (notifError) {
    console.log('Failed to create group notifications:', notifError.message);
  }

  return res.status(201).json(new ApiResponse(201, populatedGroup, 'Group created successfully'));
});

/**
 * Get user's groups
 */
export const getMyGroups = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit = 50, skip = 0, search } = req.query;

  const query = {
    'members.user': userId,
    isDeleted: false,
  };

  if (search) {
    query.$text = { $search: search };
  }

  const groups = await GroupChat.find(query)
    .populate('members.user', 'firstName lastName username profileImage avatar isOnline')
    .populate('lastMessage', 'encryptedContent messageType createdAt senderId')
    .populate('createdBy', 'firstName lastName username')
    .sort({ lastMessageAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();

  // Transform groups with decrypted last message and unread count
  const transformedGroups = groups.map((group) => {
    const member = group.members.find((m) => m.user._id.toString() === userId.toString());
    let lastMessageText = null;

    if (group.lastMessage?.encryptedContent) {
      try {
        lastMessageText = decryptMessage(group.lastMessage.encryptedContent);
      } catch {
        lastMessageText = '[Unable to decrypt]';
      }
    }

    return {
      ...group,
      myRole: member?.role,
      unreadCount: member?.unreadCount || 0,
      isMuted: member?.isMuted || false,
      lastMessage: group.lastMessage
        ? {
            ...group.lastMessage,
            text: lastMessageText,
          }
        : null,
    };
  });

  const total = await GroupChat.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        groups: transformedGroups,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + parseInt(limit) < total,
      },
      'Groups fetched successfully'
    )
  );
});

/**
 * Get single group details
 */
export const getGroupDetails = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  })
    .populate('members.user', 'firstName lastName username profileImage avatar isOnline lastSeen')
    .populate('createdBy', 'firstName lastName username profileImage')
    .populate({
      path: 'pinnedMessages',
      populate: { path: 'senderId', select: 'firstName lastName username profileImage' },
    });

  if (!group) {
    throw new ApiError(404, 'Group not found or you are not a member');
  }

  return res.status(200).json(new ApiResponse(200, group, 'Group details fetched'));
});

/**
 * Update group info
 */
export const updateGroup = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;
  const { name, description, settings } = req.body;

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  if (!group.canEditGroupInfo(userId)) {
    throw new ApiError(403, 'You do not have permission to edit group info');
  }

  const updates = [];

  if (name && name !== group.name) {
    group.name = name.trim();
    updates.push('name');
  }

  if (description !== undefined && description !== group.description) {
    group.description = description?.trim() || '';
    updates.push('description');
  }

  // Handle avatar upload
  if (req.file) {
    // Delete old avatar
    if (group.avatarPublicId) {
      await deleteOnCloudinary(group.avatarPublicId);
    }
    const uploadResult = await uploadOnCloudinary(req.file.path);
    if (uploadResult) {
      group.avatar = uploadResult.secure_url || uploadResult.url;
      group.avatarPublicId = uploadResult.public_id;
      updates.push('photo');
    }
  }

  // Update settings
  if (settings) {
    group.settings = { ...group.settings.toObject(), ...settings };
    updates.push('settings');
  }

  await group.save();

  // Create system messages for updates
  if (updates.length > 0) {
    const user = await User.findById(userId).select('firstName lastName');
    const userName = `${user.firstName} ${user.lastName}`;

    for (const update of updates) {
      let msgType, msgText;
      switch (update) {
        case 'name':
          msgType = 'group_name_changed';
          msgText = `${userName} changed the group name to "${group.name}"`;
          break;
        case 'description':
          msgType = 'group_description_changed';
          msgText = `${userName} changed the group description`;
          break;
        case 'photo':
          msgType = 'group_photo_changed';
          msgText = `${userName} changed the group photo`;
          break;
        case 'settings':
          msgType = 'settings_changed';
          msgText = `${userName} changed group settings`;
          break;
      }

      await GroupMessage.create({
        groupId: group._id,
        senderId: userId,
        messageType: 'system',
        systemMessage: msgText,
        systemMessageType: msgType,
      });
    }
  }

  // Notify members
  const io = getIO();
  if (io) {
    group.members.forEach((member) => {
      io.to(member.user.toString()).emit('groupUpdated', {
        groupId: group._id,
        updates,
        group,
      });
    });
  }

  const populated = await GroupChat.findById(groupId).populate(
    'members.user',
    'firstName lastName username profileImage avatar'
  );

  return res.status(200).json(new ApiResponse(200, populated, 'Group updated successfully'));
});

/**
 * Add members to group
 */
export const addMembers = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;
  const { memberIds } = req.body;

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    throw new ApiError(400, 'Member IDs are required');
  }

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  if (!group.canAddMembers(userId)) {
    throw new ApiError(403, 'You do not have permission to add members');
  }

  // Check max members
  if (group.members.length + memberIds.length > group.settings.maxMembers) {
    throw new ApiError(400, `Group can have maximum ${group.settings.maxMembers} members`);
  }

  // Filter out existing members
  const existingMemberIds = group.members.map((m) => m.user.toString());
  const newMemberIds = memberIds.filter((id) => !existingMemberIds.includes(id));

  if (newMemberIds.length === 0) {
    throw new ApiError(400, 'All specified users are already members');
  }

  // Validate new members exist
  const validUsers = await User.find({ _id: { $in: newMemberIds } }).select(
    '_id firstName lastName'
  );

  // Add new members
  const newMembers = validUsers.map((user) => ({
    user: user._id,
    role: 'member',
    addedBy: userId,
    joinedAt: new Date(),
  }));

  group.members.push(...newMembers);
  await group.save();

  // Create system messages
  const adder = await User.findById(userId).select('firstName lastName');
  const adderName = `${adder.firstName} ${adder.lastName}`;

  for (const user of validUsers) {
    await GroupMessage.create({
      groupId: group._id,
      senderId: userId,
      messageType: 'system',
      systemMessage: `${adderName} added ${user.firstName} ${user.lastName}`,
      systemMessageType: 'member_added',
    });
  }

  // Notify new members
  const io = getIO();
  if (io) {
    newMemberIds.forEach((memberId) => {
      io.to(memberId.toString()).emit('addedToGroup', { group });
    });

    // Notify existing members
    group.members.forEach((member) => {
      io.to(member.user.toString()).emit('groupMembersUpdated', {
        groupId: group._id,
        action: 'added',
        members: newMembers,
      });
    });
  }

  const populated = await GroupChat.findById(groupId).populate(
    'members.user',
    'firstName lastName username profileImage avatar'
  );

  return res.status(200).json(new ApiResponse(200, populated, 'Members added successfully'));
});

/**
 * Remove member from group
 */
export const removeMember = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId, memberId } = req.params;

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  const isAdmin = group.isAdmin(userId);
  const isSelf = memberId === userId.toString();

  if (!isAdmin && !isSelf) {
    throw new ApiError(403, 'Only admins can remove members');
  }

  // Cannot remove if target is admin and remover is not admin
  const targetMember = group.members.find((m) => m.user.toString() === memberId);
  if (!targetMember) {
    throw new ApiError(404, 'Member not found in group');
  }

  if (
    targetMember.role === 'admin' &&
    !isSelf &&
    group.members.filter((m) => m.role === 'admin').length === 1
  ) {
    throw new ApiError(400, 'Cannot remove the only admin. Transfer admin first.');
  }

  // Remove member
  group.members = group.members.filter((m) => m.user.toString() !== memberId);
  await group.save();

  // Create system message
  const remover = await User.findById(userId).select('firstName lastName');
  const removed = await User.findById(memberId).select('firstName lastName');

  const systemMessage = isSelf
    ? `${removed.firstName} ${removed.lastName} left the group`
    : `${remover.firstName} ${remover.lastName} removed ${removed.firstName} ${removed.lastName}`;

  await GroupMessage.create({
    groupId: group._id,
    senderId: userId,
    messageType: 'system',
    systemMessage,
    systemMessageType: isSelf ? 'member_left' : 'member_removed',
  });

  // Notify via socket
  const io = getIO();
  if (io) {
    io.to(memberId).emit('removedFromGroup', { groupId: group._id });
    group.members.forEach((member) => {
      io.to(member.user.toString()).emit('groupMembersUpdated', {
        groupId: group._id,
        action: 'removed',
        memberId,
      });
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, null, isSelf ? 'Left group successfully' : 'Member removed successfully')
    );
});

/**
 * Update member role (promote/demote admin)
 */
export const updateMemberRole = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId, memberId } = req.params;
  const { role } = req.body;

  if (!['admin', 'moderator', 'member'].includes(role)) {
    throw new ApiError(400, 'Invalid role');
  }

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  if (!group.isAdmin(userId)) {
    throw new ApiError(403, 'Only admins can change roles');
  }

  const member = group.members.find((m) => m.user.toString() === memberId);
  if (!member) {
    throw new ApiError(404, 'Member not found');
  }

  const oldRole = member.role;
  member.role = role;
  await group.save();

  // System message
  const admin = await User.findById(userId).select('firstName lastName');
  const target = await User.findById(memberId).select('firstName lastName');

  const action = role === 'admin' ? 'promoted' : 'demoted';
  await GroupMessage.create({
    groupId: group._id,
    senderId: userId,
    messageType: 'system',
    systemMessage: `${admin.firstName} ${admin.lastName} ${action} ${target.firstName} ${target.lastName} to ${role}`,
    systemMessageType: role === 'admin' ? 'admin_promoted' : 'admin_demoted',
  });

  // Notify
  const io = getIO();
  if (io) {
    io.to(memberId).emit('roleChanged', { groupId: group._id, role });
    group.members.forEach((m) => {
      io.to(m.user.toString()).emit('groupMembersUpdated', {
        groupId: group._id,
        action: 'roleChanged',
        memberId,
        role,
      });
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { memberId, role }, 'Role updated successfully'));
});

/**
 * Generate invite link
 */
export const generateInviteLink = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;
  const { expiresIn, usageLimit } = req.body;

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  if (!group.isAdmin(userId)) {
    throw new ApiError(403, 'Only admins can generate invite links');
  }

  if (!group.settings.linkSharingEnabled) {
    throw new ApiError(400, 'Link sharing is disabled for this group');
  }

  let expiresAt = null;
  if (expiresIn) {
    expiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  const code = await group.generateInviteLink(userId, { expiresAt, usageLimit });

  const inviteUrl = `${process.env.FRONTEND_URL}/join-group/${code}`;

  return res
    .status(200)
    .json(
      new ApiResponse(200, { code, inviteUrl, expiresAt, usageLimit }, 'Invite link generated')
    );
});

/**
 * Join group via invite link
 */
export const joinViaInvite = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { code } = req.params;

  const group = await GroupChat.findOne({
    'inviteLink.code': code,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Invalid or expired invite link');
  }

  // Check if already a member
  if (group.isMember(userId)) {
    throw new ApiError(400, 'You are already a member of this group');
  }

  // Check expiration
  if (group.inviteLink.expiresAt && group.inviteLink.expiresAt < new Date()) {
    throw new ApiError(400, 'Invite link has expired');
  }

  // Check usage limit
  if (group.inviteLink.usageLimit && group.inviteLink.usageCount >= group.inviteLink.usageLimit) {
    throw new ApiError(400, 'Invite link usage limit reached');
  }

  // Check max members
  if (group.members.length >= group.settings.maxMembers) {
    throw new ApiError(400, 'Group has reached maximum members');
  }

  // Check if approval required
  if (group.settings.approvalRequired) {
    // Add to pending requests
    group.pendingRequests.push({
      user: userId,
      requestedAt: new Date(),
    });
    await group.save();

    // Notify admins
    const io = getIO();
    const admins = group.members.filter((m) => m.role === 'admin');
    admins.forEach((admin) => {
      io.to(admin.user.toString()).emit('joinRequest', {
        groupId: group._id,
        userId,
      });
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { status: 'pending' },
          'Join request sent. Waiting for admin approval.'
        )
      );
  }

  // Add member
  group.members.push({
    user: userId,
    role: 'member',
    joinedAt: new Date(),
  });
  group.inviteLink.usageCount += 1;
  await group.save();

  // System message
  const user = await User.findById(userId).select('firstName lastName');
  await GroupMessage.create({
    groupId: group._id,
    senderId: userId,
    messageType: 'system',
    systemMessage: `${user.firstName} ${user.lastName} joined via invite link`,
    systemMessageType: 'member_added',
  });

  // Notify members
  const io = getIO();
  if (io) {
    group.members.forEach((member) => {
      io.to(member.user.toString()).emit('groupMembersUpdated', {
        groupId: group._id,
        action: 'joined',
        member: { user: userId },
      });
    });
  }

  const populated = await GroupChat.findById(group._id).populate(
    'members.user',
    'firstName lastName username profileImage avatar'
  );

  return res.status(200).json(new ApiResponse(200, populated, 'Joined group successfully'));
});

/**
 * Delete group (admin only)
 */
export const deleteGroup = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  if (!group.isAdmin(userId)) {
    throw new ApiError(403, 'Only admins can delete the group');
  }

  group.isDeleted = true;
  group.deletedAt = new Date();
  await group.save();

  // Notify all members
  const io = getIO();
  if (io) {
    group.members.forEach((member) => {
      io.to(member.user.toString()).emit('groupDeleted', { groupId: group._id });
    });
  }

  return res.status(200).json(new ApiResponse(200, null, 'Group deleted successfully'));
});

// ==================== MESSAGING ====================

/**
 * Send message to group
 */
export const sendGroupMessage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;
  const {
    text,
    messageType = 'text',
    replyTo,
    mentions = [],
    sharedContent,
    location,
    contact,
    poll,
    isForwarded,
  } = req.body;

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  if (!group.canSendMessage(userId)) {
    throw new ApiError(403, 'You cannot send messages in this group');
  }

  // Handle file uploads
  const files = req.files || [];
  let mediaData = [];

  if (files.length > 0) {
    const uploadPromises = files.map((file) => uploadOnCloudinary(file.path));
    const uploadResults = await Promise.all(uploadPromises);

    mediaData = uploadResults.filter(Boolean).map((result, i) => {
      const file = files[i];
      const isVideo = file.mimetype.startsWith('video/');
      const isAudio = file.mimetype.startsWith('audio/');
      const isImage = file.mimetype.startsWith('image/');

      return {
        type: isVideo ? 'video' : isAudio ? 'audio' : isImage ? 'image' : 'file',
        url: result.secure_url || result.url,
        publicId: result.public_id,
        filename: result.public_id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        duration: result.duration,
        thumbnail: result.eager?.[0]?.secure_url,
        width: result.width,
        height: result.height,
      };
    });
  }

  // Build message data
  const messageData = {
    groupId: group._id,
    senderId: userId,
    messageType: mediaData.length > 0 ? mediaData[0].type : messageType,
    media: mediaData,
    mentions,
    isForwarded: isForwarded || false,
  };

  // Encrypt text content
  if (text) {
    messageData.encryptedContent = encryptMessage(text);
  }

  // Reply
  if (replyTo) {
    messageData.replyTo = replyTo;
  }

  // Shared content (post/reel/story)
  if (sharedContent) {
    messageData.sharedContent = sharedContent;
    messageData.messageType = `shared_${sharedContent.contentType}`;

    // Fetch preview data
    let content;
    switch (sharedContent.contentType) {
      case 'post':
        content = await Post.findById(sharedContent.contentId).populate(
          'user_id',
          'username profileImage'
        );
        break;
      case 'reel':
        content = await Reel.findById(sharedContent.contentId).populate(
          'user_id',
          'username profileImage'
        );
        break;
      case 'story':
        content = await Story.findById(sharedContent.contentId).populate(
          'user_id',
          'username profileImage'
        );
        break;
    }

    if (content) {
      messageData.sharedContent.preview = {
        thumbnail: content.media?.[0]?.thumbnail || content.media?.[0]?.url,
        caption: content.caption,
        author: {
          _id: content.user_id._id,
          username: content.user_id.username,
          profileImage: content.user_id.profileImage,
        },
      };
    }
  }

  // Location
  if (location) {
    messageData.location = {
      type: 'Point',
      coordinates: [location.longitude, location.latitude],
      address: location.address,
      name: location.name,
      isLive: location.isLive || false,
      expiresAt: location.isLive ? new Date(Date.now() + (location.duration || 3600) * 1000) : null,
    };
    messageData.messageType = location.isLive ? 'live_location' : 'location';
  }

  // Contact
  if (contact) {
    messageData.contact = contact;
    messageData.messageType = 'contact';
  }

  // Poll
  if (poll) {
    messageData.poll = {
      question: poll.question,
      options: poll.options.map((opt, i) => ({
        id: `opt_${i}`,
        text: opt,
        votes: [],
      })),
      allowMultiple: poll.allowMultiple || false,
      expiresAt: poll.expiresAt,
      isAnonymous: poll.isAnonymous || false,
    };
    messageData.messageType = 'poll';
  }

  // Disappearing message
  if (group.settings.disappearingMessages?.enabled) {
    messageData.expiresAt = new Date(
      Date.now() + group.settings.disappearingMessages.duration * 1000
    );
  }

  // Create message
  const message = await GroupMessage.create(messageData);

  // Update group
  group.lastMessage = message._id;
  group.lastMessageAt = new Date();
  group.totalMessages += 1;

  // Update unread counts for other members
  group.members.forEach((member) => {
    if (member.user.toString() !== userId.toString()) {
      member.unreadCount = (member.unreadCount || 0) + 1;
    }
  });
  await group.save();

  // Populate message for response
  const populatedMessage = await GroupMessage.findById(message._id)
    .populate('senderId', 'firstName lastName username profileImage avatar')
    .populate({
      path: 'replyTo',
      select: 'encryptedContent messageType senderId',
      populate: {
        path: 'senderId',
        select: 'firstName lastName username',
      },
    })
    .populate('mentions', 'firstName lastName username');

  // Emit to all group members
  const io = getIO();
  if (io) {
    // Decrypt for sending via socket
    const msgObj = populatedMessage.toObject();

    // Decrypt replyTo content if present
    let replyToData = msgObj.replyTo;
    if (replyToData && replyToData.encryptedContent) {
      try {
        replyToData = {
          ...replyToData,
          text: decryptMessage(replyToData.encryptedContent),
          senderName: replyToData.senderId?.firstName
            ? `${replyToData.senderId.firstName} ${replyToData.senderId.lastName || ''}`.trim()
            : 'Unknown',
        };
      } catch {
        replyToData = { ...replyToData, text: '[Unable to decrypt]', senderName: 'Unknown' };
      }
    }

    const decryptedMessage = {
      ...msgObj,
      text: text || null,
      replyTo: replyToData,
    };

    group.members.forEach((member) => {
      io.to(member.user.toString()).emit('groupMessage', {
        groupId: group._id,
        message: decryptedMessage,
      });
    });

    // Send mention notifications
    if (mentions.length > 0) {
      mentions.forEach((mentionedUserId) => {
        io.to(mentionedUserId.toString()).emit('mentioned', {
          groupId: group._id,
          messageId: message._id,
          by: userId,
        });
      });
    }
  }

  return res.status(201).json(new ApiResponse(201, populatedMessage, 'Message sent'));
});

/**
 * Get group messages with pagination
 */
export const getGroupMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;
  const { limit = 50, before, after } = req.query;

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  const query = {
    groupId,
    $and: [{ $or: [{ isDeleted: false }, { deletedFor: { $ne: userId } }] }],
  };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }
  if (after) {
    query.createdAt = { ...query.createdAt, $gt: new Date(after) };
  }

  const messages = await GroupMessage.find(query)
    .populate('senderId', 'firstName lastName username profileImage avatar')
    .populate({
      path: 'replyTo',
      select: 'encryptedContent messageType senderId',
      populate: {
        path: 'senderId',
        select: 'firstName lastName username',
      },
    })
    .populate('mentions', 'firstName lastName username')
    .populate('reactions.user', 'firstName lastName username profileImage')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  // Decrypt messages and replyTo content
  const decryptedMessages = messages.map((msg) => {
    let text = null;
    if (msg.encryptedContent) {
      try {
        text = decryptMessage(msg.encryptedContent);
      } catch {
        text = '[Unable to decrypt]';
      }
    }

    // Also decrypt replyTo content
    let replyTo = msg.replyTo;
    if (replyTo && replyTo.encryptedContent) {
      try {
        replyTo = {
          ...replyTo,
          text: decryptMessage(replyTo.encryptedContent),
          senderName: replyTo.senderId?.firstName
            ? `${replyTo.senderId.firstName} ${replyTo.senderId.lastName || ''}`.trim()
            : 'Unknown',
        };
      } catch {
        replyTo = { ...replyTo, text: '[Unable to decrypt]', senderName: 'Unknown' };
      }
    }

    return { ...msg, text, replyTo };
  });

  // Mark as read
  const member = group.members.find((m) => m.user.toString() === userId.toString());
  if (member) {
    member.unreadCount = 0;
    member.lastSeen = new Date();
    await group.save();
  }

  // Update read receipts
  const messageIds = messages.map((m) => m._id);
  await GroupMessage.updateMany(
    {
      _id: { $in: messageIds },
      'readBy.user': { $ne: userId },
    },
    {
      $push: { readBy: { user: userId, readAt: new Date() } },
    }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        messages: decryptedMessages.reverse(),
        hasMore: messages.length === parseInt(limit),
      },
      'Messages fetched'
    )
  );
});

/**
 * React to message
 */
export const reactToMessage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId, messageId } = req.params;
  const { emoji } = req.body;

  if (!emoji) {
    throw new ApiError(400, 'Emoji is required');
  }

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  const message = await GroupMessage.findOne({
    _id: messageId,
    groupId,
    isDeleted: false,
  });

  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  // Remove existing reaction from this user
  message.reactions = message.reactions.filter((r) => r.user.toString() !== userId.toString());

  // Add new reaction
  message.reactions.push({
    user: userId,
    emoji,
    reactedAt: new Date(),
  });

  await message.save();

  // Notify group members
  const io = getIO();
  if (io) {
    group.members.forEach((member) => {
      io.to(member.user.toString()).emit('messageReaction', {
        groupId,
        messageId,
        userId,
        emoji,
      });
    });
  }

  return res.status(200).json(new ApiResponse(200, { messageId, emoji }, 'Reaction added'));
});

/**
 * Delete message
 */
export const deleteGroupMessage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId, messageId } = req.params;
  const { deleteForEveryone = false } = req.body;

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  const message = await GroupMessage.findOne({
    _id: messageId,
    groupId,
  });

  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  const isOwner = message.senderId.toString() === userId.toString();
  const isAdmin = group.isAdmin(userId);

  if (deleteForEveryone) {
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'Only message owner or admin can delete for everyone');
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    await message.save();

    // Notify everyone
    const io = getIO();
    if (io) {
      group.members.forEach((member) => {
        io.to(member.user.toString()).emit('messageDeleted', {
          groupId,
          messageId,
          deletedForEveryone: true,
        });
      });
    }
  } else {
    // Delete for me only
    message.deletedFor.push(userId);
    await message.save();
  }

  return res.status(200).json(new ApiResponse(200, null, 'Message deleted'));
});

/**
 * Forward message
 */
export const forwardMessage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { messageId } = req.params;
  const { targetGroupIds } = req.body;

  if (!targetGroupIds || !Array.isArray(targetGroupIds) || targetGroupIds.length === 0) {
    throw new ApiError(400, 'Target groups are required');
  }

  const originalMessage = await GroupMessage.findById(messageId);
  if (!originalMessage || originalMessage.isDeleted) {
    throw new ApiError(404, 'Message not found');
  }

  const forwardedMessages = [];

  for (const targetGroupId of targetGroupIds) {
    const targetGroup = await GroupChat.findOne({
      _id: targetGroupId,
      'members.user': userId,
      isDeleted: false,
    });

    if (!targetGroup || !targetGroup.canSendMessage(userId)) {
      continue;
    }

    const forwardedMessage = await GroupMessage.create({
      groupId: targetGroupId,
      senderId: userId,
      messageType: originalMessage.messageType,
      encryptedContent: originalMessage.encryptedContent,
      media: originalMessage.media,
      sharedContent: originalMessage.sharedContent,
      location: originalMessage.location,
      contact: originalMessage.contact,
      isForwarded: true,
      forwardedFrom: {
        groupId: originalMessage.groupId,
        messageId: originalMessage._id,
      },
    });

    // Update original message forward count
    originalMessage.forwardCount += 1;

    // Update target group
    targetGroup.lastMessage = forwardedMessage._id;
    targetGroup.lastMessageAt = new Date();
    await targetGroup.save();

    forwardedMessages.push(forwardedMessage);

    // Notify target group members
    const io = getIO();
    if (io) {
      const populated = await GroupMessage.findById(forwardedMessage._id).populate(
        'senderId',
        'firstName lastName username profileImage'
      );

      targetGroup.members.forEach((member) => {
        io.to(member.user.toString()).emit('groupMessage', {
          groupId: targetGroupId,
          message: populated,
        });
      });
    }
  }

  await originalMessage.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { forwardedCount: forwardedMessages.length }, 'Message forwarded'));
});

/**
 * Pin/Unpin message
 */
export const togglePinMessage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId, messageId } = req.params;

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  if (!group.isModerator(userId)) {
    throw new ApiError(403, 'Only admins/moderators can pin messages');
  }

  const message = await GroupMessage.findOne({
    _id: messageId,
    groupId,
    isDeleted: false,
  });

  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  if (message.isPinned) {
    // Unpin
    message.isPinned = false;
    message.pinnedBy = null;
    message.pinnedAt = null;
    group.pinnedMessages = group.pinnedMessages.filter((id) => id.toString() !== messageId);
  } else {
    // Check max pinned
    if (group.pinnedMessages.length >= group.settings.maxPinnedMessages) {
      throw new ApiError(
        400,
        `Maximum ${group.settings.maxPinnedMessages} pinned messages allowed`
      );
    }

    // Pin
    message.isPinned = true;
    message.pinnedBy = userId;
    message.pinnedAt = new Date();
    group.pinnedMessages.push(messageId);
  }

  await Promise.all([message.save(), group.save()]);

  // System message
  const user = await User.findById(userId).select('firstName lastName');
  await GroupMessage.create({
    groupId,
    senderId: userId,
    messageType: 'system',
    systemMessage: `${user.firstName} ${user.lastName} ${message.isPinned ? 'pinned' : 'unpinned'} a message`,
    systemMessageType: message.isPinned ? 'message_pinned' : 'message_unpinned',
  });

  // Notify
  const io = getIO();
  if (io) {
    group.members.forEach((member) => {
      io.to(member.user.toString()).emit('messagePinned', {
        groupId,
        messageId,
        isPinned: message.isPinned,
      });
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isPinned: message.isPinned },
        message.isPinned ? 'Message pinned' : 'Message unpinned'
      )
    );
});

/**
 * Star message
 */
export const starMessage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId, messageId } = req.params;

  const message = await GroupMessage.findOne({
    _id: messageId,
    groupId,
    isDeleted: false,
  });

  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  const isStarred = message.starredBy.includes(userId);

  if (isStarred) {
    message.starredBy = message.starredBy.filter((id) => id.toString() !== userId.toString());
  } else {
    message.starredBy.push(userId);
  }

  await message.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isStarred: !isStarred },
        !isStarred ? 'Message starred' : 'Message unstarred'
      )
    );
});

/**
 * Vote on poll
 */
export const voteOnPoll = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId, messageId } = req.params;
  const { optionIds } = req.body;

  if (!optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
    throw new ApiError(400, 'Option IDs are required');
  }

  const message = await GroupMessage.findOne({
    _id: messageId,
    groupId,
    messageType: 'poll',
    isDeleted: false,
  });

  if (!message) {
    throw new ApiError(404, 'Poll not found');
  }

  if (message.poll.expiresAt && message.poll.expiresAt < new Date()) {
    throw new ApiError(400, 'Poll has expired');
  }

  if (!message.poll.allowMultiple && optionIds.length > 1) {
    throw new ApiError(400, 'Only one vote allowed');
  }

  // Remove previous votes
  message.poll.options.forEach((opt) => {
    opt.votes = opt.votes.filter((v) => v.toString() !== userId.toString());
  });

  // Add new votes
  optionIds.forEach((optId) => {
    const option = message.poll.options.find((o) => o.id === optId);
    if (option) {
      option.votes.push(userId);
    }
  });

  await message.save();

  // Notify
  const io = getIO();
  const group = await GroupChat.findById(groupId);
  if (io && group) {
    group.members.forEach((member) => {
      io.to(member.user.toString()).emit('pollVoteUpdated', {
        groupId,
        messageId,
        poll: message.poll.isAnonymous
          ? {
              ...message.poll.toObject(),
              options: message.poll.options.map((o) => ({
                ...o.toObject(),
                voteCount: o.votes.length,
                votes: [], // Hide voters for anonymous
              })),
            }
          : message.poll,
      });
    });
  }

  return res.status(200).json(new ApiResponse(200, message.poll, 'Vote recorded'));
});

/**
 * Search messages in group
 */
export const searchGroupMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;
  const { query, type, from, limit = 20 } = req.query;

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  const searchQuery = {
    groupId,
    isDeleted: false,
    deletedFor: { $ne: userId },
  };

  if (query) {
    searchQuery.$text = { $search: query };
  }

  if (type) {
    searchQuery.messageType = type;
  }

  if (from) {
    searchQuery.senderId = from;
  }

  const messages = await GroupMessage.find(searchQuery)
    .populate('senderId', 'firstName lastName username profileImage')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  // Decrypt
  const decrypted = messages.map((msg) => {
    let text = null;
    if (msg.encryptedContent) {
      try {
        text = decryptMessage(msg.encryptedContent);
      } catch {
        text = null;
      }
    }
    return { ...msg, text };
  });

  return res.status(200).json(new ApiResponse(200, decrypted, 'Search results'));
});

/**
 * Get starred messages
 */
export const getStarredMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;
  const { limit = 50 } = req.query;

  const messages = await GroupMessage.find({
    groupId,
    starredBy: userId,
    isDeleted: false,
  })
    .populate('senderId', 'firstName lastName username profileImage')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  const decrypted = messages.map((msg) => {
    let text = null;
    if (msg.encryptedContent) {
      try {
        text = decryptMessage(msg.encryptedContent);
      } catch {
        text = null;
      }
    }
    return { ...msg, text };
  });

  return res.status(200).json(new ApiResponse(200, decrypted, 'Starred messages'));
});

/**
 * Get media gallery
 */
export const getGroupMedia = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;
  const { type = 'all', limit = 50, skip = 0 } = req.query;

  const group = await GroupChat.findOne({
    _id: groupId,
    'members.user': userId,
    isDeleted: false,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  const query = {
    groupId,
    isDeleted: false,
    'media.0': { $exists: true },
  };

  if (type !== 'all') {
    query['media.type'] = type;
  }

  const messages = await GroupMessage.find(query)
    .populate('senderId', 'firstName lastName username profileImage')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();

  // Flatten media with message context
  const mediaItems = [];
  messages.forEach((msg) => {
    msg.media.forEach((media) => {
      if (type === 'all' || media.type === type) {
        mediaItems.push({
          ...media,
          messageId: msg._id,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        });
      }
    });
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        media: mediaItems,
        total: mediaItems.length,
      },
      'Media fetched'
    )
  );
});

export default {
  createGroup,
  getMyGroups,
  getGroupDetails,
  updateGroup,
  addMembers,
  removeMember,
  updateMemberRole,
  generateInviteLink,
  joinViaInvite,
  deleteGroup,
  sendGroupMessage,
  getGroupMessages,
  reactToMessage,
  deleteGroupMessage,
  forwardMessage,
  togglePinMessage,
  starMessage,
  voteOnPoll,
  searchGroupMessages,
  getStarredMessages,
  getGroupMedia,
};
