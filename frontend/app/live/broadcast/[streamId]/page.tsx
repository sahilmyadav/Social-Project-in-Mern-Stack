'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { liveStreamService } from '@/lib/api-services';
import {
    emitEndLiveStream,
    emitLiveComment,
    emitLiveStreamIceCandidate,
    emitLiveStreamOffer,
    emitStartLiveStream,
    offLiveComment,
    offLiveStreamAnswer,
    offLiveStreamIceCandidate,
    offViewerCountUpdate,
    offViewerJoined,
    offViewerLeft,
    onLiveComment,
    onLiveStreamAnswer,
    onLiveStreamIceCandidate,
    onViewerCountUpdate,
    onViewerJoined,
    onViewerLeft
} from '@/lib/socket';
import { LiveComment, LiveViewer } from '@/types/live';
import {
    Loader2,
    MessageCircle,
    Mic,
    MicOff,
    Radio,
    Send,
    Users,
    Video,
    VideoOff,
    X
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function BroadcastPage() {
    const params = useParams();
    const router = useRouter();
    const streamId = params.streamId as string;

    const videoRef = useRef<HTMLVideoElement>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map());

    const [streamTitle, setStreamTitle] = useState('');
    const [streamDescription, setStreamDescription] = useState('');
    const [isLive, setIsLive] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [viewerCount, setViewerCount] = useState(0);
    const [viewers, setViewers] = useState<LiveViewer[]>([]);
    const [comments, setComments] = useState<LiveComment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [showViewers, setShowViewers] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // WebRTC Configuration
    const rtcConfig: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    // Fetch stream details
    const fetchStreamDetails = useCallback(async () => {
        try {
            const response = await liveStreamService.getLiveStreamDetails(streamId);
            if (response.success && response.data) {
                setStreamTitle(response.data.title);
                setStreamDescription(response.data.description || '');
                // Check if stream is already live (in case of page refresh)
                if (response.data.status === 'live') {
                    setIsLive(true);
                }
            } else {
                setError('Stream not found');
                toast.error('Stream not found');
                setTimeout(() => router.push('/live'), 2000);
            }
        } catch (error: any) {
            console.error('Error fetching stream details:', error);
            setError('Failed to load stream');
            toast.error('Failed to load stream');
        }
    }, [streamId, router]);

    // Initialize camera and microphone
    const initializeMedia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user',
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            setLocalStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Ensure video plays
                try {
                    await videoRef.current.play();
                } catch (playError) {
                    console.warn('Auto-play failed, user interaction may be needed:', playError);
                }
            }
            setLoading(false);
            toast.success('Camera ready! Click "Go Live" when ready to start.');
        } catch (error: any) {
            console.error('Error accessing media devices:', error);
            const errorMessage = error.name === 'NotAllowedError'
                ? 'Camera/microphone access denied. Please allow access and refresh.'
                : 'Failed to access camera/microphone. Please check your devices.';
            toast.error(errorMessage);
            setError(errorMessage);
            setLoading(false);
        }
    }, []);

    // Start live stream
    const startLiveStream = async () => {
        try {
            const response = await liveStreamService.startLiveStream(streamId);
            if (response.success) {
                setIsLive(true);
                emitStartLiveStream(streamId, response.data.title, response.data.description);
                toast.success('You are now live!');
            } else {
                toast.error(response.message || 'Failed to start live stream');
            }
        } catch (error: any) {
            console.error('Error starting live stream:', error);
            toast.error(error.message || 'Failed to start live stream');
        }
    };

    // End live stream
    const endLiveStream = async () => {
        try {
            const response = await liveStreamService.endLiveStream(streamId);
            if (response.success) {
                emitEndLiveStream(streamId);

                // Close all peer connections
                peerConnections.forEach((pc) => pc.close());
                setPeerConnections(new Map());

                // Stop local stream
                if (localStream) {
                    localStream.getTracks().forEach((track) => track.stop());
                }

                toast.success('Live stream ended');
                router.push('/live');
            } else {
                toast.error(response.message || 'Failed to end live stream');
            }
        } catch (error: any) {
            console.error('Error ending live stream:', error);
            toast.error(error.message || 'Failed to end live stream');
        }
    };

    // Create peer connection for a viewer
    const createPeerConnection = useCallback((viewerId: string) => {
        const pc = new RTCPeerConnection(rtcConfig);

        // Add local stream tracks to peer connection
        if (localStream) {
            localStream.getTracks().forEach((track) => {
                pc.addTrack(track, localStream);
            });
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                emitLiveStreamIceCandidate(streamId, viewerId, event.candidate);
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                pc.close();
                setPeerConnections((prev) => {
                    const newMap = new Map(prev);
                    newMap.delete(viewerId);
                    return newMap;
                });
            }
        };

        setPeerConnections((prev) => new Map(prev).set(viewerId, pc));
        return pc;
    }, [localStream, streamId]);

    // Handle viewer joined
    const handleViewerJoined = useCallback(async (data: any) => {
        const { viewerId } = data;

        const pc = createPeerConnection(viewerId);

        try {
            // Create and send offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            emitLiveStreamOffer(streamId, viewerId, offer);
        } catch (error) {
            console.error('Error creating offer for viewer:', error);
        }
    }, [createPeerConnection, streamId]);

    // Handle answer from viewer
    const handleAnswer = useCallback(async (data: any) => {
        const { viewerId, answer } = data;
        const pc = peerConnections.get(viewerId);

        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (error) {
                console.error('Error setting remote description:', error);
            }
        }
    }, [peerConnections]);

    // Handle ICE candidate from viewer
    const handleIceCandidate = useCallback(async (data: any) => {
        const { viewerId, candidate } = data;
        const pc = peerConnections.get(viewerId);

        if (pc && candidate) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }, [peerConnections]);

    // Toggle camera
    const toggleCamera = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOn(videoTrack.enabled);
            }
        }
    };

    // Toggle microphone
    const toggleMic = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicOn(audioTrack.enabled);
            }
        }
    };

    // Send comment
    const sendComment = () => {
        if (commentText.trim()) {
            emitLiveComment(streamId, commentText.trim());
            setCommentText('');
        }
    };

    // Socket event handlers
    useEffect(() => {
        const handleViewerJoinedEvent = (data: any) => {
            setViewerCount((prev) => prev + 1);
            handleViewerJoined(data);
        };

        const handleViewerLeftEvent = (data: any) => {
            setViewerCount((prev) => Math.max(0, prev - 1));
            const { viewerId } = data;
            const pc = peerConnections.get(viewerId);
            if (pc) {
                pc.close();
                setPeerConnections((prev) => {
                    const newMap = new Map(prev);
                    newMap.delete(viewerId);
                    return newMap;
                });
            }
        };

        const handleViewerCountUpdateEvent = (data: any) => {
            setViewerCount(data.count || data.viewerCount || 0);
        };

        const handleCommentEvent = (data: any) => {
            // Backend sends { streamId, comment: { _id, text, user: {...}, createdAt } }
            const commentData = data.comment || data;
            const formattedComment: LiveComment = {
                _id: commentData._id,
                liveStreamId: data.streamId || streamId,
                userId: commentData.user?._id || commentData.userId,
                user: {
                    _id: commentData.user?._id || '',
                    username: commentData.user?.username || '',
                    fullName: `${commentData.user?.firstName || ''} ${commentData.user?.lastName || ''}`.trim(),
                    profilePicture: commentData.user?.profilePicture || commentData.user?.avatar,
                },
                text: commentData.text,
                createdAt: new Date(commentData.createdAt),
            };
            setComments((prev) => [...prev, formattedComment]);
            // Auto-scroll to latest comment
            setTimeout(() => {
                commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        };

        onViewerJoined(handleViewerJoinedEvent);
        onViewerLeft(handleViewerLeftEvent);
        onViewerCountUpdate(handleViewerCountUpdateEvent);
        onLiveComment(handleCommentEvent);
        onLiveStreamAnswer(handleAnswer);
        onLiveStreamIceCandidate(handleIceCandidate);

        return () => {
            offViewerJoined(handleViewerJoinedEvent);
            offViewerLeft(handleViewerLeftEvent);
            offViewerCountUpdate(handleViewerCountUpdateEvent);
            offLiveComment(handleCommentEvent);
            offLiveStreamAnswer(handleAnswer);
            offLiveStreamIceCandidate(handleIceCandidate);
        };
    }, [handleViewerJoined, handleAnswer, handleIceCandidate, peerConnections]);

    // Initialize
    useEffect(() => {
        fetchStreamDetails();
        initializeMedia();

        return () => {
            // Cleanup - use refs to avoid stale closures
            if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
            }
            peerConnections.forEach((pc) => pc.close());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchStreamDetails, initializeMedia]);

    // Show error state
    if (error) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Error</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <Button onClick={() => router.push('/live')}>Go Back</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="container mx-auto px-4 py-4 max-w-7xl">
                {/* Stream Info Header */}
                {streamTitle && (
                    <div className="mb-4 p-4 bg-gray-900 rounded-lg">
                        <h1 className="text-xl font-bold">{streamTitle}</h1>
                        {streamDescription && (
                            <p className="text-gray-400 text-sm mt-1">{streamDescription}</p>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-10rem)]">
                    {/* Video Section */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        {/* Video */}
                        <div className="relative flex-1 bg-gray-900 rounded-lg overflow-hidden min-h-[300px] lg:min-h-[400px]">
                            {loading ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 className="h-12 w-12 animate-spin text-white" />
                                    <p className="text-gray-400 ml-3">Initializing camera...</p>
                                </div>
                            ) : (
                                <>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className={`w-full h-full object-cover ${!isCameraOn ? 'hidden' : ''}`}
                                        style={{ transform: 'scaleX(-1)' }}
                                    />
                                    {!isCameraOn && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                                            <VideoOff className="h-16 w-16 text-gray-500 mb-2" />
                                            <p className="text-gray-400">Camera is off</p>
                                        </div>
                                    )}
                                    {isLive && (
                                        <div className="absolute top-4 left-4 bg-red-500 px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                                            <Radio className="h-4 w-4" />
                                            <span className="font-semibold">LIVE</span>
                                        </div>
                                    )}
                                    {!isLive && localStream && (
                                        <div className="absolute top-4 left-4 bg-yellow-500/80 px-4 py-2 rounded-full flex items-center gap-2">
                                            <Radio className="h-4 w-4" />
                                            <span className="font-semibold">Preview</span>
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 bg-black/70 px-3 py-2 rounded-full flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        <span className="font-semibold">{viewerCount}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Controls */}
                        <Card className="bg-gray-900 border-gray-800 p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant={isCameraOn ? 'default' : 'destructive'}
                                        size="icon"
                                        onClick={toggleCamera}
                                        disabled={!localStream}
                                    >
                                        {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                                    </Button>
                                    <Button
                                        variant={isMicOn ? 'default' : 'destructive'}
                                        size="icon"
                                        onClick={toggleMic}
                                        disabled={!localStream}
                                    >
                                        {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                                    </Button>
                                </div>

                                <div className="flex items-center gap-3">
                                    {!isLive ? (
                                        <Button
                                            onClick={startLiveStream}
                                            disabled={loading || !localStream}
                                            className="bg-red-500 hover:bg-red-600 gap-2"
                                        >
                                            <Radio className="h-5 w-5" />
                                            Go Live
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => setShowEndConfirm(true)}
                                            variant="destructive"
                                            className="gap-2"
                                        >
                                            <X className="h-5 w-5" />
                                            End Stream
                                        </Button>
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
                                            No comments yet. Start the conversation!
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
                                    <div ref={commentsEndRef} />
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
                                        disabled={!isLive}
                                    />
                                    <Button
                                        onClick={sendComment}
                                        disabled={!commentText.trim() || !isLive}
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

            {/* End Stream Confirmation */}
            <ConfirmDialog
                isOpen={showEndConfirm}
                onClose={() => setShowEndConfirm(false)}
                onConfirm={endLiveStream}
                title="End Live Stream?"
                message="Are you sure you want to end this live stream? This action cannot be undone."
                confirmText="End Stream"
                cancelText="Continue Streaming"
                variant="danger"
            />
        </div>
    );
}
