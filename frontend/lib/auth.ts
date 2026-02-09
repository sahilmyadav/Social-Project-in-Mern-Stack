/**
 * Centralized auth utilities — single source of truth for token management.
 * Import this instead of duplicating refresh logic across api-client, socket, etc.
 */
import { API_CONFIG } from './api-config';
import logger from './logger';

const isBrowser = typeof window !== 'undefined';

export function getAccessToken(): string | null {
  return isBrowser ? localStorage.getItem('accessToken') : null;
}

export function getRefreshTokenValue(): string | null {
  return isBrowser ? localStorage.getItem('refreshToken') : null;
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  if (!isBrowser) return;
  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

export function clearTokens(): void {
  if (!isBrowser) return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

export function decodeJwtPayload(token: string): { exp: number; _id: string } | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * Returns true if the token is expired or will expire within `bufferMs` milliseconds.
 * Default buffer: 5 minutes (proactive refresh).
 */
export function isTokenExpiring(token: string, bufferMs = 5 * 60 * 1000): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000 - bufferMs;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresh the access token using the stored refresh token.
 * De-duplicates concurrent calls (e.g., api-client + socket both trigger at once).
 * Returns the new access token, or null on failure.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = _doRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function _doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshTokenValue();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/users/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const newAccess: string = data.data?.accessToken;
    const newRefresh: string | undefined = data.data?.refreshToken;

    if (newAccess) {
      setTokens(newAccess, newRefresh);
      return newAccess;
    }
    return null;
  } catch (err) {
    return null;
  }
}

export function redirectToLogin(): void {
  clearTokens();
  if (isBrowser) {
    window.location.href = '/login';
  }
}
