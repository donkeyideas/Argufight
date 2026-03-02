import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLoading() {
  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5">
      <Skeleton className="h-9 w-44 rounded-[var(--radius)]" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[var(--radius)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32 rounded-[var(--radius)]" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-[var(--radius)]" />
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-32 rounded-[var(--radius)]" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-[var(--radius)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
