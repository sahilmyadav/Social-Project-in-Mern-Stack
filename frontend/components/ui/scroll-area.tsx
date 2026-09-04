'use client';

import * as React from 'react';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`relative overflow-auto ${className}`} {...props}>
        {children}
      </div>
    );
  }
);
ScrollArea.displayName = 'ScrollArea';

interface ScrollBarProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

const ScrollBar = React.forwardRef<HTMLDivElement, ScrollBarProps>(
  ({ className = '', orientation = 'vertical', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`${orientation === 'horizontal' ? 'h-2' : 'w-2'} ${className}`}
        {...props}
      />
    );
  }
);
ScrollBar.displayName = 'ScrollBar';

export { ScrollArea, ScrollBar };
