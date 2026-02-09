// WebRTC ICE Server Configuration
// Uses STUN + TURN servers for reliable NAT traversal

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Google STUN servers (free, for NAT discovery)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Metered free TURN servers (for relay when direct connection fails)
    {
      urls: 'stun:stun.relay.metered.ca:80',
    },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: 'e87fdf2eac32d93a7e5dd864',
      credential: '7WSHpXE5IWvQqnJL',
    },
    {
      urls: 'turn:global.relay.metered.ca:80?transport=tcp',
      username: 'e87fdf2eac32d93a7e5dd864',
      credential: '7WSHpXE5IWvQqnJL',
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: 'e87fdf2eac32d93a7e5dd864',
      credential: '7WSHpXE5IWvQqnJL',
    },
    {
      urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      username: 'e87fdf2eac32d93a7e5dd864',
      credential: '7WSHpXE5IWvQqnJL',
    },
  ],
  iceCandidatePoolSize: 10,
};
