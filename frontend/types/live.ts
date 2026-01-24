export interface LiveStream {
    _id: string;
    streamerId: string;
    streamer: {
        _id: string;
        username: string;
        fullName: string;
        profilePicture?: string;
        isVerified?: boolean;
    };
    title: string;
    description?: string;
    thumbnail?: string;
    status: 'waiting' | 'live' | 'ended';
    viewerCount: number;
    startedAt?: Date;
    endedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface LiveComment {
    _id: string;
    liveStreamId: string;
    userId: string;
    user: {
        _id: string;
        username: string;
        fullName: string;
        profilePicture?: string;
        isVerified?: boolean;
    };
    text: string;
    createdAt: Date;
}

export interface LiveViewer {
    userId: string;
    username: string;
    fullName: string;
    profilePicture?: string;
    joinedAt: Date;
}
