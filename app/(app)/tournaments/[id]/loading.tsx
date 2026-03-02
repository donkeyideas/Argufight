import { Skeleton } from '@/components/ui/skeleton';

export default function TournamentDetailLoading() {
  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5">
      <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[var(--radius)]" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-[var(--radius)]" />
          <Skeleton className="h-20 w-full rounded-[var(--radius)]" />
        </div>
      </div>
    </div>
  );
}
