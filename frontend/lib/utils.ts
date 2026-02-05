import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Backend URL for static files (images, uploads, etc.)
const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3333';

/**
 * Get the full URL for an image/upload path
 * Converts relative paths like /uploads/avatars/... to full backend URLs
 */
export function getImageUrl(path: string | null | undefined): string {
  if (!path) return '';

  // If already a full URL (http/https or data URI), return as-is
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }

  // If it's a relative path starting with /, prepend backend URL
  if (path.startsWith('/')) {
    return `${BACKEND_URL}${path}`;
  }

  // Otherwise, assume it needs the backend URL
  return `${BACKEND_URL}/${path}`;
}
