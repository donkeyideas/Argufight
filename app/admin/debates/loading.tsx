import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDebatesLoading() {
  return (
    <div className="p-5 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-36 rounded-[var(--radius)]" />
        <Skeleton className="h-9 w-48 rounded-[var(--radius)]" />
      </div>
      <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
      <div className="space-y-2">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  );
}
