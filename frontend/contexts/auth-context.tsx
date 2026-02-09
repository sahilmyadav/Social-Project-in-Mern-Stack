'use client';

import { clearTokens, getAccessToken, setTokens } from '@/lib/auth';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  email?: string;
  phone?: string;
  bio?: string;
  avatar?: string;
  profileImage?: string;
  coverPhoto?: string;
  isVerified?: boolean;
  profile_type?: string;
  isPrivate?: boolean;
  profileCompleted?: boolean;
  interests?: string[];
  [key: string]: unknown;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    try {
      const token = getAccessToken();
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;

      if (token && storedUser) {
        const parsed = JSON.parse(storedUser) as User;
        setState({ user: parsed, isAuthenticated: true, isLoading: false });
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const login = useCallback((user: User, accessToken: string, refreshToken: string) => {
    setTokens(accessToken, refreshToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setState((prev) => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, ...updates };
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(updated));
      }
      return { ...prev, user: updated };
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, updateUser }),
    [state, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
