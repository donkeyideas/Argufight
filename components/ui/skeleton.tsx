import { cn } from '@/lib/cn';

interface SkeletonProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  rounded?: boolean;
}

export function Skeleton({ className, width, height, rounded = false }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', rounded && 'rounded-full', className)}
      style={{
        width:  width  !== undefined ? (typeof width  === 'number' ? `${width}px`  : width)  : undefined,
        height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
      }}
    />
  );
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          className={cn(i === lines - 1 && lines > 1 && 'w-3/4')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-surface border border-border rounded-[var(--radius)] p-4 space-y-3', className)}>
      <div className="flex items-center gap-3">
        <Skeleton width={36} height={36} rounded />
        <div className="flex-1 space-y-2">
          <Skeleton height={12} width="60%" />
          <Skeleton height={10} width="40%" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}
