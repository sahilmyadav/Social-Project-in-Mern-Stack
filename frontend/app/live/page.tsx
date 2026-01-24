'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Users, Radio, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { liveStreamService, authService } from '@/lib/api-services';
import { LiveStream } from '@/types/live';
import Navigation from '@/components/navigation';

export default function LivePage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [activeLiveStreams, setActiveLiveStreams] = useState<LiveStream[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userData = localStorage.getItem("user");
        if (!userData) {
            router.push("/login");
        } else {
            setUser(JSON.parse(userData));
            fetchActiveLiveStreams();
        }
    }, [router]);

    const fetchActiveLiveStreams = async () => {
        try {
            const response = await liveStreamService.getActiveLiveStreams({ limit: 20 });
            if (response.success) {
                // Filter out streams where streamer might be null (e.g. deleted user)
                const validStreams = (response.data || []).filter((s: LiveStream) => s.streamer);
                setActiveLiveStreams(validStreams);
            }
        } catch (error) {
            console.error('Error fetching live streams:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await authService.logout();
        } catch (err) {
            console.error("Logout error:", err);
        } finally {
            localStorage.removeItem("user");
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            router.push("/login");
        }
    };

    const handleGoLive = () => {
        router.push('/live/create');
    };

    const handleJoinStream = (streamId: string) => {
        router.push(`/live/watch/${streamId}`);
    };

    if (!user) return null;

    return (
        <main className="min-h-screen bg-background">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Sidebar */}
                <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
                    <Navigation user={user} onLogout={handleLogout} />
                </aside>

                {/* Main Content */}
                <section className="lg:col-span-3 pb-20 lg:pb-0">
                    <div className="container mx-auto px-4 py-8 max-w-5xl">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-3xl font-bold flex items-center gap-2">
                                    <Radio className="h-8 w-8 text-red-500 animate-pulse" />
                                    Live Streams
                                </h1>
                                <p className="text-muted-foreground mt-1">
                                    Watch live streams from people you follow
                                </p>
                            </div>
                            <Button onClick={handleGoLive} size="lg" className="gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-lg shadow-red-500/20 transition-all duration-300">
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
                                        className="cursor-pointer hover:shadow-xl transition-all duration-300 overflow-hidden group border-border/50 bg-card/50 backdrop-blur-sm"
                                        onClick={() => handleJoinStream(stream._id)}
                                    >
                                        <div className="relative aspect-video bg-muted overflow-hidden">
                                            {stream.thumbnail ? (
                                                <img
                                                    src={stream.thumbnail}
                                                    alt={stream.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                                                    <Video className="h-12 w-12 text-white/20" />
                                                </div>
                                            )}
                                            <div className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                                </span>
                                                LIVE
                                            </div>
                                            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border border-white/10">
                                                <Users className="h-3.5 w-3.5" />
                                                {stream.viewerCount || 0}
                                            </div>
                                        </div>
                                        <CardHeader className="p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="relative flex-shrink-0">
                                                    {stream.streamer?.profilePicture ? (
                                                        <img
                                                            src={stream.streamer?.profilePicture}
                                                            alt={stream.streamer?.username}
                                                            className="w-10 h-10 rounded-full border-2 border-red-500 p-0.5 object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary p-0.5">
                                                            <div className="w-full h-full bg-background rounded-full flex items-center justify-center text-xs font-bold">
                                                                {stream.streamer?.fullName?.[0]}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <CardTitle className="text-base font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                                                        {stream.title}
                                                    </CardTitle>
                                                    <CardDescription className="flex flex-col gap-0.5 mt-1">
                                                        <span className="font-medium text-foreground text-sm truncate">
                                                            {stream.streamer?.fullName}
                                                        </span>
                                                        <span className="text-xs truncate">
                                                            @{stream.streamer?.username}
                                                        </span>
                                                    </CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card className="text-center py-20 bg-muted/20 border-dashed">
                                <CardContent>
                                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Radio className="h-10 w-10 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2">No Live Streams</h3>
                                    <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                                        No one you follow is currently live. Why not start your own stream and connect with your audience?
                                    </p>
                                    <Button onClick={handleGoLive} size="lg" className="gap-2 bg-primary hover:bg-primary/90">
                                        <Video className="h-5 w-5" />
                                        Start Streaming Now
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </section>
            </div>

            {/* Mobile Navigation */}
            <Navigation user={user} onLogout={handleLogout} isMobile={true} />
        </main>
    );
}
