import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <div className="flex gap-4 items-center">
        <Skeleton className="h-20 w-20 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-40 rounded-[var(--radius)]" />
          <Skeleton className="h-4 w-64 rounded-[var(--radius)]" />
          <Skeleton className="h-4 w-32 rounded-[var(--radius)]" />
        </div>
      </div>
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-[var(--radius)]" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  );
}
