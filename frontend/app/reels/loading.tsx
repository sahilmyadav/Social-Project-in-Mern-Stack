'use client';

import { FullscreenReelSkeleton } from '@/components/skeletons';
import { Video } from 'lucide-react';

export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Sidebar Skeleton */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <div className="space-y-4 animate-pulse">
            {/* Logo skeleton */}
            <div className="h-10 w-32 bg-muted rounded-lg mb-8" />
            {/* Nav items skeleton */}
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        </aside>

        <section className="lg:col-span-2 max-w-2xl mx-auto pb-20 lg:pb-0">
          {/* Header */}
          <div className="bg-card rounded-2xl border border-border p-4 mb-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <Video className="w-6 h-6" />
              <h1 className="text-lg font-semibold">Reels</h1>
            </div>
          </div>

          {/* Reel Skeleton */}
          <div className="h-[calc(100vh-80px)] overflow-hidden">
            <FullscreenReelSkeleton />
          </div>
        </section>

        {/* Right Sidebar Skeleton */}
        <aside className="hidden lg:block lg:col-span-1 border-l border-border p-4 h-screen sticky top-0 overflow-y-auto">
          <div className="bg-card rounded-2xl border border-border p-4 mb-4 animate-pulse">
            <div className="h-6 w-40 bg-muted rounded mb-4" />
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex flex-col gap-1">
                      <div className="h-4 w-20 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted/70 rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-12 bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4 animate-pulse">
            <div className="h-6 w-36 bg-muted rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/50">
                  <div className="h-4 w-28 bg-muted rounded mb-1" />
                  <div className="h-3 w-16 bg-muted/70 rounded" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Navigation Skeleton */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border p-2">
        <div className="flex justify-around">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-10 h-10 rounded-full bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  );
}
