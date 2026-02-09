'use client';

import PostDetailsModal from '@/components/post-details-modal';
import UserAvatar from '@/components/user-avatar';
import { getMediaUrl } from '@/lib/media-utils';
import { Eye, Heart, MessageCircle, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SharedContentPreviewProps {
  messageType: 'shared_post' | 'shared_reel';
  contentData: {
    _id: string;
    caption?: string;
    media?: any;
    user: {
      _id: string;
      firstName: string;
      lastName?: string;
      username: string;
      profilePicture?: string;
      avatar?: string;
    };
    likes_count?: number;
    comments_count?: number;
    views_count?: number;
  };
}

export default function SharedContentPreview({
  messageType,
  contentData,
}: SharedContentPreviewProps) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  if (!contentData) {
    return (
      <div className="mt-2 p-3 border border-border rounded-lg bg-muted/50 text-muted-foreground text-sm">
        Content no longer available
      </div>
    );
  }

  const rawMediaUrl = contentData.media?.[0]?.url || contentData.media?.url;
  const rawThumbnailUrl = contentData.media?.[0]?.thumbnail || rawMediaUrl;
  const mediaUrl = getMediaUrl(rawMediaUrl);
  const thumbnailUrl = getMediaUrl(rawThumbnailUrl);
  const isVideo = contentData.media?.[0]?.type === 'video' || messageType === 'shared_reel';

  const handleClick = () => {
    if (messageType === 'shared_reel') {
      router.push(`/reel/${contentData._id}`);
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        className="mt-2 border border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary/50 transition max-w-sm"
      >
        {mediaUrl && (
          <div className="relative aspect-square bg-muted">
            {isVideo ? (
              <>
                <video
                  src={mediaUrl}
                  poster={thumbnailUrl}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <Play size={20} className="text-black ml-1" fill="black" />
                  </div>
                </div>
              </>
            ) : (
              <img src={mediaUrl} alt="Shared content" className="w-full h-full object-cover" />
            )}
          </div>
        )}

        <div className="p-3 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <UserAvatar user={contentData.user} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {contentData.user.firstName} {contentData.user.lastName || ''}
              </p>
              <p className="text-xs text-muted-foreground truncate">@{contentData.user.username}</p>
            </div>
          </div>

          {contentData.caption && (
            <p className="text-sm text-foreground line-clamp-2 mb-2">{contentData.caption}</p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart size={14} />
              {contentData.likes_count || 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={14} />
              {contentData.comments_count || 0}
            </span>
            {messageType === 'shared_reel' && (
              <span className="flex items-center gap-1">
                <Eye size={14} />
                {contentData.views_count || 0}
              </span>
            )}
          </div>

          <div className="mt-2 text-xs text-primary font-medium">
            Tap to view {messageType === 'shared_post' ? 'post' : 'reel'}
          </div>
        </div>
      </div>

      {showModal && messageType === 'shared_post' && (
        <PostDetailsModal
          post={{
            ...contentData,
            user_id: contentData.user,
          }}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
