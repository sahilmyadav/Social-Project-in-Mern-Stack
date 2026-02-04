'use client'

import { VideoProvider } from '@/contexts/video-context'
import GlobalCallHandler from './global-call-handler'
import GlobalSocketHandler from './global-socket-handler'
import { ThemeProvider } from './theme-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <VideoProvider>
        <GlobalSocketHandler />
        <GlobalCallHandler />
        {children}
      </VideoProvider>
    </ThemeProvider>
  )
}
