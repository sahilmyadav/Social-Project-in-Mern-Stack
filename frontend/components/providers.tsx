'use client';

import { AuthProvider } from '@/contexts/auth-context';
import { CallProvider } from '@/contexts/call-context';
import { VideoProvider } from '@/contexts/video-context';
import GlobalCallHandler from './global-call-handler';
import GlobalSocketHandler from './global-socket-handler';
import { ThemeProvider } from './theme-provider';
import VersionChecker from './version-checker';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <CallProvider>
          <VideoProvider>
            <GlobalSocketHandler />
            <GlobalCallHandler />
            <VersionChecker />
            {children}
          </VideoProvider>
        </CallProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
