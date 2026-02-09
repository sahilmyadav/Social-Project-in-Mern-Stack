/** STUN + TURN configuration. TURN is critical for ~20% of real-world connections. */
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TURN relay fallback — replace credentials with your own Coturn/Twilio/Xirsys config
    {
      urls: [
        'turn:turn.clikkme.in:3478?transport=udp',
        'turn:turn.clikkme.in:3478?transport=tcp',
        'turns:turn.clikkme.in:5349?transport=tcp',
      ],
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'clikkme',
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'clikkme_turn_secret',
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
};

// Mutable ICE config — can be updated with ephemeral TURN credentials at runtime
let _dynamicIceServers: RTCConfiguration | null = null;

export function getIceServers(): RTCConfiguration {
  return _dynamicIceServers || ICE_SERVERS;
}

export function setDynamicIceServers(config: RTCConfiguration): void {
  _dynamicIceServers = config;
}

/**
 * Fetch ephemeral TURN credentials from backend.
 * Falls back to static config if endpoint is unavailable.
 */
export async function fetchTurnCredentials(): Promise<RTCConfiguration> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${apiUrl}/api/v1/webrtc/turn-credentials`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data?.iceServers) {
        const config: RTCConfiguration = {
          iceServers: data.data.iceServers,
          iceCandidatePoolSize: 10,
          iceTransportPolicy: 'all',
        };
        setDynamicIceServers(config);
        return config;
      }
    }
  } catch {
    // Fall through to static config
  }
  return ICE_SERVERS;
}

/** How long to ring before auto-failing (ms) — WhatsApp uses ~35s */
export const RING_TIMEOUT_MS = 35_000;

/** Grace period before marking a disconnected ICE connection as failed (ms) */
export const ICE_RECONNECT_TIMEOUT_MS = 8_000;

/** Max group call participants (mesh topology limit) */
export const MAX_GROUP_PARTICIPANTS = 8;

/** WhatsApp-grade audio constraints — echo cancel + noise suppression + AGC */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
};

/** Video constraints for 1:1 calls (HD) */
export const VIDEO_CONSTRAINTS_1to1: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 30, max: 30 },
  facingMode: 'user',
};

/** Video constraints for group calls (lower to save bandwidth in mesh) */
export const VIDEO_CONSTRAINTS_GROUP: MediaTrackConstraints = {
  width: { ideal: 640, max: 960 },
  height: { ideal: 480, max: 720 },
  frameRate: { ideal: 24, max: 24 },
  facingMode: 'user',
};

/** Check if a signaling event is for a group call (used to filter in 1:1 modals) */
export function isGroupCallSignal(data: Record<string, any>): boolean {
  return !!data.callType && (data.callType === 'group-voice' || data.callType === 'group-video');
}

export function formatCallDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseIceCandidate(candidateData: Record<string, any>): RTCIceCandidate | null {
  const c = candidateData.candidate;
  if (!c?.candidate) return null;
  return new RTCIceCandidate({
    candidate: c.candidate,
    sdpMLineIndex: c.sdpMLineIndex,
    sdpMid: c.sdpMid,
  });
}

export async function processIceQueue(
  pc: RTCPeerConnection,
  queue: RTCIceCandidate[]
): Promise<void> {
  for (const candidate of queue) {
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // Silently skip invalid candidates — they're non-fatal
    }
  }
  queue.length = 0;
}

export function cleanupPeerConnection(pc: RTCPeerConnection | null): void {
  if (!pc) return;
  try {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.oniceconnectionstatechange = null;
    pc.onsignalingstatechange = null;
    pc.close();
  } catch {
    // PC may already be closed
  }
}

export function cleanupMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    track.stop();
    track.enabled = false;
  });
}

/**
 * Attempt an ICE restart on an existing peer connection.
 * Returns the new offer SDP to send to the remote peer.
 */
export async function attemptIceRestart(
  pc: RTCPeerConnection
): Promise<RTCSessionDescriptionInit | null> {
  try {
    if (pc.signalingState === 'closed') return null;
    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);
    return offer;
  } catch {
    return null;
  }
}

// ── Bandwidth adaptation ──

/** Preferred max bitrates (kbps) by call type */
export const BITRATE_LIMITS = {
  audio: 64, // 64 kbps Opus
  video1to1: 1500, // 1.5 Mbps for HD
  videoGroup: 500, // 500 kbps per peer in mesh
} as const;

/**
 * Apply max bitrate cap on all video senders.
 * This prevents bandwidth saturation on poor networks.
 */
export async function applyBitrateCap(
  pc: RTCPeerConnection,
  maxBitrateKbps: number
): Promise<void> {
  const senders = pc.getSenders();
  for (const sender of senders) {
    if (sender.track?.kind !== 'video') continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = maxBitrateKbps * 1000; // Convert to bps
      await sender.setParameters(params);
    } catch {
      // Some browsers don't support setParameters
    }
  }
}

/**
 * Apply audio bitrate cap for Opus codec.
 */
export async function applyAudioBitrateCap(
  pc: RTCPeerConnection,
  maxBitrateKbps: number = BITRATE_LIMITS.audio
): Promise<void> {
  const senders = pc.getSenders();
  for (const sender of senders) {
    if (sender.track?.kind !== 'audio') continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = maxBitrateKbps * 1000;
      await sender.setParameters(params);
    } catch {
      // Fallback: some browsers don't support this
    }
  }
}

// ── Quality monitoring via getStats() ──

export interface CallQualityStats {
  roundTripTime: number; // ms
  jitter: number; // seconds
  packetsLost: number;
  packetLossPercent: number;
  bytesSent: number;
  bytesReceived: number;
  currentBitrate: number; // kbps
  timestamp: number;
}

let _prevBytesSent = 0;
let _prevBytesReceived = 0;
let _prevTimestamp = 0;

/**
 * Poll WebRTC stats from a peer connection.
 * Call this periodically (e.g., every 3 seconds) to monitor quality.
 */
export async function getCallQualityStats(pc: RTCPeerConnection): Promise<CallQualityStats | null> {
  if (!pc || pc.connectionState === 'closed') return null;
  try {
    const stats = await pc.getStats();
    let roundTripTime = 0;
    let jitter = 0;
    let packetsLost = 0;
    let packetsReceived = 0;
    let bytesSent = 0;
    let bytesReceived = 0;
    const now = Date.now();

    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        roundTripTime = (report.currentRoundTripTime || 0) * 1000; // Convert to ms
      }
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        jitter = report.jitter || 0;
        packetsLost = report.packetsLost || 0;
        packetsReceived = report.packetsReceived || 0;
      }
      if (report.type === 'transport') {
        bytesSent = report.bytesSent || 0;
        bytesReceived = report.bytesReceived || 0;
      }
    });

    const totalPackets = packetsReceived + packetsLost;
    const packetLossPercent = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;

    // Calculate current bitrate from delta
    let currentBitrate = 0;
    if (_prevTimestamp > 0) {
      const timeDelta = (now - _prevTimestamp) / 1000; // seconds
      if (timeDelta > 0) {
        const bytesDelta = bytesSent - _prevBytesSent + (bytesReceived - _prevBytesReceived);
        currentBitrate = Math.round((bytesDelta * 8) / timeDelta / 1000); // kbps
      }
    }
    _prevBytesSent = bytesSent;
    _prevBytesReceived = bytesReceived;
    _prevTimestamp = now;

    return {
      roundTripTime,
      jitter,
      packetsLost,
      packetLossPercent,
      bytesSent,
      bytesReceived,
      currentBitrate,
      timestamp: now,
    };
  } catch {
    return null;
  }
}

/**
 * Adaptive quality: reduce video quality when network is poor.
 * This mimics WhatsApp's dynamic quality adjustment.
 */
export async function adaptVideoQuality(
  pc: RTCPeerConnection,
  stats: CallQualityStats,
  isGroupCall: boolean
): Promise<void> {
  const senders = pc.getSenders();
  for (const sender of senders) {
    if (sender.track?.kind !== 'video') continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      // Degrade quality based on packet loss and RTT
      if (stats.packetLossPercent > 10 || stats.roundTripTime > 500) {
        // Severe: drop to minimal quality
        params.encodings[0].maxBitrate = 150_000; // 150 kbps
        params.encodings[0].maxFramerate = 15;
        params.encodings[0].scaleResolutionDownBy = 4;
      } else if (stats.packetLossPercent > 5 || stats.roundTripTime > 300) {
        // Moderate: reduce quality
        params.encodings[0].maxBitrate = isGroupCall ? 300_000 : 500_000;
        params.encodings[0].maxFramerate = 20;
        params.encodings[0].scaleResolutionDownBy = 2;
      } else if (stats.packetLossPercent > 2 || stats.roundTripTime > 150) {
        // Mild: slight reduction
        params.encodings[0].maxBitrate = isGroupCall ? 500_000 : 1_000_000;
        params.encodings[0].maxFramerate = isGroupCall ? 24 : 30;
        params.encodings[0].scaleResolutionDownBy = 1;
      } else {
        // Good: full quality
        params.encodings[0].maxBitrate = isGroupCall ? 500_000 : 1_500_000;
        delete params.encodings[0].maxFramerate;
        params.encodings[0].scaleResolutionDownBy = 1;
      }

      await sender.setParameters(params);
    } catch {
      // Browser may not support all encoding parameters
    }
  }
}

// ── beforeunload cleanup helper ──

/**
 * Register a cleanup function that runs on tab close/refresh.
 * Returns an unregister function.
 */
export function registerBeforeUnloadCleanup(cleanup: () => void): () => void {
  const handler = () => {
    cleanup();
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}
