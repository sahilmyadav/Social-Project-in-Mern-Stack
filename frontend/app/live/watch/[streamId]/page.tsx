'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Users,
    MessageCircle,
    Send,
    Loader2,
    Radio,
    ArrowLeft,
    Volume2,
    VolumeX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { liveStreamService } from '@/lib/api-services';
import {
    getSocket,
    emitJoinLiveStream,
    emitLeaveLiveStream,
    emitLiveComment,
    onLiveStreamEnded,
    onViewerCountUpdate,
    onLiveComment,
    offLiveStreamEnded,
    offViewerCountUpdate,
    offLiveComment,
    onLiveStreamOffer,
    emitLiveStreamAnswer,
    emitLiveStreamIceCandidate,
    offLiveStreamOffer,
    onLiveStreamIceCandidate,
    offLiveStreamIceCandidate,
} from '@/lib/socket';
import { LiveComment, LiveStream } from '@/types/live';
import { toast } from 'sonner';

export default function WatchLivePage() {
    const params = useParams();
    const router = useRouter();
    const streamId = params.streamId as string;

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

    const [stream, setStream] = useState<LiveStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [viewerCount, setViewerCount] = useState(0);
    const [comments, setComments] = useState<LiveComment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');

    // WebRTC Configuration
    const rtcConfig: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    // Fetch stream details
    const fetchStreamDetails = async () => {
        try {
            const response = await liveStreamService.getLiveStreamDetails(streamId);
            if (response.success && response.data) {
                setStream(response.data);
                setViewerCount(response.data.viewerCount || 0);
            } else {
                toast.error('Live stream not found');
                router.push('/live');
            }
        } catch (error) {
            console.error('Error fetching stream details:', error);
            toast.error('Failed to load live stream');
            router.push('/live');
        } finally {
            setLoading(false);
        }
    };

    // Join live stream
    const joinLiveStream = async () => {
        try {
            const response = await liveStreamService.joinLiveStream(streamId);
            if (response.success) {
                emitJoinLiveStream(streamId);
                setupPeerConnection();
            } else {
                toast.error(response.message || 'Failed to join live stream');
            }
        } catch (error: any) {
            console.error('Error joining live stream:', error);
            toast.error(error.message || 'Failed to join live stream');
        }
    };

    // Setup peer connection
    const setupPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection(rtcConfig);
        peerConnectionRef.current = pc;

        // Handle incoming tracks
        pc.ontrack = (event) => {
            const [stream] = event.streams;
            setRemoteStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                const socket = getSocket();
                const userId = socket?.id; // You might need to get actual user ID
                if (userId) {
                    emitLiveStreamIceCandidate(streamId, stream?.streamerId || '', event.candidate);
                }
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            setConnectionState(pc.connectionState);

            if (pc.connectionState === 'connected') {
                toast.success('Connected to live stream');
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                toast.error('Connection lost');
            }
        };

        // Handle ICE connection state
        pc.oniceconnectionstatechange = () => {
        };

        return pc;
    }, [streamId, stream]);

    // Handle offer from broadcaster
    const handleOffer = useCallback(async (data: any) => {
        const { offer, streamerId } = data;
        const pc = peerConnectionRef.current;

        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                emitLiveStreamAnswer(streamId, streamerId, answer);
            } catch (error) {
                console.error('Error handling offer:', error);
                toast.error('Failed to connect to stream');
            }
        }
    }, [streamId]);

    // Handle ICE candidate from broadcaster
    const handleIceCandidate = useCallback(async (data: any) => {
        const { candidate } = data;
        const pc = peerConnectionRef.current;

        if (pc && candidate) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }, []);

    // Send comment
    const sendComment = () => {
        if (commentText.trim()) {
            emitLiveComment(streamId, commentText.trim());
            setCommentText('');
        }
    };

    // Toggle mute
    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
        }
    };

    // Leave stream
    const leaveStream = () => {
        emitLeaveLiveStream(streamId);
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
        router.push('/live');
    };

    // Socket event handlers
    useEffect(() => {
        const handleStreamEndedEvent = () => {
            toast.info('Live stream has ended');
            router.push('/live');
        };

        const handleViewerCountUpdateEvent = (data: any) => {
            setViewerCount(data.count);
        };

        const handleCommentEvent = (data: LiveComment) => {
            setComments((prev) => [...prev, data]);
        };

        onLiveStreamEnded(handleStreamEndedEvent);
        onViewerCountUpdate(handleViewerCountUpdateEvent);
        onLiveComment(handleCommentEvent);
        onLiveStreamOffer(handleOffer);
        onLiveStreamIceCandidate(handleIceCandidate);

        return () => {
            offLiveStreamEnded(handleStreamEndedEvent);
            offViewerCountUpdate(handleViewerCountUpdateEvent);
            offLiveComment(handleCommentEvent);
            offLiveStreamOffer(handleOffer);
            offLiveStreamIceCandidate(handleIceCandidate);
        };
    }, [handleOffer, handleIceCandidate, router]);

    // Initialize
    useEffect(() => {
        fetchStreamDetails();
        joinLiveStream();

        return () => {
            // Cleanup
            emitLeaveLiveStream(streamId);
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
        };
    }, [streamId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-white" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="container mx-auto px-4 py-4 max-w-7xl">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-2rem)]">
                    {/* Video Section */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        {/* Video */}
                        <div className="relative flex-1 bg-gray-900 rounded-lg overflow-hidden">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />

                            {connectionState !== 'connected' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
                                    <div className="text-center">
                                        <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
                                        <p className="text-gray-400">Connecting to stream...</p>
                                    </div>
                                </div>
                            )}

                            {/* Live Badge */}
                            <div className="absolute top-4 left-4 bg-red-500 px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                                <Radio className="h-4 w-4" />
                                <span className="font-semibold">LIVE</span>
                            </div>

                            {/* Viewer Count */}
                            <div className="absolute top-4 right-4 bg-black/70 px-3 py-2 rounded-full flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span className="font-semibold">{viewerCount}</span>
                            </div>

                            {/* Back Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute bottom-4 left-4 bg-black/70 hover:bg-black/90"
                                onClick={leaveStream}
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>

                            {/* Mute Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/90"
                                onClick={toggleMute}
                            >
                                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                            </Button>
                        </div>

                        {/* Stream Info */}
                        <Card className="bg-gray-900 border-gray-800 p-4">
                            <div className="flex items-start gap-3">
                                {stream?.streamer?.profilePicture ? (
                                    <img
                                        src={stream.streamer.profilePicture}
                                        alt={stream.streamer.username || "User"}
                                        className="w-12 h-12 rounded-full"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                                )}
                                <div className="flex-1">
                                    <h2 className="font-bold text-lg">{stream?.title}</h2>
                                    <p className="text-gray-400 text-sm">{stream?.streamer?.fullName}</p>
                                    {stream?.description && (
                                        <p className="text-gray-300 text-sm mt-2">{stream.description}</p>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Chat Section */}
                    <div className="flex flex-col gap-4 h-full">
                        <Card className="flex-1 bg-gray-900 border-gray-800 flex flex-col">
                            <div className="p-4 border-b border-gray-800">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <MessageCircle className="h-5 w-5" />
                                    Live Chat
                                </h3>
                            </div>

                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-3">
                                    {comments.length === 0 ? (
                                        <p className="text-center text-gray-500 text-sm py-8">
                                            No comments yet. Be the first to comment!
                                        </p>
                                    ) : (
                                        comments.map((comment) => (
                                            <div key={comment._id} className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    {comment.user.profilePicture ? (
                                                        <img
                                                            src={comment.user.profilePicture}
                                                            alt={comment.user.username}
                                                            className="w-6 h-6 rounded-full"
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                                                    )}
                                                    <span className="font-semibold text-sm">
                                                        {comment.user.fullName}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-300 ml-8">{comment.text}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>

                            <div className="p-4 border-t border-gray-800">
                                <div className="flex gap-2">
                                    <Input
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Say something..."
                                        onKeyPress={(e) => e.key === 'Enter' && sendComment()}
                                        className="bg-gray-800 border-gray-700"
                                    />
                                    <Button
                                        onClick={sendComment}
                                        disabled={!commentText.trim()}
                                        size="icon"
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
