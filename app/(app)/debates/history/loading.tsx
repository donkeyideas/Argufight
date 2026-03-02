import { Skeleton } from '@/components/ui/skeleton';

export default function DebatesHistoryLoading() {
  return (
    <div className="p-5 max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-9 w-48 rounded-[var(--radius)]" />
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  );
}
