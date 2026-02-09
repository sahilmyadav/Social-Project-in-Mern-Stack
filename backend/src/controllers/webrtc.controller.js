import crypto from 'crypto';

/**
 * Generate ephemeral TURN credentials using HMAC-based auth.
 *
 * Coturn supports time-limited credentials via the "TURN REST API" method:
 * - username = "expiry_timestamp:userId"
 * - credential = HMAC-SHA1(shared_secret, username)
 *
 * This keeps the shared secret on the backend only. Frontend never sees it.
 * Credentials are valid for TURN_CREDENTIAL_TTL seconds (default: 1 hour).
 *
 * Configure Coturn with:
 *   use-auth-secret
 *   static-auth-secret=YOUR_SECRET_HERE  (same as TURN_SECRET env var)
 */
export const getTurnCredentials = async (req, res) => {
  try {
    const turnServer = process.env.TURN_SERVER || 'turn.clikkme.in';
    const turnPort = process.env.TURN_PORT || '3478';
    const turnsPort = process.env.TURNS_PORT || '5349';
    const turnSecret = process.env.TURN_SECRET || 'clikkme_turn_secret';
    const ttl = parseInt(process.env.TURN_CREDENTIAL_TTL || '3600', 10); // 1 hour default

    const userId = req.user._id.toString();
    const expiryTimestamp = Math.floor(Date.now() / 1000) + ttl;
    const username = `${expiryTimestamp}:${userId}`;

    // HMAC-SHA1 with the shared secret — this is what Coturn expects
    const hmac = crypto.createHmac('sha1', turnSecret);
    hmac.update(username);
    const credential = hmac.digest('base64');

    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: [
          `turn:${turnServer}:${turnPort}?transport=udp`,
          `turn:${turnServer}:${turnPort}?transport=tcp`,
          `turns:${turnServer}:${turnsPort}?transport=tcp`,
        ],
        username,
        credential,
      },
    ];

    return res.status(200).json({
      success: true,
      data: {
        iceServers,
        ttl,
        expiresAt: new Date(expiryTimestamp * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to generate TURN credentials:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate TURN credentials',
    });
  }
};
