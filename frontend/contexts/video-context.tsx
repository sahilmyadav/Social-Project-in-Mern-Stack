'use client';

import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

interface VideoContextType {
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export function VideoProvider({ children }: { children: ReactNode }) {
  // Global mute state - starts muted like Instagram
  const [isMuted, setIsMuted] = useState(true);

  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  return (
    <VideoContext.Provider value={{ isMuted, setMuted, toggleMute }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideo() {
  const context = useContext(VideoContext);
  if (context === undefined) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
}

// Safe hook that doesn't throw if used outside provider
export function useVideoSafe() {
  const context = useContext(VideoContext);
  return context ?? { isMuted: true, setMuted: () => {}, toggleMute: () => {} };
}
