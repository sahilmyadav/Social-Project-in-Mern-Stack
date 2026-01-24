"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Trash2, Eye, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { storyService } from "@/lib/api-services";
import { useConfirmDialog, ConfirmDialog } from "@/components/ui/confirm-dialog";
import "@/styles/filters.css";

interface Story {
  _id: string;
  user: {
    _id: string;
    firstName: string;
    username: string;
    profilePicture?: string;
    avatar?: string;
  };
  media: {
    url: string;
    type: "image" | "video";
  };
  filter?: string;
  music?: {
    trackId: string;
    trackName: string;
    artistName: string;
    previewUrl: string;
    startTime: number;
  };
  createdAt: string;
  viewCount?: number;
  views?: Array<{
    _id: string;
    firstName: string;
    lastName?: string;
    username: string;
    profilePicture?: string;
    viewedAt: string;
  }>;
}

interface StoryViewerProps {
  isOpen: boolean;
  onClose: () => void;
  stories: Story[];
  initialIndex?: number;
  currentUserId?: string;
  onDelete?: (storyId: string) => void;
}

export default function StoryViewer({
  isOpen,
  onClose,
  stories,
  initialIndex = 0,
  currentUserId,
  onDelete,
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [viewers, setViewers] = useState<any[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false); // Track if media is loaded
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const hasTrackedView = useRef<Set<string>>(new Set());

  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const currentStory = stories[currentIndex];
  const isOwner = currentUserId === currentStory?.user._id;
  const mediaUrl = typeof currentStory?.media === 'string'
    ? currentStory.media
    : currentStory?.media?.url || '';
  const isImage = currentStory?.media?.type === "image" ||
    (!currentStory?.media?.type && mediaUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i));



  // Calculate time ago
  const getTimeAgo = (date: string) => {
    const seconds = Math.floor(
      (new Date().getTime() - new Date(date).getTime()) / 1000
    );
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Auto-advance story
  useEffect(() => {
    if (!isOpen || isPaused) return;

    // If story has music, make duration at least 60 seconds to allow full playback
    let duration: number;
    if (currentStory?.music) {
      duration = 30000; // 30 seconds for stories with music
    } else {
      duration = isImage ? 5000 : videoRef.current?.duration ? videoRef.current.duration * 1000 : 15000;
    }

    const interval = 50;

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + (interval / duration) * 100;
        if (newProgress >= 100) {
          handleNext();
          return 0;
        }
        return newProgress;
      });
    }, interval);

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentIndex, isOpen, isPaused, isImage, currentStory?.music]);

  // Play music if story has music (only after media is loaded)
  useEffect(() => {
    if (!isOpen || !currentStory?.music || !mediaLoaded) {
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
      return;
    }



    const audio = new Audio(currentStory.music.previewUrl);
    let checkPlayback: NodeJS.Timeout | null = null;

    // Validate startTime is a finite number
    const startTime = typeof currentStory.music.startTime === 'number' && isFinite(currentStory.music.startTime)
      ? currentStory.music.startTime
      : 0;

    // Wait for audio metadata to load before setting currentTime and playing
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = startTime;
    });

    // Start timer only when audio actually starts playing
    audio.addEventListener('playing', () => {
      const playbackStartTime = Date.now();

      checkPlayback = setInterval(() => {
        const elapsed = (Date.now() - playbackStartTime) / 1000;


        if (elapsed >= 30) {
          if (checkPlayback) clearInterval(checkPlayback);
          if (musicAudioRef.current) {
            musicAudioRef.current.pause();
            musicAudioRef.current = null;
          }
        }
      }, 1000);
    }, { once: true }); // Only trigger once

    audio.volume = 0.7;
    audio.play().catch(() => { });
    musicAudioRef.current = audio;

    return () => {
      if (checkPlayback) clearInterval(checkPlayback);
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
    };
  }, [currentStory?._id, isOpen, mediaLoaded]);

  // Reset progress and media loaded state when story changes or when modal opens
  useEffect(() => {
    setProgress(0);
    setMediaLoaded(false); // Reset media loaded state for new story
  }, [currentIndex, isOpen]);

  // Load viewers for own stories
  const loadViewers = async () => {
    if (!currentStory || !isOwner) return;

    try {
      const response = await storyService.getStoryViewers(currentStory._id);
      if (response.success && response.data) {
        const viewersList = response.data.viewers || response.data.views || [];
        setViewers(viewersList);
        setViewCount(viewersList.length);
      }
    } catch (error) {
      console.error("❌ Error loading story viewers:", error);
      // Don't break the story viewer if this fails
      setViewers([]);
      setViewCount(0);
    }
  };

  // Track story view and load view count
  useEffect(() => {
    if (!isOpen || !currentStory) return;

    const trackView = async () => {
      // Don't track view for own story
      if (isOwner) {
        // Load viewers for own story
        loadViewers();
        return;
      }

      // Track view only once per story
      if (!hasTrackedView.current.has(currentStory._id)) {
        try {
          await storyService.viewStory(currentStory._id);
          hasTrackedView.current.add(currentStory._id);
        } catch (error) {
          console.error("❌ Error tracking story view:", error);
          // Don't break the story viewer if tracking fails
        }
      }
    };

    trackView();
  }, [currentStory?._id, isOpen, isOwner]);

  const handleNext = () => {
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;
    }

    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!isOwner || !currentStory) return;

    confirm({
      title: "Delete Story",
      message: "Are you sure you want to delete this story? This action cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        await onDelete?.(currentStory._id);

        // Move to next story or close if last one
        if (stories.length > 1) {
          if (currentIndex === stories.length - 1) {
            setCurrentIndex(Math.max(0, currentIndex - 1));
          }
        } else {
          onClose();
        }
      },
    });
  };


  // Close viewer if stories become invalid
  useEffect(() => {
    if (isOpen && (!stories || stories.length === 0 || !currentStory)) {
      onClose();
    }
  }, [isOpen, stories, currentStory, onClose]);

  if (!isOpen || !currentStory) return null;


  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
        <ConfirmDialog {...dialogProps} />
        {stories.map((_, index) => (
          <div
            key={index}
            className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-white transition-all duration-100"
              style={{
                width:
                  index === currentIndex
                    ? `${progress}%`
                    : index < currentIndex
                      ? "100%"
                      : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white">
            {currentStory.user.profilePicture || currentStory.user.avatar ? (
              <img
                src={currentStory.user.profilePicture || currentStory.user.avatar}
                alt={currentStory.user.firstName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                {currentStory.user.firstName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">
              {currentStory.user.firstName}
            </p>
            <p className="text-white/70 text-xs">
              {getTimeAgo(currentStory.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Count (for own stories) */}
          {isOwner && viewCount > 0 && (
            <button
              onClick={() => setShowViewers(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-full transition"
            >
              <Eye className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">{viewCount}</span>
            </button>
          )}

          {isOwner && (
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-white/20 rounded-full transition"
            >
              <Trash2 className="w-5 h-5 text-white" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Story content */}
      <div
        className="relative w-full h-full flex items-center justify-center"
        onClick={() => setIsPaused(!isPaused)}
      >
        {mediaUrl ? (
          isImage ? (
            <img
              src={mediaUrl}
              alt="Story"
              className={`max-w-full max-h-full object-contain ${currentStory.filter ? `filter-${currentStory.filter}` : ''}`}
              onLoad={() => {
                setMediaLoaded(true);
              }}
              onError={() => {
                setMediaLoaded(true); // Still set to true to prevent blocking
              }}
            />
          ) : (
            <video
              ref={videoRef}
              src={mediaUrl}
              className={`max-w-full max-h-full object-contain ${currentStory.filter ? `filter-${currentStory.filter}` : ''}`}
              autoPlay
              playsInline
              onEnded={handleNext}
              onLoadedData={() => {
                setMediaLoaded(true);
              }}
              onError={() => {
                setMediaLoaded(true); // Still set to true to prevent blocking
              }}
            />
          )
        ) : (
          <div className="flex items-center justify-center text-white text-center">
            <div>
              <div className="text-6xl mb-4">📸</div>
              <p className="text-lg">Story media not available</p>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {!mediaLoaded && mediaUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-white text-sm font-medium">Loading story...</p>
            </div>
          </div>
        )}
      </div>

      {/* Music Indicator */}
      {currentStory?.music && (
        <div className="absolute bottom-20 left-4 right-4 z-10">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">
                {currentStory.music.trackName}
              </p>
              <p className="text-white/70 text-xs truncate">
                {currentStory.music.artistName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      {currentIndex > 0 && (
        <button
          onClick={handlePrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition z-10"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}
      {currentIndex < stories.length - 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition z-10"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 rounded-full p-4">
          <div className="w-3 h-8 bg-white/80 rounded-sm mx-1 inline-block" />
          <div className="w-3 h-8 bg-white/80 rounded-sm mx-1 inline-block" />
        </div>
      )}

      {/* Viewers Modal */}
      {showViewers && isOwner && (
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowViewers(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Viewers
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({viewCount})
                </span>
              </div>
              <button
                onClick={() => setShowViewers(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Viewers List */}
            <div className="flex-1 overflow-y-auto p-4">
              {viewers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No views yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {viewers.map((viewer) => (
                    <div
                      key={viewer._id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0">
                        {viewer.profilePicture ? (
                          <img
                            src={viewer.profilePicture}
                            alt={viewer.firstName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                            {viewer.firstName?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {viewer.firstName} {viewer.lastName || ""}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          @{viewer.username}
                        </p>
                      </div>
                      {viewer.viewedAt && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(viewer.viewedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
