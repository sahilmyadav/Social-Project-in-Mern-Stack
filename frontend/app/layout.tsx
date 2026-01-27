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
  generator: 'v0.app',
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
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <Providers>{children}</Providers>
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            style: {
              background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 50%, #f97316 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 10px 40px rgba(147, 51, 234, 0.3)',
            },
            classNames: {
              error: 'bg-red-500 text-white',
              success: 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white',
              warning: 'bg-amber-500 text-white',
              info: 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white',
            },
          }}
        />
      </body>
    </html>
  );
}
