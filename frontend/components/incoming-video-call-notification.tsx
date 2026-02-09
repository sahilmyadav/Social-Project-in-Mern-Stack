'use client';

import { getMediaUrl } from '@/lib/media-utils';
import { User, Video, X } from 'lucide-react';

interface IncomingVideoCallNotificationProps {
  callerName: string;
  callerAvatar?: string;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingVideoCallNotification({
  callerName,
  callerAvatar,
  onAccept,
  onReject,
}: IncomingVideoCallNotificationProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-gray-900 to-black rounded-3xl p-8 shadow-2xl border border-white/10 max-w-sm w-full mx-4">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 rounded-full bg-blue-500 opacity-30 animate-ping" />
            <div
              className="absolute inset-0 rounded-full bg-blue-500 opacity-30 animate-ping"
              style={{ animationDelay: '0.5s' }}
            />
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white/20 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500">
              {callerAvatar?.startsWith('http') || callerAvatar?.startsWith('/') || callerAvatar?.startsWith('uploads') ? (
                <img
                  src={getMediaUrl(callerAvatar)}
                  alt={callerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={40} className="text-white" />
                </div>
              )}
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">{callerName}</h2>
          <p className="text-gray-300 flex items-center justify-center gap-2">
            <Video className="w-5 h-5" />
            Incoming video call
          </p>
        </div>

        <div className="flex items-center justify-center gap-6">
          <button
            onClick={onReject}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-red-500/50 active:scale-95"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-green-500/50 active:scale-95"
          >
            <Video className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-6">
          <div
            className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <div
            className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}
