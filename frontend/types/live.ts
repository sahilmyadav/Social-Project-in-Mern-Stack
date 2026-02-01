/**
 * ============================================================================
 * LIVE STREAMING TYPES
 * ============================================================================
 *
 * Type definitions for the Instagram-like live streaming feature.
 * These types are used throughout the frontend for type safety.
 */

/**
 * LiveStream - Main stream object
 *
 * Represents a live stream session, whether it's:
 * - 'waiting': Created but not yet started (pre-live)
 * - 'live': Currently broadcasting
 * - 'ended': Broadcast has finished
 */
export interface LiveStream {
  _id: string;
  streamerId: string;
  streamer: {
    _id: string;
    username: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
    avatar?: string;
    isVerified?: boolean;
  };
  title: string;
  description?: string;
  thumbnail?: string;
  status: 'waiting' | 'live' | 'ended';
  viewerCount: number;
  peakViewerCount?: number;
  startedAt?: Date | string;
  endedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * LiveComment - Real-time comment during a live stream
 *
 * Comments are broadcast via WebSocket to all viewers in real-time.
 * They are also stored in MongoDB for record-keeping.
 */
export interface LiveComment {
  _id: string;
  liveStreamId: string;
  userId: string;
  user: {
    _id: string;
    username: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
    avatar?: string;
    isVerified?: boolean;
  };
  text: string;
  isPinned?: boolean;
  createdAt: Date | string;
}

/**
 * LiveViewer - User currently watching a stream
 *
 * Viewers are tracked in the database and in-memory via socket rooms.
 * This helps with viewer count and viewer list features.
 */
export interface LiveViewer {
  _id?: string;
  liveStreamId?: string;
  userId: string;
  username: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  avatar?: string;
  isVerified?: boolean;
  joinedAt: Date | string;
  leftAt?: Date | string;
}

/**
 * LiveReaction - Heart/reaction sent during stream
 *
 * Reactions are ephemeral - they trigger floating heart animations
 * but aren't permanently stored.
 */
export interface LiveReaction {
  userId: string;
  streamId: string;
  type: 'heart' | 'like' | 'fire' | 'clap';
  color?: string;
  timestamp: Date;
}

/**
 * LiveStreamNotification - Notification when someone goes live
 *
 * Sent to all followers when a user starts a live stream.
 */
export interface LiveStreamNotification {
  streamId: string;
  streamerId: string;
  streamerName: string;
  streamerUsername: string;
  streamerAvatar?: string;
  title: string;
  thumbnail?: string;
  startedAt: Date | string;
}

/**
 * WebRTC Types for signaling
 */
export interface RTCOfferPayload {
  streamId: string;
  broadcasterId: string;
  offer: RTCSessionDescriptionInit;
}

export interface RTCAnswerPayload {
  streamId: string;
  viewerId: string;
  answer: RTCSessionDescriptionInit;
}

export interface RTCIceCandidatePayload {
  streamId: string;
  senderId: string;
  candidate: RTCIceCandidateInit;
}

/**
 * Stream Stats - Analytics for broadcasters
 */
export interface LiveStreamStats {
  streamId: string;
  duration: number; // in seconds
  peakViewers: number;
  totalViews: number;
  totalComments: number;
  totalReactions: number;
}
