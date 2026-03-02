import { Skeleton } from '@/components/ui/skeleton';

export default function SupportLoading() {
  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <Skeleton className="h-9 w-36 rounded-[var(--radius)]" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-[var(--radius)]" />
        ))}
      </div>
      <div className="space-y-3 pt-2">
        <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        <Skeleton className="h-28 w-full rounded-[var(--radius)]" />
        <Skeleton className="h-10 w-32 rounded-[var(--radius)]" />
      </div>
    </div>
  );
}
