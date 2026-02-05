import { API_CONFIG } from './api-config';

const BACKEND_URL = API_CONFIG.SOCKET_URL || 'http://localhost:3333';

export const getMediaUrl = (url: string | undefined | null): string => {
  if (!url) return '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (url.startsWith('/uploads')) {
    return `${BACKEND_URL}${url}`;
  }

  if (url.startsWith('uploads')) {
    return `${BACKEND_URL}/${url}`;
  }

  // Handle avatar filenames stored without path prefix
  if (
    url.startsWith('avatar_') ||
    url.startsWith('cover_') ||
    url.startsWith('post_') ||
    url.startsWith('reel_') ||
    url.startsWith('story_')
  ) {
    // Determine the subfolder based on the filename prefix
    if (url.startsWith('avatar_')) {
      return `${BACKEND_URL}/uploads/avatars/${url}`;
    }
    if (url.startsWith('cover_')) {
      return `${BACKEND_URL}/uploads/covers/${url}`;
    }
    if (url.startsWith('post_')) {
      return `${BACKEND_URL}/uploads/posts/${url}`;
    }
    if (url.startsWith('reel_')) {
      return `${BACKEND_URL}/uploads/reels/${url}`;
    }
    if (url.startsWith('story_')) {
      return `${BACKEND_URL}/uploads/stories/${url}`;
    }
  }

  return url;
};

export const getPostMediaUrl = (post: any): string => {
  const media = post?.media?.[0];
  if (!media) return post?.image || post?.file_url || '';

  return getMediaUrl(media.url || media.thumbnail);
};

export const getReelMediaUrl = (reel: any): string => {
  const media = reel?.media;
  if (!media) return '';

  return getMediaUrl(media.url);
};

export const getReelThumbnailUrl = (reel: any): string => {
  const media = reel?.media;
  if (!media) return '';

  return getMediaUrl(media.thumbnail || media.url);
};

export const getAvatarUrl = (user: any): string => {
  const avatar = user?.profileImage || user?.profilePicture || user?.avatar;
  if (!avatar) return '';

  return getMediaUrl(avatar);
};
