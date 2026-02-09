
export interface GroupMember {
  _id: string;
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    profileImage?: string;
    avatar?: string;
    isOnline?: boolean;
    lastSeen?: Date;
  };
  role: 'admin' | 'moderator' | 'member';
  joinedAt: Date;
  addedBy?: string;
  isMuted?: boolean;
  unreadCount?: number;
  lastSeen?: Date;
}

export interface GroupSettings {
  editGroupInfo: 'admin' | 'moderator' | 'all';
  sendMessages: 'all' | 'admin' | 'moderator';
  addMembers: 'admin' | 'moderator' | 'all';
  approvalRequired: boolean;
  disappearingMessages?: {
    enabled: boolean;
    duration: number; // seconds
  };
  slowMode?: {
    enabled: boolean;
    interval: number; // seconds
  };
  linkSharingEnabled: boolean;
  maxMembers: number;
  maxPinnedMessages: number;
}

export interface GroupInviteLink {
  code: string;
  createdBy: string;
  expiresAt?: Date;
  usageLimit?: number;
  usageCount: number;
}

export interface Group {
  _id: string;
  name: string;
  description?: string;
  avatar?: string;
  type: 'private' | 'public';
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    profileImage?: string;
  };
  members: GroupMember[];
  settings: GroupSettings;
  inviteLink?: GroupInviteLink;
  pinnedMessages: string[];
  lastMessage?: GroupMessage;
  lastMessageAt?: Date;
  totalMessages: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  myRole?: 'admin' | 'moderator' | 'member';
  unreadCount?: number;
  isMuted?: boolean;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'file'
  | 'document'
  | 'sticker'
  | 'gif'
  | 'location'
  | 'live_location'
  | 'contact'
  | 'shared_post'
  | 'shared_reel'
  | 'shared_story'
  | 'poll'
  | 'system';

export interface MessageMedia {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  publicId?: string;
  filename?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  duration?: number;
  thumbnail?: string;
  width?: number;
  height?: number;
  caption?: string;
}

export interface MessageLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  address?: string;
  name?: string;
  isLive?: boolean;
  expiresAt?: Date;
}

export interface MessageContact {
  name: string;
  phone?: string;
  email?: string;
  userId?: string;
}

export interface SharedContent {
  contentType: 'post' | 'reel' | 'story' | 'message';
  contentId: string;
  preview?: {
    thumbnail?: string;
    caption?: string;
    author?: {
      _id: string;
      username: string;
      profileImage?: string;
    };
  };
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[];
  voteCount?: number;
}

export interface Poll {
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  expiresAt?: Date;
  isAnonymous: boolean;
}

export interface MessageReaction {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    profileImage?: string;
  };
  emoji: string;
  reactedAt: Date;
}

export interface ReadReceipt {
  user: string;
  readAt: Date;
}

export interface GroupMessage {
  _id: string;
  groupId: string;
  senderId: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    profileImage?: string;
    avatar?: string;
  };
  messageType: MessageType;
  text?: string; // Decrypted content
  encryptedContent?: string;
  media?: MessageMedia[];
  location?: MessageLocation;
  contact?: MessageContact;
  sharedContent?: SharedContent;
  poll?: Poll;
  replyTo?: {
    _id: string;
    text?: string;
    messageType: MessageType;
    senderId: {
      _id: string;
      firstName: string;
      lastName: string;
    };
  };
  mentions?: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
  }[];
  reactions: MessageReaction[];
  readBy: ReadReceipt[];
  deliveredTo: string[];
  isForwarded: boolean;
  forwardedFrom?: {
    groupId: string;
    messageId: string;
  };
  forwardCount: number;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedFor: string[];
  isPinned: boolean;
  pinnedBy?: string;
  pinnedAt?: Date;
  starredBy: string[];
  expiresAt?: Date;
  systemMessage?: string;
  systemMessageType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CallParticipantStatus =
  | 'invited'
  | 'ringing'
  | 'connected'
  | 'left'
  | 'declined'
  | 'missed'
  | 'disconnected';
export type CallParticipantRole = 'host' | 'co-host' | 'participant';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface CallParticipant {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    profileImage?: string;
    avatar?: string;
  };
  status: CallParticipantStatus;
  joinedAt?: Date;
  leftAt?: Date;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  isHandRaised: boolean;
  handRaisedAt?: Date;
  role: CallParticipantRole;
  connectionQuality: ConnectionQuality;
  peerId?: string;
}

export interface CallSettings {
  maxParticipants: number;
  waitingRoomEnabled: boolean;
  muteOnJoin: boolean;
  recordingEnabled: boolean;
  screenSharingAllowed: boolean;
}

export interface CallRecording {
  isRecording: boolean;
  startedAt?: Date;
  stoppedAt?: Date;
  startedBy?: string;
  url?: string;
  size?: number;
}

export interface WaitingRoomUser {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
  requestedAt: Date;
}

export interface GroupCall {
  _id: string;
  callId: string;
  groupId: string;
  callType: 'audio' | 'video';
  initiator: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    profileImage?: string;
  };
  participants: CallParticipant[];
  status: 'initiated' | 'ringing' | 'ongoing' | 'ended' | 'missed';
  settings: CallSettings;
  recording?: CallRecording;
  waitingRoom: WaitingRoomUser[];
  startedAt: Date;
  endedAt?: Date;
  duration?: number; // seconds
  endReason?: 'host_ended' | 'all_left' | 'timeout' | 'error';
  metrics?: {
    peakParticipants: number;
    totalJoins: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMessageEvent {
  groupId: string;
  message: GroupMessage;
}

export interface GroupTypingEvent {
  groupId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface GroupReactionEvent {
  groupId: string;
  messageId: string;
  userId: string;
  emoji: string;
  reactions: MessageReaction[];
}

export interface IncomingGroupCallEvent {
  callId: string;
  groupId: string;
  groupName: string;
  groupAvatar?: string;
  callType: 'audio' | 'video';
  initiator: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CallParticipantEvent {
  callId: string;
  participant: {
    _id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
    peerId?: string;
  };
}

export interface CallMediaStateEvent {
  callId: string;
  userId: string;
  mediaType: 'audio' | 'video' | 'screenShare';
  enabled: boolean;
}

export interface CallHandRaiseEvent {
  callId: string;
  userId: string;
  raised: boolean;
}
