import { Skeleton } from '@/components/ui/skeleton';

export default function TrendingLoading() {
  return (
    <div className="p-5 max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-9 w-36 rounded-[var(--radius)]" />
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex gap-3 items-center">
            <Skeleton className="h-6 w-6 rounded-[var(--radius)] shrink-0" />
            <Skeleton className="h-14 w-full rounded-[var(--radius)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
