"use client";

import { useState, useEffect } from "react";
import { X, Music, Play, Pause, Check, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Track {
    title: string;
    artist: string;
    album: string;
    url: string;
    albumCover?: {
        format: string;
        data: string;
    };
    duration: number;
}

interface MusicSelection {
    trackId: string;
    trackName: string;
    artistName: string;
    albumArt: string;
    previewUrl: string;
    startTime: number; // Start time in seconds for the 30-second clip
}

interface MusicPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectMusic: (music: MusicSelection) => void;
}

export default function MusicPickerModal({
    isOpen,
    onClose,
    onSelectMusic,
}: MusicPickerModalProps) {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
    const [playingTrackUrl, setPlayingTrackUrl] = useState<string | null>(null);
    const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
    const [startTime, setStartTime] = useState(0); // Start time for 30-second clip
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        if (isOpen) {
            loadTracks();
        }
    }, [isOpen]);

    useEffect(() => {
        // Cleanup audio on unmount
        return () => {
            if (audioElement) {
                audioElement.pause();
                audioElement.src = "";
            }
        };
    }, [audioElement]);

    const loadTracks = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(
                "https://songsapi-77qx.onrender.com/api/songs/cloud-songs"
            );

            const data = await response.json();

            if (Array.isArray(data)) {
                setTracks(data);
            } else {
                console.error("Failed to load tracks");
                setTracks([]);
            }
        } catch (error) {
            console.error("Error loading tracks:", error);
            setTracks([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlayPreview = (track: Track, fromStart: number = 0) => {
        if (!track.url) {

            return;
        }

        // Stop current audio if playing
        if (audioElement) {
            audioElement.pause();
            audioElement.src = "";
        }

        if (playingTrackUrl === track.url) {
            // Stop playing
            setPlayingTrackUrl(null);
            setAudioElement(null);
            setCurrentTime(0);
        } else {
            // Play new track from specified start time
            const audio = new Audio(track.url);
            audio.currentTime = fromStart;
            audio.play();
            setAudioElement(audio);
            setPlayingTrackUrl(track.url);

            // Update current time as audio plays
            audio.ontimeupdate = () => {
                setCurrentTime(audio.currentTime);
                // Stop after 30 seconds
                if (audio.currentTime >= fromStart + 30) {
                    audio.pause();
                    setPlayingTrackUrl(null);
                    setAudioElement(null);
                    setCurrentTime(0);
                }
            };

            audio.onended = () => {
                setPlayingTrackUrl(null);
                setAudioElement(null);
                setCurrentTime(0);
            };
        }
    };

    const handleSelectTrack = (track: Track) => {
        setSelectedTrack(track);
        setStartTime(0); // Reset start time when selecting new track
        // Stop any playing audio
        if (audioElement) {
            audioElement.pause();
            audioElement.src = "";
            setPlayingTrackUrl(null);
            setAudioElement(null);
        }
    };

    const handleConfirmSelection = () => {
        if (!selectedTrack) return;

        onSelectMusic({
            trackId: selectedTrack.url,
            trackName: selectedTrack.title,
            artistName: selectedTrack.artist,
            albumArt: "",
            previewUrl: selectedTrack.url,
            startTime: startTime, // Include selected start time
        });

        handleClose();
    };

    const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStartTime = parseFloat(e.target.value);
        setStartTime(newStartTime);

        // If audio is playing, update its current time
        if (audioElement && selectedTrack) {
            audioElement.currentTime = newStartTime;
        }
    };

    const handlePlayTimeline = () => {
        if (selectedTrack) {
            handlePlayPreview(selectedTrack, startTime);
        }
    };

    const handleAdjustTime = (seconds: number) => {
        const newTime = Math.max(0, Math.min(startTime + seconds, (selectedTrack?.duration || 180) - 30));
        setStartTime(newTime);
        if (audioElement && selectedTrack) {
            audioElement.currentTime = newTime;
        }
    };

    const handleClose = () => {
        if (audioElement) {
            audioElement.pause();
            audioElement.src = "";
        }
        setTracks([]);
        setSelectedTrack(null);
        setPlayingTrackUrl(null);
        setAudioElement(null);
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

    const maxStartTime = (selectedTrack?.duration || 180) - 30; // Max start time to ensure 30 seconds available

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-background rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                            <Music className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold">Add Music</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-muted rounded-full transition"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="text-center py-12">
                            <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground animate-pulse" />
                            <p className="text-muted-foreground">Loading music...</p>
                        </div>
                    ) : tracks.length === 0 ? (
                        <div className="text-center py-12">
                            <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground">No tracks available</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {tracks.map((track, index) => (
                                <div
                                    key={track.url + index}
                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${selectedTrack?.url === track.url
                                        ? "bg-primary/10 border-2 border-primary"
                                        : "hover:bg-muted border-2 border-transparent"
                                        }`}
                                    onClick={() => handleSelectTrack(track)}
                                >
                                    {/* Music Icon */}
                                    <div className="relative w-12 h-12 flex-shrink-0 bg-gradient-to-br from-purple-500 to-pink-600 rounded flex items-center justify-center">
                                        <Music className="w-6 h-6 text-white" />
                                    </div>

                                    {/* Track Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">{track.title}</p>
                                        <p className="text-sm text-muted-foreground truncate">
                                            {track.artist}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {/* Play/Pause Preview */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePlayPreview(track, 0);
                                            }}
                                            className="p-2 hover:bg-background rounded-full transition"
                                        >
                                            {playingTrackUrl === track.url ? (
                                                <Pause className="w-5 h-5" />
                                            ) : (
                                                <Play className="w-5 h-5" />
                                            )}
                                        </button>

                                        {/* Selected Indicator */}
                                        {selectedTrack?.url === track.url && (
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

                {/* Footer with Timeline Picker */}
                {selectedTrack && (
                    <div className="p-6 border-t border-border space-y-4">
                        {/* Selected Track Info */}
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                            <div className="w-12 h-12 rounded bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                                <Music className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{selectedTrack.title}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                    {selectedTrack.artist}
                                </p>
                            </div>
                        </div>

                        {/* Timeline Picker */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground font-medium">Select 30-second clip</span>
                                <span className="font-semibold text-primary">
                                    {formatTime(startTime)} - {formatTime(startTime + 30)}
                                </span>
                            </div>

                            {/* Visual Waveform Timeline */}
                            <div className="relative">
                                {/* Waveform Background */}
                                <div className="h-16 bg-muted rounded-xl overflow-hidden relative">
                                    {/* Simulated waveform bars */}
                                    <div className="absolute inset-0 flex items-center justify-around px-1">
                                        {Array.from({ length: 60 }).map((_, i) => {
                                            const height = Math.random() * 60 + 20;
                                            const isInWindow = i >= (startTime / maxStartTime) * 60 && i <= ((startTime + 30) / (selectedTrack?.duration || 180)) * 60;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`w-0.5 rounded-full transition-all duration-300 ${isInWindow
                                                        ? 'bg-gradient-to-t from-purple-500 via-pink-500 to-purple-400'
                                                        : 'bg-muted-foreground/20'
                                                        }`}
                                                    style={{ height: `${height}%` }}
                                                />
                                            );
                                        })}
                                    </div>

                                    {/* 30-second window indicator */}
                                    <div
                                        className="absolute top-0 bottom-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 border-l-2 border-r-2 border-primary transition-all duration-300"
                                        style={{
                                            left: `${(startTime / maxStartTime) * 100}%`,
                                            width: `${(30 / (selectedTrack?.duration || 180)) * 100}%`
                                        }}
                                    >
                                        {/* Animated shimmer effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                                    </div>

                                    {/* Real-time playback indicator */}
                                    {playingTrackUrl === selectedTrack.url && (
                                        <div
                                            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg shadow-white/50 transition-all duration-100"
                                            style={{
                                                left: `${(currentTime / (selectedTrack?.duration || 180)) * 100}%`
                                            }}
                                        >
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg animate-pulse" />
                                        </div>
                                    )}
                                </div>

                                {/* Timeline Slider (invisible but functional) */}
                                <input
                                    type="range"
                                    min="0"
                                    max={maxStartTime}
                                    step="1"
                                    value={startTime}
                                    onChange={handleTimelineChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                            </div>

                            {/* Timeline Controls */}
                            <div className="flex items-center justify-between gap-2">
                                <button
                                    onClick={() => handleAdjustTime(-5)}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-xl transition font-medium"
                                >
                                    <SkipBack className="w-4 h-4" />
                                    -5s
                                </button>

                                <button
                                    onClick={handlePlayTimeline}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 rounded-xl transition font-semibold shadow-lg shadow-purple-500/30"
                                >
                                    {playingTrackUrl === selectedTrack.url ? (
                                        <>
                                            <Pause className="w-5 h-5" />
                                            Pause
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-5 h-5" />
                                            Preview
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => handleAdjustTime(5)}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-xl transition font-medium"
                                >
                                    +5s
                                    <SkipForward className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Confirm Button */}
                        <button
                            onClick={handleConfirmSelection}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 rounded-xl transition font-bold shadow-lg shadow-purple-500/30 text-base"
                        >
                            <Check className="w-5 h-5" />
                            Add Music to Story
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
