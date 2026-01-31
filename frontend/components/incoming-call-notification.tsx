'use client';

import { getMediaUrl } from '@/lib/media-utils';
import { Phone, PhoneOff, User } from 'lucide-react';
import { useEffect, useState } from 'react';

interface IncomingCallNotificationProps {
  isVisible: boolean;
  callerName: string;
  callerAvatar: string;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallNotification({
  isVisible,
  callerName,
  callerAvatar,
  onAccept,
  onReject,
}: IncomingCallNotificationProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      // Play ringtone sound (optional)
      // const audio = new Audio('/ringtone.mp3')
      // audio.loop = true
      // audio.play()
    } else {
      setIsAnimating(false);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] animate-in fade-in duration-300" />

      {/* Notification Card */}
      <div
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-md transition-all duration-300 ${
          isAnimating ? 'animate-in slide-in-from-top-4' : 'animate-out slide-out-to-top-4'
        }`}
      >
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-white/10 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-green-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Incoming Call
            </span>
          </div>

          {/* Caller Info */}
          <div className="flex items-center gap-4 mb-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-3xl shadow-lg ring-4 ring-white/10">
                {callerAvatar?.startsWith('http') || callerAvatar?.startsWith('/') ? (
                  <img
                    src={getMediaUrl(callerAvatar)}
                    alt={callerName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User size={32} className="text-white" />
                )}
              </div>

              {/* Pulsing ring animation */}
              <div className="absolute inset-0 rounded-full border-4 border-blue-400 animate-ping opacity-75" />
            </div>

            {/* Name */}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-1">{callerName}</h3>
              <p className="text-sm text-gray-400">Voice Call</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-8">
            {/* Reject Button */}
            <button
              onClick={onReject}
              className="group flex flex-col items-center gap-2 transition-transform hover:scale-110 active:scale-95"
              title="Reject call"
            >
              <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/50 transition-all">
                <PhoneOff size={28} className="text-white" />
              </div>
              <span className="text-xs font-medium text-gray-400 group-hover:text-red-400 transition-colors">
                Decline
              </span>
            </button>

            {/* Accept Button */}
            <button
              onClick={onAccept}
              className="group flex flex-col items-center gap-2 transition-transform hover:scale-110 active:scale-95"
              title="Accept call"
            >
              <div className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg shadow-green-500/50 transition-all animate-pulse">
                <Phone size={28} className="text-white" />
              </div>
              <span className="text-xs font-medium text-gray-400 group-hover:text-green-400 transition-colors">
                Accept
              </span>
            </button>
          </div>

          {/* Ringing animation dots */}
          <div className="flex justify-center gap-1.5 mt-6">
            <div
              className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <div
              className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
