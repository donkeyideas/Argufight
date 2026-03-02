import { Skeleton } from '@/components/ui/skeleton';

export default function DebatesSavedLoading() {
  return (
    <div className="p-5 max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-9 w-40 rounded-[var(--radius)]" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  );
}
