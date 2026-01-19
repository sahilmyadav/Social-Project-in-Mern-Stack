'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circular' | 'rectangular' | 'text';
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'default',
  animation = 'pulse',
  ...props
}: SkeletonProps) {
  const variants = {
    default: 'rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    text: 'rounded h-4 w-full',
  };

  const animations = {
    pulse: 'animate-pulse',
    wave: 'skeleton-wave',
    none: '',
  };

  return (
    <div
      className={cn('bg-muted/60', variants[variant], animations[animation], className)}
      {...props}
    />
  );
}

// Post Card Skeleton
export function PostCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <Skeleton variant="circular" className="w-10 h-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>

      {/* Image */}
      <Skeleton className="w-full aspect-square" />

      {/* Actions */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
          <div className="ml-auto">
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        </div>
        <Skeleton className="h-4 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}

// Story Skeleton
export function StorySkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      <Skeleton variant="circular" className="w-16 h-16 ring-2 ring-muted" />
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

// Stories Bar Skeleton
export function StoriesBarSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <StorySkeleton key={i} />
      ))}
    </div>
  );
}

// Profile Header Skeleton
export function ProfileHeaderSkeleton() {
  return (
    <div className="space-y-6">
      {/* Cover Photo */}
      <Skeleton className="w-full h-48 rounded-none" />

      {/* Profile Info */}
      <div className="px-6 -mt-16 relative">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-4">
          <Skeleton variant="circular" className="w-32 h-32 border-4 border-background" />
          <div className="flex-1 text-center md:text-left space-y-3">
            <Skeleton className="h-7 w-40 mx-auto md:mx-0" />
            <Skeleton className="h-4 w-24 mx-auto md:mx-0" />
          </div>
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>

        {/* Stats */}
        <div className="flex justify-center md:justify-start gap-8 mt-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="text-center space-y-1">
              <Skeleton className="h-6 w-10 mx-auto" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Comment Skeleton
export function CommentSkeleton() {
  return (
    <div className="flex gap-3 py-3">
      <Skeleton variant="circular" className="w-8 h-8 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

// Notification Skeleton
export function NotificationSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border">
      <Skeleton variant="circular" className="w-12 h-12" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-10 h-10 rounded-lg" />
    </div>
  );
}

// Chat List Skeleton
export function ChatListSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border">
      <Skeleton variant="circular" className="w-14 h-14" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-3 w-10 ml-auto" />
        <Skeleton variant="circular" className="w-5 h-5 ml-auto" />
      </div>
    </div>
  );
}

// Reel Card Skeleton
export function ReelCardSkeleton() {
  return (
    <div className="relative aspect-[9/16] bg-muted rounded-xl overflow-hidden">
      <Skeleton className="absolute inset-0" />
      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" className="w-10 h-10" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="absolute right-3 bottom-24 space-y-4">
        <Skeleton variant="circular" className="w-10 h-10" />
        <Skeleton variant="circular" className="w-10 h-10" />
        <Skeleton variant="circular" className="w-10 h-10" />
      </div>
    </div>
  );
}

// User Card Skeleton
export function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton variant="circular" className="w-12 h-12" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-9 w-20 rounded-lg" />
    </div>
  );
}
