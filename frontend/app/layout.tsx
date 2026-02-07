import { Providers } from '@/components/providers';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type React from 'react';
import { Toaster } from 'sonner';
import './globals.css';

const _geist = Geist({ subsets: ['latin'] });
const _geistMono = Geist_Mono({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ClickME - Social Media',
  description: 'Share your moments, connect with friends',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <Providers>{children}</Providers>
        <Toaster
          position="top-right"
          richColors
          expand={true}
          closeButton
          duration={4000}
          toastOptions={{
            style: {
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
              fontSize: '14px',
              fontWeight: '500',
            },
            classNames: {
              toast:
                'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
              error: '!bg-red-500 !text-white !border-red-600',
              success:
                '!bg-gradient-to-r !from-purple-600 !via-pink-500 !to-orange-400 !text-white !border-none',
              warning: '!bg-amber-500 !text-white !border-amber-600',
              info: '!bg-blue-500 !text-white !border-blue-600',
              loading: '!bg-gray-800 !text-white !border-gray-700',
              description: 'group-[.toast]:text-muted-foreground text-sm opacity-90',
              actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
              cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
              closeButton: 'group-[.toast]:bg-background/80 group-[.toast]:border-border',
            },
          }}
        />
      </body>
    </html>
  );
}
