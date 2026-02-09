'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Music, Pause, Play, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Track {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  previewUrl: string;
  artworkUrl: string;
  duration: number;
}

interface MusicSelection {
  trackId: string;
  trackName: string;
  artistName: string;
  albumArt: string;
  previewUrl: string;
  startTime: number;
}

interface MusicPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMusic: (music: MusicSelection) => void;
}

const POPULAR_SEARCHES = ['trending', 'arijit singh', 'bollywood', 'punjabi', 'romantic', 'party'];

export default function MusicPickerModal({
  isOpen,
  onClose,
  onSelectMusic,
}: MusicPickerModalProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [clipDuration] = useState(15); // 15 second clips for stories

  useEffect(() => {
    if (isOpen) {
      searchTracks('trending hits');
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);

  const searchTracks = async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://saavn.sumit.co/api/search/songs?query=${encodeURIComponent(query)}&limit=25`
      );

      const data = await response.json();

      if (data.success && data.data?.results && Array.isArray(data.data.results)) {
        const formattedTracks: Track[] = data.data.results
          .filter((item: any) => item.downloadUrl && item.downloadUrl.length > 0)
          .map((item: any) => ({
            trackId: item.id,
            title: item.name,
            artist: item.artists?.primary?.[0]?.name || 'Unknown Artist',
            album: item.album?.name || item.name,
            previewUrl:
              item.downloadUrl?.[3]?.url ||
              item.downloadUrl?.[2]?.url ||
              item.downloadUrl?.[0]?.url,
            artworkUrl: item.image?.[2]?.url || item.image?.[1]?.url || item.image?.[0]?.url,
            duration: item.duration || 180,
          }));
        setTracks(formattedTracks);
      } else {
        setTracks([]);
      }
    } catch (error) {
      setTracks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchTracks(searchQuery);
  };

  const handlePlayPreview = (track: Track, fromStart?: number) => {
    if (!track.previewUrl) return;

    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }

    if (playingTrackId === track.trackId && fromStart === undefined) {
      setPlayingTrackId(null);
      setAudioElement(null);
      setCurrentTime(0);
    } else {
      const audio = new Audio(track.previewUrl);
      const playFromTime =
        fromStart !== undefined
          ? fromStart
          : selectedTrack?.trackId === track.trackId
            ? startTime
            : 0;

      audio.currentTime = playFromTime;
      audio.play().catch((err) => console.error('Audio play error:', err));
      setAudioElement(audio);
      setPlayingTrackId(track.trackId);

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
        if (
          selectedTrack?.trackId === track.trackId &&
          audio.currentTime >= startTime + clipDuration
        ) {
          audio.pause();
          audio.currentTime = startTime;
          setCurrentTime(startTime);
        }
      };

      audio.onended = () => {
        setPlayingTrackId(null);
        setAudioElement(null);
        setCurrentTime(0);
      };
    }
  };

  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track);
    setStartTime(0);
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
      setPlayingTrackId(null);
      setAudioElement(null);
    }
  };

  const handleConfirmSelection = () => {
    if (!selectedTrack) return;

    onSelectMusic({
      trackId: selectedTrack.trackId,
      trackName: selectedTrack.title,
      artistName: selectedTrack.artist,
      albumArt: selectedTrack.artworkUrl,
      previewUrl: selectedTrack.previewUrl,
      startTime: startTime, // Use selected start time
    });

    handleClose();
  };

  const handleClose = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    setTracks([]);
    setSelectedTrack(null);
    setPlayingTrackId(null);
    setAudioElement(null);
    setSearchQuery('');
    setStartTime(0);
    setCurrentTime(0);
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-background rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold">Add Music</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-muted rounded-full transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-border">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search songs, artists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              Search
            </Button>
          </form>

          <div className="flex flex-wrap gap-2 mt-3">
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                onClick={() => {
                  setSearchQuery(term);
                  searchTracks(term);
                }}
                className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded-full transition capitalize"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-12">
              <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground animate-pulse" />
              <p className="text-muted-foreground">Searching music...</p>
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Search for your favorite songs</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tracks.map((track) => (
                <div
                  key={track.trackId}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${
                    selectedTrack?.trackId === track.trackId
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'hover:bg-muted border-2 border-transparent'
                  }`}
                  onClick={() => handleSelectTrack(track)}
                >
                  <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden">
                    {track.artworkUrl ? (
                      <img
                        src={track.artworkUrl}
                        alt={track.album}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                        <Music className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{track.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayPreview(track);
                      }}
                      className="p-2 hover:bg-background rounded-full transition"
                    >
                      {playingTrackId === track.trackId ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </button>

                    {selectedTrack?.trackId === track.trackId && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedTrack && (
          <div className="p-4 border-t border-border space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                {selectedTrack.artworkUrl ? (
                  <img
                    src={selectedTrack.artworkUrl}
                    alt={selectedTrack.album}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <Music className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{selectedTrack.title}</p>
                <p className="text-sm text-muted-foreground truncate">{selectedTrack.artist}</p>
              </div>
              <button
                onClick={() => handlePlayPreview(selectedTrack, startTime)}
                className="p-2 bg-primary/10 hover:bg-primary/20 rounded-full transition"
              >
                {playingTrackId === selectedTrack.trackId ? (
                  <Pause className="w-5 h-5 text-primary" />
                ) : (
                  <Play className="w-5 h-5 text-primary" />
                )}
              </button>
            </div>

            <div className="space-y-2 p-3 bg-muted/50 rounded-xl">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Select {clipDuration}s clip</span>
                <span className="text-muted-foreground">
                  {formatTime(startTime)} -{' '}
                  {formatTime(Math.min(startTime + clipDuration, selectedTrack.duration))}
                </span>
              </div>

              <div className="relative pt-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-600 absolute"
                    style={{
                      left: `${(startTime / selectedTrack.duration) * 100}%`,
                      width: `${(clipDuration / selectedTrack.duration) * 100}%`,
                    }}
                  />
                  {playingTrackId === selectedTrack.trackId && (
                    <div
                      className="absolute top-0 w-1 h-full bg-white shadow-lg"
                      style={{ left: `${(currentTime / selectedTrack.duration) * 100}%` }}
                    />
                  )}
                </div>

                <input
                  type="range"
                  min={0}
                  max={Math.max(0, selectedTrack.duration - clipDuration)}
                  step={1}
                  value={startTime}
                  onChange={(e) => {
                    const newStartTime = parseInt(e.target.value);
                    setStartTime(newStartTime);
                    if (audioElement && playingTrackId === selectedTrack.trackId) {
                      audioElement.currentTime = newStartTime;
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0:00</span>
                <span>{formatTime(selectedTrack.duration)}</span>
              </div>
            </div>

            <Button
              onClick={handleConfirmSelection}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
            >
              <Check className="w-5 h-5 mr-2" />
              Add Music to Story
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
