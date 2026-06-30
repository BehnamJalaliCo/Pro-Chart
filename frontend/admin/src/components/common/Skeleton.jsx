import React from 'react';

/**
 * Skeleton loaders — برای loading states.
 *
 * با احترام به prefers-reduced-motion: animation حذف می‌شود.
 */

export function SkeletonBox({ className = '' }) {
  return (
    <div
      className={`bg-surface-hover rounded motion-safe:animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

/**
 * TableSkeleton — برای DataTable در حال load.
 */
export function TableSkeleton({ columns = 5, rows = 5 }) {
  return (
    <div className="w-full" aria-label="در حال بارگذاری" role="status">
      {/* header */}
      <div className="flex gap-4 py-3 px-4 border-b border-surface-border">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBox key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-3 px-4 border-b border-surface-border/50">
          {Array.from({ length: columns }).map((_, c) => (
            <SkeletonBox key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * CardSkeleton — برای StatCard grid.
 */
export function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label="در حال بارگذاری" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
          <SkeletonBox className="h-3 w-1/2" />
          <SkeletonBox className="h-6 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/**
 * ChartSkeleton — placeholder برای recharts.
 */
export function ChartSkeleton({ height = 300 }) {
  return (
    <div
      className="w-full bg-surface-card border border-surface-border rounded-xl p-5"
      aria-label="در حال بارگذاری نمودار"
      role="status"
    >
      <SkeletonBox className="h-4 w-1/3 mb-4" />
      <SkeletonBox className="w-full" style={{ height }} />
    </div>
  );
}

export default SkeletonBox;
