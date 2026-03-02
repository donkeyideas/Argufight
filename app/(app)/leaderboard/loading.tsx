import { Skeleton } from '@/components/ui/skeleton';

export default function LeaderboardLoading() {
  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <Skeleton className="h-9 w-44 rounded-[var(--radius)]" />
      <div className="flex gap-3 justify-center">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28 w-28 rounded-[var(--radius)]" />
        ))}
      </div>
      <div className="space-y-2">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  );
}
