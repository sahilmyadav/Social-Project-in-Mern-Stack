'use client';


// Post/Reel Card Skeleton
export function PostSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-3 bg-muted rounded w-20" />
        </div>
      </div>
      {/* Media */}
      <div className="aspect-square bg-muted" />
      {/* Actions */}
      <div className="p-4 space-y-3">
        <div className="flex gap-4">
          <div className="h-6 w-6 bg-muted rounded" />
          <div className="h-6 w-6 bg-muted rounded" />
          <div className="h-6 w-6 bg-muted rounded" />
        </div>
        <div className="h-4 bg-muted rounded w-24" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-3/4" />
      </div>
    </div>
  );
}

// Reel Card Skeleton (vertical video aspect ratio)
export function ReelSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-3 bg-muted rounded w-16" />
        </div>
      </div>
      {/* Video */}
      <div className="aspect-[9/16] max-h-[500px] bg-muted relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-muted/50" />
        </div>
      </div>
      {/* Actions */}
      <div className="p-4 flex gap-4">
        <div className="h-6 w-16 bg-muted rounded" />
        <div className="h-6 w-16 bg-muted rounded" />
        <div className="h-6 w-16 bg-muted rounded" />
      </div>
    </div>
  );
}

// Fullscreen Reel Skeleton (for reels page)
export function FullscreenReelSkeleton() {
  return (
    <div className="snap-start snap-always h-[calc(100vh-80px)] flex items-center justify-center py-4">
      <div className="max-w-sm w-full mx-auto px-4">
        <div className="relative bg-muted rounded-2xl overflow-hidden aspect-[9/16] max-h-[75vh] mx-auto shadow-xl animate-pulse">
          {/* Background shimmer */}
          <div className="absolute inset-0 bg-gradient-to-b from-muted-foreground/10 to-muted-foreground/20" />

          {/* Mute button skeleton */}
          <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-muted-foreground/20" />

          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/40 to-transparent" />

          {/* User info skeleton */}
          <div className="absolute bottom-4 left-4 right-16 z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-muted-foreground/30" />
              <div className="flex flex-col gap-1">
                <div className="h-4 w-24 bg-muted-foreground/30 rounded" />
                <div className="h-3 w-16 bg-muted-foreground/20 rounded" />
              </div>
              <div className="ml-2 h-6 w-16 bg-muted-foreground/20 rounded" />
            </div>
            <div className="h-4 w-3/4 bg-muted-foreground/20 rounded mb-1" />
            <div className="h-4 w-1/2 bg-muted-foreground/20 rounded" />
          </div>

          {/* Action buttons skeleton */}
          <div className="absolute right-3 bottom-20 flex flex-col gap-4 z-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-muted-foreground/20" />
                <div className="h-3 w-8 bg-muted-foreground/20 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Story Bar Skeleton
export function StoriesBarSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 mb-6 overflow-hidden">
      <div className="flex gap-4 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-muted" />
            <div className="h-3 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Suggestion Card Skeleton
export function SuggestionSkeleton() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-24" />
        <div className="h-3 bg-muted rounded w-16" />
      </div>
      <div className="h-8 w-16 bg-muted rounded-full" />
    </div>
  );
}

// Feed Skeletons (multiple posts)
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {[...Array(count)].map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

// Full Page Loading Skeleton
export function HomePageSkeleton() {
  return (
    <div className="space-y-6">
      <StoriesBarSkeleton />
      <FeedSkeleton count={2} />
    </div>
  );
}

// Intersection Observer Hook for Lazy Loading
export function useInView(options?: IntersectionObserverInit) {
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, options);

    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, options]);

  return { ref: setRef, isInView };
}

// Import React hooks
import { useEffect, useState } from 'react';

// Lazy Load Wrapper Component
export function LazyLoad({
  children,
  placeholder,
  rootMargin = '100px'
}: {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  rootMargin?: string;
}) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const { ref, isInView } = useInView({ rootMargin, threshold: 0 });

  useEffect(() => {
    if (isInView && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [isInView, hasLoaded]);

  return (
    <div ref={ref as any}>
      {hasLoaded ? children : (placeholder || <PostSkeleton />)}
    </div>
  );
}

// Infinite Scroll Trigger
export function InfiniteScrollTrigger({
  onLoadMore,
  hasMore,
  isLoading
}: {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}) {
  const { ref, isInView } = useInView({ rootMargin: '200px' });

  useEffect(() => {
    if (isInView && hasMore && !isLoading) {
      onLoadMore();
    }
  }, [isInView, hasMore, isLoading, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref as any} className="py-8 flex justify-center">
      {isLoading && (
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      )}
    </div>
  );
}
