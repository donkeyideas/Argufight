import { Skeleton } from '@/components/ui/skeleton';

export default function TournamentsLoading() {
  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5">
      <Skeleton className="h-9 w-44 rounded-[var(--radius)]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  );
}
