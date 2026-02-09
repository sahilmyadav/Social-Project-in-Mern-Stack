'use client';

export function PostSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-3 bg-muted rounded w-20" />
        </div>
      </div>
      <div className="aspect-square bg-muted" />
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

export function ReelSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-3 bg-muted rounded w-16" />
        </div>
      </div>
      <div className="aspect-[9/16] max-h-[500px] bg-muted relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-muted/50" />
        </div>
      </div>
      <div className="p-4 flex gap-4">
        <div className="h-6 w-16 bg-muted rounded" />
        <div className="h-6 w-16 bg-muted rounded" />
        <div className="h-6 w-16 bg-muted rounded" />
      </div>
    </div>
  );
}

export function FullscreenReelSkeleton() {
  return (
    <div className="snap-start snap-always h-[calc(100vh-80px)] flex items-center justify-center py-4">
      <div className="max-w-sm w-full mx-auto px-4">
        <div className="relative bg-muted rounded-2xl overflow-hidden aspect-[9/16] max-h-[75vh] mx-auto shadow-xl animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-b from-muted-foreground/10 to-muted-foreground/20" />

          <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-muted-foreground/20" />

          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/40 to-transparent" />

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

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {[...Array(count)].map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="space-y-6">
      <StoriesBarSkeleton />
      <FeedSkeleton count={2} />
    </div>
  );
}

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

import { useEffect, useState } from 'react';

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
