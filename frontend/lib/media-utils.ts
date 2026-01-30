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
