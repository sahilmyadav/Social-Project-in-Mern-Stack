'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Users } from 'lucide-react';
import { liveStreamService } from '@/lib/api-services';
import { LiveStream } from '@/types/live';
import { ScrollArea } from '@/components/ui/scroll-area';
import { onLiveStreamStarted, onLiveStreamEnded, offLiveStreamStarted, offLiveStreamEnded } from '@/lib/socket';

export function LiveStreamIndicator() {
    const router = useRouter();
    const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);

    useEffect(() => {
        fetchLiveStreams();

        // Socket listeners for real-time updates
        const handleStreamStarted = (data: any) => {
            fetchLiveStreams();
        };

        const handleStreamEnded = (data: any) => {
            setLiveStreams((prev) => prev.filter((s) => s._id !== data.streamId));
        };

        onLiveStreamStarted(handleStreamStarted);
        onLiveStreamEnded(handleStreamEnded);

        return () => {
            offLiveStreamStarted(handleStreamStarted);
            offLiveStreamEnded(handleStreamEnded);
        };
    }, []);

    const fetchLiveStreams = async () => {
        try {
            const response = await liveStreamService.getActiveLiveStreams({ limit: 10 });
            if (response.success) {
                setLiveStreams(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching live streams:', error);
        }
    };

    const handleStreamClick = (streamId: string) => {
        router.push(`/live/watch/${streamId}`);
    };

    if (liveStreams.length === 0) {
        return null;
    }

    return (
        <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                    <Radio className="h-5 w-5 text-red-500" />
                    Live Now
                </h3>
                <button
                    onClick={() => router.push('/live')}
                    className="text-sm text-primary hover:underline"
                >
                    See all
                </button>
            </div>

            <ScrollArea className="w-full">
                <div className="flex gap-3 pb-2">
                    {liveStreams.map((stream) => (
                        <button
                            key={stream._id}
                            onClick={() => handleStreamClick(stream._id)}
                            className="flex-shrink-0 group"
                        >
                            <div className="relative w-32 h-48 rounded-lg overflow-hidden border-2 border-red-500">
                                {stream.thumbnail ? (
                                    <img
                                        src={stream.thumbnail}
                                        alt={stream.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500" />
                                )}

                                {/* Live Badge */}
                                <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 animate-pulse">
                                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                                    LIVE
                                </div>

                                {/* Viewer Count */}
                                <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {stream.viewerCount}
                                </div>

                                {/* Gradient Overlay */}
                                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />

                                {/* Stream Info */}
                                <div className="absolute bottom-2 left-2 right-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        {stream.streamer.profilePicture ? (
                                            <img
                                                src={stream.streamer.profilePicture}
                                                alt={stream.streamer.username}
                                                className="w-6 h-6 rounded-full border-2 border-white"
                                            />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-white" />
                                        )}
                                        <span className="text-white text-xs font-medium truncate">
                                            {stream.streamer.fullName}
                                        </span>
                                    </div>
                                    <p className="text-white text-xs font-semibold line-clamp-2">
                                        {stream.title}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
