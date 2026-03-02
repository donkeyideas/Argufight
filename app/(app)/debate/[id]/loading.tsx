import { Skeleton } from '@/components/ui/skeleton';

export default function DebateLoading() {
  return (
    <div className="flex flex-col h-full p-5 gap-4">
      <Skeleton className="h-16 w-full rounded-[var(--radius)]" />
      <div className="flex-1 flex gap-4">
        <div className="flex-1 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-[var(--radius)]" />
          ))}
        </div>
        <div className="w-64 space-y-3">
          <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
          <Skeleton className="h-24 w-full rounded-[var(--radius)]" />
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-[var(--radius)]" />
    </div>
  );
}
