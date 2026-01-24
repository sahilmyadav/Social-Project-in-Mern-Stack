'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Users, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { liveStreamService } from '@/lib/api-services';
import { LiveStream } from '@/types/live';
import { toast } from 'sonner';

export default function LivePage() {
    const router = useRouter();
    const [activeLiveStreams, setActiveLiveStreams] = useState<LiveStream[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchActiveLiveStreams();
    }, []);

    const fetchActiveLiveStreams = async () => {
        try {
            const response = await liveStreamService.getActiveLiveStreams({ limit: 20 });
            if (response.success) {
                setActiveLiveStreams(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching live streams:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGoLive = () => {
        router.push('/live/create');
    };

    const handleJoinStream = (streamId: string) => {
        router.push(`/live/watch/${streamId}`);
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Radio className="h-8 w-8 text-red-500" />
                            Live Streams
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Watch live streams from people you follow
                        </p>
                    </div>
                    <Button onClick={handleGoLive} size="lg" className="gap-2">
                        <Video className="h-5 w-5" />
                        Go Live
                    </Button>
                </div>

                {/* Active Live Streams */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="animate-pulse">
                                <div className="aspect-video bg-muted" />
                                <CardHeader>
                                    <div className="h-4 bg-muted rounded w-3/4" />
                                    <div className="h-3 bg-muted rounded w-1/2 mt-2" />
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                ) : activeLiveStreams.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeLiveStreams.map((stream) => (
                            <Card
                                key={stream._id}
                                className="cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden group"
                                onClick={() => handleJoinStream(stream._id)}
                            >
                                <div className="relative aspect-video bg-gradient-to-br from-purple-500 to-pink-500">
                                    {stream.thumbnail ? (
                                        <img
                                            src={stream.thumbnail}
                                            alt={stream.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Video className="h-16 w-16 text-white/50" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 animate-pulse">
                                        <span className="w-2 h-2 bg-white rounded-full" />
                                        LIVE
                                    </div>
                                    <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {stream.viewerCount}
                                    </div>
                                </div>
                                <CardHeader>
                                    <CardTitle className="line-clamp-1">{stream.title}</CardTitle>
                                    <CardDescription className="flex items-center gap-2">
                                        <div className="flex items-center gap-2">
                                            {stream.streamer.profilePicture ? (
                                                <img
                                                    src={stream.streamer.profilePicture}
                                                    alt={stream.streamer.username}
                                                    className="w-6 h-6 rounded-full"
                                                />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                                            )}
                                            <span className="font-medium">{stream.streamer.fullName}</span>
                                        </div>
                                    </CardDescription>
                                    {stream.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                                            {stream.description}
                                        </p>
                                    )}
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="text-center py-16">
                        <CardContent>
                            <Radio className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No Live Streams</h3>
                            <p className="text-muted-foreground mb-6">
                                No one you follow is currently live. Be the first to go live!
                            </p>
                            <Button onClick={handleGoLive} size="lg" className="gap-2">
                                <Video className="h-5 w-5" />
                                Start Your First Live Stream
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
